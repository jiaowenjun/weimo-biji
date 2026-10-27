use jsonwebtoken::{
    DecodingKey, EncodingKey, Header, Validation, decode as jwt_decode, encode as jwt_encode,
};
use serde::{Serialize, de::DeserializeOwned};
use time::{Duration, OffsetDateTime};

#[derive(Debug, thiserror::Error)]
pub enum JwtError {
    #[error("jwt encode failed: {0}")]
    Encode(jsonwebtoken::errors::Error),
    #[error("jwt decode failed: {0}")]
    Decode(jsonwebtoken::errors::Error),
}

pub type JwtResult<T> = Result<T, JwtError>;

pub fn expires_at(duration: Duration) -> i64 {
    (OffsetDateTime::now_utc() + duration).unix_timestamp()
}

pub fn is_expired(exp: i64) -> bool {
    let Ok(exp) = OffsetDateTime::from_unix_timestamp(exp) else {
        return true;
    };
    OffsetDateTime::now_utc() > exp
}

pub fn encode_claims<T>(claims: &T, secret: &[u8]) -> JwtResult<String>
where
    T: Serialize,
{
    jwt_encode(
        &Header::default(),
        claims,
        &EncodingKey::from_secret(secret),
    )
    .map_err(JwtError::Encode)
}

pub fn decode_claims<T>(token: &str, secret: &[u8]) -> JwtResult<T>
where
    T: DeserializeOwned,
{
    decode_with_exp_validation(token, secret, true)
}

pub fn decode_claims_allow_expired<T>(token: &str, secret: &[u8]) -> JwtResult<T>
where
    T: DeserializeOwned,
{
    decode_with_exp_validation(token, secret, false)
}

pub fn decode_with_exp_validation<T>(token: &str, secret: &[u8], validate_exp: bool) -> JwtResult<T>
where
    T: DeserializeOwned,
{
    let mut validation = Validation::default();
    validation.leeway = 0;
    validation.validate_exp = validate_exp;
    jwt_decode::<T>(token, &DecodingKey::from_secret(secret), &validation)
        .map(|data| data.claims)
        .map_err(JwtError::Decode)
}

pub use decode_claims as decode;
pub use decode_claims_allow_expired as decode_allow_expired;
pub use encode_claims as encode;
