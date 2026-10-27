use std::collections::HashSet;

use tagtree::{TagTree, normalize_paths};
use time::OffsetDateTime;
use tokio::sync::OwnedRwLockReadGuard;

use super::DataManager;
use crate::data::{
    CrossRefIndex, Db, FriendMemoSearchPage, FriendMemoSearchRequest, FriendMemoView, Memo,
    MemoCreate, MemoDb, MemoId, MemoRef, MemoSearchPage, MemoSearchQuery, MemoSearchRequest,
    MemoUpdate, MemoView, RefIndex, Stats, TreeMeta, UserDb,
};
use crate::error::{WeimoError, WeimoResult};

fn own_refs(refs: &[MemoRef]) -> Vec<MemoId> {
    refs.iter().filter_map(MemoRef::own_id).collect()
}

fn friend_refs_targeting_user(refs: &[MemoRef], username: &str) -> Vec<String> {
    refs.iter()
        .filter_map(|memo_ref| {
            let (target_username, memo_id) = memo_ref.friend_target()?;
            (target_username == username).then(|| memo_id.to_string())
        })
        .collect()
}

pub(super) fn validate_refs(
    self_id: Option<MemoId>,
    self_ct: OffsetDateTime,
    refs: &[MemoId],
    ref_index: &RefIndex,
) -> WeimoResult<Vec<MemoId>> {
    let mut seen = HashSet::new();
    let mut deduped = Vec::with_capacity(refs.len());
    for memo_ref in refs {
        if seen.insert(*memo_ref) {
            deduped.push(*memo_ref);
        }
    }

    for memo_ref in &deduped {
        if Some(*memo_ref) == self_id {
            return Err(WeimoError::InvalidRefs("不能自引用".to_string()));
        }
        if !ref_index.contains(*memo_ref) {
            return Err(WeimoError::InvalidRefs(format!(
                "引用了不存在的笔记 {memo_ref}"
            )));
        }
        let target_ct = ref_index
            .ct_of(*memo_ref)
            .expect("contains 已通过，ct 必存在");
        if target_ct >= self_ct {
            return Err(WeimoError::InvalidRefs(format!(
                "被引用笔记 {memo_ref} 的创建时间不早于本笔记"
            )));
        }
    }

    Ok(deduped)
}

#[derive(Debug)]
pub(super) struct MemoManager {
    pub(super) username: String,
    pub(super) tag_tree: TagTree<MemoId>,
    pub(super) max_id: MemoId,
    pub(super) ref_index: RefIndex,
    pub(super) cross_ref_index: CrossRefIndex,
}

impl MemoManager {
    pub(super) fn new(username: &str) -> Self {
        Self {
            username: username.to_string(),
            tag_tree: TagTree::new(),
            max_id: 0,
            ref_index: RefIndex::default(),
            cross_ref_index: CrossRefIndex::default(),
        }
    }

    pub(super) async fn build<U: UserDb, M: MemoDb>(
        username: &str,
        db: &Db<U, M>,
    ) -> WeimoResult<Self> {
        let ids = db.get_memo_ids(username).await;
        tracing::info!("用户 {}: {} 条笔记", username, ids.len());

        let mut tag_tree = TagTree::new();
        let mut ref_index = RefIndex::default();
        let mut cross_ref_index = CrossRefIndex::default();
        let mut max_id = 0;
        for id in &ids {
            let memo = db.get_memo(username, id).await?;
            tag_tree.set_tags(memo.id(), memo.tags())?;
            ref_index.record_created(*memo.id(), memo.create_t_utc(), &own_refs(memo.refs()));
            cross_ref_index.record_created(*memo.id(), memo.refs());
            if *memo.id() > max_id {
                max_id = *memo.id();
            }
        }

        Ok(Self {
            username: username.to_string(),
            tag_tree,
            max_id,
            ref_index,
            cross_ref_index,
        })
    }

    pub(super) fn next_memo_id(&self) -> MemoId {
        self.max_id.saturating_add(1)
    }

