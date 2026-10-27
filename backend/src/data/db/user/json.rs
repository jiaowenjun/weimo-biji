use async_trait::async_trait;
use std::{
    collections::HashMap,
    path::{Path, PathBuf},
};
use tokio::{fs, io};

use crate::data::UserDb;
use crate::data::{User, UserCreate};
use crate::error::{WeimoError, WeimoResult};

/// 用户数据文件管理结构
///
/// 提供基于文件系统的用户信息持久化存储
#[derive(Debug, Clone)]
pub struct JsonUsers {
    path: PathBuf,
    users: HashMap<String, User>,
}

impl JsonUsers {
    /// 创建新的用户文件管理器
    ///
    /// # 参数
    /// * `path` - 用户数据文件路径
    ///
    /// 如果文件不存在或格式不正确，将创建一个空的用户集合
    pub async fn new<P: AsRef<Path>>(path: P) -> Self {
        if !path.as_ref().exists() {
            fs::create_dir_all(path.as_ref().parent().unwrap())
                .await
                .unwrap();
            fs::write(path.as_ref(), "[]").await.unwrap();
        }
        let users = fs::read_to_string(&path)
            .await
            .ok()
            .and_then(|content| serde_json::from_str::<Vec<User>>(&content).ok())
            .unwrap_or_default()
            .into_iter()
            .map(|user| (user.username().to_string(), user))
            .collect();

        Self {
            path: path.as_ref().to_path_buf(),
            users,
        }
    }

    /// 将用户数据保存到文件
    async fn save(&self) -> io::Result<()> {
        let users: Vec<&User> = self.users.values().collect();
        let json = serde_json::to_string(&users)?;
        fs::write(&self.path, json).await
    }

    /// 获取用户，如果不存在则返回错误
    fn get_user_or_error(&self, username: &str) -> WeimoResult<&User> {
        self.users
            .get(username)
            .ok_or_else(|| WeimoError::UserNotFound(username.to_string()))
    }

    /// 获取用户的可变引用，如果不存在则返回错误
    fn get_user_mut_or_error(&mut self, username: &str) -> WeimoResult<&mut User> {
        self.users
            .get_mut(username)
            .ok_or_else(|| WeimoError::UserNotFound(username.to_string()))
    }

    fn find_by_wechat_openid(&self, openid: &str) -> Option<User> {
        self.users
            .values()
            .find(|user| user.wechat_openid() == Some(openid))
            .cloned()
    }

    fn find_by_login_name(&self, login_name: &str) -> Option<User> {
        self.users
            .values()
            .find(|user| user.login_name() == login_name)
            .cloned()
    }

    fn login_identifier_available(&self, candidate: &str) -> bool {
        !self.users.contains_key(candidate)
            && !self
                .users
                .values()
                .any(|user| user.login_name() == candidate)
    }

    fn ensure_login_name_available(
        &self,
        current_username: &str,
        login_name: &str,
    ) -> WeimoResult<()> {
        let conflict = self.users.values().any(|user| {
            user.username() != current_username
                && (user.username() == login_name || user.login_name() == login_name)
        });

        if conflict {
            Err(WeimoError::LoginNameAlreadyExists(login_name.to_string()))
        } else {
            Ok(())
        }
    }

    fn unique_wechat_username(&self, openid: &str) -> String {
        let sanitized = openid
            .chars()
            .filter(|ch| ch.is_ascii_alphanumeric())
            .collect::<String>()
            .to_lowercase();
        let suffix_source = if sanitized.is_empty() {
            "guest".to_string()
        } else {
            sanitized
        };
        let suffix_len = suffix_source.len();
        let short_suffix = &suffix_source[suffix_len.saturating_sub(8)..];
        let base = format!("wx_{short_suffix}");

        if self.login_identifier_available(&base) {
            return base;
        }

        for index in 2..=9999 {
            let candidate = format!("{base}_{index}");
            if self.login_identifier_available(&candidate) {
                return candidate;
            }
        }

        format!("wx_{}", uuid::Uuid::new_v4().simple())
    }
}

#[async_trait]
impl UserDb for JsonUsers {
    async fn create(&mut self, info: UserCreate) -> WeimoResult<User> {
        if self.exists(&info.username).await {
            return Err(WeimoError::UserAlreadyExists(info.username));
        }

        User::validate_username(&info.username)?;
        if self.find_by_login_name(&info.username).is_some() {
            return Err(WeimoError::LoginNameAlreadyExists(info.username));
        }

        let user = User::create(info);
        self.users.insert(user.username().to_string(), user.clone());
        self.save().await.map_err(WeimoError::WriteError)?;

        Ok(user)
    }

