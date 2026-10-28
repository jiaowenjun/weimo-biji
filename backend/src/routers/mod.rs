mod auth;
mod cors;
mod me;
mod memo;
mod state;
mod tag;

use axum::{Json, Router, routing::get};
use serde::Serialize;
use tower_cookies::CookieManagerLayer;

use crate::data::{MemoDb, UserDb};

pub use state::AppState;

use auth::auth_router;
use cors::cors;
use me::me_router;
use memo::memo_router;
use tag::tag_router;

#[derive(Serialize)]
struct HealthResponse {
    ok: bool,
    service: &'static str,
}

async fn health() -> Json<HealthResponse> {
    tracing::debug!("健康检查请求");
    Json(HealthResponse {
        ok: true,
        service: "biji",
    })
}

pub fn app_router<U: UserDb + 'static, M: MemoDb + 'static>(state: AppState<U, M>) -> Router {
    let cors_layer = cors(state.config());

    Router::new()
        .route("/health", get(health))
        .nest("/auth", auth_router(state.clone()))
        .nest("/me", me_router(state.clone()))
        .nest("/memo", memo_router(state.clone()))
        .nest("/tag", tag_router(state))
        .layer(CookieManagerLayer::new())
        .layer(cors_layer)
}

#[cfg(test)]
mod tests {
    use std::{path::Path, sync::Arc};


    /// 单段纯文本的 WDF 文档 JSON(测试夹具)
    fn wdf_value(text: &str) -> serde_json::Value {
        serde_json::json!({
            "schema": "weimo.document",
            "version": 1,
            "root": { "type": "doc", "content": [
                { "type": "paragraph", "content": [{ "type": "text", "text": text }] }
            ]}
        })
    }

    use async_trait::async_trait;
    use axum::{
        body::{Body, to_bytes},
        http::{Method, Request, StatusCode, header},
    };
    use serde::{Deserialize, de::DeserializeOwned};
    use serde_json::json;
    use tempfile::TempDir;
    use tower::ServiceExt;

    use super::*;
    use crate::config::ServerConfig;
    use crate::data::{
        Claims, DataManager, MdDb, MemoCreate, MemoId, MemoRef, MiniAuthResult, MiniToken,
        MiniWechatCheckResult, Token, UserCreate, UserView,
    };
    use crate::error::{WeimoError, WeimoResult};
    use crate::wechat::{DynWechatAuthClient, WechatAuthClient, WechatSession};

    struct TestApp {
        app: Router,
        storage_dir: TempDir,
    }

    struct AuthSession {
        access_token: String,
        refresh_cookie: String,
    }

    #[derive(Debug, Deserialize)]
    struct TestMemoView {
        id: MemoId,
        ct_utc: serde_json::Value,
        mt_utc: serde_json::Value,
        tags: Vec<String>,
        content: serde_json::Value,
        refs: Vec<String>,
        referenced_by: Vec<String>,
    }

    #[derive(Debug)]
    struct MockWechatAuthClient;

    #[async_trait]
    impl WechatAuthClient for MockWechatAuthClient {
        async fn exchange_code(&self, code: &str) -> WeimoResult<WechatSession> {
            match code {
                "valid-wechat-code" => Ok(WechatSession {
                    openid: "wechat-openid-alice".to_string(),
                    unionid: Some("wechat-unionid-alice".to_string()),
                }),
                _ => Err(WeimoError::InvalidWechatCode),
            }
        }
    }

    async fn register_alice(app: &Router) {
        let register_response = send(
            app,
            build_request(
                Method::POST,
                "/auth/register",
                None,
                None,
                Some(
                    serde_json::to_vec(&UserCreate {
                        username: "alice".to_string(),
                        password: "secret".to_string(),
                        nickname: Some("Alice".to_string()),
                    })
                    .expect("注册请求应能序列化"),
                ),
            ),
        )
        .await;
        assert_eq!(register_response.status(), StatusCode::OK);

        let registered_user: UserView = json_body(register_response).await;
        assert_eq!(
            registered_user,
            UserView {
                username: "alice".to_string(),
                nickname: "Alice".to_string(),
                login_name: "alice".to_string(),
                has_login_password: true,
            }
        );
    }

