use std::fmt::Display;
use std::sync::OnceLock;

use crate::auth::{http::bearer, jwt};
use axum::extract::FromRequestParts;
use http::request::Parts;
use serde::{Deserialize, Serialize};
use time::{Duration, OffsetDateTime};

use crate::error::{WeimoError, WeimoResult};

static SECRET_KEY: OnceLock<Vec<u8>> = OnceLock::new();

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Claims {
    pub sub: String,
    pub exp: i64,
}

impl Claims {
    pub fn init_secret(secret: impl Into<Vec<u8>>) {
        let _ = SECRET_KEY.set(secret.into());
    }

    fn secret_key() -> &'static [u8] {
        SECRET_KEY
            .get_or_init(|| {
                #[cfg(test)]
                {
                    b"weimo-test-jwt-secret-for-unit-tests-only".to_vec()
                }

                #[cfg(not(test))]
                {
                    panic!("JWT secret not initialized");
                }
            })
            .as_slice()
    }

    fn new(username: &str, duration: Duration) -> Self {
        Self {
            sub: username.to_owned(),
            exp: jwt::expires_at(duration),
        }
    }

    fn encode(&self) -> WeimoResult<String> {
        jwt::encode(self, Self::secret_key()).map_err(WeimoError::JwtEncodeError)
    }

    pub fn is_expired(&self) -> bool {
        jwt::is_expired(self.exp)
    }

    fn decode_with_validation(token: &str, validate_exp: bool) -> WeimoResult<Self> {
        jwt::decode_with_exp_validation(token, Self::secret_key(), validate_exp)
            .map_err(|_| WeimoError::InvalidToken)
    }

    pub fn decode(token: &str) -> WeimoResult<Self> {
        Self::decode_with_validation(token, true)
    }

    pub fn decode_allow_expired(token: &str) -> WeimoResult<Self> {
        Self::decode_with_validation(token, false)
    }

    pub fn create_access_token(username: &str) -> WeimoResult<String> {
        let claims = Claims::new(username, Duration::minutes(30));
        claims.encode()
    }

    pub fn create_refresh_token(username: &str) -> WeimoResult<String> {
        let claims = Claims::new(username, Duration::days(30));
        claims.encode()
    }
}

impl Display for Claims {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        write!(
            f,
            "Claims {{ sub: {}, exp: {} }}",
            self.sub,
            OffsetDateTime::from_unix_timestamp(self.exp).unwrap()
        )
    }
}

