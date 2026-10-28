use async_trait::async_trait;
use rusqlite::{params, OptionalExtension};

use super::super::SqliteConn;
use crate::data::UserDb;
use crate::data::{User, UserCreate};
use crate::error::{WeimoError, WeimoResult};

use super::super::sqlite_conn::db_err;

/// 基于 SQLite 的用户存储。
///
/// 语义与旧 JsonUsers 逐条对齐(登录名占用规则、微信用户名生成等),
/// 唯一性约束同时由唯一索引兜底。
#[derive(Debug, Clone)]
pub struct SqliteUsers {
    conn: SqliteConn,
}

const USER_COLUMNS: &str =
    "username, hashed_password, nickname, login_name, wechat_openid, wechat_unionid";

fn row_to_user(row: &rusqlite::Row<'_>) -> rusqlite::Result<User> {
    let json = serde_json::json!({
        "username": row.get::<_, String>(0)?,
        "hashed_password": row.get::<_, String>(1)?,
        "nickname": row.get::<_, String>(2)?,
        "login_name": row.get::<_, String>(3)?,
        "wechat_openid": row.get::<_, Option<String>>(4)?,
        "wechat_unionid": row.get::<_, Option<String>>(5)?,
    });
    serde_json::from_value(json).map_err(|_| rusqlite::Error::InvalidQuery)
}

fn insert_user_exec(conn: &rusqlite::Connection, user: &User) -> WeimoResult<()> {
    // User 字段经 serde 视图取出,避免依赖模型新增构造器
    let value = serde_json::to_value(user)
        .map_err(|_| WeimoError::WriteError(std::io::Error::other("用户序列化失败")))?;
    conn.execute(
        "INSERT INTO users (username, hashed_password, nickname, login_name, wechat_openid, wechat_unionid)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6)",
        params![
            value["username"].as_str().unwrap_or_default(),
            value["hashed_password"].as_str().unwrap_or_default(),
            value["nickname"].as_str().unwrap_or_default(),
            value["login_name"].as_str().unwrap_or_default(),
            value["wechat_openid"].as_str(),
            value["wechat_unionid"].as_str(),
        ],
    )
    .map_err(db_err)?;
    Ok(())
}

impl SqliteUsers {
    pub fn new(conn: SqliteConn) -> Self {
        Self { conn }
    }

    fn find_by_login_name(&self, conn: &rusqlite::Connection, login_name: &str) -> Option<User> {
        conn.query_row(
            &format!("SELECT {USER_COLUMNS} FROM users WHERE login_name = ?1"),
            params![login_name],
            row_to_user,
        )
        .optional()
        .map_err(|error| {
            tracing::warn!("按登录名查询用户失败: {error}");
            error
        })
        .ok()
        .flatten()
    }

    fn find_by_openid(&self, conn: &rusqlite::Connection, openid: &str) -> Option<User> {
        conn.query_row(
            &format!("SELECT {USER_COLUMNS} FROM users WHERE wechat_openid = ?1"),
            params![openid],
            row_to_user,
        )
        .optional()
        .ok()
        .flatten()
    }

    /// 与旧实现一致:候选名不能撞任何用户名或登录名
    fn login_identifier_available(
        &self,
        conn: &rusqlite::Connection,
        candidate: &str,
    ) -> bool {
        let hit = conn
            .query_row(
                "SELECT 1 FROM users WHERE username = ?1 OR login_name = ?1 LIMIT 1",
                params![candidate],
                |_| Ok(()),
            )
            .optional();
        matches!(hit, Ok(None))
    }

    fn unique_wechat_username(&self, conn: &rusqlite::Connection, openid: &str) -> String {
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

        if self.login_identifier_available(conn, &base) {
            return base;
        }

        for index in 2..=9999 {
            let candidate = format!("{base}_{index}");
            if self.login_identifier_available(conn, &candidate) {
                return candidate;
            }
        }

        format!("wx_{}", uuid::Uuid::new_v4().simple())
    }

