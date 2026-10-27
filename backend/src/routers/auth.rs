use axum::extract::State;
use axum::routing::post;
use axum::{Json, Router};
use time::Duration;
use tower_cookies::cookie::SameSite;
use tower_cookies::{Cookie, Cookies};

use crate::data::{
    Claims, MiniAuthResult, MiniRefreshRequest, MiniToken, MiniWechatCheckRequest,
    MiniWechatCheckResult, MiniWechatLoginRequest, MiniWechatRegisterRequest, Token, User,
    UserCreate, UserLogin, UserView,
};
use crate::data::{MemoDb, UserDb};
use crate::error::{WeimoError, WeimoResult};
use crate::routers::AppState;

pub fn auth_router<U: UserDb + 'static, M: MemoDb + 'static>(state: AppState<U, M>) -> Router {
    Router::new()
        .route("/register", post(register))
        .route("/login", post(login))
        .route("/refresh", post(refresh_access_token))
        .route("/mini/login", post(login_mini))
        .route("/mini/wechat", post(login_mini_wechat))
        .route("/mini/wechat/check", post(check_mini_wechat))
        .route("/mini/wechat/register", post(register_mini_wechat))
        .route("/mini/refresh", post(refresh_access_token_mini))
        .with_state(state)
}

fn build_token(token: String) -> Token {
    Token {
        token,
        token_type: "Bearer".to_string(),
    }
}

fn build_mini_token(access_token: String, refresh_token: String) -> MiniToken {
    MiniToken {
        token: access_token,
        token_type: "Bearer".to_string(),
        refresh_token,
    }
}

fn build_mini_auth_result(
    access_token: String,
    refresh_token: String,
    user: UserView,
    is_new_user: bool,
) -> MiniAuthResult {
    MiniAuthResult {
        token: access_token,
        token_type: "Bearer".to_string(),
        refresh_token,
        user,
        is_new_user,
    }
}

async fn resolve_login_user<U: UserDb, M: MemoDb>(
    state: &AppState<U, M>,
    login_name: &str,
) -> WeimoResult<User> {
    let login_name = login_name.trim();
    if let Some(user) = state
        .data_manager()
        .get_user_by_login_name(login_name)
        .await
    {
        return Ok(user);
    }

    state
        .data_manager()
        .get_user(login_name)
        .await
        .map_err(|_| WeimoError::UserNotFound(login_name.to_string()))
}

/// 注册新用户
async fn register<U: UserDb, M: MemoDb>(
    State(state): State<AppState<U, M>>,
    Json(info): Json<UserCreate>,
) -> WeimoResult<Json<UserView>> {
    tracing::info!("收到注册请求: username={}", info.username);

    if state.data_manager().user_exists(&info.username).await {
        tracing::warn!("注册失败，用户名已存在");
        return Err(WeimoError::UserAlreadyExists(info.username));
    }

    let user = state.data_manager().create_user(info).await?;
    tracing::info!("注册成功");
    Ok(Json(user.into()))
}

/// 登录并获取访问令牌
async fn login<U: UserDb, M: MemoDb>(
    cookies: Cookies,
    State(state): State<AppState<U, M>>,
    Json(info): Json<UserLogin>,
) -> WeimoResult<Json<Token>> {
    tracing::info!("收到登录请求: login_name={}", info.login_name);
    let user = resolve_login_user(&state, &info.login_name).await?;

    if !user.verify_password(&info.password) {
        tracing::warn!("登录失败，密码错误");
        return Err(WeimoError::InvalidPassword);
    }

    let access_token = Claims::create_access_token(user.username())?;
    let refresh_token = Claims::create_refresh_token(user.username())?;

    tracing::info!("登录成功");

    let cookie_secure = state.config().refresh_cookie_secure;
    cookies.add(
        Cookie::build(("refresh_token", refresh_token))
            .http_only(true)
            .path("/")
            .same_site(SameSite::Lax)
            .secure(cookie_secure)
            .max_age(Duration::days(30))
            .build(),
    );

    Ok(Json(build_token(access_token)))
}

/// 小程序登录并显式返回 refresh token
async fn login_mini<U: UserDb, M: MemoDb>(
    State(state): State<AppState<U, M>>,
    Json(info): Json<UserLogin>,
) -> WeimoResult<Json<MiniToken>> {
    tracing::info!("收到小程序登录请求: login_name={}", info.login_name);
    let user = resolve_login_user(&state, &info.login_name).await?;

    if !user.verify_password(&info.password) {
        tracing::warn!("小程序登录失败，密码错误");
        return Err(WeimoError::InvalidPassword);
    }

    let access_token = Claims::create_access_token(user.username())?;
    let refresh_token = Claims::create_refresh_token(user.username())?;

    tracing::info!("小程序登录成功");
    Ok(Json(build_mini_token(access_token, refresh_token)))
}