    async fn delete(&mut self, username: &str) -> WeimoResult<()> {
        if !self.exists(username).await {
            return Err(WeimoError::UserNotFound(username.to_string()));
        }
        self.users.remove(username);
        self.save().await.map_err(WeimoError::WriteError)?;
        Ok(())
    }

    async fn update_nickname(&mut self, username: &str, nickname: &str) -> WeimoResult<()> {
        let user = self.get_user_mut_or_error(username)?;
        user.set_nickname(nickname);
        self.save().await.map_err(WeimoError::WriteError)
    }

    async fn update_login_name(&mut self, username: &str, login_name: &str) -> WeimoResult<User> {
        let login_name = login_name.trim();
        User::validate_login_name(login_name)?;

        let current = self.get_user_or_error(username)?;
        if current.login_name() == login_name {
            return Ok(current.clone());
        }

        self.ensure_login_name_available(username, login_name)?;

        let user = self.get_user_mut_or_error(username)?;
        user.set_login_name(login_name);
        let updated = user.clone();
        self.save().await.map_err(WeimoError::WriteError)?;
        Ok(updated)
    }

    async fn update_password(&mut self, username: &str, password: &str) -> WeimoResult<User> {
        let user = self.get_user_mut_or_error(username)?;
        user.set_password(password);
        let updated = user.clone();
        self.save().await.map_err(WeimoError::WriteError)?;
        Ok(updated)
    }

    async fn get(&self, username: &str) -> WeimoResult<User> {
        self.get_user_or_error(username).cloned()
    }

    async fn get_by_wechat_openid(&self, openid: &str) -> Option<User> {
        let openid = openid.trim();
        if openid.is_empty() {
            return None;
        }

        self.find_by_wechat_openid(openid)
    }

    async fn get_by_login_name(&self, login_name: &str) -> Option<User> {
        let login_name = login_name.trim();
        if login_name.is_empty() {
            return None;
        }

        self.find_by_login_name(login_name)
    }

    async fn create_wechat_user(
        &mut self,
        openid: &str,
        unionid: Option<String>,
        nickname: Option<String>,
    ) -> WeimoResult<User> {
        let openid = openid.trim();
        if openid.is_empty() {
            return Err(WeimoError::InvalidWechatCode);
        }

        if let Some(user) = self.find_by_wechat_openid(openid) {
            return Ok(user);
        }

        let username = self.unique_wechat_username(openid);
        User::validate_username(&username)?;
        let effective_nickname = nickname
            .map(|n| n.trim().to_string())
            .filter(|n| !n.is_empty())
            .ok_or(WeimoError::NicknameRequired)?;
        let user = User::create_wechat(
            username.clone(),
            effective_nickname,
            openid.to_string(),
            unionid,
        );
        self.users.insert(username, user.clone());
        self.save().await.map_err(WeimoError::WriteError)?;

        Ok(user)
    }

    async fn get_all_users(&self) -> Vec<String> {
        self.users.keys().cloned().collect()
    }

