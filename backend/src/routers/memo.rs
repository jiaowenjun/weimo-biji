use axum::extract::{Path, State};
use axum::routing::{get, post};
use axum::{Json, Router};

use crate::data::{
    Claims, MemoCreate, MemoDb, MemoId, MemoSearchPage, MemoSearchRequest, MemoUpdate, MemoView,
    UserDb,
};
use crate::error::WeimoResult;
use crate::routers::AppState;

pub fn memo_router<U: UserDb + 'static, M: MemoDb + 'static>(state: AppState<U, M>) -> Router {
    Router::new()
        .route("/", post(create_memo))
        .route("/search", post(search_memo_ids))
        .route("/{id}", get(get_memo).put(update_memo).delete(delete_memo))
        .route("/batch", post(get_memos))
        .with_state(state)
}

async fn search_memo_ids<U: UserDb, M: MemoDb>(
    State(state): State<AppState<U, M>>,
    claims: Claims,
    Json(request): Json<MemoSearchRequest>,
) -> WeimoResult<Json<MemoSearchPage>> {
    tracing::debug!(
        "收到笔记搜索请求: username={}, request={:?}",
        claims.sub,
        request
    );
    request.validate()?;
    let user = state.data_manager().get_user(&claims.sub).await?;
    let page = state
        .data_manager()
        .search_memo_page(user.username(), &request)
        .await?;
    tracing::debug!(
        "笔记搜索成功: total_count={}, items={}",
        page.total_count,
        page.items.len()
    );
    Ok(Json(page))
}

async fn get_memo<U: UserDb, M: MemoDb>(
    State(state): State<AppState<U, M>>,
    claims: Claims,
    Path(id): Path<MemoId>,
) -> WeimoResult<Json<MemoView>> {
    tracing::debug!("收到笔记请求: username={}, id={}", claims.sub, id);
    let user = state.data_manager().get_user(&claims.sub).await?;
    let view = state
        .data_manager()
        .get_memo_view(user.username(), &id)
        .await?;
    tracing::debug!("笔记请求成功");
    Ok(Json(view))
}

async fn get_memos<U: UserDb, M: MemoDb>(
    State(state): State<AppState<U, M>>,
    claims: Claims,
    Json(ids): Json<Vec<MemoId>>,
) -> WeimoResult<Json<Vec<MemoView>>> {
    tracing::debug!(
        "收到笔记列表请求: username={}, {} 条笔记",
        claims.sub,
        ids.len()
    );
    let user = state.data_manager().get_user(&claims.sub).await?;
    let views = state
        .data_manager()
        .get_memo_views(user.username(), &ids)
        .await?;
    tracing::debug!("笔记列表请求成功: {} 条笔记", views.len());
    Ok(Json(views))
}

async fn create_memo<U: UserDb, M: MemoDb>(
    State(state): State<AppState<U, M>>,
    claims: Claims,
    Json(info): Json<MemoCreate>,
) -> WeimoResult<Json<MemoId>> {
    tracing::debug!(
        "收到笔记创建请求: username={}, content={}字节",
        claims.sub,
        info.content.to_string().len(),
    );
    let user = state.data_manager().get_user(&claims.sub).await?;
    let memo = state
        .data_manager()
        .create_memo(user.username(), info)
        .await?;
    tracing::debug!("笔记创建成功: id={}", memo.id());
    Ok(Json(*memo.id()))
}

async fn update_memo<U: UserDb, M: MemoDb>(
    State(state): State<AppState<U, M>>,
    claims: Claims,
    Path(id): Path<MemoId>,
    Json(info): Json<MemoUpdate>,
) -> WeimoResult<Json<MemoId>> {
    tracing::debug!("收到笔记更新请求: username={}, id={}", claims.sub, id);
    let user = state.data_manager().get_user(&claims.sub).await?;
    let memo = state
        .data_manager()
        .update_memo(user.username(), &id, info)
        .await?;
    tracing::debug!("笔记更新成功");
    Ok(Json(*memo.id()))
}

