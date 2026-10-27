use std::sync::Arc;

use tokio::sync::RwLock;

use super::DataManager;
use super::memos::MemoManager;
use crate::data::{MemoDb, User, UserCreate, UserDb};
use crate::error::WeimoResult;

impl<U: UserDb, M: MemoDb> DataManager<U, M> {
    pub async fn create_user(&self, info: UserCreate) -> WeimoResult<User> {
        let user = {
            let mut db = self.db.write().await;
            db.create_user(info).await?
        };
        self.memo_managers.write().await.insert(
            user.username().to_string(),
            Arc::new(RwLock::new(MemoManager::new(user.username()))),
        );
        Ok(user)
    }

    pub async fn delete_user(&self, username: &str) -> WeimoResult<()> {
        {
            let mut db = self.db.write().await;
            db.delete_user(username).await?;
        }
        self.memo_managers.write().await.remove(username);
        Ok(())
    }

    pub async fn update_user_nickname(&self, username: &str, nickname: &str) -> WeimoResult<()> {
        self.db
            .write()
            .await
            .update_user_nickname(username, nickname)
            .await
    }

    pub async fn update_user_login_name(
        &self,
        username: &str,
        login_name: &str,
    ) -> WeimoResult<User> {
        self.db
            .write()
            .await
            .update_user_login_name(username, login_name)
            .await
    }

    pub async fn update_user_password(&self, username: &str, password: &str) -> WeimoResult<User> {
        self.db
            .write()
            .await
            .update_user_password(username, password)
            .await
    }

    pub async fn get_user(&self, username: &str) -> WeimoResult<User> {
        self.db.read().await.get_user(username).await
    }

    pub async fn get_user_by_wechat_openid(&self, openid: &str) -> Option<User> {
        self.db.read().await.get_user_by_wechat_openid(openid).await
    }

    pub async fn get_user_by_login_name(&self, login_name: &str) -> Option<User> {
        self.db
            .read()
            .await
            .get_user_by_login_name(login_name)
            .await
    }

    pub async fn find_or_create_wechat_user(
        &self,
        openid: &str,
        unionid: Option<String>,
        nickname: Option<String>,
    ) -> WeimoResult<(User, bool)> {
        if let Some(user) = self.get_user_by_wechat_openid(openid).await {
            return Ok((user, false));
        }

        let user = {
            let mut db = self.db.write().await;
            if let Some(user) = db.get_user_by_wechat_openid(openid).await {
                return Ok((user, false));
            }
            db.create_wechat_user(openid, unionid, nickname).await?
        };

        self.memo_managers.write().await.insert(
            user.username().to_string(),
            Arc::new(RwLock::new(MemoManager::new(user.username()))),
        );

        Ok((user, true))
    }

    pub async fn user_exists(&self, username: &str) -> bool {
        self.db.read().await.user_exists(username).await
    }
}
