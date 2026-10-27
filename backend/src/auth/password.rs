#[derive(Debug, thiserror::Error)]
pub enum PasswordError {
    #[error("password hash failed: {0}")]
    Hash(bcrypt::BcryptError),
    #[error("password verify failed: {0}")]
    Verify(bcrypt::BcryptError),
}

pub type PasswordResult<T> = Result<T, PasswordError>;

pub fn hash_password(password: &str) -> PasswordResult<String> {
    hash_password_with_cost(password, bcrypt::DEFAULT_COST)
}

pub fn hash_password_with_cost(password: &str, cost: u32) -> PasswordResult<String> {
    bcrypt::hash(password, cost).map_err(PasswordError::Hash)
}

pub fn verify_password(password: &str, password_hash: &str) -> PasswordResult<bool> {
    bcrypt::verify(password, password_hash).map_err(PasswordError::Verify)
}