    async fn setup_test_app() -> TestApp {
        let wechat_auth: DynWechatAuthClient = Arc::new(MockWechatAuthClient);
        let storage_dir = tempfile::tempdir().expect("应能创建临时目录");
        let db = MdDb::new(storage_dir.path()).await;
        let manager = DataManager::new(db).await.expect("应能初始化数据管理器");
        let config = ServerConfig {
            storage_path: storage_dir.path().display().to_string(),
            bind_host: "127.0.0.1".to_string(),
            bind_port: 8000,
            refresh_cookie_secure: false,
            cors_allowed_origins: vec!["http://localhost:3000".to_string()],
            wechat_app_id: Some("wx-test-app".to_string()),
            wechat_app_secret: Some("wx-test-secret".to_string()),
            wechat_api_base_url: "https://api.weixin.qq.com".to_string(),
        };
        let state = AppState::new_with_wechat(manager, config, wechat_auth);

        TestApp {
            app: app_router(state),
            storage_dir,
        }
    }

    async fn send(app: &Router, request: Request<Body>) -> axum::response::Response {
        app.clone()
            .oneshot(request)
            .await
            .expect("路由请求应成功执行")
    }

    fn build_request(
        method: Method,
        uri: &str,
        access_token: Option<&str>,
        cookie: Option<&str>,
        body: Option<Vec<u8>>,
    ) -> Request<Body> {
        let mut builder = Request::builder().method(method).uri(uri);

        if let Some(token) = access_token {
            builder = builder.header(header::AUTHORIZATION, format!("Bearer {token}"));
        }

        if let Some(cookie) = cookie {
            builder = builder.header(header::COOKIE, cookie);
        }

        if body.is_some() {
            builder = builder.header(header::CONTENT_TYPE, "application/json");
        }

        builder
            .body(body.map(Body::from).unwrap_or_else(Body::empty))
            .expect("应能构造 HTTP 请求")
    }

    async fn json_body<T: DeserializeOwned>(response: axum::response::Response) -> T {
        let bytes = to_bytes(response.into_body(), usize::MAX)
            .await
            .expect("应能读取响应体");
        serde_json::from_slice(&bytes).expect("响应体应为合法 JSON")
    }

    fn refresh_cookie(response: &axum::response::Response) -> String {
        response
            .headers()
            .get(header::SET_COOKIE)
            .expect("登录响应应返回 refresh_token cookie")
            .to_str()
            .expect("Set-Cookie 应为合法字符串")
            .split(';')
            .next()
            .expect("Set-Cookie 应包含 cookie 值")
            .to_string()
    }

    async fn authenticate(app: &Router) -> AuthSession {
        register_alice(app).await;

        let login_response = send(
            app,
            build_request(
                Method::POST,
                "/auth/login",
                None,
                None,
                Some(
                    serde_json::to_vec(&json!({
                        "username": "alice",
                        "password": "secret"
                    }))
                    .expect("登录请求应能序列化"),
                ),
            ),
        )
        .await;
        assert_eq!(login_response.status(), StatusCode::OK);

        let refresh_cookie = refresh_cookie(&login_response);
        let token: Token = json_body(login_response).await;

        AuthSession {
            access_token: token.token,
            refresh_cookie,
        }
    }

    async fn authenticate_mini(app: &Router) -> MiniToken {
        register_alice(app).await;

        let login_response = send(
            app,
            build_request(
                Method::POST,
                "/auth/mini/login",
                None,
                None,
                Some(
                    serde_json::to_vec(&json!({
                        "username": "alice",
                        "password": "secret"
                    }))
                    .expect("小程序登录请求应能序列化"),
                ),
            ),
        )
        .await;
        assert_eq!(login_response.status(), StatusCode::OK);

        json_body(login_response).await
    }

    async fn send_mini_wechat_login(
        app: &Router,
        nickname: Option<&str>,
    ) -> axum::response::Response {
        let mut payload = json!({ "code": "valid-wechat-code" });
        if let Some(nick) = nickname {
            payload["nickname"] = json!(nick);
        }
        send(
            app,
            build_request(
                Method::POST,
                "/auth/mini/wechat",
                None,
                None,
                Some(serde_json::to_vec(&payload).expect("小程序微信登录请求应能序列化")),
            ),
        )
        .await
    }

    async fn authenticate_mini_wechat_with_nickname(
        app: &Router,
        nickname: Option<&str>,
    ) -> MiniAuthResult {
        let login_response = send_mini_wechat_login(app, nickname).await;
        assert_eq!(login_response.status(), StatusCode::OK);
        json_body(login_response).await
    }

    async fn create_memo(app: &Router, access_token: &str, tags: &[&str], content: &str) -> MemoId {
        let response = send(
            app,
            build_request(
                Method::POST,
                "/memo",
                Some(access_token),
                None,
                Some(
                    serde_json::to_vec(&MemoCreate {
                        content: wdf_value(content),
                        tags: tags.iter().map(|tag| (*tag).to_string()).collect(),
                        refs: vec![],
                    })
                    .expect("创建 memo 请求应能序列化"),
                ),
            ),
        )
        .await;
        assert_eq!(response.status(), StatusCode::OK);
        json_body(response).await
    }