    pub(super) fn record_created(&mut self, memo: &Memo) -> WeimoResult<()> {
        self.max_id = *memo.id();
        self.tag_tree.set_tags(memo.id(), memo.tags())?;
        self.ref_index
            .record_created(*memo.id(), memo.create_t_utc(), &own_refs(memo.refs()));
        self.cross_ref_index.record_created(*memo.id(), memo.refs());
        Ok(())
    }

    pub(super) fn record_deleted(&mut self, memo: &Memo) {
        self.tag_tree.remove_item(memo.id());
        self.ref_index.record_deleted(*memo.id());
        self.cross_ref_index.record_deleted(*memo.id());
    }

    pub(super) fn record_updated(&mut self, memo: &Memo) -> WeimoResult<()> {
        self.tag_tree.set_tags(memo.id(), memo.tags())?;
        self.ref_index
            .record_updated(*memo.id(), &own_refs(memo.refs()));
        self.cross_ref_index.record_updated(*memo.id(), memo.refs());
        Ok(())
    }

    pub(super) fn candidate_ids(
        &self,
        query: &MemoSearchQuery,
    ) -> WeimoResult<Option<Vec<MemoId>>> {
        let tag_ids = match query.tag.as_deref().filter(|tag| !tag.is_empty()) {
            Some(tag) => Some(
                self.tag_tree
                    .items_under(tag)?
                    .into_iter()
                    .collect::<HashSet<_>>(),
            ),
            None => None,
        };

        let annotation_ids = match query.has_annotation {
            Some(true) => Some(self.ref_index.annotated_memo_ids()),
            _ => None,
        };

        let result = match (tag_ids, annotation_ids) {
            (None, None) => None,
            (Some(a), None) => Some(a),
            (None, Some(b)) => Some(b),
            (Some(a), Some(b)) => Some(a.intersection(&b).copied().collect()),
        };

        Ok(result.map(|set| set.into_iter().collect()))
    }

    pub(super) fn get_tags_meta(&self) -> TreeMeta {
        let summary = self.tag_tree.summary();
        let mut meta = TreeMeta::from(summary.root);
        meta.untagged_count = summary.untagged_item_count;
        meta
    }
}

impl<U: UserDb, M: MemoDb> DataManager<U, M> {
    async fn existing_friend_contexts(
        &self,
        username: &str,
    ) -> Vec<(String, OwnedRwLockReadGuard<MemoManager>)> {
        let friend_usernames = self.existing_friend_usernames(username).await;
        let mut contexts = Vec::with_capacity(friend_usernames.len());
        for friend_username in friend_usernames {
            if let Ok(friend_manager) = self.memo_manager(&friend_username).await {
                contexts.push((friend_username, friend_manager.read_owned().await));
            }
        }
        contexts
    }

    async fn validate_memo_refs(
        &self,
        username: &str,
        self_id: Option<MemoId>,
        self_ct: OffsetDateTime,
        refs: &[MemoRef],
        ref_index: &RefIndex,
    ) -> WeimoResult<Vec<MemoRef>> {
        let mut seen = HashSet::<String>::new();
        let mut deduped = Vec::with_capacity(refs.len());
        for memo_ref in refs {
            let key = memo_ref.to_string();
            if seen.insert(key) {
                deduped.push(memo_ref.clone());
            }
        }

        let own = validate_refs(self_id, self_ct, &own_refs(&deduped), ref_index)?;
        let mut own_iter = own.into_iter();
        let has_friend_ref = deduped
            .iter()
            .any(|memo_ref| memo_ref.friend_target().is_some());
        let friend_usernames = if has_friend_ref {
            let social = self.social.social.read().await;
            Self::friend_usernames_for(social.document(), username)
        } else {
            Vec::new()
        };

        for memo_ref in &deduped {
            if let Some((target_username, memo_id)) = memo_ref.friend_target() {
                if !friend_usernames
                    .iter()
                    .any(|friend| friend == target_username)
                {
                    return Err(WeimoError::InvalidRefs("好友笔记不可引用".to_string()));
                }
                self.db
                    .read()
                    .await
                    .get_memo(target_username, &memo_id)
                    .await
                    .map_err(|_| WeimoError::InvalidRefs("好友笔记不可引用".to_string()))?;
            }
        }

        Ok(deduped
            .into_iter()
            .map(|memo_ref| match memo_ref {
                MemoRef::Own(_) => MemoRef::Own(own_iter.next().expect("own refs length matches")),
                friend @ MemoRef::Friend { .. } => friend,
            })
            .collect())
    }

