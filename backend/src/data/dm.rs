mod memos;
mod social;
mod users;

use std::collections::HashMap;
use std::sync::Arc;

use tokio::sync::RwLock;

use self::memos::MemoManager;
use self::social::SocialManager;
use crate::data::{Db, JsonSocial, MemoDb, UserDb};
use crate::error::{WeimoError, WeimoResult};

/// Biji 数据层 facade。领域实现保持私有，调用方不直接获取底层锁。
///
/// 锁纪律：`memo_managers` 只用于克隆用户 manager；Memo 写路径先持有用户
/// manager，再获取 `db`；social 与 `db` 不同时持有。
#[derive(Debug, Clone)]
pub struct DataManager<U: UserDb, M: MemoDb> {
    db: Arc<RwLock<Db<U, M>>>,
    memo_managers: Arc<RwLock<HashMap<String, Arc<RwLock<MemoManager>>>>>,
    social: SocialManager,
}

impl<U: UserDb, M: MemoDb> DataManager<U, M> {
    pub async fn new_with_social(db: Db<U, M>, social: JsonSocial) -> WeimoResult<Self> {
        let mut memo_managers = HashMap::new();
        for user in db.get_all_users().await {
            memo_managers.insert(
                user.clone(),
                Arc::new(RwLock::new(MemoManager::build(&user, &db).await?)),
            );
        }
        tracing::info!("已加载 {} 个用户", memo_managers.len());
        Ok(Self {
            db: Arc::new(RwLock::new(db)),
            memo_managers: Arc::new(RwLock::new(memo_managers)),
            social: SocialManager::new(social),
        })
    }

    async fn memo_manager(&self, username: &str) -> WeimoResult<Arc<RwLock<MemoManager>>> {
        self.memo_managers
            .read()
            .await
            .get(username)
            .cloned()
            .ok_or_else(|| WeimoError::UserNotFound(username.to_string()))
    }
}

#[cfg(test)]
mod tests {
    use super::memos::validate_refs;
    use super::*;
    use crate::data::*;
    use async_trait::async_trait;
    use std::collections::HashMap;
    use std::sync::{
        Arc,
        atomic::{AtomicBool, Ordering},
    };
    use tempfile::tempdir;
    use time::{OffsetDateTime, format_description::well_known::Rfc3339};
    use tokio::sync::{Mutex, oneshot};

    fn ts(s: &str) -> OffsetDateTime {
        OffsetDateTime::parse(s, &Rfc3339).unwrap()
    }

    fn idx_with(items: &[(MemoId, &str)]) -> RefIndex {
        let mut idx = RefIndex::default();
        for (id, t) in items {
            idx.record_created(*id, ts(t), &[]);
        }
        idx
    }

    async fn setup_social_manager() -> (tempfile::TempDir, DataManager<JsonUsers, MdMemos>) {
        let dir = tempdir().unwrap();
        let mut db = MdDb::new(dir.path()).await;
        for (username, nickname) in [("alice", "Alice"), ("bob", "Bob"), ("carol", "Carol")] {
            db.create_user(UserCreate {
                username: username.to_string(),
                password: "secret".to_string(),
                nickname: Some(nickname.to_string()),
            })
            .await
            .unwrap();
        }
        let social = JsonSocial::new(dir.path().join("social.json")).await;
        let manager = DataManager::new_with_social(db, social).await.unwrap();
        (dir, manager)
    }

    async fn pair_alice_and_bob(manager: &DataManager<JsonUsers, MdMemos>) {
        let request = manager.create_friend_request("alice", "bob").await.unwrap();
        manager
            .accept_friend_request("bob", &request.id)
            .await
            .unwrap();
    }

    #[tokio::test]
    async fn social_request_writes_pending_request_and_notification() {
        let (_dir, manager) = setup_social_manager().await;

        let request = manager.create_friend_request("alice", "bob").await.unwrap();
        let bob_notifications = manager.get_friend_notifications("bob").await.unwrap();

        assert_eq!(request.from, "alice");
        assert_eq!(request.to, "bob");
        assert_eq!(request.status, FriendRequestStatus::Pending);
        assert_eq!(bob_notifications.items.len(), 1);
        assert_eq!(
            bob_notifications.items[0].kind,
            SocialNotificationKind::FriendRequest
        );
        assert_eq!(
            manager
                .get_friend_unread_count("bob")
                .await
                .unwrap()
                .unread_count,
            1
        );
    }

    #[tokio::test]
    async fn social_request_blocks_second_pending_for_either_user() {
        let (_dir, manager) = setup_social_manager().await;

        manager.create_friend_request("alice", "bob").await.unwrap();

        let reverse = manager
            .create_friend_request("bob", "alice")
            .await
            .unwrap_err();
        let third_party = manager
            .create_friend_request("carol", "bob")
            .await
            .unwrap_err();

        assert!(matches!(
            reverse,
            WeimoError::FriendConflict(FriendConflictCode::PendingExists)
        ));
        assert!(matches!(
            third_party,
            WeimoError::FriendConflict(FriendConflictCode::PendingExists)
        ));
    }

    #[tokio::test]
    async fn social_request_blocks_second_friend_when_current_user_reaches_limit() {
        let (_dir, manager) = setup_social_manager().await;
        pair_alice_and_bob(&manager).await;

        let err = manager
            .create_friend_request("alice", "carol")
            .await
            .unwrap_err();

        assert!(matches!(
            err,
            WeimoError::FriendConflict(FriendConflictCode::AlreadyPaired)
        ));
    }

    #[tokio::test]
    async fn social_accept_expires_when_requester_reaches_friend_limit_before_acceptance() {
        let (_dir, manager) = setup_social_manager().await;
        let request = manager.create_friend_request("alice", "bob").await.unwrap();

        {
            let mut social = manager.social.social.write().await;
            social.document_mut().friendships.push(Friendship {
                id: SocialManager::next_id("friendship"),
                user_a: "alice".to_string(),
                user_b: "carol".to_string(),
                created_at: SocialManager::now(),
            });
            social.save().await.unwrap();
        }

        let err = manager
            .accept_friend_request("bob", &request.id)
            .await
            .unwrap_err();

        assert!(matches!(
            err,
            WeimoError::FriendConflict(FriendConflictCode::RequestExpired)
        ));
    }

    #[tokio::test]
    async fn social_accepting_request_creates_friendship_and_success_notification() {
        let (_dir, manager) = setup_social_manager().await;
        let request = manager.create_friend_request("alice", "bob").await.unwrap();

        let summary = manager
            .accept_friend_request("bob", &request.id)
            .await
            .unwrap();
        let alice_notifications = manager.get_friend_notifications("alice").await.unwrap();

        assert_eq!(summary.friends.len(), 1);
        assert!(
            summary
                .friends
                .iter()
                .any(|friend| friend.username == "alice")
        );
        assert_eq!(
            alice_notifications.items[0].kind,
            SocialNotificationKind::FriendAccepted
        );
        let alice_summary = manager.get_friend_summary("alice").await.unwrap();
        assert_eq!(alice_summary.friends.len(), 1);
        assert!(
            alice_summary
                .friends
                .iter()
                .any(|friend| friend.username == "bob")
        );
        let bob_summary = manager.get_friend_summary("bob").await.unwrap();
        assert_eq!(bob_summary.friends.len(), 1);
        assert!(
            bob_summary
                .friends
                .iter()
                .any(|friend| friend.username == "alice")
        );
    }

