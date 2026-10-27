use crate::data::{User, UserCreate};
use crate::error::WeimoResult;
use async_trait::async_trait;

/// 异步用户数据库接口
#[async_trait]
pub trait UserDb: Send + Sync + Clone {
    /// 创建新用户
    ///
    /// # 返回值
    /// * `Ok(User)` - 添加成功
    /// * `Err(UserError::AlreadyExists)` - 用户已存在
    /// * `Err(UserError::InvalidUsername)` - 用户名不合法
    /// * `Err(UserError::WriteError)` - 写入失败
    async fn create(&mut self, info: UserCreate) -> WeimoResult<User>;

    /// 删除指定用户
    ///
    /// # 返回值
    /// * `Ok(())` - 删除成功
    /// * `Err(UserError::NotFound)` - 用户不存在
    /// * `Err(UserError::WriteError)` - 写入失败
    async fn delete(&mut self, username: &str) -> WeimoResult<()>;

    /// 修改用户昵称
    ///
    /// # 返回值
    /// * `Ok(())` - 修改成功
    /// * `Err(UserError::NotFound)` - 用户不存在
    /// * `Err(UserError::WriteError)` - 写入失败
    async fn update_nickname(&mut self, username: &str, nickname: &str) -> WeimoResult<()>;

    /// 修改用户登录名
    async fn update_login_name(&mut self, username: &str, login_name: &str) -> WeimoResult<User>;

    /// 修改用户登录密码
    async fn update_password(&mut self, username: &str, password: &str) -> WeimoResult<User>;

    /// 获取用户信息
    ///
    /// # 返回值
    /// * `Ok(User)` - 返回用户信息
    /// * `Err(UserError::NotFound)` - 用户不存在
    async fn get(&self, username: &str) -> WeimoResult<User>;

    /// 通过微信 openid 获取用户，不存在时返回 `None`
    async fn get_by_wechat_openid(&self, openid: &str) -> Option<User>;

    /// 通过登录名获取用户，不存在时返回 `None`
    async fn get_by_login_name(&self, login_name: &str) -> Option<User>;

    /// 创建微信用户，如 openid 已存在则直接返回已有用户。
    /// 新建用户时 `nickname` 必须为非空值，否则返回 `NicknameRequired` 错误。
    async fn create_wechat_user(
        &mut self,
        openid: &str,
        unionid: Option<String>,
        nickname: Option<String>,
    ) -> WeimoResult<User>;

    /// 获取所有用户名，失败返回空列表
    async fn get_all_users(&self) -> Vec<String>;

    /// 检查用户是否存在
    async fn exists(&self, username: &str) -> bool;
}