    async fn get_me(app: &Router, access_token: &str) -> UserView {
        let response = send(
            app,
            build_request(Method::GET, "/me", Some(access_token), None, None),
        )
        .await;
        assert_eq!(response.status(), StatusCode::OK);
        json_body(response).await
    }

    async fn get_memo(app: &Router, access_token: &str, memo_id: MemoId) -> TestMemoView {
        let response = send(
            app,
            build_request(
                Method::GET,
                &format!("/memo/{memo_id}"),
                Some(access_token),
                None,
                None,
            ),
        )
        .await;
        assert_eq!(response.status(), StatusCode::OK);
        json_body(response).await
    }

    async fn register_user(app: &Router, username: &str, nickname: &str) {
        let response = send(
            app,
            build_request(
                Method::POST,
                "/auth/register",
                None,
                None,
                Some(
                    serde_json::to_vec(&UserCreate {
                        username: username.to_string(),
                        password: "secret".to_string(),
                        nickname: Some(nickname.to_string()),
                    })
                    .expect("注册请求应能序列化"),
                ),
            ),
        )
        .await;
        assert_eq!(response.status(), StatusCode::OK);
    }

    async fn login_user(app: &Router, username: &str) -> String {
        let response = send(
            app,
            build_request(
                Method::POST,
                "/auth/login",
                None,
                None,
                Some(
                    serde_json::to_vec(&json!({
                        "username": username,
                        "password": "secret"
                    }))
                    .expect("登录请求应能序列化"),
                ),
            ),
        )
        .await;
        assert_eq!(response.status(), StatusCode::OK);
        let token: Token = json_body(response).await;
        token.token
    }

    async fn login_with_password(
        app: &Router,
        login_name: &str,
        password: &str,
    ) -> axum::response::Response {
        send(
            app,
            build_request(
                Method::POST,
                "/auth/login",
                None,
                None,
                Some(
                    serde_json::to_vec(&json!({
                        "login_name": login_name,
                        "password": password
                    }))
                    .expect("登录请求应能序列化"),
                ),
            ),
        )
        .await
    }

    #[tokio::test]
    async fn health_returns_machine_readable_service_identity() {
        let TestApp {
            app,
            storage_dir: _storage_dir,
        } = setup_test_app().await;

        let response = send(
            &app,
            build_request(Method::GET, "/health", None, None, None),
        )
        .await;

        assert_eq!(response.status(), StatusCode::OK);
        assert_eq!(
            json_body::<serde_json::Value>(response).await,
            json!({
                "ok": true,
                "service": "biji"
            })
        );
    }

    async fn batch_get_memos(
        app: &Router,
        access_token: &str,
        memo_ids: &[MemoId],
    ) -> Vec<TestMemoView> {
        let response = send(
            app,
            build_request(
                Method::POST,
                "/memo/batch",
                Some(access_token),
                None,
                Some(serde_json::to_vec(memo_ids).expect("批量获取 memo 请求应能序列化")),
            ),
        )
        .await;
        assert_eq!(response.status(), StatusCode::OK);
        json_body(response).await
    }

    #[tokio::test]
    async fn register_login_me_and_refresh_flow_works() {
        let test_app = setup_test_app().await;
        let session = authenticate(&test_app.app).await;

        let me = get_me(&test_app.app, &session.access_token).await;
        assert_eq!(
            me,
            UserView {
                username: "alice".to_string(),
                nickname: "Alice".to_string(),
                login_name: "alice".to_string(),
                has_login_password: true,
            }
        );

        let refresh_response = send(
            &test_app.app,
            build_request(
                Method::POST,
                "/auth/refresh",
                None,
                Some(&session.refresh_cookie),
                None,
            ),
        )
        .await;
        assert_eq!(refresh_response.status(), StatusCode::OK);

        let refreshed_token: Token = json_body(refresh_response).await;
        assert_eq!(refreshed_token.token_type, "Bearer");
        assert!(!refreshed_token.token.is_empty());
    }

    #[tokio::test]
    async fn login_accepts_login_name_and_legacy_username_alias() {
        let test_app = setup_test_app().await;
        register_alice(&test_app.app).await;

        let login_name_response = login_with_password(&test_app.app, "alice", "secret").await;
        assert_eq!(login_name_response.status(), StatusCode::OK);

        let legacy_response = send(
            &test_app.app,
            build_request(
                Method::POST,
                "/auth/login",
                None,
                None,
                Some(
                    serde_json::to_vec(&json!({
                        "username": "alice",
                        "password": "secret"
                    }))
                    .expect("旧登录请求应能序列化"),
                ),
            ),
        )
        .await;
        assert_eq!(legacy_response.status(), StatusCode::OK);
    }