    #[tokio::test]
    async fn friend_summary_returns_list_shaped_fields() {
        let (_dir, manager) = setup_social_manager().await;
        let request = manager.create_friend_request("alice", "bob").await.unwrap();

        let bob_summary = manager
            .accept_friend_request("bob", &request.id)
            .await
            .unwrap();
        let alice_summary = manager.get_friend_summary("alice").await.unwrap();

        assert_eq!(bob_summary.friends.len(), 1);
        assert!(
            bob_summary
                .friends
                .iter()
                .any(|friend| friend.username == "alice")
        );
        assert_eq!(bob_summary.pending_outgoing.len(), 0);
        assert_eq!(alice_summary.friends.len(), 1);
        assert!(
            alice_summary
                .friends
                .iter()
                .any(|friend| friend.username == "bob")
        );
    }

    #[tokio::test]
    async fn social_mark_notifications_read_clears_only_current_user_unread_count() {
        let (_dir, manager) = setup_social_manager().await;
        manager.create_friend_request("alice", "bob").await.unwrap();

        manager.mark_friend_notifications_read("bob").await.unwrap();

        assert_eq!(
            manager
                .get_friend_unread_count("bob")
                .await
                .unwrap()
                .unread_count,
            0
        );
        assert_eq!(
            manager
                .get_friend_unread_count("alice")
                .await
                .unwrap()
                .unread_count,
            0
        );
    }

    #[tokio::test]
    async fn social_deleted_requester_notification_is_safe_to_render() {
        let (_dir, manager) = setup_social_manager().await;
        manager.create_friend_request("alice", "bob").await.unwrap();

        manager.delete_user("alice").await.unwrap();
        let notifications = manager.get_friend_notifications("bob").await.unwrap();

        assert_eq!(notifications.items.len(), 1);
        assert_eq!(
            notifications.items[0].from.as_ref().unwrap().nickname,
            "用户已注销"
        );
        assert!(notifications.items[0].from.as_ref().unwrap().deleted);
        assert!(!notifications.items[0].request.as_ref().unwrap().can_accept);
    }

    #[tokio::test]
    async fn create_memo_can_reference_target_friend_memo() {
        let (_dir, manager) = setup_social_manager().await;
        pair_alice_and_bob(&manager).await;
        let bob_memo = manager
            .create_memo(
                "bob",
                MemoCreate {
                    content: "Bob memo".to_string(),
                    tags: vec!["friend".to_string()],
                    refs: vec![],
                },
            )
            .await
            .unwrap();

        let alice_memo = manager
            .create_memo(
                "alice",
                MemoCreate {
                    content: "Alice annotation".to_string(),
                    tags: vec!["无".to_string()],
                    refs: vec![MemoRef::Friend {
                        username: "bob".to_string(),
                        memo_id: *bob_memo.id(),
                    }],
                },
            )
            .await
            .unwrap();

        assert_eq!(alice_memo.refs()[0].to_string(), "bob/1");
    }

    #[tokio::test]
    async fn create_memo_rejects_non_friend_ref_with_invalid_refs() {
        let (_dir, manager) = setup_social_manager().await;
        let bob_memo = manager
            .create_memo(
                "bob",
                MemoCreate {
                    content: "Bob memo".to_string(),
                    tags: vec![],
                    refs: vec![],
                },
            )
            .await
            .unwrap();

        let err = manager
            .create_memo(
                "alice",
                MemoCreate {
                    content: "Alice annotation".to_string(),
                    tags: vec![],
                    refs: vec![MemoRef::Friend {
                        username: "bob".to_string(),
                        memo_id: *bob_memo.id(),
                    }],
                },
            )
            .await
            .unwrap_err();

        assert!(matches!(err, WeimoError::InvalidRefs(_)));
    }

    #[tokio::test]
    async fn create_memo_rejects_friend_ref_when_ref_owner_is_not_a_friend() {
        let (_dir, manager) = setup_social_manager().await;
        pair_alice_and_bob(&manager).await;
        let carol_memo = manager
            .create_memo(
                "carol",
                MemoCreate {
                    content: "Carol private".to_string(),
                    tags: vec![],
                    refs: vec![],
                },
            )
            .await
            .unwrap();

        let err = manager
            .create_memo(
                "alice",
                MemoCreate {
                    content: "Bad ref".to_string(),
                    tags: vec![],
                    refs: vec![MemoRef::Friend {
                        username: "carol".to_string(),
                        memo_id: *carol_memo.id(),
                    }],
                },
            )
            .await
            .unwrap_err();

        assert!(matches!(err, WeimoError::InvalidRefs(_)));
    }

    #[tokio::test]
    async fn updating_friend_refs_updates_cross_ref_index() {
        let (_dir, manager) = setup_social_manager().await;
        pair_alice_and_bob(&manager).await;
        let first = manager
            .create_memo(
                "bob",
                MemoCreate {
                    content: "first".to_string(),
                    tags: vec![],
                    refs: vec![],
                },
            )
            .await
            .unwrap();
        let second = manager
            .create_memo(
                "bob",
                MemoCreate {
                    content: "second".to_string(),
                    tags: vec![],
                    refs: vec![],
                },
            )
            .await
            .unwrap();
        let alice = manager
            .create_memo(
                "alice",
                MemoCreate {
                    content: "annotation".to_string(),
                    tags: vec![],
                    refs: vec![MemoRef::Friend {
                        username: "bob".to_string(),
                        memo_id: *first.id(),
                    }],
                },
            )
            .await
            .unwrap();

        manager
            .update_memo(
                "alice",
                alice.id(),
                MemoUpdate {
                    content: None,
                    tags: None,
                    refs: Some(vec![MemoRef::Friend {
                        username: "bob".to_string(),
                        memo_id: *second.id(),
                    }]),
                },
            )
            .await
            .unwrap();

        let alice_manager = manager.memo_manager("alice").await.unwrap();
        let alice_manager = alice_manager.read().await;
        assert!(
            alice_manager
                .cross_ref_index
                .get_referenced_by("bob", *first.id())
                .is_empty()
        );
        assert_eq!(
            alice_manager
                .cross_ref_index
                .get_referenced_by("bob", *second.id()),
            vec![*alice.id()]
        );
    }

    #[tokio::test]
    async fn deleting_friend_user_preserves_saved_cross_ref_string() {
        let (_dir, manager) = setup_social_manager().await;
        pair_alice_and_bob(&manager).await;
        let bob_memo = manager
            .create_memo(
                "bob",
                MemoCreate {
                    content: "Bob memo".to_string(),
                    tags: vec![],
                    refs: vec![],
                },
            )
            .await
            .unwrap();
        let alice_memo = manager
            .create_memo(
                "alice",
                MemoCreate {
                    content: "Alice annotation".to_string(),
                    tags: vec![],
                    refs: vec![MemoRef::Friend {
                        username: "bob".to_string(),
                        memo_id: *bob_memo.id(),
                    }],
                },
            )
            .await
            .unwrap();

        manager.delete_user("bob").await.unwrap();
        let reloaded = manager.get_memo("alice", alice_memo.id()).await.unwrap();

        assert_eq!(reloaded.refs()[0].to_string(), "bob/1");
    }