    pub async fn create_memo(&self, username: &str, info: MemoCreate) -> WeimoResult<Memo> {
        let manager = self.memo_manager(username).await?;
        let mut manager = manager.write().await;
        let next_id = manager.next_memo_id();
        let now = OffsetDateTime::now_utc();
        let validated = self
            .validate_memo_refs(username, None, now, &info.refs, &manager.ref_index)
            .await?;
        let tags = normalize_paths(&info.tags).map_err(tagtree::Error::from)?;
        let info = MemoCreate {
            refs: validated,
            tags,
            ..info
        };
        let memo = {
            let mut db = self.db.write().await;
            db.create_memo(&manager.username, info, next_id).await?
        };
        manager.record_created(&memo)?;
        Ok(memo)
    }

    pub async fn delete_memo(&self, username: &str, id: &MemoId) -> WeimoResult<Memo> {
        let manager = self.memo_manager(username).await?;
        let mut manager = manager.write().await;
        let referrers = manager.ref_index.get_referenced_by(*id);

        let memo = {
            let mut db = self.db.write().await;
            for referrer_id in &referrers {
                let referrer = db.get_memo(&manager.username, referrer_id).await?;
                let deleted_ref = MemoRef::Own(*id);
                let new_refs = referrer
                    .refs()
                    .iter()
                    .filter(|memo_ref| **memo_ref != deleted_ref)
                    .cloned()
                    .collect();
                let updated = db
                    .update_memo(
                        &manager.username,
                        referrer_id,
                        MemoUpdate {
                            content: None,
                            tags: None,
                            refs: Some(new_refs),
                        },
                    )
                    .await?;
                manager.record_updated(&updated)?;
            }
            db.delete_memo(&manager.username, id).await?
        };
        manager.record_deleted(&memo);
        Ok(memo)
    }

    pub async fn update_memo(
        &self,
        username: &str,
        id: &MemoId,
        info: MemoUpdate,
    ) -> WeimoResult<Memo> {
        let manager = self.memo_manager(username).await?;
        let mut manager = manager.write().await;

        let info = MemoUpdate {
            tags: info
                .tags
                .as_deref()
                .map(|tags| normalize_paths(tags).map_err(tagtree::Error::from))
                .transpose()?,
            ..info
        };

        let info = if let Some(new_refs) = info.refs.as_deref() {
            let current = self.db.read().await.get_memo(&manager.username, id).await?;
            let validated = self
                .validate_memo_refs(
                    username,
                    Some(*current.id()),
                    current.create_t_utc(),
                    new_refs,
                    &manager.ref_index,
                )
                .await?;
            MemoUpdate {
                refs: Some(validated),
                ..info
            }
        } else {
            info
        };

        let memo = {
            let mut db = self.db.write().await;
            db.update_memo(&manager.username, id, info).await?
        };
        manager.record_updated(&memo)?;
        Ok(memo)
    }

    #[cfg(test)]
    pub async fn get_memo(&self, username: &str, id: &MemoId) -> WeimoResult<Memo> {
        let manager = self.memo_manager(username).await?;
        let manager = manager.read().await;
        self.db.read().await.get_memo(&manager.username, id).await
    }

    fn build_view(
        manager: &MemoManager,
        friend_contexts: &[(String, OwnedRwLockReadGuard<MemoManager>)],
        memo: Memo,
    ) -> MemoView {
        let mut referenced_by = manager
            .ref_index
            .get_referenced_by(*memo.id())
            .into_iter()
            .map(|id| id.to_string())
            .collect::<Vec<_>>();
        for (friend_username, friend_manager) in friend_contexts {
            referenced_by.extend(
                friend_manager
                    .cross_ref_index
                    .get_referenced_by(&manager.username, *memo.id())
                    .into_iter()
                    .map(|id| format!("{friend_username}/{id}")),
            );
        }
        MemoView::from_memo(&memo, referenced_by)
    }