    #[tokio::test]
    async fn login_name_update_enables_new_login_and_preserves_token_subject() {
        let test_app = setup_test_app().await;
        let session = authenticate(&test_app.app).await;

        let update_response = send(
            &test_app.app,
            build_request(
                Method::POST,
                "/me/login-name",
                Some(&session.access_token),
                None,
                Some(
                    serde_json::to_vec(&json!({
                        "login_name": "alice-web"
                    }))
                    .expect("登录名更新请求应能序列化"),
                ),
            ),
        )
        .await;
        assert_eq!(update_response.status(), StatusCode::OK);

        let updated: UserView = json_body(update_response).await;
        assert_eq!(updated.username, "alice");
        assert_eq!(updated.login_name, "alice-web");

        let login_response = login_with_password(&test_app.app, "alice-web", "secret").await;
        assert_eq!(login_response.status(), StatusCode::OK);
        let token: Token = json_body(login_response).await;
        let claims = Claims::decode(&token.token).expect("登录令牌应能解析");
        assert_eq!(claims.sub, "alice");
    }

    #[tokio::test]
    async fn login_name_update_rejects_other_username_and_login_name() {
        let test_app = setup_test_app().await;
        let session = authenticate(&test_app.app).await;
        register_user(&test_app.app, "bob", "Bob").await;
        let bob_token = login_user(&test_app.app, "bob").await;

        let bob_login_name_response = send(
            &test_app.app,
            build_request(
                Method::POST,
                "/me/login-name",
                Some(&bob_token),
                None,
                Some(
                    serde_json::to_vec(&json!({
                        "login_name": "bob-web"
                    }))
                    .expect("登录名更新请求应能序列化"),
                ),
            ),
        )
        .await;
        assert_eq!(bob_login_name_response.status(), StatusCode::OK);

        let username_conflict = send(
            &test_app.app,
            build_request(
                Method::POST,
                "/me/login-name",
                Some(&session.access_token),
                None,
                Some(
                    serde_json::to_vec(&json!({
                        "login_name": "bob"
                    }))
                    .expect("登录名更新请求应能序列化"),
                ),
            ),
        )
        .await;
        assert_eq!(username_conflict.status(), StatusCode::CONFLICT);

        let login_name_conflict = send(
            &test_app.app,
            build_request(
                Method::POST,
                "/me/login-name",
                Some(&session.access_token),
                None,
                Some(
                    serde_json::to_vec(&json!({
                        "login_name": "bob-web"
                    }))
                    .expect("登录名更新请求应能序列化"),
                ),
            ),
        )
        .await;
        assert_eq!(login_name_conflict.status(), StatusCode::CONFLICT);
    }

    #[tokio::test]
    async fn login_password_update_rejects_invalid_inputs_and_replaces_password() {
        let test_app = setup_test_app().await;
        let session = authenticate(&test_app.app).await;

        let blank_response = send(
            &test_app.app,
            build_request(
                Method::POST,
                "/me/login-password",
                Some(&session.access_token),
                None,
                Some(
                    serde_json::to_vec(&json!({
                        "password": "   ",
                        "confirm_password": "   "
                    }))
                    .expect("密码更新请求应能序列化"),
                ),
            ),
        )
        .await;
        assert_eq!(blank_response.status(), StatusCode::BAD_REQUEST);

        let mismatch_response = send(
            &test_app.app,
            build_request(
                Method::POST,
                "/me/login-password",
                Some(&session.access_token),
                None,
                Some(
                    serde_json::to_vec(&json!({
                        "password": "new-secret",
                        "confirm_password": "other-secret"
                    }))
                    .expect("密码更新请求应能序列化"),
                ),
            ),
        )
        .await;
        assert_eq!(mismatch_response.status(), StatusCode::BAD_REQUEST);

        let update_response = send(
            &test_app.app,
            build_request(
                Method::POST,
                "/me/login-password",
                Some(&session.access_token),
                None,
                Some(
                    serde_json::to_vec(&json!({
                        "password": "new-secret",
                        "confirm_password": "new-secret"
                    }))
                    .expect("密码更新请求应能序列化"),
                ),
            ),
        )
        .await;
        assert_eq!(update_response.status(), StatusCode::OK);
        let updated: UserView = json_body(update_response).await;
        assert!(updated.has_login_password);

        let old_login = login_with_password(&test_app.app, "alice", "secret").await;
        assert_eq!(old_login.status(), StatusCode::UNAUTHORIZED);

        let new_login = login_with_password(&test_app.app, "alice", "new-secret").await;
        assert_eq!(new_login.status(), StatusCode::OK);
    }

