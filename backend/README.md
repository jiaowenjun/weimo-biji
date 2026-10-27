# 维摩笔记服务端

`biji` 是 维摩笔记 的 HTTP API 服务，当前基于 `Axum + Tokio` 实现，负责认证、用户、memo、标签与统计能力，并将数据落到本地文件系统。

## 当前能力

- 用户注册、登录、刷新 access token
- 小程序微信注册 / 登录（`wx.login code -> openid`，首次自动建号）
- 当前用户查询、昵称更新、账号删除
- memo 创建、读取、批量读取、更新、删除
- memo 组合搜索：标签、日期、全文、游标分页
- 标签树元信息查询与标签重命名
- 一对一好友搜索、申请、通知与同意
- 用户统计：笔记数、标签数、字数、活跃日期
- `users.json + social.json + <username>/*.md + .jwt_secret` 存储布局

## 启动

```bash
# 从 workspace 根目录运行
cargo run -p biji

# 指定存储目录
cargo run -p biji -- --storage "/path/to/storage"

# 指定监听地址和允许的前端来源
cargo run -p biji -- \
  --host 127.0.0.1 \
  --port 8080 \
  --cors-origin http://localhost:3000 \
  --cors-origin http://localhost:3001

# 运行测试
cargo test -p biji
```

默认行为：

- 监听地址：`0.0.0.0:8000`
- 存储目录：`~/workspace/memos`
- 日志级别：未设置 `RUST_LOG` 时默认为 `debug`

## 运行配置

| 项目 | 入口 | 默认值 | 说明 |
| --- | --- | --- | --- |
| `--storage` / `WEIMO_STORAGE_PATH` | CLI / 环境变量 | `~/workspace/memos` | 数据根目录 |
| `--host` / `WEIMO_HOST` | CLI / 环境变量 | `0.0.0.0` | HTTP 监听地址 |
| `--port` / `WEIMO_PORT` | CLI / 环境变量 | `8000` | HTTP 监听端口 |
| `--cors-origin` / `WEIMO_CORS_ORIGINS` | CLI / 环境变量 | 内置本地开发来源列表 | 允许的 CORS Origin；CLI 可重复传入多个 |
| `WEIMO_JWT_SECRET` | 环境变量 | 无 | 显式指定 JWT secret |
| `--cookie-secure` / `WEIMO_COOKIE_SECURE` | CLI / 环境变量 | `false` | 为 `refresh_token` Cookie 打上 `Secure`；接受 `true/false`、`yes/no`、`1/0` |
| `--wechat-app-id` / `WEIMO_WECHAT_APP_ID` | CLI / 环境变量 | `wx0450700454b0c0b7` | 微信小程序 AppID |
| `--wechat-app-secret` / `WEIMO_WECHAT_APP_SECRET` | CLI / 环境变量 | 无 | 微信小程序 AppSecret |
| `--wechat-api-base-url` / `WEIMO_WECHAT_API_BASE_URL` | CLI / 环境变量 | `https://api.weixin.qq.com` | 微信换码接口基地址，便于测试或代理 |
| `RUST_LOG` | 环境变量 | `debug` | `tracing_subscriber` 日志级别 |

同一配置同时存在时，CLI 参数优先于环境变量，环境变量优先于默认值。secret 建议通过环境变量注入，避免出现在进程参数中。

如果没有设置 `WEIMO_JWT_SECRET`，服务会按以下顺序解析：

1. 读取环境变量 `WEIMO_JWT_SECRET`
2. 读取 `<storage>/.jwt_secret`
3. 自动生成新 secret 并写回 `<storage>/.jwt_secret`

## 存储结构

```text
<storage>/
├── .jwt_secret
├── social.json
├── users.json
└── <username>/
    ├── 1.md
    ├── 2.md
    └── ...
```

- 用户数据保存在 `users.json`
- 好友关系、好友申请与通知保存在 `social.json`
- 每条 memo 保存为 `<username>/<memo_id>.md`
- memo 文件使用 Markdown 正文 + YAML FrontMatter：
  - `id`
  - `ct`
  - `mt`
  - `tags`
  - `refs`

## 认证与联调约定

- 受保护接口使用 `Authorization: Bearer <token>`
- `POST /auth/login` 成功后写入 `refresh_token` HttpOnly Cookie
- `POST /auth/refresh` 只依赖 `refresh_token` Cookie
- `POST /auth/mini/wechat` 依赖 `WEIMO_WECHAT_APP_ID` / `WEIMO_WECHAT_APP_SECRET`
- `POST /auth/mini/wechat` 会调用微信 `jscode2session`，按 `openid` 登录；首次成功后自动注册
- access token 有效期 30 分钟
- refresh token 有效期 30 天
- `refresh_token` Cookie 固定使用：
  - `HttpOnly`
  - `Path=/`
  - `SameSite=Lax`
  - `Max-Age=30 days`
  - `Secure` 由 `WEIMO_COOKIE_SECURE` 控制

