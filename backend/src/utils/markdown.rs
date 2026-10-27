use serde::Deserialize;

/// Split a Markdown document into YAML front matter and body.
///
/// The persisted Timu and Memo format trims the document, accepts CRLF input,
/// and removes one blank line between the closing delimiter and the body.
pub fn split_front_matter(markdown: &str) -> Option<(String, String)> {
    let normalized = markdown.trim().replace("\r\n", "\n");
    let document = normalized.strip_prefix("---\n")?;
    let (front_matter, body) = document.split_once("\n---\n")?;
    let body = body.strip_prefix('\n').unwrap_or(body);

    Some((front_matter.to_string(), body.to_string()))
}

/// Render YAML front matter and a Markdown body using the persisted envelope.
pub fn render_front_matter(front_matter: &str, body: &str) -> String {
    format!(
        "---\n{}\n---\n\n{body}",
        front_matter.trim_end_matches('\n')
    )
}

/// Deserialize a legacy YAML scalar using the string semantics of the old
/// line-based front matter reader.
pub fn deserialize_scalar_string<'de, D>(deserializer: D) -> Result<String, D::Error>
where
    D: serde::Deserializer<'de>,
{
    let value = noyalib::Value::deserialize(deserializer)?;
    scalar_string(&value).ok_or_else(|| serde::de::Error::custom("expected a YAML scalar"))
}

/// Deserialize a YAML sequence while preserving legacy unquoted scalar tags.
pub fn deserialize_string_list<'de, D>(deserializer: D) -> Result<Vec<String>, D::Error>
where
    D: serde::Deserializer<'de>,
{
    let value = noyalib::Value::deserialize(deserializer)?;
    let noyalib::Value::Sequence(values) = value else {
        return Ok(Vec::new());
    };

    values
        .iter()
        .map(|value| {
            scalar_string(value).ok_or_else(|| serde::de::Error::custom("expected a YAML scalar"))
        })
        .collect()
}

fn scalar_string(value: &noyalib::Value) -> Option<String> {
    match value {
        noyalib::Value::Null => Some(String::new()),
        noyalib::Value::Bool(value) => Some(value.to_string()),
        noyalib::Value::Number(value) => Some(value.to_string()),
        noyalib::Value::String(value) => Some(value.clone()),
        noyalib::Value::Tagged(value) => scalar_string(value.value()),
        noyalib::Value::Sequence(_) | noyalib::Value::Mapping(_) => None,
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde::Deserialize;

    #[test]
    fn splits_lf_and_crlf_documents() {
        for markdown in [
            "---\nid: 7\n---\n\nbody",
            "\r\n---\r\nid: 7\r\n---\r\n\r\nbody\r\n",
        ] {
            assert_eq!(
                split_front_matter(markdown),
                Some(("id: 7".to_string(), "body".to_string()))
            );
        }
    }

    #[test]
    fn rejects_missing_or_unclosed_front_matter() {
        assert_eq!(split_front_matter("body"), None);
        assert_eq!(split_front_matter("---\nid: 7"), None);
    }

    #[test]
    fn renders_canonical_envelope() {
        assert_eq!(
            render_front_matter("id: 7\n", "body"),
            "---\nid: 7\n---\n\nbody"
        );
    }

    #[test]
    fn deserializes_legacy_scalar_strings() {
        #[derive(Debug, Deserialize, PartialEq)]
        struct Strings {
            #[serde(deserialize_with = "deserialize_scalar_string")]
            title: String,
            #[serde(deserialize_with = "deserialize_string_list")]
            tags: Vec<String>,
        }

        let parsed = noyalib::from_str::<Strings>(
            "title:\ntags:\n  - true\n  - 7\n  - 1.5\n  - text\n  -\n",
        )
        .unwrap();

        assert_eq!(
            parsed,
            Strings {
                title: String::new(),
                tags: vec!["true", "7", "1.5", "text", ""]
                    .into_iter()
                    .map(String::from)
                    .collect(),
            }
        );
    }
}