    #[tokio::test]
    async fn mini_login_and_refresh_flow_works() {
        let test_app = setup_test_app().await;
        let mini_token = authenticate_mini(&test_app.app).await;

        assert_eq!(mini_token.token_type, "Bearer");
        assert!(!mini_token.token.is_empty());
        assert!(!mini_token.refresh_token.is_empty());

        let me = get_me(&test_app.app, &mini_token.token).await;
        assert_eq!(me.nickname, "Alice");

        let refresh_response = send(
            &test_app.app,
            build_request(
                Method::POST,
                "/auth/mini/refresh",
                None,
                None,
                Some(
                    serde_json::to_vec(&json!({
                        "refresh_token": mini_token.refresh_token,
                    }))
                    .expect("小程序刷新请求应能序列化"),
                ),
            ),
        )
        .await;
        assert_eq!(refresh_response.status(), StatusCode::OK);

        let refreshed_token: Token = json_body(refresh_response).await;
        assert_eq!(refreshed_token.token_type, "Bearer");
        assert!(!refreshed_token.token.is_empty());
    }

    #[tokio::test]
    async fn mini_wechat_login_auto_registers_and_reuses_existing_account() {
        let test_app = setup_test_app().await;

        let first_login = authenticate_mini_wechat_with_nickname(&test_app.app, Some("小明")).await;
        assert!(first_login.is_new_user);
        assert!(first_login.user.username.starts_with("wx_"));
        assert_eq!(first_login.user.nickname, "小明");
        assert_eq!(first_login.token_type, "Bearer");
        assert!(!first_login.refresh_token.is_empty());

        let me = get_me(&test_app.app, &first_login.token).await;
        assert_eq!(me, first_login.user);

        let second_login = authenticate_mini_wechat_with_nickname(&test_app.app, None).await;
        assert!(!second_login.is_new_user);
        assert_eq!(second_login.user, first_login.user);
    }

    #[tokio::test]
    async fn mini_wechat_login_with_nickname_uses_provided_nickname() {
        let test_app = setup_test_app().await;

        let first_login = authenticate_mini_wechat_with_nickname(&test_app.app, Some("小明")).await;
        assert!(first_login.is_new_user);
        assert_eq!(first_login.user.nickname, "小明");

        let me = get_me(&test_app.app, &first_login.token).await;
        assert_eq!(me.nickname, "小明");
    }

    #[tokio::test]
    async fn mini_wechat_login_reuse_ignores_new_nickname() {
        let test_app = setup_test_app().await;

        let first_login = authenticate_mini_wechat_with_nickname(&test_app.app, Some("小明")).await;
        assert!(first_login.is_new_user);
        assert_eq!(first_login.user.nickname, "小明");

        let second_login =
            authenticate_mini_wechat_with_nickname(&test_app.app, Some("小红")).await;
        assert!(!second_login.is_new_user);
        assert_eq!(second_login.user.nickname, "小明");
    }

    #[tokio::test]
    async fn mini_wechat_login_rejects_empty_nickname_for_new_user() {
        let test_app = setup_test_app().await;

        let response = send_mini_wechat_login(&test_app.app, Some("  ")).await;
        assert_eq!(response.status(), StatusCode::BAD_REQUEST);
    }

    #[tokio::test]
    async fn mini_wechat_login_rejects_missing_nickname_for_new_user() {
        let test_app = setup_test_app().await;

        let response = send_mini_wechat_login(&test_app.app, None).await;
        assert_eq!(response.status(), StatusCode::BAD_REQUEST);
    }

    #[tokio::test]
    async fn mini_wechat_check_returns_not_registered_for_new_user() {
        let test_app = setup_test_app().await;

        let response = send(
            &test_app.app,
            build_request(
                Method::POST,
                "/auth/mini/wechat/check",
                None,
                None,
                Some(
                    serde_json::to_vec(&json!({ "code": "valid-wechat-code" }))
                        .expect("预检查请求应能序列化"),
                ),
            ),
        )
        .await;
        assert_eq!(response.status(), StatusCode::OK);

        let result: MiniWechatCheckResult = json_body(response).await;
        assert!(!result.is_registered);
    }

    #[tokio::test]
    async fn mini_wechat_check_returns_registered_for_existing_user() {
        let test_app = setup_test_app().await;

        authenticate_mini_wechat_with_nickname(&test_app.app, Some("小明")).await;

        let response = send(
            &test_app.app,
            build_request(
                Method::POST,
                "/auth/mini/wechat/check",
                None,
                None,
                Some(
                    serde_json::to_vec(&json!({ "code": "valid-wechat-code" }))
                        .expect("预检查请求应能序列化"),
                ),
            ),
        )
        .await;
        assert_eq!(response.status(), StatusCode::OK);

        let result: MiniWechatCheckResult = json_body(response).await;
        assert!(result.is_registered);
    }

