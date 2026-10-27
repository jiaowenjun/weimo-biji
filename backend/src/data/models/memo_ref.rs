use serde::de::{self, Visitor};
use serde::{Deserialize, Deserializer, Serialize, Serializer};
use std::fmt;
use std::str::FromStr;

use crate::data::MemoId;

#[derive(Debug, Clone, PartialEq, Eq, Hash)]
pub enum MemoRef {
    Own(MemoId),
    Friend { username: String, memo_id: MemoId },
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub enum MemoRefParseError {
    Empty,
    TooManySlashes,
    EmptyUsername,
    InvalidMemoId,
}

impl fmt::Display for MemoRefParseError {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        let message = match self {
            Self::Empty => "引用不能为空",
            Self::TooManySlashes => "好友引用格式不合法",
            Self::EmptyUsername => "好友用户名不能为空",
            Self::InvalidMemoId => "笔记 ID 必须是正整数",
        };
        f.write_str(message)
    }
}

impl MemoRef {
    pub fn own_id(&self) -> Option<MemoId> {
        match self {
            Self::Own(id) => Some(*id),
            Self::Friend { .. } => None,
        }
    }

    pub fn friend_target(&self) -> Option<(&str, MemoId)> {
        match self {
            Self::Own(_) => None,
            Self::Friend { username, memo_id } => Some((username.as_str(), *memo_id)),
        }
    }

    pub fn from_legacy_id(id: MemoId) -> Result<Self, MemoRefParseError> {
        if id == 0 {
            Err(MemoRefParseError::InvalidMemoId)
        } else {
            Ok(Self::Own(id))
        }
    }
}

impl fmt::Display for MemoRef {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            Self::Own(id) => write!(f, "{id}"),
            Self::Friend { username, memo_id } => write!(f, "{username}/{memo_id}"),
        }
    }
}

fn parse_positive_memo_id(raw: &str) -> Result<MemoId, MemoRefParseError> {
    let id = raw
        .parse::<MemoId>()
        .map_err(|_| MemoRefParseError::InvalidMemoId)?;
    if id == 0 {
        Err(MemoRefParseError::InvalidMemoId)
    } else {
        Ok(id)
    }
}

impl FromStr for MemoRef {
    type Err = MemoRefParseError;

    fn from_str(raw: &str) -> Result<Self, Self::Err> {
        let raw = raw.trim().trim_matches('"').trim_matches('\'');
        if raw.is_empty() {
            return Err(MemoRefParseError::Empty);
        }

        let parts = raw.split('/').collect::<Vec<_>>();
        match parts.as_slice() {
            [memo_id] => Ok(Self::Own(parse_positive_memo_id(memo_id)?)),
            [username, memo_id] => {
                if username.is_empty() {
                    return Err(MemoRefParseError::EmptyUsername);
                }
                Ok(Self::Friend {
                    username: (*username).to_string(),
                    memo_id: parse_positive_memo_id(memo_id)?,
                })
            }
            _ => Err(MemoRefParseError::TooManySlashes),
        }
    }
}

impl Serialize for MemoRef {
    fn serialize<S>(&self, serializer: S) -> Result<S::Ok, S::Error>
    where
        S: Serializer,
    {
        serializer.serialize_str(&self.to_string())
    }
}

struct MemoRefVisitor;

impl<'de> Visitor<'de> for MemoRefVisitor {
    type Value = MemoRef;

    fn expecting(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        f.write_str("a memo reference string like \"7\" or \"bob/7\", or a legacy positive integer")
    }

    fn visit_str<E>(self, value: &str) -> Result<Self::Value, E>
    where
        E: de::Error,
    {
        value.parse::<MemoRef>().map_err(E::custom)
    }

    fn visit_string<E>(self, value: String) -> Result<Self::Value, E>
    where
        E: de::Error,
    {
        self.visit_str(&value)
    }

    fn visit_u64<E>(self, value: u64) -> Result<Self::Value, E>
    where
        E: de::Error,
    {
        let id = MemoId::try_from(value).map_err(|_| E::custom("memo id is too large"))?;
        MemoRef::from_legacy_id(id).map_err(E::custom)
    }

    fn visit_i64<E>(self, value: i64) -> Result<Self::Value, E>
    where
        E: de::Error,
    {
        let id = MemoId::try_from(value).map_err(|_| E::custom("memo id must be positive"))?;
        MemoRef::from_legacy_id(id).map_err(E::custom)
    }
}

impl<'de> Deserialize<'de> for MemoRef {
    fn deserialize<D>(deserializer: D) -> Result<Self, D::Error>
    where
        D: Deserializer<'de>,
    {
        deserializer.deserialize_any(MemoRefVisitor)
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn parses_and_formats_own_ref() {
        let parsed = "7".parse::<MemoRef>().unwrap();
        assert_eq!(parsed, MemoRef::Own(7));
        assert_eq!(parsed.to_string(), "7");
    }

    #[test]
    fn parses_and_formats_friend_ref() {
        let parsed = "bob/12".parse::<MemoRef>().unwrap();
        assert_eq!(
            parsed,
            MemoRef::Friend {
                username: "bob".to_string(),
                memo_id: 12,
            }
        );
        assert_eq!(parsed.to_string(), "bob/12");
    }

    #[test]
    fn rejects_invalid_ref_strings() {
        for input in [
            "", "0", "-1", "abc", "bob/0", "bob/-1", "bob/x", "/7", "bob/7/8",
        ] {
            assert!(input.parse::<MemoRef>().is_err(), "{input} should fail");
        }
    }

    #[test]
    fn serde_json_uses_string_form() {
        let refs = vec![
            MemoRef::Own(7),
            MemoRef::Friend {
                username: "bob".to_string(),
                memo_id: 12,
            },
        ];
        let json = serde_json::to_string(&refs).unwrap();
        assert_eq!(json, r#"["7","bob/12"]"#);
        let decoded: Vec<MemoRef> = serde_json::from_str(&json).unwrap();
        assert_eq!(decoded, refs);
    }

    #[test]
    fn serde_json_accepts_legacy_numeric_refs() {
        let decoded: Vec<MemoRef> = serde_json::from_str("[7,\"bob/12\"]").unwrap();
        assert_eq!(
            decoded,
            vec![
                MemoRef::Own(7),
                MemoRef::Friend {
                    username: "bob".to_string(),
                    memo_id: 12,
                },
            ]
        );
    }
}