    #[tokio::test]
    async fn friend_memo_search_returns_target_friend_full_list() {
        let (_dir, manager) = setup_social_manager().await;
        pair_alice_and_bob(&manager).await;
        manager
            .create_memo(
                "bob",
                MemoCreate {
                    content: "older".to_string(),
                    tags: vec![],
                    refs: vec![],
                },
            )
            .await
            .unwrap();
        manager
            .create_memo(
                "bob",
                MemoCreate {
                    content: "newer".to_string(),
                    tags: vec![],
                    refs: vec![],
                },
            )
            .await
            .unwrap();

        let page = manager
            .search_friend_memo_page(
                "alice",
                "bob",
                &FriendMemoSearchRequest {
                    page_size: Some(8),
                    cursor: None,
                    ..FriendMemoSearchRequest::default()
                },
            )
            .await
            .unwrap();

        assert_eq!(page.total_count, 2);
        assert_eq!(
            page.items
                .iter()
                .map(|view| view.content.as_str())
                .collect::<Vec<_>>(),
            vec!["newer", "older"]
        );
    }

    #[tokio::test]
    async fn friend_sidebar_stats_and_tags_use_target_friend_workspace() {
        let (_dir, manager) = setup_social_manager().await;
        pair_alice_and_bob(&manager).await;
        manager
            .create_memo(
                "alice",
                MemoCreate {
                    content: "Alice private".to_string(),
                    tags: vec!["self".to_string()],
                    refs: vec![],
                },
            )
            .await
            .unwrap();
        manager
            .create_memo(
                "bob",
                MemoCreate {
                    content: "Bob tagged memo".to_string(),
                    tags: vec!["friend".to_string()],
                    refs: vec![],
                },
            )
            .await
            .unwrap();

        let stats = manager.get_friend_stats("alice", "bob").await.unwrap();
        let tag_meta = manager.get_friend_tags_meta("alice", "bob").await.unwrap();

        assert_eq!(stats.note_count, 1);
        assert_eq!(stats.tag_count, 1);
        assert_eq!(tag_meta.item_count, 1);
        assert_eq!(tag_meta.children[0].label, "friend");
    }

    #[tokio::test]
    async fn friend_sidebar_stats_requires_explicit_friend_username() {
        let (_dir, manager) = setup_social_manager().await;
        pair_alice_and_bob(&manager).await;
        manager
            .create_memo(
                "bob",
                MemoCreate {
                    content: "Bob memo".to_string(),
                    tags: vec!["friend".to_string()],
                    refs: vec![],
                },
            )
            .await
            .unwrap();

        let stats = manager.get_friend_stats("alice", "bob").await.unwrap();
        let tag_meta = manager.get_friend_tags_meta("alice", "bob").await.unwrap();

        assert_eq!(stats.note_count, 1);
        assert_eq!(tag_meta.item_count, 1);
    }

    #[tokio::test]
    async fn friend_memo_search_filters_by_target_friend_tag() {
        let (_dir, manager) = setup_social_manager().await;
        pair_alice_and_bob(&manager).await;
        manager
            .create_memo(
                "bob",
                MemoCreate {
                    content: "Bob work memo".to_string(),
                    tags: vec!["work/rust".to_string()],
                    refs: vec![],
                },
            )
            .await
            .unwrap();
        manager
            .create_memo(
                "bob",
                MemoCreate {
                    content: "Bob life memo".to_string(),
                    tags: vec!["life".to_string()],
                    refs: vec![],
                },
            )
            .await
            .unwrap();

        let page = manager
            .search_friend_memo_page(
                "alice",
                "bob",
                &FriendMemoSearchRequest {
                    query: MemoSearchQuery {
                        tag: Some("work".to_string()),
                        ..MemoSearchQuery::default()
                    },
                    page_size: Some(8),
                    cursor: None,
                },
            )
            .await
            .unwrap();

        assert_eq!(page.total_count, 1);
        assert_eq!(page.items[0].content, "Bob work memo");
    }

    #[tokio::test]
    async fn friend_memo_search_filters_by_has_annotation() {
        let (_dir, manager) = setup_social_manager().await;
        pair_alice_and_bob(&manager).await;
        let bob_source = manager
            .create_memo(
                "bob",
                MemoCreate {
                    content: "Bob source".to_string(),
                    tags: vec![],
                    refs: vec![],
                },
            )
            .await
            .unwrap();
        manager
            .create_memo(
                "bob",
                MemoCreate {
                    content: "Bob plain".to_string(),
                    tags: vec![],
                    refs: vec![],
                },
            )
            .await
            .unwrap();
        manager
            .create_memo(
                "bob",
                MemoCreate {
                    content: "Bob annotation".to_string(),
                    tags: vec![],
                    refs: vec![MemoRef::Own(*bob_source.id())],
                },
            )
            .await
            .unwrap();

        let page = manager
            .search_friend_memo_page(
                "alice",
                "bob",
                &FriendMemoSearchRequest {
                    query: MemoSearchQuery {
                        has_annotation: Some(true),
                        ..MemoSearchQuery::default()
                    },
                    page_size: Some(8),
                    cursor: None,
                },
            )
            .await
            .unwrap();

        assert_eq!(page.total_count, 2);
        assert_eq!(
            page.items
                .iter()
                .map(|view| view.content.as_str())
                .collect::<Vec<_>>(),
            vec!["Bob annotation", "Bob source"]
        );
    }

    #[tokio::test]
    async fn friend_memo_search_has_annotation_includes_current_user_annotations() {
        let (_dir, manager) = setup_social_manager().await;
        pair_alice_and_bob(&manager).await;
        let bob_plain = manager
            .create_memo(
                "bob",
                MemoCreate {
                    content: "Bob plain".to_string(),
                    tags: vec![],
                    refs: vec![],
                },
            )
            .await
            .unwrap();
        manager
            .create_memo(
                "bob",
                MemoCreate {
                    content: "Bob unrelated".to_string(),
                    tags: vec![],
                    refs: vec![],
                },
            )
            .await
            .unwrap();
        let alice_annotation = manager
            .create_memo(
                "alice",
                MemoCreate {
                    content: "Alice annotation".to_string(),
                    tags: vec![],
                    refs: vec![MemoRef::Friend {
                        username: "bob".to_string(),
                        memo_id: *bob_plain.id(),
                    }],
                },
            )
            .await
            .unwrap();

        let page = manager
            .search_friend_memo_page(
                "alice",
                "bob",
                &FriendMemoSearchRequest {
                    query: MemoSearchQuery {
                        has_annotation: Some(true),
                        ..MemoSearchQuery::default()
                    },
                    page_size: Some(8),
                    cursor: None,
                },
            )
            .await
            .unwrap();

        assert_eq!(page.total_count, 1);
        assert_eq!(page.items[0].id, *bob_plain.id());
        assert_eq!(
            page.items[0].referenced_by,
            vec![alice_annotation.id().to_string()]
        );
    }

