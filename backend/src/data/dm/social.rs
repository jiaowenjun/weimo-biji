use std::sync::Arc;

use time::OffsetDateTime;
use tokio::sync::RwLock;
use uuid::Uuid;

use super::DataManager;
use crate::data::MemoDb;
use crate::data::{
    FriendConflictCode, FriendFollowState, FriendNotificationList, FriendNotificationRequestView,
    FriendNotificationView, FriendProfile, FriendRequest, FriendRequestStatus, FriendSearchItem,
    FriendSearchResult, FriendSummary, FriendUnreadCount, Friendship, JsonSocial,
    PendingOutgoingFriendRequestView, SocialDocument, SocialNotification, SocialNotificationKind,
    UserDb, UserView,
};
use crate::error::{WeimoError, WeimoResult};

pub(super) const MAX_FRIENDS_PER_USER: usize = 1;
pub(super) const MAX_PENDING_OUTGOING_PER_USER: usize = 1;

#[derive(Debug, Clone)]
pub(super) struct SocialManager {
    pub(super) social: Arc<RwLock<JsonSocial>>,
}

impl SocialManager {
    pub(super) fn new(social: JsonSocial) -> Self {
        Self {
            social: Arc::new(RwLock::new(social)),
        }
    }

    pub(super) fn now() -> OffsetDateTime {
        OffsetDateTime::now_utc()
    }

    pub(super) fn next_id(prefix: &str) -> String {
        format!("{prefix}_{}", Uuid::new_v4().simple())
    }
}

impl<U: UserDb, M: MemoDb> DataManager<U, M> {
    pub(super) async fn ensure_existing_friend(
        &self,
        username: &str,
        friend_username: &str,
    ) -> WeimoResult<()> {
        let (is_friend, friend_count) = {
            let social = self.social.social.read().await;
            (
                Self::users_are_friends(social.document(), username, friend_username),
                Self::friend_count_for(social.document(), username),
            )
        };

        if !is_friend {
            let code = if friend_count == 0 {
                FriendConflictCode::NoFriendsYet
            } else {
                FriendConflictCode::NotYourFriend
            };
            return Err(WeimoError::FriendConflict(code));
        }

        if !self.db.read().await.user_exists(friend_username).await {
            return Err(WeimoError::FriendConflict(
                FriendConflictCode::FriendUnavailable,
            ));
        }

        Ok(())
    }

    pub(super) async fn existing_friend_usernames(&self, username: &str) -> Vec<String> {
        let friend_usernames = {
            let social = self.social.social.read().await;
            Self::friend_usernames_for(social.document(), username)
        };

        let mut existing = Vec::with_capacity(friend_usernames.len());
        for friend_username in friend_usernames {
            if self.db.read().await.user_exists(&friend_username).await {
                existing.push(friend_username);
            }
        }
        existing
    }

    pub(super) fn other_friend_username(friendship: &Friendship, username: &str) -> Option<String> {
        if friendship.user_a == username {
            Some(friendship.user_b.clone())
        } else if friendship.user_b == username {
            Some(friendship.user_a.clone())
        } else {
            None
        }
    }

    pub(super) fn friend_usernames_for(document: &SocialDocument, username: &str) -> Vec<String> {
        document
            .friendships
            .iter()
            .filter_map(|friendship| Self::other_friend_username(friendship, username))
            .collect()
    }

    fn friend_count_for(document: &SocialDocument, username: &str) -> usize {
        document
            .friendships
            .iter()
            .filter(|friendship| Self::other_friend_username(friendship, username).is_some())
            .count()
    }

    fn users_are_friends(document: &SocialDocument, username: &str, friend_username: &str) -> bool {
        document.friendships.iter().any(|friendship| {
            (friendship.user_a == username && friendship.user_b == friend_username)
                || (friendship.user_a == friend_username && friendship.user_b == username)
        })
    }