async fn delete_memo<U: UserDb, M: MemoDb>(
    State(state): State<AppState<U, M>>,
    claims: Claims,
    Path(id): Path<MemoId>,
) -> WeimoResult<Json<MemoId>> {
    tracing::debug!("收到笔记删除请求: username={}, id={}", claims.sub, id);
    let user = state.data_manager().get_user(&claims.sub).await?;
    let memo = state
        .data_manager()
        .delete_memo(user.username(), &id)
        .await?;
    tracing::debug!("笔记删除成功");
    Ok(Json(*memo.id()))
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::config::ServerConfig;
    use crate::data::{DataManager, MdDb, MemoRef, MemoSearchQuery, MemoTextFilter, UserCreate};
    use crate::error::WeimoError;
    use time::OffsetDateTime;
    use tokio::time::{Duration, sleep};

    async fn setup_state() -> AppState<crate::data::JsonUsers, crate::data::MdMemos> {
        let temp_dir = tempfile::tempdir().expect("应能创建临时目录");
        let mut db = MdDb::new(temp_dir.path()).await;

        db.create_user(UserCreate {
            username: "test_user".to_string(),
            password: "hashed_password".to_string(),
            nickname: Some("Tester".to_string()),
        })
        .await
        .unwrap();

        for (id, content, tags) in [
            (1, "Axum search memo", vec!["work/rust".to_string()]),
            (2, "Tower memo", vec!["work/go".to_string()]),
            (3, "Third page memo", vec!["work/rust".to_string()]),
            (4, "Newest memo", vec!["life/review".to_string()]),
        ] {
            db.create_memo(
                "test_user",
                MemoCreate {
                    content: serde_json::json!({
                        "schema": "weimo.document",
                        "version": 1,
                        "root": { "type": "doc", "content": [
                            { "type": "paragraph", "content": [{ "type": "text", "text": content }] }
                        ]}
                    }),
                    tags,
                    refs: vec![],
                },
                id,
            )
            .await
            .unwrap();
            sleep(Duration::from_millis(2)).await;
        }

        let manager = DataManager::new(db).await.unwrap();
        let state = AppState::new(
            manager,
            ServerConfig {
                storage_path: temp_dir.path().display().to_string(),
                bind_host: "127.0.0.1".to_string(),
                bind_port: 8000,
                refresh_cookie_secure: false,
                cors_allowed_origins: vec!["http://localhost:3000".to_string()],
                wechat_app_id: None,
                wechat_app_secret: None,
                wechat_api_base_url: "https://api.weixin.qq.com".to_string(),
            },
        );

        Box::leak(Box::new(temp_dir));
        state
    }

    fn test_claims() -> Claims {
        Claims {
            sub: "test_user".to_string(),
            exp: OffsetDateTime::now_utc().unix_timestamp() + 3600,
        }
    }

    #[tokio::test]
    async fn test_search_memo_ids_returns_matching_ids() {
        let state = setup_state().await;

        let Json(page) = search_memo_ids(
            State(state),
            test_claims(),
            Json(MemoSearchRequest {
                query: MemoSearchQuery {
                    tag: Some("work/rust".to_string()),
                    text: Some(MemoTextFilter {
                        contains: "axum".to_string(),
                    }),
                    ..MemoSearchQuery::default()
                },
                page_size: Some(8),
                ..MemoSearchRequest::default()
            }),
        )
        .await
        .unwrap();

        assert_eq!(page.total_count, 1);
        assert_eq!(
            page.items.iter().map(|view| view.id).collect::<Vec<_>>(),
            vec![1]
        );
        assert!(!page.has_more);
    }

    #[tokio::test]
    async fn test_search_memo_ids_returns_cursor_page() {
        let state = setup_state().await;

        let Json(first_page) = search_memo_ids(
            State(state.clone()),
            test_claims(),
            Json(MemoSearchRequest {
                page_size: Some(2),
                ..MemoSearchRequest::default()
            }),
        )
        .await
        .unwrap();

        assert_eq!(
            first_page
                .items
                .iter()
                .map(|view| view.id)
                .collect::<Vec<_>>(),
            vec![4, 3]
        );
        assert_eq!(first_page.total_count, 4);
        assert!(first_page.has_more);

        let Json(second_page) = search_memo_ids(
            State(state),
            test_claims(),
            Json(MemoSearchRequest {
                cursor: first_page.next_cursor,
                page_size: Some(2),
                ..MemoSearchRequest::default()
            }),
        )
        .await
        .unwrap();

        assert_eq!(
            second_page
                .items
                .iter()
                .map(|view| view.id)
                .collect::<Vec<_>>(),
            vec![2, 1]
        );
        assert_eq!(second_page.total_count, 4);
        assert!(!second_page.has_more);
    }

    #[tokio::test]
    async fn test_get_memo_returns_view_with_refs_and_referenced_by() {
        let state = setup_state().await;
        state
            .data_manager()
            .update_memo(
                "test_user",
                &4,
                MemoUpdate {
                    content: None,
                    tags: None,
                    refs: Some(vec![MemoRef(1)]),
                },
            )
            .await
            .unwrap();

        let Json(view4) = get_memo(State(state.clone()), test_claims(), Path(4 as MemoId))
            .await
            .unwrap();
        assert_eq!(view4.refs, vec!["1"]);
        assert!(view4.referenced_by.is_empty());

        let Json(view1) = get_memo(State(state), test_claims(), Path(1 as MemoId))
            .await
            .unwrap();
        assert_eq!(view1.refs, Vec::<String>::new());
        assert_eq!(view1.referenced_by, vec!["4"]);
    }

    #[tokio::test]
    async fn test_search_memo_ids_rejects_invalid_query() {
        let state = setup_state().await;

        let result = search_memo_ids(
            State(state),
            test_claims(),
            Json(MemoSearchRequest {
                query: MemoSearchQuery {
                    created_at: Some(crate::data::MemoDateFilter::Month {
                        year: 2026,
                        month: 13,
                    }),
                    ..MemoSearchQuery::default()
                },
                ..MemoSearchRequest::default()
            }),
        )
        .await;

        assert!(matches!(result, Err(WeimoError::InvalidSearchQuery(_))));
    }

    #[tokio::test]
    async fn test_search_memo_ids_rejects_invalid_cursor() {
        let state = setup_state().await;

        let result = search_memo_ids(
            State(state),
            test_claims(),
            Json(MemoSearchRequest {
                cursor: Some("bad-cursor".to_string()),
                query: MemoSearchQuery {
                    created_at: Some(crate::data::MemoDateFilter::Month {
                        year: 2026,
                        month: 3,
                    }),
                    ..MemoSearchQuery::default()
                },
                ..MemoSearchRequest::default()
            }),
        )
        .await;

        assert!(matches!(result, Err(WeimoError::InvalidSearchQuery(_))));
    }
}