    #[tokio::test]
    async fn friend_memo_search_filters_by_target_friend_created_day() {
        let (_dir, manager) = setup_social_manager().await;
        pair_alice_and_bob(&manager).await;
        let bob_memo = manager
            .create_memo(
                "bob",
                MemoCreate {
                    content: "Bob today memo".to_string(),
                    tags: vec![],
                    refs: vec![],
                },
            )
            .await
            .unwrap();
        let created = bob_memo.create_t();

        let matching_page = manager
            .search_friend_memo_page(
                "alice",
                "bob",
                &FriendMemoSearchRequest {
                    query: MemoSearchQuery {
                        created_at: Some(MemoDateFilter::Day {
                            year: created.year(),
                            month: u8::from(created.month()),
                            day: created.day(),
                        }),
                        ..MemoSearchQuery::default()
                    },
                    page_size: Some(8),
                    cursor: None,
                },
            )
            .await
            .unwrap();
        let old_page = manager
            .search_friend_memo_page(
                "alice",
                "bob",
                &FriendMemoSearchRequest {
                    query: MemoSearchQuery {
                        created_at: Some(MemoDateFilter::Day {
                            year: 1999,
                            month: 1,
                            day: 1,
                        }),
                        ..MemoSearchQuery::default()
                    },
                    page_size: Some(8),
                    cursor: None,
                },
            )
            .await
            .unwrap();

        assert_eq!(matching_page.total_count, 1);
        assert_eq!(matching_page.items[0].content, "Bob today memo");
        assert_eq!(old_page.total_count, 0);
    }

    #[tokio::test]
    async fn friend_sidebar_data_without_any_friend_returns_no_friends_yet() {
        let (_dir, manager) = setup_social_manager().await;

        let stats_err = manager.get_friend_stats("alice", "bob").await.unwrap_err();
        let tags_err = manager
            .get_friend_tags_meta("alice", "bob")
            .await
            .unwrap_err();

        assert!(matches!(
            stats_err,
            WeimoError::FriendConflict(FriendConflictCode::NoFriendsYet)
        ));
        assert!(matches!(
            tags_err,
            WeimoError::FriendConflict(FriendConflictCode::NoFriendsYet)
        ));
    }

    #[tokio::test]
    async fn friend_sidebar_data_for_non_friend_returns_not_your_friend() {
        let (_dir, manager) = setup_social_manager().await;
        pair_alice_and_bob(&manager).await;

        let stats_err = manager
            .get_friend_stats("alice", "carol")
            .await
            .unwrap_err();
        let tags_err = manager
            .get_friend_tags_meta("alice", "carol")
            .await
            .unwrap_err();

        assert!(matches!(
            stats_err,
            WeimoError::FriendConflict(FriendConflictCode::NotYourFriend)
        ));
        assert!(matches!(
            tags_err,
            WeimoError::FriendConflict(FriendConflictCode::NotYourFriend)
        ));
    }

    #[tokio::test]
    async fn friend_memo_detail_returns_only_current_user_annotations() {
        let (_dir, manager) = setup_social_manager().await;
        pair_alice_and_bob(&manager).await;
        let bob_memo = manager
            .create_memo(
                "bob",
                MemoCreate {
                    content: "target".to_string(),
                    tags: vec![],
                    refs: vec![],
                },
            )
            .await
            .unwrap();
        let alice_note = manager
            .create_memo(
                "alice",
                MemoCreate {
                    content: "annotation".to_string(),
                    tags: vec![],
                    refs: vec![MemoRef::Friend {
                        username: "bob".to_string(),
                        memo_id: *bob_memo.id(),
                    }],
                },
            )
            .await
            .unwrap();

        let detail = manager
            .get_friend_memo_view("alice", "bob", bob_memo.id())
            .await
            .unwrap();

        assert_eq!(detail.id, *bob_memo.id());
        assert_eq!(detail.content, "target");
        assert_eq!(detail.referenced_by, vec![alice_note.id().to_string()]);
        let json = serde_json::to_value(detail).unwrap();
        assert!(json.get("refs").is_none());
    }

    #[tokio::test]
    async fn friend_memo_search_returns_only_refs_targeting_current_user() {
        let (_dir, manager) = setup_social_manager().await;
        pair_alice_and_bob(&manager).await;
        let alice_memo = manager
            .create_memo(
                "alice",
                MemoCreate {
                    content: "Alice original".to_string(),
                    tags: vec![],
                    refs: vec![],
                },
            )
            .await
            .unwrap();
        let bob_private_memo = manager
            .create_memo(
                "bob",
                MemoCreate {
                    content: "Bob private source".to_string(),
                    tags: vec![],
                    refs: vec![],
                },
            )
            .await
            .unwrap();
        let bob_annotation = manager
            .create_memo(
                "bob",
                MemoCreate {
                    content: "Bob annotation".to_string(),
                    tags: vec![],
                    refs: vec![
                        MemoRef::Friend {
                            username: "alice".to_string(),
                            memo_id: *alice_memo.id(),
                        },
                        MemoRef::Own(*bob_private_memo.id()),
                    ],
                },
            )
            .await
            .unwrap();

        let page = manager
            .search_friend_memo_page(
                "alice",
                "bob",
                &FriendMemoSearchRequest {
                    page_size: Some(8),
                    cursor: None,
                    ..FriendMemoSearchRequest::default()
                },
            )
            .await
            .unwrap();

        let view = page
            .items
            .iter()
            .find(|item| item.id == *bob_annotation.id())
            .unwrap();
        assert_eq!(view.refs, vec![alice_memo.id().to_string()]);
    }

    #[tokio::test]
    async fn own_memo_search_includes_current_friend_annotations_without_implicit_friend_lookup() {
        let (_dir, manager) = setup_social_manager().await;
        pair_alice_and_bob(&manager).await;
        let bob_memo = manager
            .create_memo(
                "bob",
                MemoCreate {
                    content: "Bob original".to_string(),
                    tags: vec![],
                    refs: vec![],
                },
            )
            .await
            .unwrap();
        let alice_note = manager
            .create_memo(
                "alice",
                MemoCreate {
                    content: "Alice annotation".to_string(),
                    tags: vec![],
                    refs: vec![MemoRef::Friend {
                        username: "bob".to_string(),
                        memo_id: *bob_memo.id(),
                    }],
                },
            )
            .await
            .unwrap();

        let page = manager
            .search_memo_page("bob", &MemoSearchRequest::default())
            .await
            .unwrap();
        let bob_view = page
            .items
            .iter()
            .find(|view| view.id == *bob_memo.id())
            .unwrap();

        assert_eq!(
            bob_view.referenced_by,
            vec![format!("alice/{}", alice_note.id())]
        );

        let detail = manager.get_memo_view("bob", bob_memo.id()).await.unwrap();
        assert_eq!(
            detail.referenced_by,
            vec![format!("alice/{}", alice_note.id())]
        );
    }

