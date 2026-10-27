#![allow(dead_code)]

use serde::{Deserialize, Serialize};
use time::OffsetDateTime;

use super::user::UserView;

#[derive(Debug, Clone, Default, Serialize, Deserialize, PartialEq, Eq)]
pub struct SocialDocument {
    #[serde(default)]
    pub friendships: Vec<Friendship>,
    #[serde(default)]
    pub requests: Vec<FriendRequest>,
    #[serde(default)]
    pub notifications: Vec<SocialNotification>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub struct Friendship {
    pub id: String,
    pub user_a: String,
    pub user_b: String,
    #[serde(with = "time::serde::rfc3339")]
    pub created_at: OffsetDateTime,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub struct FriendRequest {
    pub id: String,
    pub from: String,
    pub to: String,
    pub status: FriendRequestStatus,
    #[serde(with = "time::serde::rfc3339")]
    pub created_at: OffsetDateTime,
    #[serde(
        default,
        with = "time::serde::rfc3339::option",
        skip_serializing_if = "Option::is_none"
    )]
    pub handled_at: Option<OffsetDateTime>,
}

#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum FriendRequestStatus {
    Pending,
    Accepted,
    Expired,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub struct SocialNotification {
    pub id: String,
    pub recipient: String,
    pub kind: SocialNotificationKind,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub request_id: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub from: Option<String>,
    #[serde(
        default,
        with = "time::serde::rfc3339::option",
        skip_serializing_if = "Option::is_none"
    )]
    pub read_at: Option<OffsetDateTime>,
    #[serde(with = "time::serde::rfc3339")]
    pub created_at: OffsetDateTime,
}

#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum SocialNotificationKind {
    FriendRequest,
    FriendAccepted,
}

#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "SCREAMING_SNAKE_CASE")]
pub enum FriendConflictCode {
    AlreadyPaired,
    TargetPaired,
    PendingExists,
    RequestExpired,
    RequestNotFound,
    InvalidFriendTarget,
    NoFriendsYet,
    NotYourFriend,
    FriendUnavailable,
}

