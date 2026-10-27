use axum::http::HeaderName;
use tower_http::cors::CorsLayer;

use crate::config::ServerConfig;

pub fn cors(config: &ServerConfig) -> CorsLayer {
    CorsLayer::new()
        .allow_origin(
            config
                .cors_allowed_origins
                .iter()
                .map(|origin| origin.parse().unwrap())
                .collect::<Vec<_>>(),
        )
        .allow_methods([
            axum::http::Method::GET,
            axum::http::Method::POST,
            axum::http::Method::PUT,
            axum::http::Method::DELETE,
            axum::http::Method::PATCH,
        ])
        .allow_headers([
            HeaderName::from_static("content-type"),
            HeaderName::from_static("authorization"),
        ])
        .allow_credentials(true)
}
