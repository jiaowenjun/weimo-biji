use std::path::Path;

use super::base::Db;
use crate::data::db::SqliteConn;
use crate::data::{SqliteMemos, SqliteUsers};
use crate::error::WeimoResult;

/// SQLite 一体化数据库:单连接同时服务用户表与笔记表
pub type SqliteDb = Db<SqliteUsers, SqliteMemos>;

impl SqliteDb {
    /// 打开(或创建)存储目录下的 biji.db
    pub async fn new<P: AsRef<Path>>(root_dir: P) -> WeimoResult<Self> {
        let db_path = root_dir.as_ref().join("biji.db");
        if let Some(parent) = db_path.parent() {
            tokio::fs::create_dir_all(parent)
                .await
                .map_err(crate::error::WeimoError::WriteError)?;
        }
        let conn = tokio::task::spawn_blocking({
            let path = db_path.clone();
            move || SqliteConn::open(path)
        })
        .await
        .map_err(|error| crate::error::WeimoError::WriteError(std::io::Error::other(error)))??;

        tracing::info!("SQLite 数据库已就绪: {}", db_path.display());
        Ok(Self::from((SqliteUsers::new(conn.clone()), SqliteMemos::new(conn))))
    }

    /// 用户原样写入(迁移专用)
    pub async fn insert_user_raw(&self, user: &crate::data::User) -> WeimoResult<()> {
        self.user_db().insert_raw(user, true).map(|_| ())
    }

    /// 笔记原样写入(迁移专用,幂等)
    pub async fn insert_memo_raw(&self, username: &str, memo: &crate::data::Memo) -> WeimoResult<()> {
        self.memo_db().insert_raw(username, memo)?;
        Ok(())
    }
}
