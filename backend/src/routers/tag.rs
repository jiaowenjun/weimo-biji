use axum::extract::{Path, State};
use axum::routing::{get, put};
use axum::{Json, Router};

use crate::data::{Claims, MemoDb, TagRenameRequest, TreeMeta, UserDb};
use crate::error::WeimoResult;
use crate::routers::AppState;

pub fn tag_router<U: UserDb + 'static, M: MemoDb + 'static>(state: AppState<U, M>) -> Router {
    Router::new()
        .route("/meta", get(get_tag_meta))
        .route("/{tag}", put(update_tag).delete(delete_tag))
        .with_state(state)
}

async fn get_tag_meta<U: UserDb, M: MemoDb>(
    State(state): State<AppState<U, M>>,
    claims: Claims,
) -> WeimoResult<Json<TreeMeta>> {
    tracing::debug!("收到标签元信息请求: username={}", claims.sub);
    let user = state.data_manager().get_user(&claims.sub).await?;
    let meta = state.data_manager().get_tags_meta(user.username()).await?;
    tracing::debug!("标签元信息请求成功");
    Ok(Json(meta))
}

async fn update_tag<U: UserDb, M: MemoDb>(
    State(state): State<AppState<U, M>>,
    claims: Claims,
    Path(tag): Path<String>,
    Json(payload): Json<TagRenameRequest>,
) -> WeimoResult<Json<String>> {
    let old_tag = tag.replace("|", "/");
    tracing::debug!(
        "收到标签更新请求: username={}, old_tag={}, new_tag={}",
        claims.sub,
        old_tag,
        payload.new_tag
    );
    let user = state.data_manager().get_user(&claims.sub).await?;
    state
        .data_manager()
        .update_tag(user.username(), &old_tag, &payload.new_tag)
        .await?;
    tracing::debug!("标签更新成功");
    Ok(Json("ok".to_string()))
}

async fn delete_tag<U: UserDb, M: MemoDb>(
    State(state): State<AppState<U, M>>,
    claims: Claims,
    Path(tag): Path<String>,
) -> WeimoResult<Json<String>> {
    let tag = tag.replace("|", "/");
    tracing::debug!("收到标签删除请求: username={}, tag={}", claims.sub, tag);
    let user = state.data_manager().get_user(&claims.sub).await?;
    state
        .data_manager()
        .delete_tag(user.username(), &tag)
        .await?;
    tracing::debug!("标签删除成功");
    Ok(Json("ok".to_string()))
}
