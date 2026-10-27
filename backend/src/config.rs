use crate::utils::config;
use clap::{ArgAction, Parser, builder::BoolishValueParser};

const DEFAULT_STORAGE: &str = "~/workspace/memos";
const DEFAULT_HOST: &str = "0.0.0.0";
const DEFAULT_PORT: u16 = 8000;
const DEFAULT_WECHAT_APP_ID: &str = "wx0450700454b0c0b7";
const DEFAULT_WECHAT_API_BASE_URL: &str = "https://api.weixin.qq.com";
const DEFAULT_CORS_ORIGINS: &str = "http://localhost:3000,http://localhost:3001,http://127.0.0.1:3000,http://127.0.0.1:3001,http://localhost:5173,http://localhost:5174,http://127.0.0.1:5173,http://127.0.0.1:5174,http://localhost:4173,http://localhost:4174,http://127.0.0.1:4173,http://127.0.0.1:4174";

#[derive(Parser, Debug, Clone)]
#[command(author, version, about, long_about = None)]
pub struct ServerConfig {
    /// Storage directory path
    #[arg(
        long = "storage",
        env = "WEIMO_STORAGE_PATH",
        default_value = DEFAULT_STORAGE,
        value_parser = expand_storage_path
    )]
    pub storage_path: String,
    /// Bind host
    #[arg(long = "host", env = "WEIMO_HOST", default_value = DEFAULT_HOST)]
    pub bind_host: String,
    /// Bind port
    #[arg(long = "port", env = "WEIMO_PORT", default_value_t = DEFAULT_PORT)]
    pub bind_port: u16,
    /// Set the refresh cookie Secure attribute
    #[arg(
        long = "cookie-secure",
        env = "WEIMO_COOKIE_SECURE",
        default_value_t = false,
        action = ArgAction::Set,
        value_parser = BoolishValueParser::new()
    )]
    pub refresh_cookie_secure: bool,
    /// Explicitly allowed CORS origin, can be passed multiple times
    #[arg(
        long = "cors-origin",
        env = "WEIMO_CORS_ORIGINS",
        value_delimiter = ',',
        default_value = DEFAULT_CORS_ORIGINS,
        hide_default_value = true
    )]
    pub cors_allowed_origins: Vec<String>,
    /// WeChat mini program AppID
    #[arg(
        long = "wechat-app-id",
        env = "WEIMO_WECHAT_APP_ID",
        default_value = DEFAULT_WECHAT_APP_ID
    )]
    pub wechat_app_id: Option<String>,
    /// WeChat mini program AppSecret
    #[arg(
        long = "wechat-app-secret",
        env = "WEIMO_WECHAT_APP_SECRET",
        hide_env_values = true
    )]
    pub wechat_app_secret: Option<String>,
    /// WeChat API base URL
    #[arg(
        long = "wechat-api-base-url",
        env = "WEIMO_WECHAT_API_BASE_URL",
        default_value = DEFAULT_WECHAT_API_BASE_URL
    )]
    pub wechat_api_base_url: String,
}

impl ServerConfig {
    pub fn load() -> Self {
        Self::parse()
    }

    pub fn bind_addr(&self) -> String {
        config::bind_addr(&self.bind_host, self.bind_port)
    }
}

fn expand_storage_path(value: &str) -> Result<String, String> {
    Ok(shellexpand::tilde(value).into_owned())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn bind_addr_formats_host_and_port() {
        let config = ServerConfig {
            storage_path: "/tmp/memos".to_string(),
            bind_host: "127.0.0.1".to_string(),
            bind_port: 8080,
            refresh_cookie_secure: true,
            cors_allowed_origins: vec![],
            wechat_app_id: None,
            wechat_app_secret: None,
            wechat_api_base_url: DEFAULT_WECHAT_API_BASE_URL.to_string(),
        };

        assert_eq!(config.bind_addr(), "127.0.0.1:8080");
    }

    #[test]
    fn clap_parses_cli_config_values() {
        let config = ServerConfig::try_parse_from([
            "biji",
            "--storage",
            "/tmp/memos",
            "--host",
            "127.0.0.1",
            "--port",
            "8080",
            "--cookie-secure",
            "yes",
            "--cors-origin",
            "https://one.example,https://two.example",
            "--wechat-app-id",
            "test-app-id",
            "--wechat-app-secret",
            "test-app-secret",
            "--wechat-api-base-url",
            "https://wechat.example",
        ])
        .expect("parse server config");

        assert_eq!(config.storage_path, "/tmp/memos");
        assert_eq!(config.bind_addr(), "127.0.0.1:8080");
        assert!(config.refresh_cookie_secure);
        assert_eq!(
            config.cors_allowed_origins,
            ["https://one.example", "https://two.example"]
        );
        assert_eq!(config.wechat_app_id.as_deref(), Some("test-app-id"));
        assert_eq!(config.wechat_app_secret.as_deref(), Some("test-app-secret"));
        assert_eq!(config.wechat_api_base_url, "https://wechat.example");
    }
}
