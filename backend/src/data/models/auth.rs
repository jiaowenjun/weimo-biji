use serde::{Deserialize, Serialize};

use super::user::UserView;

/// 用户登录信息
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct UserLogin {
    #[serde(alias = "username")]
    pub login_name: String,
    pub password: String,
}

/// 认证响应体结构体
#[derive(Debug, Serialize, Deserialize)]
pub struct Token {
    pub token: String,
    pub token_type: String,
}

/// 小程序登录响应体
#[derive(Debug, Serialize, Deserialize)]
pub struct MiniToken {
    pub token: String,
    pub token_type: String,
    pub refresh_token: String,
}

/// 小程序刷新访问令牌请求体
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MiniRefreshRequest {
    pub refresh_token: String,
}

/// 小程序微信登录请求体
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MiniWechatLoginRequest {
    pub code: String,
    #[serde(default)]
    pub nickname: Option<String>,
}

/// 小程序微信注册请求体（仅 code + 昵称）
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MiniWechatRegisterRequest {
    pub code: String,
    pub nickname: String,
}

/// 小程序微信登录响应体
#[derive(Debug, Serialize, Deserialize)]
pub struct MiniAuthResult {
    pub token: String,
    pub token_type: String,
    pub refresh_token: String,
    pub user: UserView,
    pub is_new_user: bool,
}

/// 小程序微信注册状态预检查请求体
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MiniWechatCheckRequest {
    pub code: String,
}

/// 小程序微信注册状态预检查响应体
#[derive(Debug, Serialize, Deserialize)]
pub struct MiniWechatCheckResult {
    pub is_registered: bool,
}