/// 小程序通过微信 code 登录，首次登录自动注册
async fn login_mini_wechat<U: UserDb, M: MemoDb>(
    State(state): State<AppState<U, M>>,
    Json(payload): Json<MiniWechatLoginRequest>,
) -> WeimoResult<Json<MiniAuthResult>> {
    tracing::info!("收到小程序微信登录请求");

    let wechat_session = state.exchange_wechat_code(&payload.code).await?;

    let nickname = payload
        .nickname
        .as_deref()
        .map(str::trim)
        .filter(|n| !n.is_empty())
        .map(String::from);

    let is_existing = state
        .data_manager()
        .get_user_by_wechat_openid(&wechat_session.openid)
        .await
        .is_some();

    if !is_existing && nickname.is_none() {
        tracing::warn!("小程序微信首次注册缺少昵称");
        return Err(WeimoError::NicknameRequired);
    }

    let (user, is_new_user) = state
        .data_manager()
        .find_or_create_wechat_user(
            &wechat_session.openid,
            wechat_session.unionid.clone(),
            nickname,
        )
        .await?;

    let access_token = Claims::create_access_token(user.username())?;
    let refresh_token = Claims::create_refresh_token(user.username())?;

    tracing::info!(
        "小程序微信登录成功: username={}, is_new_user={}",
        user.username(),
        is_new_user
    );

    Ok(Json(build_mini_auth_result(
        access_token,
        refresh_token,
        UserView::from(&user),
        is_new_user,
    )))
}

/// 小程序微信注册状态预检查（不创建用户）
async fn check_mini_wechat<U: UserDb, M: MemoDb>(
    State(state): State<AppState<U, M>>,
    Json(payload): Json<MiniWechatCheckRequest>,
) -> WeimoResult<Json<MiniWechatCheckResult>> {
    tracing::info!("收到小程序微信注册状态预检查请求");

    let wechat_session = state.exchange_wechat_code(&payload.code).await?;

    let is_registered = state
        .data_manager()
        .get_user_by_wechat_openid(&wechat_session.openid)
        .await
        .is_some();

    tracing::info!("微信注册状态预检查完成: is_registered={}", is_registered);
    Ok(Json(MiniWechatCheckResult { is_registered }))
}

/// 小程序微信注册（JSON：`code` + `nickname`，不接收头像）
async fn register_mini_wechat<U: UserDb, M: MemoDb>(
    State(state): State<AppState<U, M>>,
    Json(payload): Json<MiniWechatRegisterRequest>,
) -> WeimoResult<Json<MiniAuthResult>> {
    tracing::info!("收到小程序微信注册请求");

    let code = payload.code.trim();
    if code.is_empty() {
        return Err(WeimoError::InvalidWechatCode);
    }

    let nickname = payload.nickname.trim().to_string();
    if nickname.is_empty() {
        return Err(WeimoError::NicknameRequired);
    }

    let wechat_session = state.exchange_wechat_code(code).await?;

    if let Some(existing) = state
        .data_manager()
        .get_user_by_wechat_openid(&wechat_session.openid)
        .await
    {
        let access_token = Claims::create_access_token(existing.username())?;
        let refresh_token = Claims::create_refresh_token(existing.username())?;
        return Ok(Json(build_mini_auth_result(
            access_token,
            refresh_token,
            UserView::from(&existing),
            false,
        )));
    }

    let (user, is_new_user) = state
        .data_manager()
        .find_or_create_wechat_user(
            &wechat_session.openid,
            wechat_session.unionid.clone(),
            Some(nickname),
        )
        .await?;

    let access_token = Claims::create_access_token(user.username())?;
    let refresh_token = Claims::create_refresh_token(user.username())?;

    tracing::info!(
        "小程序微信注册成功: username={}, is_new_user={}",
        user.username(),
        is_new_user
    );

    Ok(Json(build_mini_auth_result(
        access_token,
        refresh_token,
        UserView::from(&user),
        is_new_user,
    )))
}

/// 刷新访问令牌
async fn refresh_access_token<U: UserDb, M: MemoDb>(
    cookies: Cookies,
    State(state): State<AppState<U, M>>,
) -> WeimoResult<Json<Token>> {
    let Some(refresh_token) = cookies.get("refresh_token") else {
        tracing::warn!("访问令牌刷新请求失败，未找到 refresh_token");
        return Err(WeimoError::InvalidToken);
    };

    let claims = Claims::decode_allow_expired(refresh_token.value())?;
    tracing::info!("收到访问令牌刷新请求: username={}", claims.sub);

    if claims.is_expired() {
        tracing::warn!("刷新令牌已过期");
        return Err(WeimoError::InvalidToken);
    }

    let user = state.data_manager().get_user(&claims.sub).await?;

    tracing::debug!("创建新访问令牌");
    let token = Claims::create_access_token(user.username())?;

    tracing::info!("刷新令牌成功");
    Ok(Json(build_token(token)))
}

/// 小程序通过显式 refresh token 刷新访问令牌
async fn refresh_access_token_mini<U: UserDb, M: MemoDb>(
    State(state): State<AppState<U, M>>,
    Json(payload): Json<MiniRefreshRequest>,
) -> WeimoResult<Json<Token>> {
    if payload.refresh_token.trim().is_empty() {
        tracing::warn!("小程序访问令牌刷新请求失败，refresh_token 为空");
        return Err(WeimoError::InvalidToken);
    }

    let claims = Claims::decode_allow_expired(payload.refresh_token.trim())?;
    tracing::info!("收到小程序访问令牌刷新请求: username={}", claims.sub);

    if claims.is_expired() {
        tracing::warn!("小程序刷新令牌已过期");
        return Err(WeimoError::InvalidToken);
    }

    let user = state.data_manager().get_user(&claims.sub).await?;
    let token = Claims::create_access_token(user.username())?;

    tracing::info!("小程序刷新令牌成功");
    Ok(Json(build_token(token)))
}
