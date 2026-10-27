use serde::de::{self, Visitor};
use serde::{Deserialize, Deserializer, Serialize, Serializer};
use std::fmt;
use std::str::FromStr;

use crate::data::MemoId;

/// 笔记引用，仅支持引用当前用户自己的笔记，序列化为 ID 字符串。
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash)]
pub struct MemoRef(pub MemoId);

#[derive(Debug, Clone, PartialEq, Eq)]
pub enum MemoRefParseError {
    Empty,
    InvalidMemoId,
}

impl fmt::Display for MemoRefParseError {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        let message = match self {
            Self::Empty => "引用不能为空",
            Self::InvalidMemoId => "笔记 ID 必须是正整数",
        };
        f.write_str(message)
    }
}

fn from_legacy_id(id: MemoId) -> Result<MemoRef, MemoRefParseError> {
    if id == 0 {
        Err(MemoRefParseError::InvalidMemoId)
    } else {
        Ok(MemoRef(id))
    }
}

impl fmt::Display for MemoRef {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        write!(f, "{}", self.0)
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

        Ok(Self(parse_positive_memo_id(raw)?))
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
        f.write_str("a memo reference string like \"7\", or a legacy positive integer")
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
        from_legacy_id(id).map_err(E::custom)
    }

    fn visit_i64<E>(self, value: i64) -> Result<Self::Value, E>
    where
        E: de::Error,
    {
        let id = MemoId::try_from(value).map_err(|_| E::custom("memo id must be positive"))?;
        from_legacy_id(id).map_err(E::custom)
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
        assert_eq!(parsed, MemoRef(7));
        assert_eq!(parsed.to_string(), "7");
    }

    #[test]
    fn rejects_invalid_ref_strings() {
        for input in ["", "0", "-1", "abc", "bob/7", "bob/0", "/7", "bob/7/8"] {
            assert!(input.parse::<MemoRef>().is_err(), "{input} should fail");
        }
    }

    #[test]
    fn serde_json_uses_string_form() {
        let refs = vec![MemoRef(7), MemoRef(12)];
        let json = serde_json::to_string(&refs).unwrap();
        assert_eq!(json, r#"["7","12"]"#);
        let decoded: Vec<MemoRef> = serde_json::from_str(&json).unwrap();
        assert_eq!(decoded, refs);
    }

    #[test]
    fn serde_json_accepts_legacy_numeric_refs() {
        let decoded: Vec<MemoRef> = serde_json::from_str("[7,\"12\"]").unwrap();
        assert_eq!(decoded, vec![MemoRef(7), MemoRef(12)]);
    }
}
