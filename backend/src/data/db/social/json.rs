#![allow(dead_code)]

use std::{
    io,
    path::{Path, PathBuf},
};
use tokio::fs;

use crate::data::SocialDocument;
use crate::error::{WeimoError, WeimoResult};

#[derive(Debug, Clone)]
pub struct JsonSocial {
    path: PathBuf,
    document: SocialDocument,
}

impl JsonSocial {
    pub async fn new<P: AsRef<Path>>(path: P) -> Self {
        let path = path.as_ref();
        if !path.exists() {
            if let Some(parent) = path.parent() {
                fs::create_dir_all(parent).await.unwrap();
            }
            fs::write(path, "{}").await.unwrap();
        }

        let document = fs::read_to_string(path)
            .await
            .ok()
            .and_then(|content| serde_json::from_str::<SocialDocument>(&content).ok())
            .unwrap_or_default();

        Self {
            path: path.to_path_buf(),
            document,
        }
    }

    pub fn in_memory() -> Self {
        Self {
            path: PathBuf::new(),
            document: SocialDocument::default(),
        }
    }

    pub fn document(&self) -> &SocialDocument {
        &self.document
    }

    pub fn document_mut(&mut self) -> &mut SocialDocument {
        &mut self.document
    }

    #[cfg(test)]
    pub fn replace_document(&mut self, document: SocialDocument) {
        self.document = document;
    }

    pub async fn save(&self) -> WeimoResult<()> {
        if self.path.as_os_str().is_empty() {
            return Ok(());
        }

        let json = serde_json::to_string_pretty(&self.document)
            .map_err(|error| WeimoError::WriteError(io::Error::other(error)))?;
        fs::write(&self.path, json)
            .await
            .map_err(WeimoError::WriteError)
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::data::{
        FriendRequest, FriendRequestStatus, Friendship, SocialDocument, SocialNotification,
        SocialNotificationKind,
    };
    use time::OffsetDateTime;

    fn now() -> OffsetDateTime {
        OffsetDateTime::from_unix_timestamp(1_772_000_000).unwrap()
    }

    fn later() -> OffsetDateTime {
        OffsetDateTime::from_unix_timestamp(1_772_000_060).unwrap()
    }

    #[tokio::test]
    async fn new_creates_empty_social_file() {
        let dir = tempfile::tempdir().unwrap();
        let path = dir.path().join("social.json");

        let social = JsonSocial::new(&path).await;

        assert!(path.exists());
        assert_eq!(social.document().friendships.len(), 0);
        assert_eq!(social.document().requests.len(), 0);
        assert_eq!(social.document().notifications.len(), 0);
    }

    #[tokio::test]
    async fn save_persists_and_reload_round_trips_document() {
        let dir = tempfile::tempdir().unwrap();
        let path = dir.path().join("social.json");
        let mut social = JsonSocial::new(&path).await;

        let expected = SocialDocument {
            friendships: vec![Friendship {
                id: "friendship-1".to_string(),
                user_a: "alice".to_string(),
                user_b: "bob".to_string(),
                created_at: now(),
            }],
            requests: vec![FriendRequest {
                id: "request-1".to_string(),
                from: "alice".to_string(),
                to: "bob".to_string(),
                status: FriendRequestStatus::Pending,
                created_at: now(),
                handled_at: Some(later()),
            }],
            notifications: vec![SocialNotification {
                id: "notification-1".to_string(),
                recipient: "bob".to_string(),
                kind: SocialNotificationKind::FriendRequest,
                request_id: Some("request-1".to_string()),
                from: Some("alice".to_string()),
                read_at: Some(later()),
                created_at: now(),
            }],
        };

        social.replace_document(expected.clone());
        social.save().await.unwrap();

        let reloaded = JsonSocial::new(&path).await;
        let raw_json: serde_json::Value =
            serde_json::from_str(&fs::read_to_string(&path).await.unwrap()).unwrap();

        assert_eq!(reloaded.document(), &expected);
        assert_eq!(
            raw_json["friendships"][0]["created_at"],
            "2026-02-25T06:13:20Z"
        );
        assert_eq!(
            raw_json["requests"][0]["created_at"],
            "2026-02-25T06:13:20Z"
        );
        assert_eq!(
            raw_json["requests"][0]["handled_at"],
            "2026-02-25T06:14:20Z"
        );
        assert_eq!(
            raw_json["notifications"][0]["created_at"],
            "2026-02-25T06:13:20Z"
        );
        assert_eq!(
            raw_json["notifications"][0]["read_at"],
            "2026-02-25T06:14:20Z"
        );
    }
}
