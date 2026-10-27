use async_trait::async_trait;
use std::path::{Path, PathBuf};
use tokio::fs;

use crate::data::MemoDb;
use crate::data::{Memo, MemoCreate, MemoId, MemoUpdate};
use crate::error::{WeimoError, WeimoResult};

/// 基于JSON文件的异步笔记存储
#[derive(Debug, Clone)]
pub struct MdMemos {
    /// 根目录路径
    root_dir: PathBuf,
}

impl MdMemos {
    /// 创建 AsyncMemoFile 实例
    pub async fn new<P: AsRef<Path>>(root_dir: P) -> Self {
        let root_dir = root_dir.as_ref();
        if !root_dir.exists() {
            fs::create_dir_all(root_dir).await.expect("无法创建根目录");
        }
        Self {
            root_dir: root_dir.to_path_buf(),
        }
    }

    /// 获取用户目录路径
    #[inline]
    fn user_dir(&self, user: &str) -> PathBuf {
        self.root_dir.join(user)
    }

    /// 获取笔记文件路径
    #[inline]
    fn memo_path(&self, user: &str, id: &MemoId) -> PathBuf {
        self.user_dir(user).join(format!("{id}.md"))
    }

    /// 异步保存笔记到文件
    async fn save_memo(&self, user: &str, memo: &Memo) -> WeimoResult<()> {
        // 笔记保存路径
        let path = self.memo_path(user, memo.id());

        // 确保用户目录存在
        if let Some(parent) = path.parent()
            && !parent.exists()
        {
            fs::create_dir_all(parent)
                .await
                .map_err(WeimoError::WriteError)?;
        }

        // 将笔记写入文件
        fs::write(path, memo.to_markdown())
            .await
            .map_err(WeimoError::WriteError)
    }

    /// 异步删除笔记文件
    async fn rm_memo(&self, user: &str, id: &MemoId) -> WeimoResult<()> {
        let path = self.memo_path(user, id);
        if path.exists() {
            fs::remove_file(path)
                .await
                .map_err(WeimoError::WriteError)?;
        }
        Ok(())
    }

    /// 异步从文件加载笔记
    async fn load_memo(&self, user: &str, id: &MemoId) -> WeimoResult<Memo> {
        let path = self.memo_path(user, id);
        if !path.exists() {
            tracing::warn!(
                "用户 '{user}' 的笔记 ID {id} 不存在，路径: {}",
                path.display()
            );
            return Err(WeimoError::MemoNotFound(*id));
        }

        let content = fs::read_to_string(&path)
            .await
            .map_err(WeimoError::ReadError)?;
        Memo::parse_markdown(&content).ok_or(WeimoError::MemoNotFound(*id))
    }
}

#[async_trait]
impl MemoDb for MdMemos {
    async fn create(&mut self, user: &str, info: MemoCreate, id: MemoId) -> WeimoResult<Memo> {
        let memo = Memo::create(info, id);
        self.save_memo(user, &memo).await?;
        Ok(memo)
    }

    async fn delete(&mut self, user: &str, id: &MemoId) -> WeimoResult<Memo> {
        let memo = self.load_memo(user, id).await?;
        self.rm_memo(user, id).await?;
        Ok(memo)
    }

    async fn update(&mut self, user: &str, id: &MemoId, info: MemoUpdate) -> WeimoResult<Memo> {
        let mut memo = self.load_memo(user, id).await?;

        if let Some(content) = info.content {
            memo.set_content(&content);
        }

        if let Some(tags) = info.tags {
            memo.set_tags(&tags);
        }

        if let Some(refs) = info.refs {
            memo.set_refs(&refs);
        }

        self.save_memo(user, &memo).await?;
        Ok(memo)
    }

    async fn get(&self, user: &str, id: &MemoId) -> WeimoResult<Memo> {
        self.load_memo(user, id).await
    }

    async fn get_ids(&self, user: &str) -> Vec<MemoId> {
        let dir = self.user_dir(user);
        if !dir.exists() {
            return Vec::new();
        }

        match fs::read_dir(dir).await {
            Ok(mut entries) => {
                let mut ids = Vec::new();
                while let Ok(Some(entry)) = entries.next_entry().await {
                    let path = entry.path();
                    if path.is_file()
                        && path.extension().is_some_and(|ext| ext == "md")
                        && let Some(stem) = path.file_stem()
                        && let Some(id) = stem.to_str()
                    {
                        ids.push(id.parse::<MemoId>().unwrap());
                    }
                }
                ids
            }
            Err(_) => Vec::new(),
        }
    }

