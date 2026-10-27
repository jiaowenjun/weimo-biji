use crate::auth::jwt::JwtError;
use axum::{
    Json,
    response::{IntoResponse, Response},
};
use http::StatusCode;
use serde_json::json;
use std::io;
use tagtree::Error as TagTreeError;
use thiserror::Error;

use crate::data::MemoId;

#[derive(Error, Debug)]
pub enum WeimoError {
    #[error("用户名 '{0}' 不合法")]
    InvalidUsername(String),

    #[error("昵称不能为空")]
    InvalidNickname,

    #[error("登录名 '{0}' 不合法")]
    InvalidLoginName(String),

    #[error("登录名 '{0}' 已存在")]
    LoginNameAlreadyExists(String),

    #[error("登录密码不能为空")]
    InvalidLoginPassword,

    #[error("两次输入的登录密码不一致")]
    LoginPasswordMismatch,

    #[error("用户 '{0}' 已存在")]
    UserAlreadyExists(String),

    #[error("用户 '{0}' 不存在")]
    UserNotFound(String),

    #[error("笔记 '{0}' 不存在")]
    MemoNotFound(MemoId),

    #[error("搜索条件不合法: {0}")]
    InvalidSearchQuery(String),

    #[error("引用不合法: {0}")]
    InvalidRefs(String),

    #[error("写入数据库失败")]
    WriteError(io::Error),

    #[error("读取数据库失败")]
    ReadError(io::Error),

    #[error("树操作错误: {0}")]
    TreeError(String),

    #[error("JWT编码错误: {0}")]
    JwtEncodeError(JwtError),

    #[error("无效的用户名或密码")]
    InvalidPassword,

    #[error("无效的令牌")]
    InvalidToken,

    #[error("服务端未配置微信登录")]
    WechatAuthNotConfigured,

    #[error("首次注册需要提供昵称")]
    NicknameRequired,

    #[error("无效的微信登录凭证")]
    InvalidWechatCode,

    #[error("微信登录失败: {0}")]
    WechatAuthFailed(String),
}

pub type WeimoResult<T> = Result<T, WeimoError>;

impl From<TagTreeError> for WeimoError {
    fn from(value: TagTreeError) -> Self {
        WeimoError::TreeError(value.to_string())
    }
}

// 将 WeimoError 转换为 HTTP 响应
impl IntoResponse for WeimoError {
    fn into_response(self) -> Response {
        let (status, error_message) = match self {
            WeimoError::UserAlreadyExists(username) => {
                (StatusCode::CONFLICT, format!("用户名 {username} 已存在"))
            }
            WeimoError::UserNotFound(username) => {
                (StatusCode::NOT_FOUND, format!("用户 {username} 不存在"))
            }
            WeimoError::InvalidUsername(username) => {
                (StatusCode::BAD_REQUEST, format!("用户名 {username} 不合法"))
            }
            WeimoError::InvalidNickname => (StatusCode::BAD_REQUEST, "昵称不能为空".to_string()),
            WeimoError::InvalidLoginName(login_name) => (
                StatusCode::BAD_REQUEST,
                format!("登录名 {login_name} 不合法"),
            ),
            WeimoError::LoginNameAlreadyExists(login_name) => {
                (StatusCode::CONFLICT, format!("登录名 {login_name} 已存在"))
            }
            WeimoError::InvalidLoginPassword => {
                (StatusCode::BAD_REQUEST, "登录密码不能为空".to_string())
            }
            WeimoError::LoginPasswordMismatch => (
                StatusCode::BAD_REQUEST,
                "两次输入的登录密码不一致".to_string(),
            ),
            WeimoError::MemoNotFound(memo_id) => {
                (StatusCode::NOT_FOUND, format!("笔记 {memo_id} 不存在"))
            }
            WeimoError::InvalidSearchQuery(msg) => {
                (StatusCode::BAD_REQUEST, format!("无效的搜索条件: {msg}"))
            }
            WeimoError::InvalidRefs(reason) => {
                (StatusCode::BAD_REQUEST, format!("引用不合法: {reason}"))
            }
            WeimoError::WriteError(e) => (
                StatusCode::INTERNAL_SERVER_ERROR,
                format!("写入数据库失败: {e}"),
            ),
            WeimoError::ReadError(e) => (
                StatusCode::INTERNAL_SERVER_ERROR,
                format!("读取数据库失败: {e}"),
            ),
            WeimoError::TreeError(e) => (
                StatusCode::INTERNAL_SERVER_ERROR,
                format!("树操作错误: {e}"),
            ),
            WeimoError::JwtEncodeError(e) => (
                StatusCode::INTERNAL_SERVER_ERROR,
                format!("JWT编码错误: {e}"),
            ),
            WeimoError::InvalidPassword => (StatusCode::UNAUTHORIZED, "密码错误".to_string()),
            WeimoError::InvalidToken => (StatusCode::UNAUTHORIZED, "无效的令牌".to_string()),
            WeimoError::WechatAuthNotConfigured => (
                StatusCode::SERVICE_UNAVAILABLE,
                "服务端暂未开启微信登录".to_string(),
            ),
            WeimoError::NicknameRequired => {
                (StatusCode::BAD_REQUEST, "首次注册需要提供昵称".to_string())
            }
            WeimoError::InvalidWechatCode => {
                (StatusCode::BAD_REQUEST, "无效的微信登录凭证".to_string())
            }
            WeimoError::WechatAuthFailed(message) => {
                (StatusCode::BAD_GATEWAY, format!("微信登录失败: {message}"))
            }
        };

        let body = Json(json!({
            "error": error_message,
        }));
        (status, body).into_response()
    }
}
