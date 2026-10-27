use super::{http::bearer, jwt, password};
use serde::{Deserialize, Serialize};
use time::Duration;

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
struct TestClaims {
    sub: String,
    exp: i64,
}

#[test]
fn password_hash_round_trips_through_verify() {
    let hash = password::hash_password("correct horse battery staple").unwrap();

    assert!(password::verify_password("correct horse battery staple", &hash).unwrap());
    assert!(!password::verify_password("wrong", &hash).unwrap());
}

#[test]
fn jwt_encodes_decodes_and_can_ignore_expiry() {
    let secret = b"test-secret";
    let claims = TestClaims {
        sub: "alice".to_string(),
        exp: jwt::expires_at(Duration::minutes(5)),
    };

    let token = jwt::encode(&claims, secret).unwrap();
    assert_eq!(jwt::decode::<TestClaims>(&token, secret).unwrap(), claims);

    let expired = TestClaims {
        sub: "alice".to_string(),
        exp: jwt::expires_at(Duration::seconds(-5)),
    };
    let expired_token = jwt::encode(&expired, secret).unwrap();
    assert!(jwt::decode::<TestClaims>(&expired_token, secret).is_err());
    assert_eq!(
        jwt::decode_allow_expired::<TestClaims>(&expired_token, secret).unwrap(),
        expired
    );
}

#[test]
fn bearer_token_parser_accepts_case_insensitive_scheme_and_rejects_bad_headers() {
    assert_eq!(
        bearer::parse_authorization_header("Bearer abc.def").unwrap(),
        "abc.def"
    );
    assert_eq!(
        bearer::parse_authorization_header("bearer token").unwrap(),
        "token"
    );

    assert!(bearer::parse_authorization_header("Basic nope").is_err());
    assert!(bearer::parse_authorization_header("Bearer").is_err());
    assert!(bearer::parse_authorization_header("Bearer   ").is_err());
}