    #[tokio::test]
    async fn own_memo_search_has_annotation_includes_friend_cross_annotations() {
        let (_dir, manager) = setup_social_manager().await;
        pair_alice_and_bob(&manager).await;
        let alice_own_source = manager
            .create_memo(
                "alice",
                MemoCreate {
                    content: "Alice own source".to_string(),
                    tags: vec![],
                    refs: vec![],
                },
            )
            .await
            .unwrap();
        let alice_friend_target = manager
            .create_memo(
                "alice",
                MemoCreate {
                    content: "Alice friend target".to_string(),
                    tags: vec![],
                    refs: vec![],
                },
            )
            .await
            .unwrap();
        let bob_source = manager
            .create_memo(
                "bob",
                MemoCreate {
                    content: "Bob source".to_string(),
                    tags: vec![],
                    refs: vec![],
                },
            )
            .await
            .unwrap();
        let alice_own_annotation = manager
            .create_memo(
                "alice",
                MemoCreate {
                    content: "Alice own annotation".to_string(),
                    tags: vec![],
                    refs: vec![MemoRef::Own(*alice_own_source.id())],
                },
            )
            .await
            .unwrap();
        let alice_friend_annotation = manager
            .create_memo(
                "alice",
                MemoCreate {
                    content: "Alice friend annotation".to_string(),
                    tags: vec![],
                    refs: vec![MemoRef::Friend {
                        username: "bob".to_string(),
                        memo_id: *bob_source.id(),
                    }],
                },
            )
            .await
            .unwrap();
        let bob_annotation = manager
            .create_memo(
                "bob",
                MemoCreate {
                    content: "Bob annotation".to_string(),
                    tags: vec![],
                    refs: vec![MemoRef::Friend {
                        username: "alice".to_string(),
                        memo_id: *alice_friend_target.id(),
                    }],
                },
            )
            .await
            .unwrap();
        manager
            .create_memo(
                "alice",
                MemoCreate {
                    content: "Alice plain".to_string(),
                    tags: vec![],
                    refs: vec![],
                },
            )
            .await
            .unwrap();

        let page = manager
            .search_memo_page(
                "alice",
                &MemoSearchRequest {
                    query: MemoSearchQuery {
                        has_annotation: Some(true),
                        ..MemoSearchQuery::default()
                    },
                    page_size: Some(8),
                    cursor: None,
                },
            )
            .await
            .unwrap();

        let ids = page.items.iter().map(|view| view.id).collect::<Vec<_>>();
        assert_eq!(
            ids,
            vec![
                *alice_friend_annotation.id(),
                *alice_own_annotation.id(),
                *alice_friend_target.id(),
                *alice_own_source.id()
            ]
        );
        let own_source_view = page
            .items
            .iter()
            .find(|view| view.id == *alice_own_source.id())
            .unwrap();
        assert_eq!(
            own_source_view.referenced_by,
            vec![alice_own_annotation.id().to_string()]
        );
        let friend_target_view = page
            .items
            .iter()
            .find(|view| view.id == *alice_friend_target.id())
            .unwrap();
        assert_eq!(
            friend_target_view.referenced_by,
            vec![format!("bob/{}", bob_annotation.id())]
        );
    }

    #[tokio::test]
    async fn own_memo_search_aggregates_cross_annotations_from_all_existing_friends() {
        let (_dir, manager) = setup_social_manager().await;
        {
            let mut social = manager.social.social.write().await;
            social.document_mut().friendships.push(Friendship {
                id: "friendship-bob-alice".to_string(),
                user_a: "bob".to_string(),
                user_b: "alice".to_string(),
                created_at: ts("2026-05-24T00:00:00Z"),
            });
            social.document_mut().friendships.push(Friendship {
                id: "friendship-bob-carol".to_string(),
                user_a: "bob".to_string(),
                user_b: "carol".to_string(),
                created_at: ts("2026-05-24T00:00:01Z"),
            });
        }

        let alice_target = manager
            .create_memo(
                "alice",
                MemoCreate {
                    content: "Alice target".to_string(),
                    tags: vec![],
                    refs: vec![],
                },
            )
            .await
            .unwrap();
        let bob_source = manager
            .create_memo(
                "bob",
                MemoCreate {
                    content: "Bob source".to_string(),
                    tags: vec![],
                    refs: vec![],
                },
            )
            .await
            .unwrap();
        let bob_annotation = manager
            .create_memo(
                "bob",
                MemoCreate {
                    content: "Bob annotation on Alice".to_string(),
                    tags: vec![],
                    refs: vec![MemoRef::Friend {
                        username: "alice".to_string(),
                        memo_id: *alice_target.id(),
                    }],
                },
            )
            .await
            .unwrap();
        let alice_annotation = manager
            .create_memo(
                "alice",
                MemoCreate {
                    content: "Alice annotation on Bob".to_string(),
                    tags: vec![],
                    refs: vec![MemoRef::Friend {
                        username: "bob".to_string(),
                        memo_id: *bob_source.id(),
                    }],
                },
            )
            .await
            .unwrap();
        let carol_annotation = manager
            .create_memo(
                "carol",
                MemoCreate {
                    content: "Carol annotation on Bob".to_string(),
                    tags: vec![],
                    refs: vec![MemoRef::Friend {
                        username: "bob".to_string(),
                        memo_id: *bob_source.id(),
                    }],
                },
            )
            .await
            .unwrap();

        let page = manager
            .search_memo_page(
                "bob",
                &MemoSearchRequest {
                    query: MemoSearchQuery {
                        has_annotation: Some(true),
                        ..MemoSearchQuery::default()
                    },
                    page_size: Some(8),
                    cursor: None,
                },
            )
            .await
            .unwrap();

        let ids = page.items.iter().map(|view| view.id).collect::<Vec<_>>();
        assert!(ids.contains(bob_source.id()));
        assert!(ids.contains(bob_annotation.id()));

        let bob_source_view = page
            .items
            .iter()
            .find(|view| view.id == *bob_source.id())
            .unwrap();
        let mut referenced_by = bob_source_view.referenced_by.clone();
        referenced_by.sort();
        assert_eq!(
            referenced_by,
            vec![
                format!("alice/{}", alice_annotation.id()),
                format!("carol/{}", carol_annotation.id()),
            ]
        );

        let detail = manager.get_memo_view("bob", bob_source.id()).await.unwrap();
        let mut detail_referenced_by = detail.referenced_by;
        detail_referenced_by.sort();
        assert_eq!(
            detail_referenced_by,
            vec![
                format!("alice/{}", alice_annotation.id()),
                format!("carol/{}", carol_annotation.id()),
            ]
        );
    }

    #[tokio::test]
    async fn friend_memo_search_without_any_friend_returns_no_friends_yet() {
        let (_dir, manager) = setup_social_manager().await;
        let err = manager
            .search_friend_memo_page("alice", "bob", &FriendMemoSearchRequest::default())
            .await
            .unwrap_err();

        assert!(matches!(
            err,
            WeimoError::FriendConflict(FriendConflictCode::NoFriendsYet)
        ));
    }

