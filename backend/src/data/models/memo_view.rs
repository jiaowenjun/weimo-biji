use serde::Serialize;
use time::OffsetDateTime;

use crate::data::{Memo, MemoId, MemoRef};

#[derive(Debug, Serialize)]
pub struct MemoView {
    pub id: MemoId,
    pub ct_utc: OffsetDateTime,
    pub mt_utc: OffsetDateTime,
    pub tags: Vec<String>,
    pub content: String,
    pub refs: Vec<String>,
    pub referenced_by: Vec<String>,
}

#[derive(Debug, Serialize)]
pub struct FriendMemoView {
    pub id: MemoId,
    pub ct_utc: OffsetDateTime,
    pub mt_utc: OffsetDateTime,
    pub tags: Vec<String>,
    pub content: String,
    #[serde(skip_serializing_if = "Vec::is_empty")]
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
            content: memo.content().to_string(),
            refs: stringify_refs(memo.refs()),
            referenced_by,
        }
    }
}

impl FriendMemoView {
    pub fn from_friend_memo(memo: &Memo, refs: Vec<String>, referenced_by: Vec<String>) -> Self {
        Self {
            id: *memo.id(),
            ct_utc: memo.create_t_utc(),
            mt_utc: memo.modify_t_utc(),
            tags: memo.tags().to_vec(),
            content: memo.content().to_string(),
            refs,
            referenced_by,
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::data::{MemoCreate, MemoRef};

    #[test]
    fn friend_memo_view_omits_empty_refs_field() {
        let memo = Memo::create(
            MemoCreate {
                content: "friend memo".to_string(),
                tags: vec![],
                refs: vec![MemoRef::Own(1)],
            },
            7,
        );

        let view = FriendMemoView::from_friend_memo(&memo, vec![], vec!["3".to_string()]);
        let json = serde_json::to_value(view).unwrap();

        assert!(json.get("refs").is_none());
        assert_eq!(json["referenced_by"], serde_json::json!(["3"]));
    }

    #[test]
    fn friend_memo_view_serializes_visible_refs() {
        let memo = Memo::create(
            MemoCreate {
                content: "friend memo".to_string(),
                tags: vec![],
                refs: vec![],
            },
            7,
        );

        let view =
            FriendMemoView::from_friend_memo(&memo, vec!["5".to_string()], vec!["3".to_string()]);
        let json = serde_json::to_value(view).unwrap();

        assert_eq!(json["refs"], serde_json::json!(["5"]));
        assert_eq!(json["referenced_by"], serde_json::json!(["3"]));
    }
}
