//! 用户数据模型
//!
//! 本模块包含与用户相关的数据结构和操作，包括用户的创建、查询等功能。
//! 提供了用户数据模型(`User`)和用户操作的错误处理(`UserError`)。

use crate::auth::password;
use serde::{Deserialize, Deserializer, Serialize};
use uuid::Uuid;

const HASH_COST: u32 = 8;
const USERNAME_MAX_LEN: usize = 32;

/// 创建新用户所需信息
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct UserCreate {
    /// 用户名，作为唯一标识符
    pub username: String,
    /// 密码
    pub password: String,
    /// 可选昵称，默认使用用户名为昵称
    pub nickname: Option<String>,
}

/// 用户数据模型
#[derive(Debug, Clone, Serialize)]
pub struct User {
    username: String,
    hashed_password: String,
    nickname: String,
    login_name: String,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    wechat_openid: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    wechat_unionid: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub struct UserView {
    pub username: String,
    pub nickname: String,
    pub login_name: String,
    pub has_login_password: bool,
}

#[derive(Debug, Deserialize)]
struct UserSerde {
    username: String,
    hashed_password: String,
    nickname: String,
    #[serde(default)]
    login_name: String,
    #[serde(default)]
    wechat_openid: Option<String>,
    #[serde(default)]
    wechat_unionid: Option<String>,
}

fn is_valid_login_identifier(value: &str) -> bool {
    !value.is_empty()
        && value.len() <= USERNAME_MAX_LEN
        && value
            .chars()
            .all(|ch| ch.is_ascii_alphanumeric() || matches!(ch, '_' | '-'))
}

impl<'de> Deserialize<'de> for User {
    fn deserialize<D>(deserializer: D) -> Result<Self, D::Error>
    where
        D: Deserializer<'de>,
    {
        let raw = UserSerde::deserialize(deserializer)?;
        let login_name = raw.login_name.trim();
        Ok(Self {
            username: raw.username.clone(),
            hashed_password: raw.hashed_password,
            nickname: raw.nickname,
            login_name: if login_name.is_empty() {
                raw.username
            } else {
                login_name.to_string()
            },
            wechat_openid: raw.wechat_openid,
            wechat_unionid: raw.wechat_unionid,
        })
    }
}

impl User {
    pub fn username(&self) -> &str {
        &self.username
    }

    pub fn nickname(&self) -> &str {
        &self.nickname
    }

    pub fn login_name(&self) -> &str {
        &self.login_name
    }

    #[allow(dead_code)] // 模型访问器:驱动查询走 SQL 列,保留供领域层使用
    pub fn wechat_openid(&self) -> Option<&str> {
        self.wechat_openid.as_deref()
    }

    pub fn verify_password(&self, password: &str) -> bool {
        password::verify_password(password, &self.hashed_password).unwrap_or(false)
    }

    pub fn has_login_password(&self) -> bool {
        !self.hashed_password.is_empty()
    }

    pub fn set_nickname(&mut self, nickname: &str) {
        self.nickname = nickname.to_string();
    }

    pub fn set_login_name(&mut self, login_name: &str) {
        self.login_name = login_name.to_string();
    }

    pub fn set_password(&mut self, password: &str) {
        self.hashed_password = password::hash_password_with_cost(password, HASH_COST)
            .unwrap_or_else(|_| panic!("密码 {password} 哈希化失败"));
    }

    pub fn validate_username(username: &str) -> crate::error::WeimoResult<()> {
        if is_valid_login_identifier(username) {
            Ok(())
        } else {
            Err(crate::error::WeimoError::InvalidUsername(
                username.to_string(),
            ))
        }
    }

    pub fn validate_login_name(login_name: &str) -> crate::error::WeimoResult<()> {
        if is_valid_login_identifier(login_name) {
            Ok(())
        } else {
            Err(crate::error::WeimoError::InvalidLoginName(
                login_name.to_string(),
            ))
        }
    }

    pub fn create(info: UserCreate) -> Self {
        let nickname = info.nickname.unwrap_or_else(|| info.username.clone());
        Self {
            login_name: info.username.clone(),
            username: info.username,
            hashed_password: password::hash_password_with_cost(&info.password, HASH_COST)
                .unwrap_or_else(|_| panic!("密码 {} 哈希化失败", info.password)),
            nickname,
            wechat_openid: None,
            wechat_unionid: None,
        }
    }

