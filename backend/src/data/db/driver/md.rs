use crate::data::{Db, JsonUsers, MdMemos};
use std::path::Path;

pub type MdDb = Db<JsonUsers, MdMemos>;

impl MdDb {
    pub async fn new<P: AsRef<Path>>(root_dir: P) -> Self {
        let user_file = JsonUsers::new(root_dir.as_ref().join("users.json")).await;
        let memo_file = MdMemos::new(root_dir.as_ref()).await;
        Self::from((user_file, memo_file))
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::data::{MemoCreate, MemoSearchQuery, MemoTextFilter, MemoUpdate, UserCreate};
    use crate::error::WeimoError;
    use tokio::fs;

    async fn setup_temp_dir() -> tempfile::TempDir {
        let temp_dir = tempfile::tempdir().unwrap();
        fs::create_dir_all(temp_dir.path()).await.unwrap();
        temp_dir
    }

    #[tokio::test]
    async fn test_new_db() {
        let temp_dir = setup_temp_dir().await;
        let db = MdDb::new(temp_dir.path()).await;

        // 验证初始状态下没有用户
        assert_eq!(db.get_all_users().await.len(), 0);
    }

    #[tokio::test]
    async fn test_create_user() {
        let temp_dir = setup_temp_dir().await;
        let mut db = MdDb::new(temp_dir.path()).await;

        // 创建用户
        let user_info = UserCreate {
            username: "test_user".to_string(),
            password: "hashed_pwd".to_string(),
            nickname: Some("Test User".to_string()),
        };

        let user = db.create_user(user_info).await.unwrap();

        // 验证用户信息
        assert_eq!(user.username(), "test_user");
        assert_eq!(user.nickname(), "Test User");

        // 验证用户存在
        assert!(db.user_exists("test_user").await);

        // 验证可以获取用户
        let retrieved_user = db.get_user("test_user").await.unwrap();
        assert_eq!(retrieved_user.username(), "test_user");
        assert_eq!(retrieved_user.nickname(), "Test User");
    }

    #[tokio::test]
    async fn test_create_duplicate_user() {
        let temp_dir = setup_temp_dir().await;
        let mut db = MdDb::new(temp_dir.path()).await;

        // 创建用户
        let user_info = UserCreate {
            username: "test_user".to_string(),
            password: "hashed_pwd".to_string(),
            nickname: None,
        };

        // 第一次创建应该成功
        let result = db.create_user(user_info.clone()).await;
        assert!(result.is_ok());

        // 第二次创建应该失败（用户已存在）
        let result = db.create_user(user_info).await;
        assert!(result.is_err());
    }

    #[tokio::test]
    async fn test_update_user_nickname() {
        let temp_dir = setup_temp_dir().await;
        let mut db = MdDb::new(temp_dir.path()).await;

        // 创建用户
        let user_info = UserCreate {
            username: "test_user".to_string(),
            password: "hashed_pwd".to_string(),
            nickname: Some("Original Name".to_string()),
        };

        db.create_user(user_info).await.unwrap();

        // 更新昵称
        db.update_user_nickname("test_user", "New Name")
            .await
            .unwrap();

        // 验证昵称已更新
        let user = db.get_user("test_user").await.unwrap();
        assert_eq!(user.nickname(), "New Name");
    }

    #[tokio::test]
    async fn test_update_nonexistent_user() {
        let temp_dir = setup_temp_dir().await;
        let mut db = MdDb::new(temp_dir.path()).await;

        // 尝试更新不存在的用户
        let result = db.update_user_nickname("nonexistent", "New Name").await;
        assert!(result.is_err());
    }

    #[tokio::test]
    async fn test_delete_user() {
        let temp_dir = setup_temp_dir().await;
        let mut db = MdDb::new(temp_dir.path()).await;

        // 创建用户
        let user_info = UserCreate {
            username: "test_user".to_string(),
            password: "hashed_pwd".to_string(),
            nickname: None,
        };

        db.create_user(user_info).await.unwrap();
        assert!(db.user_exists("test_user").await);

        // 删除用户
        let result = db.delete_user("test_user").await;
        assert!(result.is_ok());

        // 验证用户已被删除
        assert!(!db.user_exists("test_user").await);
        assert!(db.get_user("test_user").await.is_err());
    }

    #[tokio::test]
    async fn test_delete_nonexistent_user() {
        let temp_dir = setup_temp_dir().await;
        let mut db = MdDb::new(temp_dir.path()).await;

        // 尝试删除不存在的用户
        let result = db.delete_user("nonexistent").await;
        assert!(result.is_err());
    }

    #[tokio::test]
    async fn test_create_memo() {
        let temp_dir = setup_temp_dir().await;
        let mut db = MdDb::new(temp_dir.path()).await;

        // 创建用户
        let user_info = UserCreate {
            username: "test_user".to_string(),
            password: "hashed_pwd".to_string(),
            nickname: None,
        };

        db.create_user(user_info).await.unwrap();

        // 创建笔记
        let memo_info = MemoCreate {
            content: "Test content".to_string(),
            tags: vec!["tag1".to_string(), "tag2".to_string()],
            refs: vec![],
        };

        let memo = db.create_memo("test_user", memo_info, 123).await.unwrap();

        // 验证笔记信息
        assert_eq!(memo.tags(), &["tag1", "tag2"]);

        // 验证笔记存在
        assert!(db.get_memo("test_user", memo.id()).await.is_ok());
    }

    #[tokio::test]
    async fn test_create_memo_for_nonexistent_user() {
        let temp_dir = setup_temp_dir().await;
        let mut db = MdDb::new(temp_dir.path()).await;

        // 尝试为不存在的用户创建笔记
        let memo_info = MemoCreate {
            content: "Test content".to_string(),
            tags: vec!["tag1".to_string()],
            refs: vec![],
        };

        let result = db.create_memo("nonexistent", memo_info, 123).await;
        assert!(result.is_err());
    }

    #[tokio::test]
    async fn test_update_memo() {
        let temp_dir = setup_temp_dir().await;
        let mut db = MdDb::new(temp_dir.path()).await;

        // 创建用户和笔记
        let user_info = UserCreate {
            username: "test_user".to_string(),
            password: "hashed_pwd".to_string(),
            nickname: None,
        };

        db.create_user(user_info).await.unwrap();

        let memo_info = MemoCreate {
            content: "Original content".to_string(),
            tags: vec!["tag1".to_string()],
            refs: vec![],
        };

        let memo = db.create_memo("test_user", memo_info, 123).await.unwrap();
        let memo_id = memo.id();

        // 更新笔记内容
        let update_info = MemoUpdate {
            content: Some("Updated content".to_string()),
            tags: None,
            refs: None,
        };

        let updated_memo = db
            .update_memo("test_user", memo_id, update_info)
            .await
            .unwrap();

        // 验证内容已更新，标签保持不变
        assert_eq!(updated_memo.tags(), &["tag1"]);

        // 更新笔记标签
        let update_info = MemoUpdate {
            content: None,
            tags: Some(vec!["tag2".to_string(), "tag3".to_string()]),
            refs: None,
        };

        let updated_memo = db
            .update_memo("test_user", memo_id, update_info)
            .await
            .unwrap();

        // 验证标签已更新，内容保持不变
        assert_eq!(updated_memo.tags(), &["tag2", "tag3"]);
    }

    #[tokio::test]
    async fn test_update_nonexistent_memo() {
        let temp_dir = setup_temp_dir().await;
        let mut db = MdDb::new(temp_dir.path()).await;

        // 创建用户
        let user_info = UserCreate {
            username: "test_user".to_string(),
            password: "hashed_pwd".to_string(),
            nickname: None,
        };

        db.create_user(user_info).await.unwrap();

        // 尝试更新不存在的笔记
        let update_info = MemoUpdate {
            content: Some("Updated content".to_string()),
            tags: None,
            refs: None,
        };

        let result = db.update_memo("test_user", &123, update_info).await;
        assert!(result.is_err());
    }

    #[tokio::test]
    async fn test_delete_memo() {
        let temp_dir = setup_temp_dir().await;
        let mut db = MdDb::new(temp_dir.path()).await;

        // 创建用户和笔记
        let user_info = UserCreate {
            username: "test_user".to_string(),
            password: "hashed_pwd".to_string(),
            nickname: None,
        };

        db.create_user(user_info).await.unwrap();

        let memo_info = MemoCreate {
            content: "Test content".to_string(),
            tags: vec!["tag1".to_string()],
            refs: vec![],
        };

        let memo = db.create_memo("test_user", memo_info, 123).await.unwrap();
        let memo_id = memo.id();

        // 删除笔记
        let deleted_memo = db.delete_memo("test_user", memo_id).await.unwrap();

        // 验证删除的笔记信息
        assert_eq!(deleted_memo.id(), memo_id);

        // 验证笔记已被删除
        assert!(db.get_memo("test_user", memo_id).await.is_err());
    }

    #[tokio::test]
    async fn test_delete_nonexistent_memo() {
        let temp_dir = setup_temp_dir().await;
        let mut db = MdDb::new(temp_dir.path()).await;

        // 创建用户
        let user_info = UserCreate {
            username: "test_user".to_string(),
            password: "hashed_pwd".to_string(),
            nickname: None,
        };

        db.create_user(user_info).await.unwrap();

        // 尝试删除不存在的笔记
        let result = db.delete_memo("test_user", &123).await;
        assert!(result.is_err());
    }

    #[tokio::test]
    async fn test_search_memo_ids_for_nonexistent_user() {
        let temp_dir = setup_temp_dir().await;
        let db = MdDb::new(temp_dir.path()).await;

        let result = db
            .search_memo_hits(
                "missing_user",
                &MemoSearchQuery {
                    text: Some(MemoTextFilter {
                        contains: "axum".to_string(),
                    }),
                    ..MemoSearchQuery::default()
                },
                None,
            )
            .await;

        assert!(matches!(result, Err(WeimoError::UserNotFound(_))));
    }

    #[tokio::test]
    async fn test_get_memo() {
        let temp_dir = setup_temp_dir().await;
        let mut db = MdDb::new(temp_dir.path()).await;

        // 创建用户和笔记
        let user_info = UserCreate {
            username: "test_user".to_string(),
            password: "hashed_pwd".to_string(),
            nickname: None,
        };

        db.create_user(user_info).await.unwrap();

        let memo_info = MemoCreate {
            content: "Test content".to_string(),
            tags: vec!["tag1".to_string(), "tag2".to_string()],
            refs: vec![],
        };

        let memo = db.create_memo("test_user", memo_info, 123).await.unwrap();
        let memo_id = memo.id();

        // 获取笔记
        let retrieved_memo = db.get_memo("test_user", memo_id).await.unwrap();

        // 验证笔记信息
        assert_eq!(retrieved_memo.id(), memo_id);
        assert_eq!(retrieved_memo.tags(), &["tag1", "tag2"]);
    }

    #[tokio::test]
    async fn test_get_memos() {
        let temp_dir = setup_temp_dir().await;
        let mut db = MdDb::new(temp_dir.path()).await;

        // 创建用户
        let user_info = UserCreate {
            username: "test_user".to_string(),
            password: "hashed_pwd".to_string(),
            nickname: None,
        };

        db.create_user(user_info).await.unwrap();

        // 创建多个笔记
        let memo_info1 = MemoCreate {
            content: "Memo 1".to_string(),
            tags: vec!["tag1".to_string(), "common".to_string()],
            refs: vec![],
        };

        let memo_info2 = MemoCreate {
            content: "Memo 2".to_string(),
            tags: vec!["tag2".to_string(), "common".to_string()],
            refs: vec![],
        };

        let memo_info3 = MemoCreate {
            content: "Memo 3".to_string(),
            tags: vec!["tag3".to_string()],
            refs: vec![],
        };

        let memo1 = db.create_memo("test_user", memo_info1, 101).await.unwrap();
        let memo2 = db.create_memo("test_user", memo_info2, 102).await.unwrap();
        let memo3 = db.create_memo("test_user", memo_info3, 103).await.unwrap();

        // 获取部分笔记
        let memo_ids = vec![*memo1.id(), *memo2.id()];
        let memos = db.get_memos("test_user", &memo_ids).await.unwrap();

        // 验证返回了正确数量的笔记
        assert_eq!(memos.len(), 2);

        // 验证笔记内容
        let mut found_memo1 = false;
        let mut found_memo2 = false;

        for memo in &memos {
            if memo.id() == memo1.id() {
                found_memo1 = true;
                assert_eq!(memo.tags(), &["tag1", "common"]);
            } else if memo.id() == memo2.id() {
                found_memo2 = true;
                assert_eq!(memo.tags(), &["tag2", "common"]);
            }
        }

        assert!(found_memo1, "Memo 1 not found in results");
        assert!(found_memo2, "Memo 2 not found in results");

        // 测试获取所有笔记
        let all_memo_ids = vec![*memo1.id(), *memo2.id(), *memo3.id()];
        let all_memos = db.get_memos("test_user", &all_memo_ids).await.unwrap();

        assert_eq!(all_memos.len(), 3);

        // 测试获取不存在的笔记ID
        let non_existent_id = 999;
        let invalid_ids = vec![*memo1.id(), non_existent_id];
        let result = db.get_memos("test_user", &invalid_ids).await;

        // 应该失败，因为有一个笔记不存在
        assert!(result.is_err());

        // 测试对不存在的用户获取笔记
        let result = db.get_memos("nonexistent_user", &memo_ids).await;
        assert!(result.is_err());
    }

    #[tokio::test]
    async fn test_memo_ids() {
        let temp_dir = setup_temp_dir().await;
        let mut db = MdDb::new(temp_dir.path()).await;

        // 创建用户
        let user_info = UserCreate {
            username: "test_user".to_string(),
            password: "hashed_pwd".to_string(),
            nickname: None,
        };

        db.create_user(user_info).await.unwrap();

        // 创建多个笔记
        let memo_info1 = MemoCreate {
            content: "Memo 1".to_string(),
            tags: vec!["tag1".to_string()],
            refs: vec![],
        };

        let memo_info2 = MemoCreate {
            content: "Memo 2".to_string(),
            tags: vec!["tag2".to_string()],
            refs: vec![],
        };

        let memo1 = db.create_memo("test_user", memo_info1, 123).await.unwrap();
        let memo2 = db.create_memo("test_user", memo_info2, 124).await.unwrap();

        // 获取笔记ID列表
        let memo_ids = db.get_memo_ids("test_user").await;

        // 验证包含两个笔记ID
        assert_eq!(memo_ids.len(), 2);
        assert!(memo_ids.contains(memo1.id()));
        assert!(memo_ids.contains(memo2.id()));
    }

    #[tokio::test]
    async fn test_persistence() {
        let temp_dir = setup_temp_dir().await;
        let temp_path = temp_dir.path().to_path_buf();

        // 创建数据库实例并添加数据
        {
            let mut db = MdDb::new(&temp_path).await;

            // 创建用户
            let user_info = UserCreate {
                username: "test_user".to_string(),
                password: "hashed_pwd".to_string(),
                nickname: Some("Test User".to_string()),
            };

            db.create_user(user_info).await.unwrap();

            // 创建笔记
            let memo_info = MemoCreate {
                content: "Test content".to_string(),
                tags: vec!["tag1".to_string()],
                refs: vec![],
            };

            let memo = db.create_memo("test_user", memo_info, 123).await.unwrap();
            let _memo_id = memo.id();
        }

        // 创建新的数据库实例并验证数据
        {
            let db = MdDb::new(&temp_path).await;

            // 验证用户存在
            assert!(db.user_exists("test_user").await);

            // 验证用户信息
            let user = db.get_user("test_user").await.unwrap();
            assert_eq!(user.username(), "test_user");
            assert_eq!(user.nickname(), "Test User");

            // 验证笔记IDs
            let memo_ids = db.get_memo_ids("test_user").await;
            assert_eq!(memo_ids.len(), 1);

            // 验证笔记内容
            let memo = db.get_memo("test_user", &memo_ids[0]).await.unwrap();
            assert_eq!(memo.tags(), &["tag1"]);
        }
    }
}
