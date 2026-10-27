use axum::extract::State;
use axum::routing::{get, post};
use axum::{Json, Router};

use crate::data::{
    Claims, LoginNameUpdateRequest, LoginPasswordUpdateRequest, MemoDb, NicknameUpdateRequest,
    Stats, UserDb, UserView,
};
use crate::error::{WeimoError, WeimoResult};
use crate::routers::AppState;

pub fn me_router<U: UserDb + 'static, M: MemoDb + 'static>(state: AppState<U, M>) -> Router {
    Router::new()
        .route("/stats", get(stats))
        .route("/nickname", post(update_me_nickname))
        .route("/login-name", post(update_me_login_name))
        .route("/login-password", post(update_me_login_password))
        .route("/", get(me).delete(delete_me).patch(update_me_nickname))
        .with_state(state)
}

/// 获取当前用户信息
async fn me<U: UserDb, M: MemoDb>(
    claims: Claims,
    State(state): State<AppState<U, M>>,
) -> WeimoResult<Json<UserView>> {
    tracing::debug!("收到用户信息请求: username={}", claims.sub);
    let user = state.data_manager().get_user(&claims.sub).await?;
    tracing::debug!("用户信息请求成功: nickname={}", user.nickname());
    Ok(Json(user.into()))
}

/// 删除当前用户
async fn delete_me<U: UserDb, M: MemoDb>(
    claims: Claims,
    State(state): State<AppState<U, M>>,
) -> WeimoResult<Json<UserView>> {
    tracing::debug!("收到删除用户请求: username={}", claims.sub);
    let user = state.data_manager().get_user(&claims.sub).await?;

    state.data_manager().delete_user(&claims.sub).await?;
    tracing::debug!("用户删除成功");
    Ok(Json(user.into()))
}

/// 更新当前用户昵称
async fn update_me_nickname<U: UserDb, M: MemoDb>(
    claims: Claims,
    State(state): State<AppState<U, M>>,
    Json(request): Json<NicknameUpdateRequest>,
) -> WeimoResult<()> {
    let nickname = request.nickname.trim();
    if nickname.is_empty() {
        return Err(WeimoError::InvalidNickname);
    }

    update_nickname(&state, &claims.sub, nickname).await
}

async fn update_nickname<U: UserDb, M: MemoDb>(
    state: &AppState<U, M>,
    username: &str,
    nickname: &str,
) -> WeimoResult<()> {
    tracing::debug!(
        "收到更新用户昵称请求: username={}, nickname={}",
        username,
        nickname
    );
    state
        .data_manager()
        .update_user_nickname(username, nickname)
        .await?;
    tracing::debug!("用户更新成功");
    Ok(())
}

/// 更新当前用户登录名
async fn update_me_login_name<U: UserDb, M: MemoDb>(
    claims: Claims,
    State(state): State<AppState<U, M>>,
    Json(request): Json<LoginNameUpdateRequest>,
) -> WeimoResult<Json<UserView>> {
    let login_name = request.login_name.trim();
    let user = state
        .data_manager()
        .update_user_login_name(&claims.sub, login_name)
        .await?;
    Ok(Json(user.into()))
}

/// 更新当前用户登录密码
async fn update_me_login_password<U: UserDb, M: MemoDb>(
    claims: Claims,
    State(state): State<AppState<U, M>>,
    Json(request): Json<LoginPasswordUpdateRequest>,
) -> WeimoResult<Json<UserView>> {
    if request.password.trim().is_empty() {
        return Err(WeimoError::InvalidLoginPassword);
    }
    if request.password != request.confirm_password {
        return Err(WeimoError::LoginPasswordMismatch);
    }

    let user = state
        .data_manager()
        .update_user_password(&claims.sub, &request.password)
        .await?;
    Ok(Json(user.into()))
}

/// 获取用户统计信息
pub async fn stats<U: UserDb, M: MemoDb>(
    State(state): State<AppState<U, M>>,
    claims: Claims,
) -> WeimoResult<Json<Stats>> {
    tracing::debug!("收到统计请求: username={}", claims.sub);

    let user = state.data_manager().get_user(&claims.sub).await?;
    let stats = state.data_manager().get_stats(user.username()).await?;

    tracing::debug!(
        "统计请求成功: memos={}, tags={}, words={}",
        stats.note_count,
        stats.tag_count,
        stats.word_count
    );
    Ok(Json(stats))
}