    #[tokio::test]
    async fn mini_wechat_register_accepts_json_code_and_nickname() {
        let test_app = setup_test_app().await;

        let response = send(
            &test_app.app,
            build_request(
                Method::POST,
                "/auth/mini/wechat/register",
                None,
                None,
                Some(
                    serde_json::to_vec(&json!({
                        "code": "valid-wechat-code",
                        "nickname": "新用户",
                    }))
                    .expect("注册请求应能序列化"),
                ),
            ),
        )
        .await;
        assert_eq!(response.status(), StatusCode::OK);

        let first: MiniAuthResult = json_body(response).await;
        assert!(first.is_new_user);
        assert_eq!(first.user.nickname, "新用户");

        let second_login = authenticate_mini_wechat_with_nickname(&test_app.app, None).await;
        assert!(!second_login.is_new_user);
        assert_eq!(second_login.user.username, first.user.username);
    }

    #[tokio::test]
    async fn patch_me_accepts_structured_json_body() {
        let test_app = setup_test_app().await;
        let session = authenticate(&test_app.app).await;

        let response = send(
            &test_app.app,
            build_request(
                Method::PATCH,
                "/me",
                Some(&session.access_token),
                None,
                Some(
                    serde_json::to_vec(&json!({
                        "nickname": "Alice Updated"
                    }))
                    .expect("昵称更新请求应能序列化"),
                ),
            ),
        )
        .await;
        assert_eq!(response.status(), StatusCode::OK);

        let me = get_me(&test_app.app, &session.access_token).await;
        assert_eq!(me.nickname, "Alice Updated");
    }

    #[tokio::test]
    async fn patch_me_rejects_blank_nickname() {
        let test_app = setup_test_app().await;
        let session = authenticate(&test_app.app).await;

        let response = send(
            &test_app.app,
            build_request(
                Method::PATCH,
                "/me",
                Some(&session.access_token),
                None,
                Some(
                    serde_json::to_vec(&json!({
                        "nickname": "   "
                    }))
                    .expect("昵称更新请求应能序列化"),
                ),
            ),
        )
        .await;
        assert_eq!(response.status(), StatusCode::BAD_REQUEST);

        let me = get_me(&test_app.app, &session.access_token).await;
        assert_eq!(me.nickname, "Alice");
    }

    #[tokio::test]
    async fn patch_me_trims_nickname_and_keeps_username() {
        let test_app = setup_test_app().await;
        let session = authenticate(&test_app.app).await;

        let response = send(
            &test_app.app,
            build_request(
                Method::PATCH,
                "/me",
                Some(&session.access_token),
                None,
                Some(
                    serde_json::to_vec(&json!({
                        "username": "mallory",
                        "nickname": "  Alice Trimmed  "
                    }))
                    .expect("昵称更新请求应能序列化"),
                ),
            ),
        )
        .await;
        assert_eq!(response.status(), StatusCode::OK);

        let me = get_me(&test_app.app, &session.access_token).await;
        assert_eq!(
            me,
            UserView {
                username: "alice".to_string(),
                nickname: "Alice Trimmed".to_string(),
                login_name: "alice".to_string(),
                has_login_password: true,
            }
        );
    }

    #[tokio::test]
    async fn post_me_nickname_updates_nickname_for_mini_program() {
        let test_app = setup_test_app().await;
        let session = authenticate(&test_app.app).await;

        let response = send(
            &test_app.app,
            build_request(
                Method::POST,
                "/me/nickname",
                Some(&session.access_token),
                None,
                Some(
                    serde_json::to_vec(&json!({
                        "nickname": "  小程序昵称  "
                    }))
                    .expect("昵称更新请求应能序列化"),
                ),
            ),
        )
        .await;
        assert_eq!(response.status(), StatusCode::OK);

        let me = get_me(&test_app.app, &session.access_token).await;
        assert_eq!(me.username, "alice");
        assert_eq!(me.nickname, "小程序昵称");
    }

    #[tokio::test]
    async fn patch_me_legacy_route_returns_not_found() {
        let test_app = setup_test_app().await;
        let session = authenticate(&test_app.app).await;

        let response = send(
            &test_app.app,
            build_request(
                Method::PATCH,
                "/me/alice-legacy",
                Some(&session.access_token),
                None,
                None,
            ),
        )
        .await;
        assert_eq!(response.status(), StatusCode::NOT_FOUND);
    }