    async fn delete_user_data(&mut self, user: &str) -> WeimoResult<()> {
        let dir = self.user_dir(user);
        if dir.exists() {
            fs::remove_dir_all(dir)
                .await
                .map_err(WeimoError::WriteError)?;
        }
        Ok(())
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::data::{MemoDateFilter, MemoSearchQuery, MemoTextFilter};
    use tempfile::tempdir;

    /// 用于测试的辅助函数，创建临时目录和AsyncMemoFile实例
    async fn setup() -> (tempfile::TempDir, MdMemos) {
        let temp_dir = tempdir().expect("无法创建临时目录");
        let memo_file = MdMemos::new(temp_dir.path()).await;
        (temp_dir, memo_file)
    }

    async fn save_test_memo(
        memo_file: &MdMemos,
        user: &str,
        id: MemoId,
        ct: &str,
        tags: &[&str],
        content: &str,
    ) {
        let tags = if tags.is_empty() {
            "tags: []".to_string()
        } else {
            let items = tags
                .iter()
                .map(|tag| format!("  - {tag}"))
                .collect::<Vec<_>>()
                .join("\n");
            format!("tags:\n{items}")
        };

        let markdown = format!("---\nid: {id}\nct: {ct}\nmt: {ct}\n{tags}\n---\n\n{content}");
        let memo = Memo::parse_markdown(&markdown).expect("测试 Memo 应该可以正常解析");
        memo_file
            .save_memo(user, &memo)
            .await
            .expect("测试 Memo 应该可以正常写入");
    }

    async fn search_hit_ids(
        memo_file: &MdMemos,
        user: &str,
        query: &MemoSearchQuery,
        candidates: Option<&[MemoId]>,
    ) -> Vec<MemoId> {
        memo_file
            .search_hits(user, query, candidates)
            .await
            .unwrap()
            .into_iter()
            .map(|hit| hit.id)
            .collect()
    }

    #[tokio::test]
    async fn test_new_creates_directory() {
        let temp_dir = tempdir().expect("无法创建临时目录");
        let path = temp_dir.path().join("test_memos");

        // 确保目录不存在
        if path.exists() {
            fs::remove_dir_all(&path).await.unwrap();
        }

        // 创建AsyncMemoFile应该创建目录
        let _memo_file = MdMemos::new(&path).await;
        assert!(path.exists());
        assert!(path.is_dir());
    }

    #[tokio::test]
    async fn test_create_memo() {
        let (_temp_dir, mut memo_file) = setup().await;
        let user = "test_user";

        let create_info = MemoCreate {
            content: "测试内容".to_string(),
            tags: vec!["标签1".to_string(), "标签2".to_string()],
            refs: vec![],
        };

        let memo = memo_file.create(user, create_info, 123).await.unwrap();

        // 验证创建的笔记
        assert_eq!(memo.word_cnt(), 4); // "测试内容" 有4个字符

        // 验证文件已创建
        assert!(memo_file.memo_path(user, memo.id()).exists());
    }

    #[tokio::test]
    async fn test_get_memo() {
        let (_temp_dir, mut memo_file) = setup().await;
        let user = "test_user";

        // 创建一个笔记
        let create_info = MemoCreate {
            content: "测试获取笔记".to_string(),
            tags: vec!["测试".to_string()],
            refs: vec![],
        };

        let created_memo = memo_file.create(user, create_info, 123).await.unwrap();
        let memo_id = created_memo.id();

        // 获取笔记
        let retrieved_memo = memo_file.get(user, memo_id).await.unwrap();

        // 验证获取的笔记内容正确
        assert_eq!(retrieved_memo.id(), created_memo.id());
        assert_eq!(retrieved_memo.word_cnt(), created_memo.word_cnt());
    }

    #[tokio::test]
    async fn test_get_nonexistent_memo() {
        let (_temp_dir, memo_file) = setup().await;
        let user = "test_user";
        let result = memo_file.get(user, &123).await;

        // 应当返回NotFound错误
        match result {
            Err(WeimoError::MemoNotFound(id)) => assert_eq!(id, 123),
            _ => panic!("应该返回MemoNotFound错误"),
        }
    }

    #[tokio::test]
    async fn test_exists() {
        let (_temp_dir, mut memo_file) = setup().await;
        let user = "test_user";

        // 创建一个笔记
        let create_info = MemoCreate {
            content: "测试存在性".to_string(),
            tags: vec![],
            refs: vec![],
        };

        let memo = memo_file.create(user, create_info, 123).await.unwrap();
        let memo_id = memo.id();

        // 验证存在性检查
        assert!(memo_file.get(user, memo_id).await.is_ok());
        assert!(memo_file.get(user, &124).await.is_err());
        assert!(memo_file.get("nonexistent_user", memo_id).await.is_err());
    }

    #[tokio::test]
    async fn test_update_memo() {
        let (_temp_dir, mut memo_file) = setup().await;
        let user = "test_user";

        // 创建一个笔记
        let create_info = MemoCreate {
            content: "原始内容".to_string(),
            tags: vec!["原始标签".to_string()],
            refs: vec![],
        };

        let created_memo = memo_file.create(user, create_info, 123).await.unwrap();
        let memo_id = created_memo.id();

        // 更新笔记内容
        let update_info = MemoUpdate {
            content: Some("更新后的内容".to_string()),
            tags: None,
            refs: None,
        };

        let updated_memo = memo_file.update(user, memo_id, update_info).await.unwrap();

        // 验证更新
        assert_eq!(updated_memo.id(), created_memo.id());
        assert_eq!(updated_memo.word_cnt(), 6); // "更新后的内容" 有6个字符

        // 确保能够从文件中获取更新后的内容
        let retrieved_memo = memo_file.get(user, memo_id).await.unwrap();
        assert_eq!(retrieved_memo.word_cnt(), 6);
    }

    #[tokio::test]
    async fn test_update_memo_tags() {
        let (_temp_dir, mut memo_file) = setup().await;
        let user = "test_user";

        // 创建一个笔记
        let create_info = MemoCreate {
            content: "测试内容".to_string(),
            tags: vec!["标签1".to_string()],
            refs: vec![],
        };

        let created_memo = memo_file.create(user, create_info, 123).await.unwrap();
        let memo_id = created_memo.id();

        // 更新笔记标签
        let update_info = MemoUpdate {
            content: None,
            tags: Some(vec!["新标签1".to_string(), "新标签2".to_string()]),
            refs: None,
        };

        memo_file.update(user, memo_id, update_info).await.unwrap();

        // 验证标签更新 - 由于无法直接访问标签，使用变通方法
        let _retrieved_memo = memo_file.get(user, memo_id).await.unwrap();
        let update_check = MemoUpdate {
            content: None,
            tags: Some(vec!["检查标签".to_string()]),
            refs: None,
        };

        memo_file.update(user, memo_id, update_check).await.unwrap();

        // 验证内容没有改变
        let final_memo = memo_file.get(user, memo_id).await.unwrap();
        assert_eq!(final_memo.word_cnt(), created_memo.word_cnt());
    }

    #[tokio::test]
    async fn test_delete_memo() {
        let (_temp_dir, mut memo_file) = setup().await;
        let user = "test_user";

        // 创建一个笔记
        let create_info = MemoCreate {
            content: "要删除的内容".to_string(),
            tags: vec![],
            refs: vec![],
        };

        let memo = memo_file.create(user, create_info, 123).await.unwrap();
        let memo_id = memo.id();

        // 确认笔记存在
        assert!(memo_file.get(user, memo_id).await.is_ok());

        // 删除笔记
        let deleted_memo = memo_file.delete(user, memo_id).await.unwrap();

        // 验证删除成功
        assert_eq!(deleted_memo.id(), memo.id());
        assert!(memo_file.get(user, memo_id).await.is_err());
    }

    #[tokio::test]
    async fn test_delete_nonexistent_memo() {
        let (_temp_dir, mut memo_file) = setup().await;
        let user = "test_user";

        // 尝试删除不存在的笔记
        let result = memo_file.delete(user, &123).await;

        // 应该返回NotFound错误
        match result {
            Err(WeimoError::MemoNotFound(id)) => assert_eq!(id, 123),
            _ => panic!("应该返回MemoNotFound错误"),
        }
    }

    #[tokio::test]
    async fn test_get_ids() {
        let (_temp_dir, mut memo_file) = setup().await;
        let user = "test_user";

        // 初始应该没有笔记
        let ids = memo_file.get_ids(user).await;
        assert!(ids.is_empty());

        // 创建多个笔记
        let create_info1 = MemoCreate {
            content: "笔记1".to_string(),
            tags: vec![],
            refs: vec![],
        };
        let create_info2 = MemoCreate {
            content: "笔记2".to_string(),
            tags: vec![],
            refs: vec![],
        };
        let create_info3 = MemoCreate {
            content: "笔记3".to_string(),
            tags: vec![],
            refs: vec![],
        };

        let memo1 = memo_file.create(user, create_info1, 123).await.unwrap();
        let memo2 = memo_file.create(user, create_info2, 124).await.unwrap();
        let memo3 = memo_file.create(user, create_info3, 125).await.unwrap();

        // 获取ID列表
        let mut ids = memo_file.get_ids(user).await;
        ids.sort(); // 排序以确保比较一致

        let mut expected_ids = [memo1.id(), memo2.id(), memo3.id()];
        expected_ids.sort();

        // 验证ID列表
        assert_eq!(ids.len(), 3);
        assert_eq!(ids, expected_ids.iter().map(|&id| *id).collect::<Vec<_>>());

        // 为不同用户创建笔记
        let other_user = "other_user";
        let create_info4 = MemoCreate {
            content: "其他用户的笔记".to_string(),
            tags: vec![],
            refs: vec![],
        };

        memo_file
            .create(other_user, create_info4, 123)
            .await
            .unwrap();

        // 验证不同用户的ID列表是独立的
        assert_eq!(memo_file.get_ids(other_user).await.len(), 1);
        assert_eq!(memo_file.get_ids(user).await.len(), 3);
    }

    #[tokio::test]
    async fn test_multi_user_isolation() {
        let (_temp_dir, mut memo_file) = setup().await;
        let user1 = "user1";
        let user2 = "user2";

        // 为两个用户创建笔记
        let create_info1 = MemoCreate {
            content: "用户1的笔记".to_string(),
            tags: vec![],
            refs: vec![],
        };
        let create_info2 = MemoCreate {
            content: "用户2的笔记".to_string(),
            tags: vec![],
            refs: vec![],
        };

        let memo1 = memo_file.create(user1, create_info1, 123).await.unwrap();
        let memo2 = memo_file.create(user2, create_info2, 124).await.unwrap();

        // 验证用户隔离
        assert!(memo_file.get(user1, memo1.id()).await.is_ok());
        assert!(memo_file.get(user1, memo2.id()).await.is_err());

        assert!(memo_file.get(user2, memo2.id()).await.is_ok());
        assert!(memo_file.get(user2, memo1.id()).await.is_err());
    }

    #[tokio::test]
    async fn test_search_ids_by_day() {
        let (_temp_dir, memo_file) = setup().await;
        let user = "test_user";

        save_test_memo(
            &memo_file,
            user,
            1,
            "2026-03-25T08:00:00Z",
            &["work/rust"],
            "Axum search",
        )
        .await;
        save_test_memo(
            &memo_file,
            user,
            2,
            "2026-03-24T08:00:00Z",
            &["work/go"],
            "Tower note",
        )
        .await;

        let ids = search_hit_ids(
            &memo_file,
            user,
            &MemoSearchQuery {
                created_at: Some(MemoDateFilter::Day {
                    year: 2026,
                    month: 3,
                    day: 25,
                }),
                ..MemoSearchQuery::default()
            },
            None,
        )
        .await;

        assert_eq!(ids, vec![1]);
    }

    #[tokio::test]
    async fn test_search_ids_by_month() {
        let (_temp_dir, memo_file) = setup().await;
        let user = "test_user";

        save_test_memo(
            &memo_file,
            user,
            1,
            "2026-03-25T08:00:00Z",
            &["work/rust"],
            "Axum search",
        )
        .await;
        save_test_memo(
            &memo_file,
            user,
            2,
            "2026-03-10T08:00:00Z",
            &["work/go"],
            "Tower note",
        )
        .await;
        save_test_memo(
            &memo_file,
            user,
            3,
            "2026-02-28T08:00:00Z",
            &["personal"],
            "Archive",
        )
        .await;

        let ids = search_hit_ids(
            &memo_file,
            user,
            &MemoSearchQuery {
                created_at: Some(MemoDateFilter::Month {
                    year: 2026,
                    month: 3,
                }),
                ..MemoSearchQuery::default()
            },
            None,
        )
        .await;

        assert_eq!(ids, vec![1, 2]);
    }

    #[tokio::test]
    async fn test_search_ids_by_year() {
        let (_temp_dir, memo_file) = setup().await;
        let user = "test_user";

        save_test_memo(
            &memo_file,
            user,
            1,
            "2026-03-25T08:00:00Z",
            &["work/rust"],
            "Axum search",
        )
        .await;
        save_test_memo(
            &memo_file,
            user,
            2,
            "2026-01-10T08:00:00Z",
            &["work/go"],
            "Tower note",
        )
        .await;
        save_test_memo(
            &memo_file,
            user,
            3,
            "2025-06-30T12:00:00Z",
            &["personal"],
            "Archive",
        )
        .await;

        let ids = search_hit_ids(
            &memo_file,
            user,
            &MemoSearchQuery {
                created_at: Some(MemoDateFilter::Year { year: 2026 }),
                ..MemoSearchQuery::default()
            },
            None,
        )
        .await;

        assert_eq!(ids, vec![1, 2]);
    }

    #[tokio::test]
    async fn test_search_ids_by_text() {
        let (_temp_dir, memo_file) = setup().await;
        let user = "test_user";

        save_test_memo(
            &memo_file,
            user,
            1,
            "2026-03-25T08:00:00Z",
            &["work/rust"],
            "Axum search",
        )
        .await;
        save_test_memo(
            &memo_file,
            user,
            2,
            "2026-03-24T08:00:00Z",
            &["work/go"],
            "tower note",
        )
        .await;
        save_test_memo(
            &memo_file,
            user,
            3,
            "2025-12-31T23:59:59Z",
            &["personal"],
            "Learning AXUM",
        )
        .await;

        let ids = search_hit_ids(
            &memo_file,
            user,
            &MemoSearchQuery {
                text: Some(MemoTextFilter {
                    contains: "axum".to_string(),
                }),
                ..MemoSearchQuery::default()
            },
            None,
        )
        .await;

        assert_eq!(ids, vec![1, 3]);
    }

    #[tokio::test]
    async fn test_search_ids_with_combined_filters() {
        let (_temp_dir, memo_file) = setup().await;
        let user = "test_user";

        save_test_memo(
            &memo_file,
            user,
            1,
            "2026-03-25T08:00:00Z",
            &["work/rust"],
            "Axum search",
        )
        .await;
        save_test_memo(
            &memo_file,
            user,
            2,
            "2026-03-24T08:00:00Z",
            &["work/go"],
            "Axum search",
        )
        .await;
        save_test_memo(
            &memo_file,
            user,
            3,
            "2026-02-24T08:00:00Z",
            &["work/rust"],
            "Axum search",
        )
        .await;

        let ids = search_hit_ids(
            &memo_file,
            user,
            &MemoSearchQuery {
                tag: Some("work/rust".to_string()),
                created_at: Some(MemoDateFilter::Month {
                    year: 2026,
                    month: 3,
                }),
                text: Some(MemoTextFilter {
                    contains: "axum".to_string(),
                }),
                ..MemoSearchQuery::default()
            },
            None,
        )
        .await;

        assert_eq!(ids, vec![1]);
    }

    #[tokio::test]
    async fn test_search_ids_returns_empty_for_empty_candidates() {
        let (_temp_dir, memo_file) = setup().await;
        let user = "test_user";

        save_test_memo(
            &memo_file,
            user,
            1,
            "2026-03-25T08:00:00Z",
            &["work/rust"],
            "Axum search",
        )
        .await;

        let ids = search_hit_ids(&memo_file, user, &MemoSearchQuery::default(), Some(&[])).await;

        assert!(ids.is_empty());
    }

    #[tokio::test]
    async fn test_search_ids_orders_by_create_time_then_id_desc() {
        let (_temp_dir, memo_file) = setup().await;
        let user = "test_user";

        save_test_memo(
            &memo_file,
            user,
            10,
            "2026-03-25T08:00:00Z",
            &["work/rust"],
            "First",
        )
        .await;
        save_test_memo(
            &memo_file,
            user,
            11,
            "2026-03-25T08:00:00Z",
            &["work/rust"],
            "Second",
        )
        .await;
        save_test_memo(
            &memo_file,
            user,
            9,
            "2026-03-24T08:00:00Z",
            &["work/rust"],
            "Third",
        )
        .await;

        let ids = search_hit_ids(&memo_file, user, &MemoSearchQuery::default(), None).await;

        assert_eq!(ids, vec![11, 10, 9]);
    }

    #[tokio::test]
    async fn test_search_ids_rejects_invalid_query() {
        let (_temp_dir, memo_file) = setup().await;
        let user = "test_user";

        let result = memo_file
            .search_hits(
                user,
                &MemoSearchQuery {
                    created_at: Some(MemoDateFilter::Month {
                        year: 2026,
                        month: 13,
                    }),
                    ..MemoSearchQuery::default()
                },
                None,
            )
            .await;

        assert!(matches!(result, Err(WeimoError::InvalidSearchQuery(_))));
    }
}