    #[tokio::test]
    async fn friend_memo_search_for_non_friend_returns_not_your_friend() {
        let (_dir, manager) = setup_social_manager().await;
        pair_alice_and_bob(&manager).await;

        let err = manager
            .search_friend_memo_page("alice", "carol", &FriendMemoSearchRequest::default())
            .await
            .unwrap_err();

        assert!(matches!(
            err,
            WeimoError::FriendConflict(FriendConflictCode::NotYourFriend)
        ));
    }

    #[tokio::test]
    async fn friend_memo_search_uses_explicit_target_instead_of_first_friendship() {
        let (_dir, manager) = setup_social_manager().await;
        {
            let mut social = manager.social.social.write().await;
            social.document_mut().friendships.push(Friendship {
                id: "friendship-alice-bob".to_string(),
                user_a: "alice".to_string(),
                user_b: "bob".to_string(),
                created_at: ts("2026-05-24T00:00:00Z"),
            });
            social.document_mut().friendships.push(Friendship {
                id: "friendship-alice-carol".to_string(),
                user_a: "alice".to_string(),
                user_b: "carol".to_string(),
                created_at: ts("2026-05-24T00:00:01Z"),
            });
        }

        let bob_memo = manager
            .create_memo(
                "bob",
                MemoCreate {
                    content: "Bob explicit friend memo".to_string(),
                    tags: vec![],
                    refs: vec![],
                },
            )
            .await
            .unwrap();
        let carol_memo = manager
            .create_memo(
                "carol",
                MemoCreate {
                    content: "Carol explicit friend memo".to_string(),
                    tags: vec![],
                    refs: vec![],
                },
            )
            .await
            .unwrap();

        let bob_page = manager
            .search_friend_memo_page("alice", "bob", &FriendMemoSearchRequest::default())
            .await
            .unwrap();
        let carol_page = manager
            .search_friend_memo_page("alice", "carol", &FriendMemoSearchRequest::default())
            .await
            .unwrap();
        let err = manager
            .search_friend_memo_page("alice", "dave", &FriendMemoSearchRequest::default())
            .await
            .unwrap_err();

        assert_eq!(bob_page.total_count, 1);
        assert_eq!(bob_page.items[0].id, *bob_memo.id());
        assert_eq!(bob_page.items[0].content, "Bob explicit friend memo");
        assert_eq!(carol_page.total_count, 1);
        assert_eq!(carol_page.items[0].id, *carol_memo.id());
        assert_eq!(carol_page.items[0].content, "Carol explicit friend memo");
        assert!(matches!(
            err,
            WeimoError::FriendConflict(FriendConflictCode::NotYourFriend)
        ));
    }

    #[test]
    fn test_validate_refs_accepts_valid() {
        let idx = idx_with(&[(1, "2026-01-01T00:00:00Z"), (2, "2026-01-02T00:00:00Z")]);
        let out = validate_refs(Some(3), ts("2026-01-03T00:00:00Z"), &[1, 2], &idx).unwrap();
        assert_eq!(out, vec![1, 2]);
    }

    #[test]
    fn test_validate_refs_dedupes_silently() {
        let idx = idx_with(&[(1, "2026-01-01T00:00:00Z")]);
        let out = validate_refs(Some(2), ts("2026-01-02T00:00:00Z"), &[1, 1, 1], &idx).unwrap();
        assert_eq!(out, vec![1]);
    }

    #[test]
    fn test_validate_refs_rejects_self() {
        let idx = idx_with(&[(1, "2026-01-01T00:00:00Z")]);
        let err = validate_refs(Some(1), ts("2026-01-01T00:00:00Z"), &[1], &idx).unwrap_err();
        assert!(matches!(err, WeimoError::InvalidRefs(_)));
    }

    #[test]
    fn test_validate_refs_rejects_unknown() {
        let idx = idx_with(&[(1, "2026-01-01T00:00:00Z")]);
        let err = validate_refs(Some(2), ts("2026-01-02T00:00:00Z"), &[99], &idx).unwrap_err();
        assert!(matches!(err, WeimoError::InvalidRefs(_)));
    }

    #[test]
    fn test_validate_refs_rejects_non_strict_earlier() {
        let idx = idx_with(&[(2, "2026-01-02T00:00:00Z")]);
        let err = validate_refs(Some(1), ts("2026-01-01T00:00:00Z"), &[2], &idx).unwrap_err();
        assert!(matches!(err, WeimoError::InvalidRefs(_)));
    }

    #[test]
    fn test_validate_refs_create_path_uses_now_as_self_ct() {
        let idx = idx_with(&[(1, "2026-01-01T00:00:00Z")]);
        let out = validate_refs(None, OffsetDateTime::now_utc(), &[1], &idx).unwrap();
        assert_eq!(out, vec![1]);
    }

    async fn setup() -> (tempfile::TempDir, MdDb) {
        let dir = tempdir().unwrap();
        let mut db = MdDb::new(dir.path()).await;
        db.create_user(UserCreate {
            username: "u".to_string(),
            password: "p".to_string(),
            nickname: None,
        })
        .await
        .unwrap();
        (dir, db)
    }

    #[derive(Debug, Clone)]
    struct StaticUserDb {
        user: User,
    }

    #[async_trait]
    impl UserDb for StaticUserDb {
        async fn create(&mut self, _info: UserCreate) -> WeimoResult<User> {
            unreachable!("test db does not support create")
        }

        async fn delete(&mut self, _username: &str) -> WeimoResult<()> {
            unreachable!("test db does not support delete")
        }

        async fn update_nickname(&mut self, _username: &str, _nickname: &str) -> WeimoResult<()> {
            unreachable!("test db does not support update_nickname")
        }

        async fn update_login_name(
            &mut self,
            _username: &str,
            _login_name: &str,
        ) -> WeimoResult<User> {
            unreachable!("test db does not support update_login_name")
        }

        async fn update_password(&mut self, _username: &str, _password: &str) -> WeimoResult<User> {
            unreachable!("test db does not support update_password")
        }

        async fn get(&self, username: &str) -> WeimoResult<User> {
            if username == self.user.username() {
                Ok(self.user.clone())
            } else {
                Err(WeimoError::UserNotFound(username.to_string()))
            }
        }

        async fn get_by_wechat_openid(&self, _openid: &str) -> Option<User> {
            None
        }

        async fn get_by_login_name(&self, login_name: &str) -> Option<User> {
            (login_name == self.user.login_name()).then(|| self.user.clone())
        }

        async fn create_wechat_user(
            &mut self,
            _openid: &str,
            _unionid: Option<String>,
            _nickname: Option<String>,
        ) -> WeimoResult<User> {
            unreachable!("test db does not support create_wechat_user")
        }

        async fn get_all_users(&self) -> Vec<String> {
            vec![self.user.username().to_string()]
        }

        async fn exists(&self, username: &str) -> bool {
            username == self.user.username()
        }
    }

    #[derive(Debug)]
    struct BlockingMemoDbState {
        entered_get_many_tx: Mutex<Option<oneshot::Sender<()>>>,
        release_get_many_rx: Mutex<Option<oneshot::Receiver<()>>>,
        should_block_get_many: AtomicBool,
    }

