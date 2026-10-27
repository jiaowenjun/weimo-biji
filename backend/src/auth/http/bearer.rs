#[derive(Debug, Clone, PartialEq, Eq, thiserror::Error)]
pub enum BearerError {
    #[error("authorization header is not a bearer token")]
    InvalidScheme,
    #[error("bearer token is empty")]
    EmptyToken,
}

pub type BearerResult<T> = Result<T, BearerError>;

pub fn parse_authorization_header(value: &str) -> BearerResult<&str> {
    let Some((scheme, token)) = value.split_once(char::is_whitespace) else {
        return Err(BearerError::EmptyToken);
    };
    if !scheme.eq_ignore_ascii_case("Bearer") {
        return Err(BearerError::InvalidScheme);
    }

    let token = token.trim();
    if token.is_empty() {
        return Err(BearerError::EmptyToken);
    }

    Ok(token)
}