    #[tokio::test]
    async fn tag_mutations_persist_shared_index_assignments() {
        let test_app = setup_test_app().await;
        let session = authenticate(&test_app.app).await;
        let memo_id = create_memo(
            &test_app.app,
            &session.access_token,
            &["work/rust", "life"],
            "Rename tag test",
        )
        .await;

        let structured_response = send(
            &test_app.app,
            build_request(
                Method::PUT,
                "/tag/work|rust",
                Some(&session.access_token),
                None,
                Some(
                    serde_json::to_vec(&json!({
                        "new_tag": "work/backend"
                    }))
                    .expect("结构化标签更新请求应能序列化"),
                ),
            ),
        )
        .await;
        assert_eq!(structured_response.status(), StatusCode::OK);

        let memo = get_memo(&test_app.app, &session.access_token, memo_id).await;
        assert!(memo.tags.iter().any(|tag| tag == "work/backend"));
        assert!(memo.tags.iter().all(|tag| tag != "work/rust"));

        let delete_response = send(
            &test_app.app,
            build_request(
                Method::DELETE,
                "/tag/work|backend",
                Some(&session.access_token),
                None,
                None,
            ),
        )
        .await;
        assert_eq!(delete_response.status(), StatusCode::OK);

        let memo = get_memo(&test_app.app, &session.access_token, memo_id).await;
        assert_eq!(memo.tags, vec!["life"]);
    }

    #[tokio::test]
    async fn get_memo_returns_refs_and_referenced_by_view() {
        let test_app = setup_test_app().await;
        let session = authenticate(&test_app.app).await;

        let memo_a = create_memo(&test_app.app, &session.access_token, &["work"], "A").await;
        tokio::time::sleep(std::time::Duration::from_millis(2)).await;

        let create_b_response = send(
            &test_app.app,
            build_request(
                Method::POST,
                "/memo",
                Some(&session.access_token),
                None,
                Some(
                    serde_json::to_vec(&MemoCreate {
                        content: wdf_value("B"),
                        tags: vec!["work".to_string()],
                        refs: vec![MemoRef(memo_a)],
                    })
                    .expect("创建带 refs 的 memo 请求应能序列化"),
                ),
            ),
        )
        .await;
        assert_eq!(create_b_response.status(), StatusCode::OK);
        let memo_b: MemoId = json_body(create_b_response).await;

        let b_view = get_memo(&test_app.app, &session.access_token, memo_b).await;
        assert_eq!(b_view.id, memo_b);
        assert_eq!(b_view.content, wdf_value("B"));
        assert!(!b_view.ct_utc.is_null());
        assert!(!b_view.mt_utc.is_null());
        assert_eq!(b_view.refs, vec![memo_a.to_string()]);
        assert!(b_view.referenced_by.is_empty());

        let a_view = get_memo(&test_app.app, &session.access_token, memo_a).await;
        assert_eq!(a_view.id, memo_a);
        assert_eq!(a_view.content, wdf_value("A"));
        assert!(!a_view.ct_utc.is_null());
        assert!(!a_view.mt_utc.is_null());
        assert_eq!(a_view.refs, Vec::<String>::new());
        assert_eq!(a_view.referenced_by, vec![memo_b.to_string()]);
    }

    #[tokio::test]
    async fn batch_get_memos_returns_memo_view_contract() {
        let test_app = setup_test_app().await;
        let session = authenticate(&test_app.app).await;

        let memo_a = create_memo(&test_app.app, &session.access_token, &["work"], "A").await;
        tokio::time::sleep(std::time::Duration::from_millis(2)).await;

        let create_b_response = send(
            &test_app.app,
            build_request(
                Method::POST,
                "/memo",
                Some(&session.access_token),
                None,
                Some(
                    serde_json::to_vec(&MemoCreate {
                        content: wdf_value("B"),
                        tags: vec!["work/ref".to_string()],
                        refs: vec![MemoRef(memo_a)],
                    })
                    .expect("创建带 refs 的 memo 请求应能序列化"),
                ),
            ),
        )
        .await;
        assert_eq!(create_b_response.status(), StatusCode::OK);
        let memo_b: MemoId = json_body(create_b_response).await;

        let views = batch_get_memos(&test_app.app, &session.access_token, &[memo_a, memo_b]).await;
        assert_eq!(views.len(), 2);

        let a_view = views.iter().find(|view| view.id == memo_a).unwrap();
        assert_eq!(a_view.content, wdf_value("A"));
        assert_eq!(a_view.tags, vec!["work".to_string()]);
        assert!(!a_view.ct_utc.is_null());
        assert!(!a_view.mt_utc.is_null());
        assert!(a_view.refs.is_empty());
        assert_eq!(a_view.referenced_by, vec![memo_b.to_string()]);

        let b_view = views.iter().find(|view| view.id == memo_b).unwrap();
        assert_eq!(b_view.content, wdf_value("B"));
        assert_eq!(b_view.tags, vec!["work/ref".to_string()]);
        assert!(!b_view.ct_utc.is_null());
        assert!(!b_view.mt_utc.is_null());
        assert_eq!(b_view.refs, vec![memo_a.to_string()]);
        assert!(b_view.referenced_by.is_empty());
    }