    fn outgoing_pending_count_for(requests: &[FriendRequest], username: &str) -> usize {
        requests
            .iter()
            .filter(|request| {
                request.status == FriendRequestStatus::Pending && request.from == username
            })
            .count()
    }

    fn user_has_pending(requests: &[FriendRequest], username: &str) -> bool {
        requests.iter().any(|request| {
            request.status == FriendRequestStatus::Pending
                && (request.from == username || request.to == username)
        })
    }

    fn users_have_pending_between(requests: &[FriendRequest], a: &str, b: &str) -> bool {
        requests.iter().any(|request| {
            request.status == FriendRequestStatus::Pending
                && ((request.from == a && request.to == b)
                    || (request.from == b && request.to == a))
        })
    }

    pub async fn get_friend_summary(&self, username: &str) -> WeimoResult<FriendSummary> {
        let (friend_usernames, outgoing, incoming_count, unread_count) = {
            let social = self.social.social.read().await;
            let document = social.document();
            let friend_usernames = Self::friend_usernames_for(document, username);
            let outgoing = document
                .requests
                .iter()
                .filter(|request| {
                    request.status == FriendRequestStatus::Pending && request.from == username
                })
                .cloned()
                .collect::<Vec<_>>();
            let incoming_count = document
                .requests
                .iter()
                .filter(|request| {
                    request.status == FriendRequestStatus::Pending && request.to == username
                })
                .count();
            let unread_count = document
                .notifications
                .iter()
                .filter(|notification| {
                    notification.recipient == username && notification.read_at.is_none()
                })
                .count();
            (friend_usernames, outgoing, incoming_count, unread_count)
        };

        let mut friends = Vec::with_capacity(friend_usernames.len());
        for friend_username in friend_usernames {
            friends.push(self.friend_profile(&friend_username).await?);
        }

        let mut pending_outgoing = Vec::with_capacity(outgoing.len());
        for request in outgoing {
            pending_outgoing.push(PendingOutgoingFriendRequestView {
                id: request.id,
                to: self.friend_profile(&request.to).await?,
                created_at: request.created_at,
            });
        }

        Ok(FriendSummary {
            friends,
            pending_outgoing,
            pending_incoming_count: incoming_count,
            unread_count,
        })
    }

    pub async fn get_friend_unread_count(&self, username: &str) -> WeimoResult<FriendUnreadCount> {
        let unread_count = self
            .social
            .social
            .read()
            .await
            .document()
            .notifications
            .iter()
            .filter(|notification| {
                notification.recipient == username && notification.read_at.is_none()
            })
            .count();
        Ok(FriendUnreadCount { unread_count })
    }

    pub async fn search_friends_by_nickname(
        &self,
        username: &str,
        nickname: &str,
    ) -> WeimoResult<FriendSearchResult> {
        let query = nickname.trim().to_lowercase();
        if query.is_empty() {
            return Err(WeimoError::InvalidSearchQuery(
                "nickname 不能为空".to_string(),
            ));
        }

        let users = {
            let db = self.db.read().await;
            let mut users = Vec::new();
            for candidate in db.get_all_users().await {
                if candidate == username {
                    continue;
                }
                if let Ok(user) = db.get_user(&candidate).await
                    && user.nickname().to_lowercase().contains(&query)
                {
                    users.push(UserView::from(user));
                }
            }
            users
        };

        let social = self.social.social.read().await;
        let document = social.document();
        let current_friend = document
            .friendships
            .iter()
            .find_map(|friendship| Self::other_friend_username(friendship, username));
        let current_user_blocked =
            current_friend.is_some() || Self::user_has_pending(&document.requests, username);

        Ok(FriendSearchResult {
            items: users
                .into_iter()
                .map(|user| {
                    let target_username = user.username.clone();
                    let target_friend = document.friendships.iter().find_map(|friendship| {
                        Self::other_friend_username(friendship, &target_username)
                    });
                    let follow_state = if current_friend.as_deref() == Some(&target_username) {
                        FriendFollowState::Paired
                    } else if document.requests.iter().any(|request| {
                        request.status == FriendRequestStatus::Pending
                            && request.from == username
                            && request.to == target_username
                    }) {
                        FriendFollowState::PendingOutgoing
                    } else if current_user_blocked
                        || target_friend.is_some()
                        || Self::user_has_pending(&document.requests, &target_username)
                    {
                        FriendFollowState::Unavailable
                    } else {
                        FriendFollowState::None
                    };
                    FriendSearchItem {
                        user: FriendProfile::from(user),
                        follow_state,
                    }
                })
                .collect(),
        })
    }