    /// 原样落库(迁移专用):不做校验、不生成默认值,允许与既有行冲突时忽略
    pub fn insert_raw(&self, user: &User, or_ignore: bool) -> WeimoResult<usize> {
        self.conn.with(|conn| {
            if or_ignore {
                // INSERT OR REPLACE 语义按用户名主键去重,重复执行迁移幂等
                let value = serde_json::to_value(user).map_err(|_| {
                    WeimoError::WriteError(std::io::Error::other("用户序列化失败"))
                })?;
                let changed = conn
                    .execute(
                        "INSERT OR REPLACE INTO users (username, hashed_password, nickname, login_name, wechat_openid, wechat_unionid)
                         VALUES (?1, ?2, ?3, ?4, ?5, ?6)",
                        params![
                            value["username"].as_str().unwrap_or_default(),
                            value["hashed_password"].as_str().unwrap_or_default(),
                            value["nickname"].as_str().unwrap_or_default(),
                            value["login_name"].as_str().unwrap_or_default(),
                            value["wechat_openid"].as_str(),
                            value["wechat_unionid"].as_str(),
                        ],
                    )
                    .map_err(db_err)?;
                Ok(changed)
            } else {
                insert_user_exec(conn, user)?;
                Ok(1)
            }
        })
    }
}

#[async_trait]
impl UserDb for SqliteUsers {
    async fn create(&mut self, info: UserCreate) -> WeimoResult<User> {
        self.conn.with(|conn| {
            if let Some(existing) = conn
                .query_row(
                    "SELECT 1 FROM users WHERE username = ?1",
                    params![info.username],
                    |_| Ok(()),
                )
                .optional()
                .map_err(db_err)?
            {
                let _ = existing;
                return Err(WeimoError::UserAlreadyExists(info.username));
            }

            User::validate_username(&info.username)?;
            if self
                .find_by_login_name(conn, &info.username)
                .is_some()
            {
                return Err(WeimoError::LoginNameAlreadyExists(info.username));
            }

            let user = User::create(info);
            insert_user_exec(conn, &user)?;
            Ok(user)
        })
    }

    async fn delete(&mut self, username: &str) -> WeimoResult<()> {
        self.conn.with(|conn| {
            let changed = conn
                .execute("DELETE FROM users WHERE username = ?1", params![username])
                .map_err(db_err)?;
            if changed == 0 {
                return Err(WeimoError::UserNotFound(username.to_string()));
            }
            Ok(())
        })
    }

    async fn update_nickname(&mut self, username: &str, nickname: &str) -> WeimoResult<()> {
        self.conn.with(|conn| {
            let mut user = conn
                .query_row(
                    &format!("SELECT {USER_COLUMNS} FROM users WHERE username = ?1"),
                    params![username],
                    row_to_user,
                )
                .optional()
                .map_err(db_err)?
                .ok_or_else(|| WeimoError::UserNotFound(username.to_string()))?;
            user.set_nickname(nickname);

            conn.execute(
                "UPDATE users SET nickname = ?1 WHERE username = ?2",
                params![nickname, username],
            )
            .map_err(db_err)?;
            Ok(())
        })
    }

    async fn update_login_name(&mut self, username: &str, login_name: &str) -> WeimoResult<User> {
        let login_name = login_name.trim().to_string();
        self.conn.with(move |conn| {
            User::validate_login_name(&login_name)?;

            let current = conn
                .query_row(
                    &format!("SELECT {USER_COLUMNS} FROM users WHERE username = ?1"),
                    params![username],
                    row_to_user,
                )
                .optional()
                .map_err(db_err)?
                .ok_or_else(|| WeimoError::UserNotFound(username.to_string()))?;
            if current.login_name() == login_name {
                return Ok(current);
            }

            // 与旧实现一致:候选登录名不得撞其他用户的用户名或登录名
            let conflict = conn
                .query_row(
                    "SELECT 1 FROM users WHERE username != ?1 AND (username = ?2 OR login_name = ?2) LIMIT 1",
                    params![username, login_name],
                    |_| Ok(()),
                )
                .optional()
                .map_err(db_err)?
                .is_some();
            if conflict {
                return Err(WeimoError::LoginNameAlreadyExists(login_name));
            }

            let mut user = current;
            user.set_login_name(&login_name);
            conn.execute(
                "UPDATE users SET login_name = ?1 WHERE username = ?2",
                params![login_name, username],
            )
            .map_err(db_err)?;
            Ok(user)
        })
    }

