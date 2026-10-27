use std::collections::HashSet;

use tagtree::{TagTree, normalize_paths};
use time::OffsetDateTime;

use super::DataManager;
use crate::data::{
    Db, Memo, MemoCreate, MemoDb, MemoId, MemoRef, MemoSearchPage, MemoSearchQuery,
    MemoSearchRequest, MemoUpdate, MemoView, RefIndex, Stats, TreeMeta, UserDb,
};
use crate::error::{WeimoError, WeimoResult};

fn own_refs(refs: &[MemoRef]) -> Vec<MemoId> {
    refs.iter().map(|memo_ref| memo_ref.0).collect()
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
}

impl MemoManager {
    pub(super) fn new(username: &str) -> Self {
        Self {
            username: username.to_string(),
            tag_tree: TagTree::new(),
            max_id: 0,
            ref_index: RefIndex::default(),
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
        let mut max_id = 0;
        for id in &ids {
            let memo = db.get_memo(username, id).await?;
            tag_tree.set_tags(memo.id(), memo.tags())?;
            ref_index.record_created(*memo.id(), memo.create_t_utc(), &own_refs(memo.refs()));
            if *memo.id() > max_id {
                max_id = *memo.id();
            }
        }

        Ok(Self {
            username: username.to_string(),
            tag_tree,
            max_id,
            ref_index,
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
        Ok(())
    }

    pub(super) fn record_deleted(&mut self, memo: &Memo) {
        self.tag_tree.remove_item(memo.id());
        self.ref_index.record_deleted(*memo.id());
    }

    pub(super) fn record_updated(&mut self, memo: &Memo) -> WeimoResult<()> {
        self.tag_tree.set_tags(memo.id(), memo.tags())?;
        self.ref_index
            .record_updated(*memo.id(), &own_refs(memo.refs()));
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
    pub async fn create_memo(&self, username: &str, info: MemoCreate) -> WeimoResult<Memo> {
        let manager = self.memo_manager(username).await?;
        let mut manager = manager.write().await;
        let next_id = manager.next_memo_id();
        let now = OffsetDateTime::now_utc();
        let validated = validate_refs(None, now, &own_refs(&info.refs), &manager.ref_index)?;
        let tags = normalize_paths(&info.tags).map_err(tagtree::Error::from)?;
        let info = MemoCreate {
            refs: validated.into_iter().map(MemoRef).collect(),
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
                let deleted_ref = MemoRef(*id);
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
            let validated = validate_refs(
                Some(*current.id()),
                current.create_t_utc(),
                &own_refs(new_refs),
                &manager.ref_index,
            )?;
            MemoUpdate {
                refs: Some(validated.into_iter().map(MemoRef).collect()),
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

    fn build_view(manager: &MemoManager, memo: Memo) -> MemoView {
        let referenced_by = manager
            .ref_index
            .get_referenced_by(*memo.id())
            .into_iter()
            .map(|id| id.to_string())
            .collect::<Vec<_>>();
        MemoView::from_memo(&memo, referenced_by)
    }

    pub async fn get_memo_view(&self, username: &str, id: &MemoId) -> WeimoResult<MemoView> {
        let manager = self.memo_manager(username).await?;
        let memo = self.db.read().await.get_memo(username, id).await?;
        let manager = manager.read().await;
        Ok(Self::build_view(&manager, memo))
    }

    pub async fn get_memo_views(
        &self,
        username: &str,
        ids: &[MemoId],
    ) -> WeimoResult<Vec<MemoView>> {
        let manager = self.memo_manager(username).await?;
        let manager = manager.read().await;
        let memos = self
            .db
            .read()
            .await
            .get_memos(&manager.username, ids)
            .await?;
        Ok(memos.into_iter().map(|memo| Self::build_view(&manager, memo)).collect())
    }

    pub async fn search_memo_page(
        &self,
        username: &str,
        request: &MemoSearchRequest,
    ) -> WeimoResult<MemoSearchPage> {
        let manager = self.memo_manager(username).await?;
        let candidates = {
            let manager = manager.read().await;
            manager.candidate_ids(&request.query)?
        };

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
            .map(|memo| Self::build_view(&manager_guard, memo))
            .collect();

        Ok(MemoSearchPage {
            items,
            next_cursor: slice.next_cursor,
            has_more: slice.has_more,
            total_count: slice.total_count,
        })
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