    #[tokio::test]
    async fn create_memo_rejects_unknown_refs_with_http_400() {
        let test_app = setup_test_app().await;
        let session = authenticate(&test_app.app).await;

        let response = send(
            &test_app.app,
            build_request(
                Method::POST,
                "/memo",
                Some(&session.access_token),
                None,
                Some(
                    serde_json::to_vec(&MemoCreate {
                        content: wdf_value("bad refs"),
                        tags: vec!["work".to_string()],
                        refs: vec![MemoRef(999)],
                    })
                    .expect("非法 refs 的创建请求应能序列化"),
                ),
            ),
        )
        .await;
        assert_eq!(response.status(), StatusCode::BAD_REQUEST);
        let body: serde_json::Value = json_body(response).await;
        assert!(
            body["error"]
                .as_str()
                .unwrap_or_default()
                .contains("引用不合法")
        );
    }

    #[tokio::test]
    async fn update_memo_rejects_self_refs_with_http_400() {
        let test_app = setup_test_app().await;
        let session = authenticate(&test_app.app).await;

        let memo_id = create_memo(&test_app.app, &session.access_token, &["work"], "self").await;
        let response = send(
            &test_app.app,
            build_request(
                Method::PUT,
                &format!("/memo/{memo_id}"),
                Some(&session.access_token),
                None,
                Some(
                    serde_json::to_vec(&json!({
                        "refs": [memo_id]
                    }))
                    .expect("非法 refs 的更新请求应能序列化"),
                ),
            ),
        )
        .await;
        assert_eq!(response.status(), StatusCode::BAD_REQUEST);
        let body: serde_json::Value = json_body(response).await;
        assert!(
            body["error"]
                .as_str()
                .unwrap_or_default()
                .contains("不能自引用")
        );
    }

    #[tokio::test]
    async fn update_memo_rejects_ct_order_violation_with_http_400() {
        let test_app = setup_test_app().await;
        let session = authenticate(&test_app.app).await;

        let memo_a = create_memo(&test_app.app, &session.access_token, &["work"], "A").await;
        tokio::time::sleep(std::time::Duration::from_millis(2)).await;
        let memo_b = create_memo(&test_app.app, &session.access_token, &["work"], "B").await;

        let response = send(
            &test_app.app,
            build_request(
                Method::PUT,
                &format!("/memo/{memo_a}"),
                Some(&session.access_token),
                None,
                Some(
                    serde_json::to_vec(&json!({
                        "refs": [memo_b]
                    }))
                    .expect("非法 refs 的更新请求应能序列化"),
                ),
            ),
        )
        .await;
        assert_eq!(response.status(), StatusCode::BAD_REQUEST);
        let body: serde_json::Value = json_body(response).await;
        assert!(
            body["error"]
                .as_str()
                .unwrap_or_default()
                .contains("不早于本笔记")
        );
    }

    #[tokio::test]
    async fn put_tag_rejects_legacy_string_payload() {
        let test_app = setup_test_app().await;
        let session = authenticate(&test_app.app).await;

        let legacy_response = send(
            &test_app.app,
            build_request(
                Method::PUT,
                "/tag/work|rust",
                Some(&session.access_token),
                None,
                Some(serde_json::to_vec("work/platform").expect("兼容标签更新请求应能序列化")),
            ),
        )
        .await;
        assert_eq!(legacy_response.status(), StatusCode::UNPROCESSABLE_ENTITY);
    }

    #[tokio::test]
    async fn delete_me_removes_user_storage_directory() {
        let test_app = setup_test_app().await;
        let session = authenticate(&test_app.app).await;
        create_memo(
            &test_app.app,
            &session.access_token,
            &["cleanup/check"],
            "Account cleanup test",
        )
        .await;

        let user_dir = test_app.storage_dir.path().join(Path::new("alice"));
        assert!(user_dir.exists(), "创建 memo 后应生成用户目录");

        let delete_response = send(
            &test_app.app,
            build_request(
                Method::DELETE,
                "/me",
                Some(&session.access_token),
                None,
                None,
            ),
        )
        .await;
        assert_eq!(delete_response.status(), StatusCode::OK);

        let deleted_user: UserView = json_body(delete_response).await;
        assert_eq!(deleted_user.username, "alice");
        assert!(!user_dir.exists(), "删除账号后应同步清理该用户的 memo 目录");
    }
}
