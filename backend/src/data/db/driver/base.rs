use crate::data::{
    Memo, MemoCreate, MemoId, MemoSearchHit, MemoSearchQuery, MemoUpdate, User, UserCreate,
};
use crate::data::{MemoDb, UserDb};
use crate::error::{WeimoError, WeimoResult};

/// 综合数据库结构，将用户数据库和笔记数据库整合在一起
#[derive(Debug)]
pub struct Db<U: UserDb, M: MemoDb> {
    user_db: U,
    memo_db: M,
}

impl<U: UserDb, M: MemoDb> Db<U, M> {
    #[inline]
    async fn check_user_exists(&self, username: &str) -> Result<(), WeimoError> {
        if self.user_db.exists(username).await {
            Ok(())
        } else {
            Err(WeimoError::UserNotFound(username.to_string()))
        }
    }

    pub async fn create_user(&mut self, info: UserCreate) -> WeimoResult<User> {
        self.user_db.create(info).await
    }

    pub async fn delete_user(&mut self, username: &str) -> WeimoResult<()> {
        self.check_user_exists(username).await?;
        self.memo_db.delete_user_data(username).await?;
        self.user_db.delete(username).await
    }

    pub async fn update_user_nickname(
        &mut self,
        username: &str,
        nickname: &str,
    ) -> WeimoResult<()> {
        self.user_db.update_nickname(username, nickname).await
    }

    pub async fn update_user_login_name(
        &mut self,
        username: &str,
        login_name: &str,
    ) -> WeimoResult<User> {
        self.user_db.update_login_name(username, login_name).await
    }

    pub async fn update_user_password(
        &mut self,
        username: &str,
        password: &str,
    ) -> WeimoResult<User> {
        self.user_db.update_password(username, password).await
    }

    pub async fn get_user(&self, username: &str) -> WeimoResult<User> {
        self.user_db.get(username).await
    }

    pub async fn get_user_by_wechat_openid(&self, openid: &str) -> Option<User> {
        self.user_db.get_by_wechat_openid(openid).await
    }

    pub async fn get_user_by_login_name(&self, login_name: &str) -> Option<User> {
        self.user_db.get_by_login_name(login_name).await
    }

    pub async fn create_wechat_user(
        &mut self,
        openid: &str,
        unionid: Option<String>,
        nickname: Option<String>,
    ) -> WeimoResult<User> {
        self.user_db
            .create_wechat_user(openid, unionid, nickname)
            .await
    }

    pub async fn get_all_users(&self) -> Vec<String> {
        self.user_db.get_all_users().await
    }

    pub async fn user_exists(&self, username: &str) -> bool {
        self.user_db.exists(username).await
    }

    pub async fn create_memo(
        &mut self,
        username: &str,
        info: MemoCreate,
        id: MemoId,
    ) -> WeimoResult<Memo> {
        self.check_user_exists(username).await?;
        self.memo_db.create(username, info, id).await
    }

    pub async fn delete_memo(&mut self, username: &str, id: &MemoId) -> WeimoResult<Memo> {
        self.check_user_exists(username).await?;
        self.memo_db.delete(username, id).await
    }

    pub async fn update_memo(
        &mut self,
        username: &str,
        id: &MemoId,
        info: MemoUpdate,
    ) -> WeimoResult<Memo> {
        self.check_user_exists(username).await?;
        self.memo_db.update(username, id, info).await
    }

    pub async fn get_memo(&self, username: &str, id: &MemoId) -> WeimoResult<Memo> {
        self.check_user_exists(username).await?;
        self.memo_db.get(username, id).await
    }

    pub async fn get_memos(&self, username: &str, ids: &[MemoId]) -> WeimoResult<Vec<Memo>> {
        self.check_user_exists(username).await?;
        self.memo_db.get_many(username, ids).await
    }

    pub async fn get_memo_ids(&self, username: &str) -> Vec<MemoId> {
        // 短路优化：如果用户不存在，直接返回空向量，避免不必要的调用
        if !self.user_db.exists(username).await {
            return Vec::new();
        }
        self.memo_db.get_ids(username).await
    }

    pub async fn search_memo_hits(
        &self,
        username: &str,
        query: &MemoSearchQuery,
        candidates: Option<&[MemoId]>,
    ) -> WeimoResult<Vec<MemoSearchHit>> {
        self.check_user_exists(username).await?;
        self.memo_db.search_hits(username, query, candidates).await
    }
}

/// 提供转换成内部数据库类型的方法
impl<U: UserDb, M: MemoDb> From<(U, M)> for Db<U, M> {
    fn from(value: (U, M)) -> Self {
        Self {
            user_db: value.0,
            memo_db: value.1,
        }
    }
}
