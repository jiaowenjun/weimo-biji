use std::path::Path;
use std::sync::{Arc, Mutex};

use rusqlite::Connection;

use crate::error::{WeimoError, WeimoResult};

/// SQLite 错误统一归为写失败(io::Error 携带原文),不区分读/写场景
pub(crate) fn db_err(error: rusqlite::Error) -> WeimoError {
    WeimoError::WriteError(std::io::Error::other(error.to_string()))
}

/// SQLite 连接封装:单连接 + 同步短临界区。
///
/// 个人笔记服务的写入频率极低,单连接串行化足以;所有锁段内不做任何
/// await,避免跨异步点持锁。WAL 提升读写并发,busy_timeout 兜底偶发竞争。
#[derive(Debug, Clone)]
pub struct SqliteConn(Arc<Mutex<Connection>>);

impl SqliteConn {
    /// 打开(或创建)数据库并执行建表迁移
    pub fn open(path: impl AsRef<Path>) -> WeimoResult<Self> {
        let conn = Connection::open(path).map_err(db_err)?;
        Self::init(conn)
    }

    fn init(conn: Connection) -> WeimoResult<Self> {
        conn.pragma_update(None, "journal_mode", "WAL")
            .map_err(db_err)?;
        conn.pragma_update(None, "synchronous", "NORMAL")
            .map_err(db_err)?;
        conn.pragma_update(None, "busy_timeout", 5000)
            .map_err(db_err)?;
        conn.pragma_update(None, "foreign_keys", "ON")
            .map_err(db_err)?;
        conn.execute_batch(SCHEMA).map_err(db_err)?;
        Ok(Self(Arc::new(Mutex::new(conn))))
    }

    /// 在锁内执行同步数据库操作(段内禁止 await)
    pub fn with<T>(&self, run: impl FnOnce(&Connection) -> WeimoResult<T>) -> WeimoResult<T> {
        let guard = self.0.lock().expect("SQLite 连接锁中毒");
        run(&guard)
    }
}

const SCHEMA: &str = "
CREATE TABLE IF NOT EXISTS users (
    username        TEXT PRIMARY KEY,
    hashed_password TEXT NOT NULL,
    nickname        TEXT NOT NULL DEFAULT '',
    login_name      TEXT NOT NULL DEFAULT '',
    wechat_openid   TEXT,
    wechat_unionid  TEXT
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_users_login_name
    ON users(login_name) WHERE login_name != '';
CREATE UNIQUE INDEX IF NOT EXISTS idx_users_openid
    ON users(wechat_openid) WHERE wechat_openid IS NOT NULL;

CREATE TABLE IF NOT EXISTS memos (
    username TEXT NOT NULL,
    id       INTEGER NOT NULL,
    ct_utc   TEXT NOT NULL,
    mt_utc   TEXT NOT NULL,
    tags     TEXT NOT NULL,
    refs     TEXT NOT NULL,
    content  TEXT NOT NULL,
    PRIMARY KEY (username, id)
);
CREATE INDEX IF NOT EXISTS idx_memos_user_ct ON memos(username, ct_utc);
";
