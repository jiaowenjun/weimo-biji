use serde::Serialize;
use time::OffsetDateTime;

use crate::data::{Memo, MemoId, MemoRef};

#[derive(Debug, Serialize)]
pub struct MemoView {
    pub id: MemoId,
    pub ct_utc: OffsetDateTime,
    pub mt_utc: OffsetDateTime,
    pub tags: Vec<String>,
    pub content: serde_json::Value,
    pub refs: Vec<String>,
    pub referenced_by: Vec<String>,
}

fn stringify_refs(refs: &[MemoRef]) -> Vec<String> {
    refs.iter().map(ToString::to_string).collect()
}

impl MemoView {
    pub fn from_memo(memo: &Memo, referenced_by: Vec<String>) -> Self {
        Self {
            id: *memo.id(),
            ct_utc: memo.create_t_utc(),
            mt_utc: memo.modify_t_utc(),
            tags: memo.tags().to_vec(),
            content: memo
                .wdf_document()
                .and_then(|document| serde_json::to_value(&document).ok())
                .unwrap_or(serde_json::Value::Null),
            refs: stringify_refs(memo.refs()),
            referenced_by,
        }
    }
}
