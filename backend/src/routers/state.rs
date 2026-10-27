use std::sync::Arc;

use crate::config::ServerConfig;
use crate::data::{DataManager, MemoDb, UserDb};
use crate::error::WeimoResult;
use crate::wechat::{DynWechatAuthClient, WechatApiClient, WechatSession};

#[derive(Clone)]
pub struct AppState<U: UserDb, M: MemoDb> {
    dm: DataManager<U, M>,
    config: Arc<ServerConfig>,
    wechat_auth: DynWechatAuthClient,
}

impl<U: UserDb, M: MemoDb> AppState<U, M> {
    pub fn new(data_manager: DataManager<U, M>, config: ServerConfig) -> Self {
        let wechat_auth = Arc::new(WechatApiClient::from_config(&config));
        Self::new_with_wechat(data_manager, config, wechat_auth)
    }

    pub fn new_with_wechat(
        data_manager: DataManager<U, M>,
        config: ServerConfig,
        wechat_auth: DynWechatAuthClient,
    ) -> Self {
        Self {
            dm: data_manager,
            config: Arc::new(config),
            wechat_auth,
        }
    }

    pub fn config(&self) -> &ServerConfig {
        self.config.as_ref()
    }

    pub fn data_manager(&self) -> &DataManager<U, M> {
        &self.dm
    }

    pub async fn exchange_wechat_code(&self, code: &str) -> WeimoResult<WechatSession> {
        self.wechat_auth.exchange_code(code).await
    }
}