    #[derive(Debug, Clone)]
    struct BlockingMemoDb {
        memos: Arc<HashMap<MemoId, String>>,
        state: Arc<BlockingMemoDbState>,
    }

    impl BlockingMemoDb {
        fn new(memos: HashMap<MemoId, String>, state: Arc<BlockingMemoDbState>) -> Self {
            Self {
                memos: Arc::new(memos),
                state,
            }
        }

        fn load(&self, id: MemoId) -> WeimoResult<Memo> {
            self.memos
                .get(&id)
                .and_then(|markdown| Memo::parse_markdown(markdown))
                .ok_or(WeimoError::MemoNotFound(id))
        }
    }

    #[async_trait]
    impl MemoDb for BlockingMemoDb {
        async fn create(
            &mut self,
            _user: &str,
            _info: MemoCreate,
            _id: MemoId,
        ) -> WeimoResult<Memo> {
            unreachable!("test db does not support create")
        }

        async fn delete(&mut self, _user: &str, _id: &MemoId) -> WeimoResult<Memo> {
            unreachable!("test db does not support delete")
        }

        async fn update(
            &mut self,
            _user: &str,
            _id: &MemoId,
            _info: MemoUpdate,
        ) -> WeimoResult<Memo> {
            unreachable!("test db does not support update")
        }

        async fn get(&self, _user: &str, id: &MemoId) -> WeimoResult<Memo> {
            self.load(*id)
        }

        async fn get_many(&self, _user: &str, ids: &[MemoId]) -> WeimoResult<Vec<Memo>> {
            if self
                .state
                .should_block_get_many
                .swap(false, Ordering::SeqCst)
            {
                if let Some(tx) = self.state.entered_get_many_tx.lock().await.take() {
                    let _ = tx.send(());
                }
                if let Some(rx) = self.state.release_get_many_rx.lock().await.take() {
                    let _ = rx.await;
                }
            }

            ids.iter().map(|id| self.load(*id)).collect()
        }

        async fn get_ids(&self, _user: &str) -> Vec<MemoId> {
            let mut ids = self.memos.keys().copied().collect::<Vec<_>>();
            ids.sort_unstable();
            ids
        }
    }

    #[tokio::test]
    async fn test_memo_manager_build_rehydrates_ref_index() {
        let (_dir, mut db) = setup().await;

        db.create_memo(
            "u",
            MemoCreate {
                content: "a".into(),
                tags: vec![],
                refs: vec![],
            },
            1,
        )
        .await
        .unwrap();
        db.create_memo(
            "u",
            MemoCreate {
                content: "b".into(),
                tags: vec![],
                refs: vec![MemoRef::Own(1)],
            },
            2,
        )
        .await
        .unwrap();
        db.create_memo(
            "u",
            MemoCreate {
                content: "c".into(),
                tags: vec![],
                refs: vec![MemoRef::Own(1), MemoRef::Own(2)],
            },
            3,
        )
        .await
        .unwrap();

        let manager = MemoManager::build("u", &db).await.unwrap();
        assert_eq!(manager.ref_index.get_refs(3), &[1, 2]);
        assert_eq!(manager.ref_index.get_referenced_by(1), vec![3, 2]);
        assert_eq!(manager.ref_index.get_referenced_by(2), vec![3]);
        assert_eq!(manager.max_id, 3);
    }

    #[tokio::test]
    async fn test_data_manager_reopen_rebuilds_ref_index_from_same_storage() {
        let dir = tempdir().unwrap();

        {
            let mut db = MdDb::new(dir.path()).await;
            db.create_user(UserCreate {
                username: "u".to_string(),
                password: "p".to_string(),
                nickname: None,
            })
            .await
            .unwrap();

            db.create_memo(
                "u",
                MemoCreate {
                    content: "a".into(),
                    tags: vec![],
                    refs: vec![],
                },
                1,
            )
            .await
            .unwrap();
            db.create_memo(
                "u",
                MemoCreate {
                    content: "b".into(),
                    tags: vec![],
                    refs: vec![MemoRef::Own(1)],
                },
                2,
            )
            .await
            .unwrap();
            db.create_memo(
                "u",
                MemoCreate {
                    content: "c".into(),
                    tags: vec![],
                    refs: vec![MemoRef::Own(1), MemoRef::Own(2)],
                },
                3,
            )
            .await
            .unwrap();

            let initial_manager = DataManager::new_with_social(db, JsonSocial::in_memory())
                .await
                .unwrap();
            let a_view = initial_manager.get_memo_view("u", &1).await.unwrap();
            assert_eq!(a_view.referenced_by, vec!["3", "2"]);
        }

        let reopened_db = MdDb::new(dir.path()).await;
        let reopened_manager = DataManager::new_with_social(reopened_db, JsonSocial::in_memory())
            .await
            .unwrap();

        let a_view = reopened_manager.get_memo_view("u", &1).await.unwrap();
        assert_eq!(a_view.refs, Vec::<String>::new());
        assert_eq!(a_view.referenced_by, vec!["3", "2"]);

        let c_view = reopened_manager.get_memo_view("u", &3).await.unwrap();
        assert_eq!(c_view.refs, vec!["1", "2"]);
        assert!(c_view.referenced_by.is_empty());
    }

    #[tokio::test]
    async fn test_create_memo_validates_and_records_refs() {
        let (_dir, db) = setup().await;
        let manager = DataManager::new_with_social(db, JsonSocial::in_memory())
            .await
            .unwrap();

        let a = manager
            .create_memo(
                "u",
                MemoCreate {
                    content: "a".into(),
                    tags: vec![],
                    refs: vec![],
                },
            )
            .await
            .unwrap();
        tokio::time::sleep(std::time::Duration::from_millis(2)).await;
        let b = manager
            .create_memo(
                "u",
                MemoCreate {
                    content: "b".into(),
                    tags: vec![],
                    refs: vec![MemoRef::Own(*a.id())],
                },
            )
            .await
            .unwrap();

        let mgr = manager.memo_manager("u").await.unwrap();
        let mgr = mgr.read().await;
        assert_eq!(mgr.ref_index.get_referenced_by(*a.id()), vec![*b.id()]);
        assert_eq!(mgr.ref_index.get_refs(*b.id()), &[*a.id()]);
    }

    #[tokio::test]
    async fn test_create_memo_rejects_unknown_ref() {
        let (_dir, db) = setup().await;
        let manager = DataManager::new_with_social(db, JsonSocial::in_memory())
            .await
            .unwrap();

        let err = manager
            .create_memo(
                "u",
                MemoCreate {
                    content: "b".into(),
                    tags: vec![],
                    refs: vec![MemoRef::Own(999)],
                },
            )
            .await
            .unwrap_err();
        assert!(matches!(err, WeimoError::InvalidRefs(_)));
    }