impl<S> FromRequestParts<S> for Claims
where
    S: Send + Sync,
{
    type Rejection = WeimoError;

    async fn from_request_parts(parts: &mut Parts, _state: &S) -> WeimoResult<Self> {
        let header = parts
            .headers
            .get(http::header::AUTHORIZATION)
            .and_then(|value| value.to_str().ok())
            .ok_or(WeimoError::InvalidToken)?;
        let token =
            bearer::parse_authorization_header(header).map_err(|_| WeimoError::InvalidToken)?;
        let claims = Claims::decode(token)?;
        Ok(claims)
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::thread;

    #[test]
    fn test_new_claims() {
        let username = "testuser";
        let duration = Duration::hours(1);
        let claims = Claims::new(username, duration);

        assert_eq!(claims.sub, username);

        // 验证过期时间大约是当前时间加上一小时（允许1秒误差）
        let now = OffsetDateTime::now_utc().unix_timestamp();
        assert!(claims.exp > now);
        assert!(claims.exp <= now + 3601);
    }

    #[test]
    fn test_is_expired() {
        // 创建一个已过期的Claims（过期时间为当前时间减去1小时）
        let expired_time = OffsetDateTime::now_utc() - Duration::hours(1);
        let expired_claims = Claims {
            sub: "expired_user".to_string(),
            exp: expired_time.unix_timestamp(),
        };
        assert!(expired_claims.is_expired());

        // 创建一个未过期的Claims（过期时间为当前时间加上1小时）
        let valid_time = OffsetDateTime::now_utc() + Duration::hours(1);
        let valid_claims = Claims {
            sub: "valid_user".to_string(),
            exp: valid_time.unix_timestamp(),
        };
        assert!(!valid_claims.is_expired());

        // 创建一个即将过期的Claims（过期时间为当前时间）
        let now = OffsetDateTime::now_utc();
        let almost_expired_claims = Claims {
            sub: "almost_expired_user".to_string(),
            exp: now.unix_timestamp(),
        };
        // 由于可能有微小的时间差，这个测试可能不稳定，但通常应该已过期
        thread::sleep(std::time::Duration::from_millis(10));
        assert!(almost_expired_claims.is_expired());
    }

    #[test]
    fn test_encode_decode() -> WeimoResult<()> {
        let username = "testuser";
        let duration = Duration::hours(1);
        let claims = Claims::new(username, duration);

        // 编码
        let token = claims.encode()?;
        assert!(!token.is_empty());

        // 解码
        let decoded_claims = Claims::decode(&token)?;
        assert_eq!(decoded_claims.sub, username);
        assert_eq!(decoded_claims.exp, claims.exp);

        Ok(())
    }

    #[test]
    fn test_token_expiration() -> WeimoResult<()> {
        // 创建一个很快过期的token（1秒后过期）
        let username = "shortlived";
        let short_duration = Duration::seconds(1);
        let claims = Claims::new(username, short_duration);

        let token = claims.encode()?;
        assert!(!claims.is_expired()); // 刚创建时不应该过期

        // 等待2秒，确保token过期
        thread::sleep(std::time::Duration::from_secs(2));

        // 默认解码应拒绝过期 token
        assert!(matches!(
            Claims::decode(&token),
            Err(WeimoError::InvalidToken)
        ));

        // 但刷新流程仍需要能够读取过期 token 的 claims
        let decoded_claims = Claims::decode_allow_expired(&token)?;
        assert_eq!(decoded_claims.sub, username);

        // 但是手动检查应该表明它已过期
        assert!(decoded_claims.is_expired());

        Ok(())
    }

    #[test]
    fn test_invalid_token() {
        let invalid_token = "invalid.jwt.token";
        let result = Claims::decode(invalid_token);
        assert!(result.is_err());

        // 检查错误类型
        match result {
            Err(WeimoError::InvalidToken) => (),
            _ => panic!("Expected InvalidToken"),
        }
    }

    #[test]
    fn test_create_access_token() -> WeimoResult<()> {
        let username = "access_user";
        let token = Claims::create_access_token(username)?;

        // 验证token不为空
        assert!(!token.is_empty());

        // 解码并验证用户名
        let claims = Claims::decode(&token)?;
        assert_eq!(claims.sub, username);

        // 验证过期时间约为30分钟（允许1秒误差）
        let now = OffsetDateTime::now_utc().unix_timestamp();
        assert!(claims.exp > now);
        assert!(claims.exp <= now + 1801); // 30分钟 = 1800秒

        Ok(())
    }

    #[test]
    fn test_create_refresh_token() -> WeimoResult<()> {
        let username = "refresh_user";
        let token = Claims::create_refresh_token(username)?;

        // 验证token不为空
        assert!(!token.is_empty());

        // 解码并验证用户名
        let claims = Claims::decode(&token)?;
        assert_eq!(claims.sub, username);

        // 验证过期时间约为30天（允许1秒误差）
        let now = OffsetDateTime::now_utc().unix_timestamp();
        assert!(claims.exp > now);
        assert!(claims.exp <= now + 2592001); // 30天 = 2592000秒

        Ok(())
    }

    #[test]
    fn test_different_tokens_for_same_user() -> WeimoResult<()> {
        let username = "multi_token_user";

        // 创建两个不同的token
        let token1 = Claims::create_access_token(username)?;
        thread::sleep(std::time::Duration::from_secs(1));
        let token2 = Claims::create_access_token(username)?;

        // 验证两个token不同
        assert_ne!(token1, token2);

        // 但两个token解码后应该有相同的用户名
        let claims1 = Claims::decode(&token1)?;
        let claims2 = Claims::decode(&token2)?;
        assert_eq!(claims1.sub, username);
        assert_eq!(claims2.sub, username);

        Ok(())
    }
}
