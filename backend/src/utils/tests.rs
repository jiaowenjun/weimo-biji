use super::config;

#[test]
fn bind_addr_formats_common_config_values() {
    assert_eq!(config::bind_addr("127.0.0.1", 8080), "127.0.0.1:8080");
}