    #[tokio::test]
    async fn test_update_memo_validates_refs_time_ordering() {
        let (_dir, db) = setup().await;
        let manager = DataManager::new_with_social(db, JsonSocial::in_memory())
            .await
            .unwrap();

        let a = manager
            .create_memo(
                "u",
                MemoCreate {
                    content: "a".into(),
                    tags: vec![],
                    refs: vec![],
                },
            )
            .await
            .unwrap();
        tokio::time::sleep(std::time::Duration::from_millis(2)).await;
        let b = manager
            .create_memo(
                "u",
                MemoCreate {
                    content: "b".into(),
                    tags: vec![],
                    refs: vec![],
                },
            )
            .await
            .unwrap();

        // 让 a 引用 b（a 早于 b，所以 a 引用 b 是 ct 倒置）
        let err = manager
            .update_memo(
                "u",
                a.id(),
                MemoUpdate {
                    content: None,
                    tags: None,
                    refs: Some(vec![MemoRef::Own(*b.id())]),
                },
            )
            .await
            .unwrap_err();
        assert!(matches!(err, WeimoError::InvalidRefs(_)));
    }

    #[tokio::test]
    async fn test_update_memo_clears_refs_on_some_empty() {
        let (_dir, db) = setup().await;
        let manager = DataManager::new_with_social(db, JsonSocial::in_memory())
            .await
            .unwrap();

        let a = manager
            .create_memo(
                "u",
                MemoCreate {
                    content: "a".into(),
                    tags: vec![],
                    refs: vec![],
                },
            )
            .await
            .unwrap();
        tokio::time::sleep(std::time::Duration::from_millis(2)).await;
        let b = manager
            .create_memo(
                "u",
                MemoCreate {
                    content: "b".into(),
                    tags: vec![],
                    refs: vec![MemoRef::Own(*a.id())],
                },
            )
            .await
            .unwrap();

        manager
            .update_memo(
                "u",
                b.id(),
                MemoUpdate {
                    content: None,
                    tags: None,
                    refs: Some(vec![]),
                },
            )
            .await
            .unwrap();

        let mgr = manager.memo_manager("u").await.unwrap();
        let mgr = mgr.read().await;
        assert!(mgr.ref_index.get_referenced_by(*a.id()).is_empty());
    }

    #[tokio::test]
    async fn test_delete_memo_cascades_to_referrers() {
        let (_dir, db) = setup().await;
        let manager = DataManager::new_with_social(db, JsonSocial::in_memory())
            .await
            .unwrap();

        let a = manager
            .create_memo(
                "u",
                MemoCreate {
                    content: "a".into(),
                    tags: vec![],
                    refs: vec![],
                },
            )
            .await
            .unwrap();
        tokio::time::sleep(std::time::Duration::from_millis(2)).await;
        let b = manager
            .create_memo(
                "u",
                MemoCreate {
                    content: "b".into(),
                    tags: vec![],
                    refs: vec![MemoRef::Own(*a.id())],
                },
            )
            .await
            .unwrap();
        tokio::time::sleep(std::time::Duration::from_millis(2)).await;
        let c = manager
            .create_memo(
                "u",
                MemoCreate {
                    content: "c".into(),
                    tags: vec![],
                    refs: vec![MemoRef::Own(*a.id())],
                },
            )
            .await
            .unwrap();

        manager.delete_memo("u", a.id()).await.unwrap();

        let b_after = manager.get_memo("u", b.id()).await.unwrap();
        let c_after = manager.get_memo("u", c.id()).await.unwrap();
        assert!(b_after.refs().is_empty());
        assert!(c_after.refs().is_empty());

        assert!(manager.get_memo("u", a.id()).await.is_err());

        let mgr = manager.memo_manager("u").await.unwrap();
        let mgr = mgr.read().await;
        assert!(!mgr.ref_index.contains(*a.id()));
        assert!(mgr.ref_index.get_referenced_by(*a.id()).is_empty());
    }

    #[tokio::test]
    async fn test_tag_rename_preserves_refs() {
        let (_dir, db) = setup().await;
        let manager = DataManager::new_with_social(db, JsonSocial::in_memory())
            .await
            .unwrap();

        let a = manager
            .create_memo(
                "u",
                MemoCreate {
                    content: "a".into(),
                    tags: vec!["work/rust".into()],
                    refs: vec![],
                },
            )
            .await
            .unwrap();
        tokio::time::sleep(std::time::Duration::from_millis(2)).await;
        let b = manager
            .create_memo(
                "u",
                MemoCreate {
                    content: "b".into(),
                    tags: vec!["work/rust".into()],
                    refs: vec![MemoRef::Own(*a.id())],
                },
            )
            .await
            .unwrap();

        manager
            .update_tag("u", "work/rust", "work/backend")
            .await
            .unwrap();

        let b_after = manager.get_memo("u", b.id()).await.unwrap();
        assert_eq!(b_after.refs(), &[MemoRef::Own(*a.id())]);
        assert!(b_after.tags().iter().any(|t| t == "work/backend"));
    }

    #[tokio::test]
    async fn test_search_memo_page_does_not_deadlock_against_waiting_writer() {
        let user = User::create(UserCreate {
            username: "u".to_string(),
            password: "p".to_string(),
            nickname: None,
        });
        let memo = Memo::create(
            MemoCreate {
                content: "search body".to_string(),
                tags: vec!["work/rust".to_string()],
                refs: vec![],
            },
            1,
        );

        let (entered_get_many_tx, entered_get_many_rx) = oneshot::channel();
        let (release_get_many_tx, release_get_many_rx) = oneshot::channel();
        let state = Arc::new(BlockingMemoDbState {
            entered_get_many_tx: Mutex::new(Some(entered_get_many_tx)),
            release_get_many_rx: Mutex::new(Some(release_get_many_rx)),
            should_block_get_many: AtomicBool::new(true),
        });

        let db = Db::from((
            StaticUserDb { user },
            BlockingMemoDb::new(
                HashMap::from([(*memo.id(), memo.to_markdown())]),
                state.clone(),
            ),
        ));
        let manager = DataManager::new_with_social(db, JsonSocial::in_memory())
            .await
            .unwrap();

        let search_manager = manager.clone();
        let search_handle = tokio::spawn(async move {
            search_manager
                .search_memo_page("u", &MemoSearchRequest::default())
                .await
        });

        entered_get_many_rx
            .await
            .expect("search should block inside get_many");

        let memo_manager = manager.memo_manager("u").await.unwrap();
        let db = manager.db.clone();
        let (writer_holds_manager_tx, writer_holds_manager_rx) = oneshot::channel();
        let writer_handle = tokio::spawn(async move {
            let _manager_guard = memo_manager.write().await;
            let _ = writer_holds_manager_tx.send(());
            let _db_guard = db.write().await;
        });

        writer_holds_manager_rx
            .await
            .expect("writer should hold manager lock before waiting on db");
        let _ = release_get_many_tx.send(());

        let search_result =
            tokio::time::timeout(std::time::Duration::from_millis(200), search_handle).await;

        if search_result.is_err() {
            writer_handle.abort();
            panic!("search_memo_page deadlocked while a writer was waiting on db");
        }

        let search_page = search_result
            .expect("search task should finish")
            .expect("search task should not panic")
            .expect("search should succeed");
        assert_eq!(search_page.items.len(), 1);
        assert_eq!(search_page.items[0].id, 1);

        writer_handle
            .await
            .expect("writer task should finish after search releases db");
    }
}