    pub fn create_wechat(
        username: String,
        nickname: String,
        openid: String,
        unionid: Option<String>,
    ) -> Self {
        let password = format!("wx:{}", Uuid::new_v4().simple());
        Self {
            login_name: username.clone(),
            username,
            hashed_password: password::hash_password_with_cost(&password, HASH_COST)
                .unwrap_or_else(|_| panic!("微信密码哈希失败: {password}")),
            nickname,
            wechat_openid: Some(openid),
            wechat_unionid: unionid,
        }
    }
}

impl From<&User> for UserView {
    fn from(value: &User) -> Self {
        Self {
            username: value.username.clone(),
            nickname: value.nickname.clone(),
            login_name: value.login_name.clone(),
            has_login_password: value.has_login_password(),
        }
    }
}

impl From<User> for UserView {
    fn from(value: User) -> Self {
        Self::from(&value)
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    /// 测试用户创建
    #[test]
    fn test_create_user_with_nickname() {
        // 准备测试数据，包含昵称
        let info = UserCreate {
            username: "test_user".to_string(),
            password: "hashed_password_123".to_string(),
            nickname: Some("测试用户".to_string()),
        };

        // 创建用户
        let user = User::create(info);

        // 验证用户信息是否正确
        assert_eq!(user.username(), "test_user");
        assert_eq!(user.nickname(), "测试用户");
        assert_eq!(user.login_name(), "test_user");
        assert!(user.has_login_password());
    }

    /// 测试不提供昵称时默认使用用户名作为昵称
    #[test]
    fn test_create_user_without_nickname() {
        // 准备测试数据，不包含昵称
        let info = UserCreate {
            username: "no_nickname_user".to_string(),
            password: "password_456".to_string(),
            nickname: None,
        };

        // 创建用户
        let user = User::create(info);

        // 验证用户信息，昵称应默认为用户名
        assert_eq!(user.username(), "no_nickname_user");
        assert_eq!(user.nickname(), "no_nickname_user");
        assert_eq!(user.login_name(), "no_nickname_user");
    }

    #[test]
    fn test_create_wechat_user_defaults_login_name_to_username() {
        let user = User::create_wechat(
            "wx_alice".to_string(),
            "微信用户".to_string(),
            "openid-alice".to_string(),
            None,
        );

        assert_eq!(user.username(), "wx_alice");
        assert_eq!(user.login_name(), "wx_alice");
        assert!(user.has_login_password());
    }

    #[test]
    fn test_validate_username_accepts_safe_ascii_names() {
        assert!(User::validate_username("alice_01").is_ok());
        assert!(User::validate_username("weimo-user").is_ok());
    }

    #[test]
    fn test_validate_username_rejects_unsafe_names() {
        assert!(User::validate_username("").is_err());
        assert!(User::validate_username("../admin").is_err());
        assert!(User::validate_username("a/b").is_err());
        assert!(User::validate_username("alice/bob").is_err());
        assert!(User::validate_username("中").is_err());
    }

    /// 测试修改用户昵称
    #[test]
    fn test_set_nickname() {
        // 创建一个用户
        let info = UserCreate {
            username: "nickname_user".to_string(),
            password: "password_789".to_string(),
            nickname: Some("原昵称".to_string()),
        };

        // 创建用户并修改昵称
        let mut user = User::create(info);
        assert_eq!(user.nickname(), "原昵称");

        // 修改昵称
        user.set_nickname("新昵称");

        // 验证昵称是否成功修改
        assert_eq!(user.nickname(), "新昵称");
    }

    /// 测试序列化和反序列化
    #[test]
    fn test_serialization() {
        // 创建用户
        let info = UserCreate {
            username: "serialize_user".to_string(),
            password: "password_abc".to_string(),
            nickname: Some("可序列化用户".to_string()),
        };
        let user = User::create(info);

        // 序列化为JSON
        let serialized = serde_json::to_string(&user).expect("序列化失败");

        // 从JSON反序列化
        let deserialized: User = serde_json::from_str(&serialized).expect("反序列化失败");

        // 验证反序列化后的用户信息
        assert_eq!(deserialized.username(), "serialize_user");
        assert_eq!(deserialized.nickname(), "可序列化用户");
    }

    /// 测试 DbCreateUserInfo 的序列化和反序列化
    #[test]
    fn test_create_user_info_serialization() {
        // 创建用户信息
        let info = UserCreate {
            username: "info_user".to_string(),
            password: "password_def".to_string(),
            nickname: Some("信息用户".to_string()),
        };

        // 序列化
        let serialized = serde_json::to_string(&info).expect("序列化失败");

        // 反序列化
        let deserialized: UserCreate = serde_json::from_str(&serialized).expect("反序列化失败");

        // 验证
        assert_eq!(deserialized.username, "info_user");
        assert_eq!(deserialized.password, "password_def");
        assert_eq!(deserialized.nickname, Some("信息用户".to_string()));
    }

    #[test]
    fn test_user_view_hides_password_hash() {
        let user = User::create(UserCreate {
            username: "alice".to_string(),
            password: "secret".to_string(),
            nickname: Some("Alice".to_string()),
        });

        let view = UserView::from(&user);
        let json = serde_json::to_string(&view).expect("序列化失败");

        assert_eq!(
            view,
            UserView {
                username: "alice".to_string(),
                nickname: "Alice".to_string(),
                login_name: "alice".to_string(),
                has_login_password: true,
            }
        );
        assert!(!json.contains("hashed_password"));
        assert!(json.contains("login_name"));
        assert!(json.contains("has_login_password"));
    }

    #[test]
    fn test_legacy_user_without_login_name_deserializes_to_username() {
        let json = serde_json::json!({
            "username": "legacy_user",
            "hashed_password": "hash",
            "nickname": "Legacy"
        });

        let user: User = serde_json::from_value(json).expect("旧用户数据应能反序列化");

        assert_eq!(user.username(), "legacy_user");
        assert_eq!(user.login_name(), "legacy_user");
    }

    #[test]
    fn test_create_wechat_user_sets_identity_fields() {
        let user = User::create_wechat(
            "wx_1234".to_string(),
            "微信用户1234".to_string(),
            "openid-1234".to_string(),
            Some("unionid-1234".to_string()),
        );

        assert_eq!(user.username(), "wx_1234");
        assert_eq!(user.nickname(), "微信用户1234");
        assert_eq!(user.wechat_openid(), Some("openid-1234"));
        let v = serde_json::to_value(&user).expect("序列化失败");
        assert_eq!(
            v.get("wechat_unionid").and_then(|x| x.as_str()),
            Some("unionid-1234")
        );
    }
}
