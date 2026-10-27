use std::{sync::Arc, time::Duration};

use async_trait::async_trait;
use reqwest::Client;
use reqwest::Url;
use serde::Deserialize;

use crate::config::ServerConfig;
use crate::error::{WeimoError, WeimoResult};

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct WechatSession {
    pub openid: String,
    pub unionid: Option<String>,
}

#[async_trait]
pub trait WechatAuthClient: Send + Sync {
    async fn exchange_code(&self, code: &str) -> WeimoResult<WechatSession>;
}

#[derive(Debug, Clone)]
pub struct WechatApiClient {
    client: Client,
    app_id: Option<String>,
    app_secret: Option<String>,
    api_base_url: String,
}

impl WechatApiClient {
    pub fn from_config(config: &ServerConfig) -> Self {
        Self {
            client: Client::builder()
                .timeout(Duration::from_secs(8))
                .build()
                .expect("微信登录 HTTP 客户端应能初始化"),
            app_id: config.wechat_app_id.clone(),
            app_secret: config.wechat_app_secret.clone(),
            api_base_url: config.wechat_api_base_url.clone(),
        }
    }

    fn credentials(&self) -> WeimoResult<(&str, &str)> {
        let app_id = self
            .app_id
            .as_deref()
            .filter(|value| !value.trim().is_empty());
        let app_secret = self
            .app_secret
            .as_deref()
            .filter(|value| !value.trim().is_empty());

        match (app_id, app_secret) {
            (Some(app_id), Some(app_secret)) => Ok((app_id, app_secret)),
            _ => Err(WeimoError::WechatAuthNotConfigured),
        }
    }
}

#[derive(Debug, Deserialize)]
struct Code2SessionResponse {
    openid: Option<String>,
    unionid: Option<String>,
    errcode: Option<i64>,
    errmsg: Option<String>,
}

#[async_trait]
impl WechatAuthClient for WechatApiClient {
    async fn exchange_code(&self, code: &str) -> WeimoResult<WechatSession> {
        let code = code.trim();
        if code.is_empty() {
            return Err(WeimoError::InvalidWechatCode);
        }

        let (app_id, app_secret) = self.credentials()?;
        let endpoint = format!(
            "{}/sns/jscode2session",
            self.api_base_url.trim_end_matches('/')
        );
        let mut url = Url::parse(&endpoint)
            .map_err(|error| WeimoError::WechatAuthFailed(error.to_string()))?;
        url.query_pairs_mut()
            .append_pair("appid", app_id)
            .append_pair("secret", app_secret)
            .append_pair("js_code", code)
            .append_pair("grant_type", "authorization_code");

        let response = self
            .client
            .get(url)
            .send()
            .await
            .map_err(|error| WeimoError::WechatAuthFailed(error.to_string()))?
            .error_for_status()
            .map_err(|error| WeimoError::WechatAuthFailed(error.to_string()))?;

        let payload: Code2SessionResponse = response
            .json()
            .await
            .map_err(|error| WeimoError::WechatAuthFailed(error.to_string()))?;

        if let Some(error_code) = payload.errcode {
            return match error_code {
                40029 | 40163 => Err(WeimoError::InvalidWechatCode),
                _ => {
                    Err(WeimoError::WechatAuthFailed(payload.errmsg.unwrap_or_else(
                        || format!("微信接口返回错误码 {error_code}"),
                    )))
                }
            };
        }

        let openid = payload
            .openid
            .map(|value| value.trim().to_string())
            .filter(|value| !value.is_empty())
            .ok_or_else(|| WeimoError::WechatAuthFailed("微信接口未返回 openid".to_string()))?;
        let unionid = payload
            .unionid
            .map(|value| value.trim().to_string())
            .filter(|value| !value.is_empty());

        Ok(WechatSession { openid, unionid })
    }
}

pub type DynWechatAuthClient = Arc<dyn WechatAuthClient>;