默认 CORS 允许以下本地来源并允许携带凭据：

- `http://localhost:3000`
- `http://localhost:3001`
- `http://127.0.0.1:3000`
- `http://127.0.0.1:3001`
- `http://localhost:5173`
- `http://localhost:5174`
- `http://127.0.0.1:5173`
- `http://127.0.0.1:5174`
- `http://localhost:4173`
- `http://localhost:4174`
- `http://127.0.0.1:4173`
- `http://127.0.0.1:4174`

## HTTP API 概览

基础地址：`http://127.0.0.1:8000`

| 分组 | 方法 | 路径 | 认证 | 说明 |
| --- | --- | --- | --- | --- |
| 健康检查 | `GET` | `/health` | 否 | 纯文本 `OK` |
| 认证 | `POST` | `/auth/register` | 否 | 注册用户 |
| 认证 | `POST` | `/auth/login` | 否 | 登录并返回 access token |
| 认证 | `POST` | `/auth/refresh` | Cookie | 刷新 access token |
| 认证 | `POST` | `/auth/mini/login` | 否 | 小程序用户名密码登录 |
| 认证 | `POST` | `/auth/mini/wechat` | 否 | 小程序微信登录；首次成功后自动注册 |
| 认证 | `POST` | `/auth/mini/wechat/check` | 否 | 小程序微信注册状态预检查；仅查询不创建用户 |
| 认证 | `POST` | `/auth/mini/refresh` | 否 | 小程序显式提交 `refresh_token` 刷新 access token |
| 当前用户 | `GET` | `/me` | Bearer | 查询当前用户 |
| 当前用户 | `PATCH` | `/me` | Bearer | 更新昵称，请求体 `{"nickname": "..."}` |
| 当前用户 | `DELETE` | `/me` | Bearer | 删除当前用户 |
| 当前用户 | `GET` | `/me/stats` | Bearer | 查询统计信息 |
| memo | `POST` | `/memo` | Bearer | 创建 memo |
| memo | `POST` | `/memo/search` | Bearer | 组合搜索并分页返回 memo |
| memo | `POST` | `/memo/batch` | Bearer | 按 ID 批量读取 memo |
| memo | `GET` | `/memo/{id}` | Bearer | 读取单条 memo |
| memo | `PUT` | `/memo/{id}` | Bearer | 更新单条 memo |
| memo | `DELETE` | `/memo/{id}` | Bearer | 删除单条 memo |
| 标签 | `GET` | `/tag/meta` | Bearer | 查询标签树元信息 |
| 标签 | `PUT` | `/tag/{old_tag}` | Bearer | 重命名标签，请求体 `{"new_tag": "..."}` |
| 好友 | `GET` | `/friend/me` | Bearer | 查询当前好友摘要 |
| 好友 | `GET` | `/friend/unread-count` | Bearer | 查询未读通知数 |
| 好友 | `GET` | `/friend/search?nickname=...` | Bearer | 按昵称搜索用户 |
| 好友 | `POST` | `/friend/request` | Bearer | 发起好友申请，请求体 `{"to_username": "..."}` |
| 好友 | `GET` | `/friend/notifications` | Bearer | 查询好友通知列表 |
| 好友 | `POST` | `/friend/notifications/read` | Bearer | 标记好友通知已读 |
| 好友 | `POST` | `/friend/requests/{id}/accept` | Bearer | 同意好友申请 |
| 好友 | `GET` | `/friend/{friend_username}/stats` | Bearer | 查询指定好友统计信息 |
| 好友 | `GET` | `/friend/{friend_username}/tag/meta` | Bearer | 查询指定好友标签树 |
| 好友 | `POST` | `/friend/{friend_username}/memos/search` | Bearer | 查询指定好友笔记 |
| 好友 | `GET` | `/friend/{friend_username}/memos/{id}` | Bearer | 查询指定好友笔记详情 |

`POST /memo/search` 支持以下条件：

- `tag`
- `created_at`
- `text`
- `cursor`
- `page_size`

多个条件按 `AND` 组合，结果按创建时间倒序返回。

好友接口的冲突响应使用 `{ "code": "...", "message": "..." }`，其中 `code` 是稳定的 uppercase snake-case 枚举，例如 `ALREADY_PAIRED`、`TARGET_PAIRED`、`PENDING_EXISTS`、`REQUEST_EXPIRED`。当前策略常量仍限制每个用户最多一个好友，且同一时刻最多参与一个待处理好友申请。好友摘要返回 `friends` 与 `pending_outgoing` 数组；好友笔记、统计和标签树读取必须在路径中指定 `friend_username`。
