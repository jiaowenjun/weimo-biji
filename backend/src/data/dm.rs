mod memos;
mod users;

use std::collections::HashMap;
use std::sync::Arc;

use tokio::sync::RwLock;

use self::memos::MemoManager;
use crate::data::{Db, MemoDb, UserDb};
use crate::error::{WeimoError, WeimoResult};

/// Biji 数据层 facade。领域实现保持私有，调用方不直接获取底层锁。
///
/// 锁纪律：`memo_managers` 只用于克隆用户 manager；Memo 写路径先持有用户
/// manager，再获取 `db`。
#[derive(Debug, Clone)]
pub struct DataManager<U: UserDb, M: MemoDb> {
    db: Arc<RwLock<Db<U, M>>>,
    memo_managers: Arc<RwLock<HashMap<String, Arc<RwLock<MemoManager>>>>>,
}

impl<U: UserDb, M: MemoDb> DataManager<U, M> {
    pub async fn new(db: Db<U, M>) -> WeimoResult<Self> {
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
                refs: vec![MemoRef(1)],
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
                refs: vec![MemoRef(1), MemoRef(2)],
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
                    refs: vec![MemoRef(1)],
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
                    refs: vec![MemoRef(1), MemoRef(2)],
                },
                3,
            )
            .await
            .unwrap();

            let initial_manager = DataManager::new(db).await.unwrap();
            let a_view = initial_manager.get_memo_view("u", &1).await.unwrap();
            assert_eq!(a_view.referenced_by, vec!["3", "2"]);
        }

        let reopened_db = MdDb::new(dir.path()).await;
        let reopened_manager = DataManager::new(reopened_db).await.unwrap();

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
        let manager = DataManager::new(db).await.unwrap();

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
                    refs: vec![MemoRef(*a.id())],
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
        let manager = DataManager::new(db).await.unwrap();

        let err = manager
            .create_memo(
                "u",
                MemoCreate {
                    content: "b".into(),
                    tags: vec![],
                    refs: vec![MemoRef(999)],
                },
            )
            .await
            .unwrap_err();
        assert!(matches!(err, WeimoError::InvalidRefs(_)));
    }

    #[tokio::test]
    async fn test_update_memo_validates_refs_time_ordering() {
        let (_dir, db) = setup().await;
        let manager = DataManager::new(db).await.unwrap();

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
                    refs: Some(vec![MemoRef(*b.id())]),
                },
            )
            .await
            .unwrap_err();
        assert!(matches!(err, WeimoError::InvalidRefs(_)));
    }

    #[tokio::test]
    async fn test_update_memo_clears_refs_on_some_empty() {
        let (_dir, db) = setup().await;
        let manager = DataManager::new(db).await.unwrap();

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
                    refs: vec![MemoRef(*a.id())],
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
        let manager = DataManager::new(db).await.unwrap();

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
                    refs: vec![MemoRef(*a.id())],
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
                    refs: vec![MemoRef(*a.id())],
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
        let manager = DataManager::new(db).await.unwrap();

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
                    refs: vec![MemoRef(*a.id())],
                },
            )
            .await
            .unwrap();

        manager
            .update_tag("u", "work/rust", "work/backend")
            .await
            .unwrap();

        let b_after = manager.get_memo("u", b.id()).await.unwrap();
        assert_eq!(b_after.refs(), &[MemoRef(*a.id())]);
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
        let manager = DataManager::new(db).await.unwrap();

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
