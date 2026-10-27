use axum::extract::{Path, Query, State};
use axum::routing::{get, post};
use axum::{Json, Router};
use serde::Deserialize;

use crate::data::{
    Claims, FriendMemoSearchPage, FriendMemoSearchRequest, FriendMemoView, FriendNotificationList,
    FriendRequest, FriendRequestCreate, FriendSearchResult, FriendSummary, FriendUnreadCount,
    MemoDb, MemoId, Stats, TreeMeta, UserDb,
};
use crate::error::WeimoResult;
use crate::routers::AppState;

#[derive(Debug, Deserialize)]
struct FriendSearchQuery {
    nickname: String,
}

pub fn friend_router<U: UserDb + 'static, M: MemoDb + 'static>(state: AppState<U, M>) -> Router {
    Router::new()
        .route("/me", get(get_friend_me))
        .route("/unread-count", get(get_unread_count))
        .route("/search", get(search_friends))
        .route("/request", post(create_request))
        .route("/notifications", get(get_notifications))
        .route("/notifications/read", post(mark_notifications_read))
        .route("/requests/{id}/accept", post(accept_request))
        .route("/{friend_username}/stats", get(get_friend_stats))
        .route("/{friend_username}/tag/meta", get(get_friend_tag_meta))
        .route("/{friend_username}/memos/search", post(search_friend_memos))
        .route("/{friend_username}/memos/{id}", get(get_friend_memo))
        .with_state(state)
}

async fn get_friend_me<U: UserDb, M: MemoDb>(
    claims: Claims,
    State(state): State<AppState<U, M>>,
) -> WeimoResult<Json<FriendSummary>> {
    Ok(Json(
        state.data_manager().get_friend_summary(&claims.sub).await?,
    ))
}

async fn get_unread_count<U: UserDb, M: MemoDb>(
    claims: Claims,
    State(state): State<AppState<U, M>>,
) -> WeimoResult<Json<FriendUnreadCount>> {
    Ok(Json(
        state
            .data_manager()
            .get_friend_unread_count(&claims.sub)
            .await?,
    ))
}

async fn search_friends<U: UserDb, M: MemoDb>(
    claims: Claims,
    State(state): State<AppState<U, M>>,
    Query(query): Query<FriendSearchQuery>,
) -> WeimoResult<Json<FriendSearchResult>> {
    Ok(Json(
        state
            .data_manager()
            .search_friends_by_nickname(&claims.sub, &query.nickname)
            .await?,
    ))
}

async fn create_request<U: UserDb, M: MemoDb>(
    claims: Claims,
    State(state): State<AppState<U, M>>,
    Json(payload): Json<FriendRequestCreate>,
) -> WeimoResult<Json<FriendRequest>> {
    Ok(Json(
        state
            .data_manager()
            .create_friend_request(&claims.sub, &payload.to_username)
            .await?,
    ))
}

async fn get_notifications<U: UserDb, M: MemoDb>(
    claims: Claims,
    State(state): State<AppState<U, M>>,
) -> WeimoResult<Json<FriendNotificationList>> {
    Ok(Json(
        state
            .data_manager()
            .get_friend_notifications(&claims.sub)
            .await?,
    ))
}

async fn mark_notifications_read<U: UserDb, M: MemoDb>(
    claims: Claims,
    State(state): State<AppState<U, M>>,
) -> WeimoResult<()> {
    state
        .data_manager()
        .mark_friend_notifications_read(&claims.sub)
        .await
}

async fn accept_request<U: UserDb, M: MemoDb>(
    claims: Claims,
    State(state): State<AppState<U, M>>,
    Path(id): Path<String>,
) -> WeimoResult<Json<FriendSummary>> {
    Ok(Json(
        state
            .data_manager()
            .accept_friend_request(&claims.sub, &id)
            .await?,
    ))
}

async fn get_friend_stats<U: UserDb, M: MemoDb>(
    claims: Claims,
    State(state): State<AppState<U, M>>,
    Path(friend_username): Path<String>,
) -> WeimoResult<Json<Stats>> {
    Ok(Json(
        state
            .data_manager()
            .get_friend_stats(&claims.sub, &friend_username)
            .await?,
    ))
}

async fn get_friend_tag_meta<U: UserDb, M: MemoDb>(
    claims: Claims,
    State(state): State<AppState<U, M>>,
    Path(friend_username): Path<String>,
) -> WeimoResult<Json<TreeMeta>> {
    Ok(Json(
        state
            .data_manager()
            .get_friend_tags_meta(&claims.sub, &friend_username)
            .await?,
    ))
}

async fn search_friend_memos<U: UserDb, M: MemoDb>(
    claims: Claims,
    State(state): State<AppState<U, M>>,
    Path(friend_username): Path<String>,
    Json(request): Json<FriendMemoSearchRequest>,
) -> WeimoResult<Json<FriendMemoSearchPage>> {
    Ok(Json(
        state
            .data_manager()
            .search_friend_memo_page(&claims.sub, &friend_username, &request)
            .await?,
    ))
}

async fn get_friend_memo<U: UserDb, M: MemoDb>(
    claims: Claims,
    State(state): State<AppState<U, M>>,
    Path((friend_username, id)): Path<(String, MemoId)>,
) -> WeimoResult<Json<FriendMemoView>> {
    Ok(Json(
        state
            .data_manager()
            .get_friend_memo_view(&claims.sub, &friend_username, &id)
            .await?,
    ))
}