    pub async fn create_friend_request(&self, from: &str, to: &str) -> WeimoResult<FriendRequest> {
        let to = to.trim();
        let users_exist = {
            let db = self.db.read().await;
            db.user_exists(from).await && db.user_exists(to).await
        };
        if to.is_empty() || to == from || !users_exist {
            return Err(WeimoError::FriendConflict(
                FriendConflictCode::InvalidFriendTarget,
            ));
        }

        let request = {
            let mut social = self.social.social.write().await;
            let now = SocialManager::now();
            let request = {
                let document = social.document_mut();
                if Self::friend_count_for(document, from) >= MAX_FRIENDS_PER_USER {
                    return Err(WeimoError::FriendConflict(
                        FriendConflictCode::AlreadyPaired,
                    ));
                }
                if Self::friend_count_for(document, to) >= MAX_FRIENDS_PER_USER {
                    return Err(WeimoError::FriendConflict(FriendConflictCode::TargetPaired));
                }
                if Self::outgoing_pending_count_for(&document.requests, from)
                    >= MAX_PENDING_OUTGOING_PER_USER
                    || Self::user_has_pending(&document.requests, from)
                    || Self::user_has_pending(&document.requests, to)
                    || Self::users_have_pending_between(&document.requests, from, to)
                {
                    return Err(WeimoError::FriendConflict(
                        FriendConflictCode::PendingExists,
                    ));
                }

                let request = FriendRequest {
                    id: SocialManager::next_id("request"),
                    from: from.to_string(),
                    to: to.to_string(),
                    status: FriendRequestStatus::Pending,
                    created_at: now,
                    handled_at: None,
                };
                document.requests.push(request.clone());
                document.notifications.push(SocialNotification {
                    id: SocialManager::next_id("notification"),
                    recipient: to.to_string(),
                    kind: SocialNotificationKind::FriendRequest,
                    request_id: Some(request.id.clone()),
                    from: Some(from.to_string()),
                    read_at: None,
                    created_at: now,
                });
                request
            };
            social.save().await?;
            request
        };

        Ok(request)
    }