    pub async fn get_memo_view(&self, username: &str, id: &MemoId) -> WeimoResult<MemoView> {
        let manager = self.memo_manager(username).await?;
        let friend_contexts = self.existing_friend_contexts(username).await;
        let memo = self.db.read().await.get_memo(username, id).await?;
        let manager = manager.read().await;
        Ok(Self::build_view(&manager, &friend_contexts, memo))
    }

    pub async fn get_memo_views(
        &self,
        username: &str,
        ids: &[MemoId],
    ) -> WeimoResult<Vec<MemoView>> {
        let manager = self.memo_manager(username).await?;
        let friend_contexts = self.existing_friend_contexts(username).await;
        let manager = manager.read().await;
        let memos = self
            .db
            .read()
            .await
            .get_memos(&manager.username, ids)
            .await?;
        Ok(memos
            .into_iter()
            .map(|memo| Self::build_view(&manager, &friend_contexts, memo))
            .collect())
    }

    pub async fn search_memo_page(
        &self,
        username: &str,
        request: &MemoSearchRequest,
    ) -> WeimoResult<MemoSearchPage> {
        let manager = self.memo_manager(username).await?;
        let mut candidates = {
            let manager = manager.read().await;
            manager.candidate_ids(&request.query)?
        };
        let friend_contexts = self.existing_friend_contexts(username).await;
        if request.query.has_annotation == Some(true) {
            for (friend_username, _) in &friend_contexts {
                let annotation_ids = {
                    let manager = manager.read().await;
                    manager
                        .cross_ref_index
                        .get_referrer_ids_for_target_user(friend_username)
                };
                match candidates.as_mut() {
                    Some(candidates) => candidates.extend(annotation_ids),
                    None => candidates = Some(annotation_ids),
                }
            }
            for (_, friend_manager) in &friend_contexts {
                let annotated_by_friend = friend_manager
                    .cross_ref_index
                    .get_referenced_memo_ids(username);
                match candidates.as_mut() {
                    Some(candidates) => candidates.extend(annotated_by_friend),
                    None => candidates = Some(annotated_by_friend),
                }
            }
            if let Some(candidates) = candidates.as_mut() {
                candidates.sort_unstable();
                candidates.dedup();
            }
        }

        let (slice, memos) = {
            let db = self.db.read().await;
            let hits = db
                .search_memo_hits(username, &request.query, candidates.as_deref())
                .await?;
            let slice = request.paginate_hits(hits)?;
            let memos = db.get_memos(username, &slice.ids).await?;
            (slice, memos)
        };

        let manager_guard = manager.read().await;
        let items = memos
            .into_iter()
            .map(|memo| Self::build_view(&manager_guard, &friend_contexts, memo))
            .collect();

        Ok(MemoSearchPage {
            items,
            next_cursor: slice.next_cursor,
            has_more: slice.has_more,
            total_count: slice.total_count,
        })
    }