    async fn exists(&self, username: &str) -> bool {
        self.users.contains_key(username)
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use tokio::io::AsyncWriteExt;

    async fn setup_temp_file() -> (tempfile::NamedTempFile, JsonUsers) {
        let file = tempfile::NamedTempFile::new().unwrap();
        let mut file_async = fs::File::create(file.path()).await.unwrap();
        file_async.write_all(b"[]").await.unwrap();
        let user_file = JsonUsers::new(file.path()).await;
        (file, user_file)
    }

    #[tokio::test]
    async fn test_new_user_file() {
        let file = tempfile::NamedTempFile::new().unwrap();
        let file_path = file.path();

        // 测试文件不存在的情况
        let user_file = JsonUsers::new(&file_path).await;
        assert_eq!(user_file.users.len(), 0);

        // 创建一个有用户的文件
        let user = User::create(UserCreate {
            username: "test_user".to_string(),
            password: "hashed_pwd".to_string(),
            nickname: Some("Test User".to_string()),
        });
        let users = vec![user];
        fs::write(&file_path, serde_json::to_string(&users).unwrap())
            .await
            .unwrap();

        // 测试从有内容的文件中读取
        let user_file = JsonUsers::new(&file_path).await;
        assert_eq!(user_file.users.len(), 1);
        assert!(user_file.exists("test_user").await);
    }

    #[tokio::test]
    async fn test_add_user() {
        let (_, mut user_file) = setup_temp_file().await;

        // 添加用户
        let info = UserCreate {
            username: "user1".to_string(),
            password: "pwd1".to_string(),
            nickname: Some("User One".to_string()),
        };

        let user = user_file.create(info).await.unwrap();
        assert_eq!(user.username(), "user1");
        assert_eq!(user.nickname(), "User One");
        assert!(user_file.exists("user1").await);

        // 再次添加同名用户应该失败
        let info = UserCreate {
            username: "user1".to_string(),
            password: "pwd2".to_string(),
            nickname: None,
        };

        let result = user_file.create(info).await;
        assert!(matches!(result, Err(WeimoError::UserAlreadyExists(_))));
    }

    #[tokio::test]
    async fn test_create_wechat_user_generates_ref_safe_username() {
        let (_, mut user_file) = setup_temp_file().await;

        let user = user_file
            .create_wechat_user("wx/openid with symbols", None, Some("微信用户".to_string()))
            .await
            .unwrap();

        assert!(!user.username().contains('/'));
        assert!(User::validate_username(user.username()).is_ok());
    }

    #[tokio::test]
    async fn test_delete_user() {
        let (_, mut user_file) = setup_temp_file().await;

        // 先添加一个用户
        let info = UserCreate {
            username: "user1".to_string(),
            password: "pwd1".to_string(),
            nickname: None,
        };

        user_file.create(info).await.unwrap();
        assert!(user_file.exists("user1").await);

        // 删除用户
        user_file.delete("user1").await.unwrap();
        assert!(!user_file.exists("user1").await);

        // 删除不存在的用户应该失败
        let result = user_file.delete("nonexistent").await;
        assert!(matches!(result, Err(WeimoError::UserNotFound(_))));
    }

    #[tokio::test]
    async fn test_update_nickname() {
        let (_, mut user_file) = setup_temp_file().await;

        // 先添加一个用户
        let info = UserCreate {
            username: "user1".to_string(),
            password: "pwd1".to_string(),
            nickname: Some("Original".to_string()),
        };

        user_file.create(info).await.unwrap();

        // 更新昵称
        user_file.update_nickname("user1", "Updated").await.unwrap();

        // 验证昵称已更新
        let user = user_file.get("user1").await.unwrap();
        assert_eq!(user.nickname(), "Updated");

        // 更新不存在用户的昵称应该失败
        let result = user_file.update_nickname("nonexistent", "New").await;
        assert!(matches!(result, Err(WeimoError::UserNotFound(_))));
    }

    #[tokio::test]
    async fn test_get_by_login_name_and_update_login_name() {
        let (_, mut user_file) = setup_temp_file().await;

        user_file
            .create(UserCreate {
                username: "alice".to_string(),
                password: "pwd1".to_string(),
                nickname: Some("Alice".to_string()),
            })
            .await
            .unwrap();

        let updated = user_file
            .update_login_name("alice", "alice-web")
            .await
            .unwrap();

        assert_eq!(updated.username(), "alice");
        assert_eq!(updated.login_name(), "alice-web");
        assert_eq!(
            user_file
                .get_by_login_name("alice-web")
                .await
                .unwrap()
                .username(),
            "alice"
        );
    }

    #[tokio::test]
    async fn test_update_login_name_rejects_other_username_and_login_name() {
        let (_, mut user_file) = setup_temp_file().await;

        user_file
            .create(UserCreate {
                username: "alice".to_string(),
                password: "pwd1".to_string(),
                nickname: None,
            })
            .await
            .unwrap();
        user_file
            .create(UserCreate {
                username: "bob".to_string(),
                password: "pwd2".to_string(),
                nickname: None,
            })
            .await
            .unwrap();
        user_file.update_login_name("bob", "bob-web").await.unwrap();

        let username_conflict = user_file.update_login_name("alice", "bob").await;
        assert!(matches!(
            username_conflict,
            Err(WeimoError::LoginNameAlreadyExists(_))
        ));

        let login_name_conflict = user_file.update_login_name("alice", "bob-web").await;
        assert!(matches!(
            login_name_conflict,
            Err(WeimoError::LoginNameAlreadyExists(_))
        ));

        user_file.update_login_name("alice", "alice").await.unwrap();
        assert_eq!(user_file.get("alice").await.unwrap().login_name(), "alice");
    }

    #[tokio::test]
    async fn test_update_password_replaces_login_password_hash() {
        let (_, mut user_file) = setup_temp_file().await;

        user_file
            .create(UserCreate {
                username: "alice".to_string(),
                password: "old-secret".to_string(),
                nickname: None,
            })
            .await
            .unwrap();

        let updated = user_file
            .update_password("alice", "new-secret")
            .await
            .unwrap();

        assert!(updated.verify_password("new-secret"));
        assert!(!updated.verify_password("old-secret"));
    }

    #[tokio::test]
    async fn test_get_user() {
        let (_, mut user_file) = setup_temp_file().await;

        // 先添加一个用户
        let info = UserCreate {
            username: "user1".to_string(),
            password: "pwd1".to_string(),
            nickname: Some("User One".to_string()),
        };

        user_file.create(info).await.unwrap();

        // 获取用户
        let user = user_file.get("user1").await.unwrap();
        assert_eq!(user.username(), "user1");
        assert_eq!(user.nickname(), "User One");

        // 获取不存在的用户应该失败
        let result = user_file.get("nonexistent").await;
        assert!(matches!(result, Err(WeimoError::UserNotFound(_))));
    }

    #[tokio::test]
    async fn test_get_all_users() {
        let (_, mut user_file) = setup_temp_file().await;

        // 添加两个用户
        user_file
            .create(UserCreate {
                username: "user1".to_string(),
                password: "pwd1".to_string(),
                nickname: None,
            })
            .await
            .unwrap();

        user_file
            .create(UserCreate {
                username: "user2".to_string(),
                password: "pwd2".to_string(),
                nickname: None,
            })
            .await
            .unwrap();

        // 获取所有用户
        let users = user_file.get_all_users().await;
        assert_eq!(users.len(), 2);
        assert!(users.contains(&"user1".to_string()));
        assert!(users.contains(&"user2".to_string()));
    }

    #[tokio::test]
    async fn test_exists() {
        let (_, mut user_file) = setup_temp_file().await;

        // 检查不存在的用户
        assert!(!user_file.exists("user1").await);

        // 添加用户
        user_file
            .create(UserCreate {
                username: "user1".to_string(),
                password: "pwd1".to_string(),
                nickname: None,
            })
            .await
            .unwrap();

        // 检查存在的用户
        assert!(user_file.exists("user1").await);
    }

    #[tokio::test]
    async fn test_create_wechat_user_reuses_existing_openid() {
        let (_, mut user_file) = setup_temp_file().await;

        let first = user_file
            .create_wechat_user(
                "openid-1",
                Some("unionid-1".to_string()),
                Some("测试用户".to_string()),
            )
            .await
            .unwrap();
        let second = user_file
            .create_wechat_user("openid-1", Some("unionid-1".to_string()), None)
            .await
            .unwrap();

        assert_eq!(first.username(), second.username());
        assert_eq!(user_file.get_all_users().await.len(), 1);
    }

    #[tokio::test]
    async fn test_get_by_wechat_openid() {
        let (_, mut user_file) = setup_temp_file().await;
        let user = user_file
            .create_wechat_user("openid-lookup", None, Some("查找用户".to_string()))
            .await
            .unwrap();

        let found = user_file.get_by_wechat_openid("openid-lookup").await;
        assert_eq!(found.as_ref().map(User::username), Some(user.username()));
    }

    #[tokio::test]
    async fn test_invalid_json_format() {
        let file = tempfile::NamedTempFile::new().unwrap();
        let file_path = file.path();

        // 写入无效的JSON
        fs::write(&file_path, b"{invalid json}").await.unwrap();

        // 应该创建一个空的用户集合
        let user_file = JsonUsers::new(&file_path).await;
        assert_eq!(user_file.users.len(), 0);
    }

    #[tokio::test]
    async fn test_empty_username() {
        let (_, mut user_file) = setup_temp_file().await;

        let result = user_file
            .create(UserCreate {
                username: "".to_string(),
                password: "pwd".to_string(),
                nickname: None,
            })
            .await;

        assert!(matches!(result, Err(WeimoError::InvalidUsername(_))));
    }

    #[tokio::test]
    async fn test_file_persistence() {
        let file = tempfile::NamedTempFile::new().unwrap();
        let file_path = file.path();

        // 创建并添加用户
        {
            let mut user_file = JsonUsers::new(&file_path).await;
            user_file
                .create(UserCreate {
                    username: "test_user".to_string(),
                    password: "pwd".to_string(),
                    nickname: Some("Test".to_string()),
                })
                .await
                .unwrap();
        }

        // 重新加载文件并验证
        let user_file = JsonUsers::new(&file_path).await;
        assert!(user_file.exists("test_user").await);
        assert_eq!(user_file.get("test_user").await.unwrap().nickname(), "Test");
    }
}
