use async_trait::async_trait;
use rusqlite::{OptionalExtension, params};
use time::{OffsetDateTime, format_description::well_known::Rfc3339};

use super::super::SqliteConn;
use crate::data::MemoDb;
use crate::data::{Memo, MemoCreate, MemoId, MemoRef, MemoUpdate};
use crate::error::{WeimoError, WeimoResult};

use super::super::sqlite_conn::db_err;

/// 基于 SQLite 的笔记存储:content 列保存规范 WDF JSON 文本。
#[derive(Debug, Clone)]
pub struct SqliteMemos {
    conn: SqliteConn,
}

fn parse_utc(raw: &str) -> WeimoResult<OffsetDateTime> {
    OffsetDateTime::parse(raw, &Rfc3339)
        .map_err(|_| WeimoError::ReadError(std::io::Error::other("笔记时间戳格式非法")))
}

fn row_to_memo(row: &rusqlite::Row<'_>) -> rusqlite::Result<Memo> {
    let ct_utc = row
        .get::<_, String>(2)
        .and_then(|raw| parse_utc(&raw).map_err(|_| rusqlite::Error::InvalidQuery))?;
    let mt_utc = row
        .get::<_, String>(3)
        .and_then(|raw| parse_utc(&raw).map_err(|_| rusqlite::Error::InvalidQuery))?;
    let tags: Vec<String> = serde_json::from_str(&row.get::<_, String>(4)?)
        .map_err(|_| rusqlite::Error::InvalidQuery)?;
    let ref_ids: Vec<u32> = serde_json::from_str(&row.get::<_, String>(5)?)
        .map_err(|_| rusqlite::Error::InvalidQuery)?;
    Ok(Memo::from_parts(
        row.get::<_, MemoId>(1)?,
        ct_utc,
        mt_utc,
        tags,
        ref_ids.into_iter().map(MemoRef).collect(),
        row.get::<_, String>(6)?,
    ))
}

const MEMO_COLUMNS: &str = "username, id, ct_utc, mt_utc, tags, refs, content";

impl SqliteMemos {
    pub fn new(conn: SqliteConn) -> Self {
        Self { conn }
    }

    fn select_memo(
        conn: &rusqlite::Connection,
        user: &str,
        id: &MemoId,
    ) -> WeimoResult<Option<Memo>> {
        conn.query_row(
            &format!("SELECT {MEMO_COLUMNS} FROM memos WHERE username = ?1 AND id = ?2"),
            params![user, id],
            row_to_memo,
        )
        .optional()
        .map_err(db_err)
    }

    fn write_memo(conn: &rusqlite::Connection, user: &str, memo: &Memo) -> WeimoResult<()> {
        let tags = serde_json::to_string(memo.tags())
            .map_err(|_| WeimoError::WriteError(std::io::Error::other("标签序列化失败")))?;
        let refs: Vec<u32> = memo.refs().iter().map(|r| r.0).collect();
        let refs = serde_json::to_string(&refs)
            .map_err(|_| WeimoError::WriteError(std::io::Error::other("引用序列化失败")))?;
        conn.execute(
            "INSERT INTO memos (username, id, ct_utc, mt_utc, tags, refs, content)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)
             ON CONFLICT(username, id) DO UPDATE SET
                ct_utc = excluded.ct_utc,
                mt_utc = excluded.mt_utc,
                tags = excluded.tags,
                refs = excluded.refs,
                content = excluded.content",
            params![
                user,
                memo.id(),
                memo.create_t_utc().format(&Rfc3339).unwrap_or_default(),
                memo.modify_t_utc().format(&Rfc3339).unwrap_or_default(),
                tags,
                refs,
                memo.content(),
            ],
        )
        .map_err(db_err)?;
        Ok(())
    }

    /// 原样落库(迁移专用):INSERT OR IGNORE 保证重复执行幂等
    pub fn insert_raw(&self, user: &str, memo: &Memo) -> WeimoResult<usize> {
        self.conn.with(|conn| {
            let tags = serde_json::to_string(memo.tags())
                .map_err(|_| WeimoError::WriteError(std::io::Error::other("标签序列化失败")))?;
            let refs: Vec<u32> = memo.refs().iter().map(|r| r.0).collect();
            let refs = serde_json::to_string(&refs)
                .map_err(|_| WeimoError::WriteError(std::io::Error::other("引用序列化失败")))?;
            conn.execute(
                "INSERT OR IGNORE INTO memos (username, id, ct_utc, mt_utc, tags, refs, content)
                 VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)",
                params![
                    user,
                    memo.id(),
                    memo.create_t_utc().format(&Rfc3339).unwrap_or_default(),
                    memo.modify_t_utc().format(&Rfc3339).unwrap_or_default(),
                    tags,
                    refs,
                    memo.content(),
                ],
            )
            .map_err(db_err)
        })
    }
}

#[async_trait]
impl MemoDb for SqliteMemos {
    async fn create(&mut self, user: &str, info: MemoCreate, id: MemoId) -> WeimoResult<Memo> {
        let memo = Memo::create(info, id)?;
        self.conn.with(|conn| Self::write_memo(conn, user, &memo))?;
        Ok(memo)
    }

    async fn delete(&mut self, user: &str, id: &MemoId) -> WeimoResult<Memo> {
        self.conn.with(|conn| {
            let memo = Self::select_memo(conn, user, id)?
                .ok_or_else(|| WeimoError::MemoNotFound(*id))?;
            conn.execute(
                "DELETE FROM memos WHERE username = ?1 AND id = ?2",
                params![user, id],
            )
            .map_err(db_err)?;
            Ok(memo)
        })
    }

    async fn update(&mut self, user: &str, id: &MemoId, info: MemoUpdate) -> WeimoResult<Memo> {
        self.conn.with(|conn| {
            let mut memo = Self::select_memo(conn, user, id)?
                .ok_or_else(|| WeimoError::MemoNotFound(*id))?;

            if let Some(content) = info.content {
                memo.set_content(&content)?;
            }

            if let Some(tags) = info.tags {
                memo.set_tags(&tags);
            }

            if let Some(refs) = info.refs {
                memo.set_refs(&refs);
            }

            Self::write_memo(conn, user, &memo)?;
            Ok(memo)
        })
    }

    async fn get(&self, user: &str, id: &MemoId) -> WeimoResult<Memo> {
        self.conn.with(|conn| {
            Self::select_memo(conn, user, id)?.ok_or_else(|| WeimoError::MemoNotFound(*id))
        })
    }

    async fn get_ids(&self, user: &str) -> Vec<MemoId> {
        self.conn
            .with(|conn| {
                let mut stmt = conn
                    .prepare("SELECT id FROM memos WHERE username = ?1")
                    .map_err(db_err)?;
                let ids = stmt
                    .query_map(params![user], |row| row.get::<_, MemoId>(0))
                    .map_err(db_err)?
                    .collect::<Result<Vec<_>, _>>()
                    .map_err(db_err)?;
                Ok(ids)
            })
            .unwrap_or_default()
    }

    async fn delete_user_data(&mut self, user: &str) -> WeimoResult<()> {
        self.conn.with(|conn| {
            conn.execute("DELETE FROM memos WHERE username = ?1", params![user])
                .map_err(db_err)?;
            Ok(())
        })
    }

}
