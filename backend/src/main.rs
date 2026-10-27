use std::{env, path::Path};

use tracing_subscriber::{layer::SubscriberExt, util::SubscriberInitExt};
use uuid::Uuid;


pub mod auth;
mod config;
mod data;
mod error;
mod routers;
pub mod utils;
mod wechat;

use config::ServerConfig;
use data::{Claims, DataManager, MdDb};
use routers::{AppState, app_router};

#[tokio::main]
async fn main() {
    tracing_subscriber::registry()
        .with(
            tracing_subscriber::EnvFilter::try_from_default_env()
                .unwrap_or_else(|_| "debug".into()),
        )
        .with(tracing_subscriber::fmt::layer())
        .init();

    let config = ServerConfig::load();
    tracing::info!("启动服务器，存储路径: {}", config.storage_path);

    let jwt_secret = load_jwt_secret(&config.storage_path).await.unwrap();
    Claims::init_secret(jwt_secret);

    let state = AppState::new(
        DataManager::new(MdDb::new(&config.storage_path).await)
            .await
            .unwrap(),
        config.clone(),
    );
    tracing::debug!("数据管理器初始化完成");

    let app = app_router(state);
    tracing::debug!("路由配置完成");

    let bind_addr = config.bind_addr();
    tracing::info!("Weimo API 服务器运行在 {bind_addr}");
    let listener = tokio::net::TcpListener::bind(&bind_addr).await.unwrap();
    axum::serve(listener, app).await.unwrap();
}

async fn load_jwt_secret(storage_path: &str) -> std::io::Result<String> {
    if let Ok(secret) = env::var("WEIMO_JWT_SECRET") {
        let secret = secret.trim().to_string();
        if !secret.is_empty() {
            tracing::info!("使用环境变量 WEIMO_JWT_SECRET");
            return Ok(secret);
        }
    }

    let secret_path = Path::new(storage_path).join(".jwt_secret");
    if let Ok(secret) = tokio::fs::read_to_string(&secret_path).await {
        let secret = secret.trim().to_string();
        if !secret.is_empty() {
            tracing::info!("使用存储目录中的 JWT secret");
            return Ok(secret);
        }
    }

    tokio::fs::create_dir_all(storage_path).await?;
    let secret = format!("{}{}", Uuid::new_v4().simple(), Uuid::new_v4().simple());
    tokio::fs::write(&secret_path, &secret).await?;
    tracing::warn!("已生成新的 JWT secret: {}", secret_path.display());
    Ok(secret)
}