    async fn update_password(&mut self, username: &str, password: &str) -> WeimoResult<User> {
        let password = password.to_string();
        self.conn.with(move |conn| {
            let mut user = conn
                .query_row(
                    &format!("SELECT {USER_COLUMNS} FROM users WHERE username = ?1"),
                    params![username],
                    row_to_user,
                )
                .optional()
                .map_err(db_err)?
                .ok_or_else(|| WeimoError::UserNotFound(username.to_string()))?;
            user.set_password(&password);

            let value = serde_json::to_value(&user)
                .map_err(|_| WeimoError::WriteError(std::io::Error::other("用户序列化失败")))?;
            conn.execute(
                "UPDATE users SET hashed_password = ?1 WHERE username = ?2",
                params![value["hashed_password"].as_str().unwrap_or_default(), username],
            )
            .map_err(db_err)?;
            Ok(user)
        })
    }

    async fn get(&self, username: &str) -> WeimoResult<User> {
        self.conn.with(|conn| {
            conn.query_row(
                &format!("SELECT {USER_COLUMNS} FROM users WHERE username = ?1"),
                params![username],
                row_to_user,
            )
            .optional()
            .map_err(db_err)?
            .ok_or_else(|| WeimoError::UserNotFound(username.to_string()))
        })
    }

    async fn get_by_wechat_openid(&self, openid: &str) -> Option<User> {
        let openid = openid.trim().to_string();
        if openid.is_empty() {
            return None;
        }
        self.conn
            .with(|conn| Ok(self.find_by_openid(conn, &openid)))
            .unwrap_or(None)
    }

    async fn get_by_login_name(&self, login_name: &str) -> Option<User> {
        let login_name = login_name.trim().to_string();
        if login_name.is_empty() {
            return None;
        }
        self.conn
            .with(|conn| Ok(self.find_by_login_name(conn, &login_name)))
            .unwrap_or(None)
    }

    async fn create_wechat_user(
        &mut self,
        openid: &str,
        unionid: Option<String>,
        nickname: Option<String>,
    ) -> WeimoResult<User> {
        let openid = openid.trim().to_string();
        let unionid = unionid.filter(|id| !id.trim().is_empty());
        let this = self.clone();
        self.conn.with(move |conn| {
            if openid.is_empty() {
                return Err(WeimoError::InvalidWechatCode);
            }

            if let Some(user) = this.find_by_openid(conn, &openid) {
                return Ok(user);
            }

            let username = this.unique_wechat_username(conn, &openid);
            User::validate_username(&username)?;
            let effective_nickname = nickname
                .map(|n| n.trim().to_string())
                .filter(|n| !n.is_empty())
                .ok_or(WeimoError::NicknameRequired)?;

            let user = User::create_wechat(username, effective_nickname, openid, unionid);
            insert_user_exec(conn, &user)?;
            Ok(user)
        })
    }

    async fn get_all_users(&self) -> Vec<String> {
        self.conn
            .with(|conn| {
                let mut stmt = conn
                    .prepare("SELECT username FROM users")
                    .map_err(db_err)?;
                let names = stmt
                    .query_map([], |row| row.get::<_, String>(0))
                    .map_err(db_err)?
                    .collect::<Result<Vec<_>, _>>()
                    .map_err(db_err)?;
                Ok(names)
            })
            .unwrap_or_default()
    }

    async fn exists(&self, username: &str) -> bool {
        self.conn
            .with(|conn| {
                Ok(conn
                    .query_row(
                        "SELECT 1 FROM users WHERE username = ?1",
                        params![username],
                        |_| Ok(()),
                    )
                    .optional()
                    .map_err(db_err)?
                    .is_some())
            })
            .unwrap_or(false)
    }
}