impl FriendConflictCode {
    pub fn message(self) -> &'static str {
        match self {
            Self::AlreadyPaired => "你已经添加朋友了",
            Self::TargetPaired => "对方已经添加朋友了",
            Self::PendingExists => "已有待处理的好友申请",
            Self::RequestExpired => "好友申请已失效",
            Self::RequestNotFound => "好友申请不存在",
            Self::InvalidFriendTarget => "无法添加该用户",
            Self::NoFriendsYet => "你还没有添加好友",
            Self::NotYourFriend => "该用户不是你的好友",
            Self::FriendUnavailable => "好友不可用",
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub struct FriendConflictBody {
    pub code: FriendConflictCode,
    pub message: String,
}

impl From<FriendConflictCode> for FriendConflictBody {
    fn from(code: FriendConflictCode) -> Self {
        Self {
            code,
            message: code.message().to_string(),
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub struct FriendProfile {
    pub username: String,
    pub nickname: String,
}

impl From<UserView> for FriendProfile {
    fn from(value: UserView) -> Self {
        Self {
            username: value.username,
            nickname: value.nickname,
        }
    }
}

impl From<&UserView> for FriendProfile {
    fn from(value: &UserView) -> Self {
        Self {
            username: value.username.clone(),
            nickname: value.nickname.clone(),
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub struct PendingOutgoingFriendRequestView {
    pub id: String,
    pub to: FriendProfile,
    #[serde(with = "time::serde::rfc3339")]
    pub created_at: OffsetDateTime,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub struct FriendSummary {
    #[serde(default)]
    pub friends: Vec<FriendProfile>,
    #[serde(default)]
    pub pending_outgoing: Vec<PendingOutgoingFriendRequestView>,
    pub pending_incoming_count: usize,
    pub unread_count: usize,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub struct FriendUnreadCount {
    pub unread_count: usize,
}

#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum FriendFollowState {
    None,
    PendingOutgoing,
    Paired,
    Unavailable,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub struct FriendSearchItem {
    pub user: FriendProfile,
    pub follow_state: FriendFollowState,
}

#[derive(Debug, Clone, Default, Serialize, Deserialize, PartialEq, Eq)]
pub struct FriendSearchResult {
    pub items: Vec<FriendSearchItem>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub struct FriendRequestCreate {
    pub to_username: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub struct DeletedFriendProfile {
    pub username: String,
    pub nickname: String,
    pub deleted: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub struct FriendNotificationRequestView {
    pub id: String,
    pub can_accept: bool,
    pub status: FriendRequestStatus,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub struct FriendNotificationView {
    pub id: String,
    pub kind: SocialNotificationKind,
    pub read: bool,
    #[serde(with = "time::serde::rfc3339")]
    pub created_at: OffsetDateTime,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub request: Option<FriendNotificationRequestView>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub from: Option<DeletedFriendProfile>,
}

#[derive(Debug, Clone, Default, Serialize, Deserialize, PartialEq, Eq)]
pub struct FriendNotificationList {
    pub items: Vec<FriendNotificationView>,
}

#[cfg(test)]
mod tests {
    use super::*;

    fn now() -> OffsetDateTime {
        OffsetDateTime::from_unix_timestamp(1_772_000_000).unwrap()
    }

    fn profile(username: &str) -> FriendProfile {
        FriendProfile {
            username: username.to_string(),
            nickname: format!("{username} nick"),
        }
    }

    #[test]
    fn friend_summary_uses_public_api_contract_fields() {
        let summary = FriendSummary {
            friends: vec![profile("bob")],
            pending_outgoing: vec![PendingOutgoingFriendRequestView {
                id: "request-1".to_string(),
                to: profile("carol"),
                created_at: now(),
            }],
            pending_incoming_count: 1,
            unread_count: 2,
        };

        let json = serde_json::to_value(summary).unwrap();

        assert_eq!(json["friends"][0]["username"], "bob");
        assert_eq!(json["pending_outgoing"][0]["to"]["username"], "carol");
        assert_eq!(json["pending_incoming_count"], 1);
        assert_eq!(json["unread_count"], 2);
        assert!(json.get("friend").is_none());
    }

    #[test]
    fn friend_dtos_use_expected_field_names() {
        let unread = serde_json::to_value(FriendUnreadCount { unread_count: 3 }).unwrap();
        let search = serde_json::to_value(FriendSearchItem {
            user: profile("bob"),
            follow_state: FriendFollowState::None,
        })
        .unwrap();
        let request = serde_json::to_value(FriendRequestCreate {
            to_username: "bob".to_string(),
        })
        .unwrap();

        assert_eq!(unread["unread_count"], 3);
        assert_eq!(search["user"]["username"], "bob");
        assert_eq!(request["to_username"], "bob");
    }

    #[test]
    fn notification_dtos_use_expected_field_names() {
        let notification = FriendNotificationView {
            id: "notification-1".to_string(),
            kind: SocialNotificationKind::FriendRequest,
            read: false,
            created_at: now(),
            request: Some(FriendNotificationRequestView {
                id: "request-1".to_string(),
                can_accept: true,
                status: FriendRequestStatus::Pending,
            }),
            from: Some(DeletedFriendProfile {
                username: "alice".to_string(),
                nickname: "用户已注销".to_string(),
                deleted: true,
            }),
        };
        let list = FriendNotificationList {
            items: vec![notification],
        };

        let json = serde_json::to_value(list).unwrap();

        assert_eq!(json["items"][0]["read"], false);
        assert_eq!(json["items"][0]["request"]["can_accept"], true);
        assert_eq!(json["items"][0]["from"]["deleted"], true);
        assert_eq!(json["items"][0]["from"]["nickname"], "用户已注销");
    }

    #[test]
    fn friend_memo_conflicts_serialize_as_stable_codes() {
        let body = FriendConflictBody::from(FriendConflictCode::AlreadyPaired);
        let json = serde_json::to_value(body).unwrap();
        assert_eq!(json["code"], "ALREADY_PAIRED");
        assert_eq!(json["message"], "你已经添加朋友了");

        let body = FriendConflictBody::from(FriendConflictCode::TargetPaired);
        let json = serde_json::to_value(body).unwrap();
        assert_eq!(json["code"], "TARGET_PAIRED");
        assert_eq!(json["message"], "对方已经添加朋友了");

        let body = FriendConflictBody::from(FriendConflictCode::NoFriendsYet);
        let json = serde_json::to_value(body).unwrap();
        assert_eq!(json["code"], "NO_FRIENDS_YET");
        assert_eq!(json["message"], "你还没有添加好友");

        let body = FriendConflictBody::from(FriendConflictCode::NotYourFriend);
        let json = serde_json::to_value(body).unwrap();
        assert_eq!(json["code"], "NOT_YOUR_FRIEND");
        assert_eq!(json["message"], "该用户不是你的好友");

        let body = FriendConflictBody::from(FriendConflictCode::FriendUnavailable);
        let json = serde_json::to_value(body).unwrap();
        assert_eq!(json["code"], "FRIEND_UNAVAILABLE");
        assert_eq!(json["message"], "好友不可用");
    }
}