    pub async fn accept_friend_request(
        &self,
        username: &str,
        request_id: &str,
    ) -> WeimoResult<FriendSummary> {
        let (from, to) = {
            let social = self.social.social.read().await;
            let Some(request) = social
                .document()
                .requests
                .iter()
                .find(|request| request.id == request_id && request.to == username)
            else {
                return Err(WeimoError::FriendConflict(
                    FriendConflictCode::RequestNotFound,
                ));
            };
            if request.status != FriendRequestStatus::Pending {
                return Err(WeimoError::FriendConflict(
                    FriendConflictCode::RequestExpired,
                ));
            }
            (request.from.clone(), request.to.clone())
        };

        let (from_exists, to_exists) = {
            let db = self.db.read().await;
            (db.user_exists(&from).await, db.user_exists(&to).await)
        };

        let mut expired = false;
        {
            let mut social = self.social.social.write().await;
            let now = SocialManager::now();
            {
                let document = social.document_mut();
                let Some(index) = document
                    .requests
                    .iter()
                    .position(|request| request.id == request_id && request.to == username)
                else {
                    return Err(WeimoError::FriendConflict(
                        FriendConflictCode::RequestNotFound,
                    ));
                };

                if document.requests[index].status != FriendRequestStatus::Pending {
                    return Err(WeimoError::FriendConflict(
                        FriendConflictCode::RequestExpired,
                    ));
                }

                let from_reached_friend_limit =
                    Self::friend_count_for(document, &from) >= MAX_FRIENDS_PER_USER;
                let to_reached_friend_limit =
                    Self::friend_count_for(document, &to) >= MAX_FRIENDS_PER_USER;

                if !from_exists
                    || !to_exists
                    || from_reached_friend_limit
                    || to_reached_friend_limit
                {
                    document.requests[index].status = FriendRequestStatus::Expired;
                    document.requests[index].handled_at = Some(now);
                    expired = true;
                } else {
                    document.requests[index].status = FriendRequestStatus::Accepted;
                    document.requests[index].handled_at = Some(now);
                    document.friendships.push(Friendship {
                        id: SocialManager::next_id("friendship"),
                        user_a: from.clone(),
                        user_b: to.clone(),
                        created_at: now,
                    });
                    document.notifications.push(SocialNotification {
                        id: SocialManager::next_id("notification"),
                        recipient: from.clone(),
                        kind: SocialNotificationKind::FriendAccepted,
                        request_id: Some(request_id.to_string()),
                        from: Some(to.clone()),
                        read_at: None,
                        created_at: now,
                    });
                }
            }
            social.save().await?;
        }

        if expired {
            return Err(WeimoError::FriendConflict(
                FriendConflictCode::RequestExpired,
            ));
        }

        self.get_friend_summary(username).await
    }

    pub async fn get_friend_notifications(
        &self,
        username: &str,
    ) -> WeimoResult<FriendNotificationList> {
        let (notifications, requests) = {
            let social = self.social.social.read().await;
            let mut notifications = social
                .document()
                .notifications
                .iter()
                .filter(|notification| notification.recipient == username)
                .cloned()
                .collect::<Vec<_>>();
            notifications.sort_by(|a, b| b.created_at.cmp(&a.created_at));
            (notifications, social.document().requests.clone())
        };

        let mut items = Vec::with_capacity(notifications.len());
        for notification in notifications {
            let request = notification.request_id.as_ref().and_then(|request_id| {
                requests
                    .iter()
                    .find(|request| request.id == *request_id)
                    .map(|request| {
                        let can_accept = request.status == FriendRequestStatus::Pending
                            && request.to == username
                            && notification.kind == SocialNotificationKind::FriendRequest;
                        FriendNotificationRequestView {
                            id: request.id.clone(),
                            can_accept,
                            status: request.status,
                        }
                    })
            });
            let from = match notification.from.as_deref() {
                Some(from) => Some(self.friend_profile_or_deleted(from).await),
                None => None,
            };
            items.push(FriendNotificationView {
                id: notification.id,
                kind: notification.kind,
                read: notification.read_at.is_some(),
                created_at: notification.created_at,
                request,
                from,
            });
        }

        Ok(FriendNotificationList { items })
    }

    pub async fn mark_friend_notifications_read(&self, username: &str) -> WeimoResult<()> {
        let mut social = self.social.social.write().await;
        let now = SocialManager::now();
        {
            let document = social.document_mut();
            for notification in &mut document.notifications {
                if notification.recipient == username && notification.read_at.is_none() {
                    notification.read_at = Some(now);
                }
            }
        }
        social.save().await
    }

    pub(super) async fn expire_social_for_deleted_user(&self, username: &str) -> WeimoResult<()> {
        let mut social = self.social.social.write().await;
        let now = SocialManager::now();
        {
            let document = social.document_mut();
            document.friendships.retain(|friendship| {
                friendship.user_a != username && friendship.user_b != username
            });
            for request in &mut document.requests {
                if request.status == FriendRequestStatus::Pending
                    && (request.from == username || request.to == username)
                {
                    request.status = FriendRequestStatus::Expired;
                    request.handled_at = Some(now);
                }
            }
        }
        social.save().await
    }
}