    pub async fn search_friend_memo_page(
        &self,
        username: &str,
        friend_username: &str,
        request: &FriendMemoSearchRequest,
    ) -> WeimoResult<FriendMemoSearchPage> {
        request.validate()?;
        self.ensure_existing_friend(username, friend_username)
            .await?;
        let caller_manager = self.memo_manager(username).await?;
        let friend_manager = self.memo_manager(friend_username).await?;
        let mut candidates = {
            let friend_manager = friend_manager.read().await;
            friend_manager.candidate_ids(&request.query)?
        };
        if request.query.has_annotation == Some(true) {
            let annotated_by_caller = {
                let caller_manager = caller_manager.read().await;
                caller_manager
                    .cross_ref_index
                    .get_referenced_memo_ids(friend_username)
            };
            match candidates.as_mut() {
                Some(candidates) => candidates.extend(annotated_by_caller),
                None => candidates = Some(annotated_by_caller),
            }
            if let Some(candidates) = candidates.as_mut() {
                candidates.sort_unstable();
                candidates.dedup();
            }
        }
        let (slice, memos) = {
            let db = self.db.read().await;
            let hits = db
                .search_memo_hits(friend_username, &request.query, candidates.as_deref())
                .await?;
            let slice = request.paginate_hits(hits)?;
            let memos = db.get_memos(friend_username, &slice.ids).await?;
            (slice, memos)
        };

        let caller_manager = caller_manager.read().await;
        let items = memos
            .into_iter()
            .map(|memo| {
                let refs = friend_refs_targeting_user(memo.refs(), username);
                let referenced_by = caller_manager
                    .cross_ref_index
                    .get_referenced_by(friend_username, *memo.id())
                    .into_iter()
                    .map(|id| id.to_string())
                    .collect();
                FriendMemoView::from_friend_memo(&memo, refs, referenced_by)
            })
            .collect();

        Ok(FriendMemoSearchPage {
            items,
            next_cursor: slice.next_cursor,
            has_more: slice.has_more,
            total_count: slice.total_count,
        })
    }

    pub async fn get_friend_memo_view(
        &self,
        username: &str,
        friend_username: &str,
        id: &MemoId,
    ) -> WeimoResult<FriendMemoView> {
        self.ensure_existing_friend(username, friend_username)
            .await?;
        let caller_manager = self.memo_manager(username).await?;
        let memo = self.db.read().await.get_memo(friend_username, id).await?;
        let caller_manager = caller_manager.read().await;
        let referenced_by = caller_manager
            .cross_ref_index
            .get_referenced_by(friend_username, *memo.id())
            .into_iter()
            .map(|id| id.to_string())
            .collect();
        let refs = friend_refs_targeting_user(memo.refs(), username);
        Ok(FriendMemoView::from_friend_memo(&memo, refs, referenced_by))
    }

    pub async fn get_friend_stats(
        &self,
        username: &str,
        friend_username: &str,
    ) -> WeimoResult<Stats> {
        self.ensure_existing_friend(username, friend_username)
            .await?;
        self.get_stats(friend_username).await
    }

    pub async fn get_friend_tags_meta(
        &self,
        username: &str,
        friend_username: &str,
    ) -> WeimoResult<TreeMeta> {
        self.ensure_existing_friend(username, friend_username)
            .await?;
        self.get_tags_meta(friend_username).await
    }

    pub async fn update_tag(
        &self,
        username: &str,
        old_tag: &str,
        new_tag: &str,
    ) -> WeimoResult<()> {
        let manager = self.memo_manager(username).await?;
        let mut manager = manager.write().await;
        let assignments = manager.tag_tree.move_subtree(old_tag, new_tag)?;
        let mut db = self.db.write().await;
        for assignment in assignments {
            db.update_memo(
                &manager.username,
                &assignment.item,
                MemoUpdate {
                    tags: Some(assignment.tags),
                    content: None,
                    refs: None,
                },
            )
            .await?;
        }
        Ok(())
    }

    pub async fn delete_tag(&self, username: &str, tag: &str) -> WeimoResult<()> {
        let manager = self.memo_manager(username).await?;
        let mut manager = manager.write().await;
        let assignments = manager.tag_tree.remove_subtree(tag)?;
        let mut db = self.db.write().await;
        for assignment in assignments {
            db.update_memo(
                &manager.username,
                &assignment.item,
                MemoUpdate {
                    tags: Some(assignment.tags),
                    content: None,
                    refs: None,
                },
            )
            .await?;
        }
        Ok(())
    }

    pub async fn get_stats(&self, username: &str) -> WeimoResult<Stats> {
        let manager = self.memo_manager(username).await?;
        let manager = manager.read().await;
        let db = self.db.read().await;
        Ok(Stats::build(&manager.username, &manager.tag_tree, &db).await)
    }

    pub async fn get_tags_meta(&self, username: &str) -> WeimoResult<TreeMeta> {
        let manager = self.memo_manager(username).await?;
        Ok(manager.read().await.get_tags_meta())
    }
}
