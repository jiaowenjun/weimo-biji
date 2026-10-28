use std::path::Path;

use weimo_wdf::{WdfBlock, WdfDocument, WdfText};

use super::driver::SqliteDb;
use crate::data::Memo;
use crate::error::{WeimoError, WeimoResult};

/// 旧文件存储(md + frontmatter)迁移到 SQLite 的结果报告
#[derive(Debug, Default)]
pub struct MigrationReport {
    pub users: usize,
    pub memos_total: usize,
    pub memos_converted: usize,
    /// 消毒后 from_markdown 成功(格式有损但结构保留)
    pub memos_sanitized: usize,
    /// from_markdown 失败后回退为纯文本段落(格式尽失但内容保留)
    pub memos_plain_fallback: usize,
    pub failed_files: Vec<String>,
}

/// 将旧文件存储目录(users.json + <username>/<id>.md)迁移进 SQLite。
///
/// - 用户按 users.json 原样写入(密码哈希/登录名/微信字段全保留);
/// - 笔记正文 markdown 经消毒降级为 WDF 可表达的子集后 from_markdown,
///   仍失败则整篇按纯文本段落兜底,保证零丢失;
/// - INSERT OR IGNORE,重复执行幂等;旧文件不改动、不删除。
pub async fn migrate_md_storage_to_sqlite(root: &Path, db: &SqliteDb) -> WeimoResult<MigrationReport> {
    let mut report = MigrationReport::default();

    migrate_users(root, db, &mut report).await?;
    migrate_memos(root, db, &mut report).await?;

    Ok(report)
}

async fn migrate_users(root: &Path, db: &SqliteDb, report: &mut MigrationReport) -> WeimoResult<()> {
    let users_path = root.join("users.json");
    let raw = match tokio::fs::read_to_string(&users_path).await {
        Ok(raw) => raw,
        Err(error) if error.kind() == std::io::ErrorKind::NotFound => {
            tracing::warn!("未找到 users.json,跳过用户迁移: {}", users_path.display());
            return Ok(());
        }
        Err(error) => return Err(WeimoError::ReadError(error)),
    };

    let users: Vec<crate::data::User> = serde_json::from_str(&raw)
        .map_err(|error| WeimoError::ReadError(std::io::Error::other(error)))?;
    for user in users {
        db.insert_user_raw(&user).await?;
        report.users += 1;
    }
    Ok(())
}

async fn migrate_memos(root: &Path, db: &SqliteDb, report: &mut MigrationReport) -> WeimoResult<()> {
    let mut user_dirs = tokio::fs::read_dir(root)
        .await
        .map_err(WeimoError::ReadError)?;

    while let Some(entry) = user_dirs
        .next_entry()
        .await
        .map_err(WeimoError::ReadError)?
    {
        let path = entry.path();
        if !path.is_dir() {
            continue;
        }
        let username = match path.file_name().and_then(|name| name.to_str()) {
            Some(name) => name.to_string(),
            None => continue,
        };

        let mut md_files = tokio::fs::read_dir(&path)
            .await
            .map_err(WeimoError::ReadError)?;
        while let Some(file) = md_files
            .next_entry()
            .await
            .map_err(WeimoError::ReadError)?
        {
            let file_path = file.path();
            if file_path.extension().and_then(|ext| ext.to_str()) != Some("md") {
                continue;
            }

            report.memos_total += 1;
            let stored = match tokio::fs::read_to_string(&file_path).await {
                Ok(stored) => stored,
                Err(error) => {
                    report.failed_files.push(format!("{}: {error}", file_path.display()));
                    continue;
                }
            };

            let Some(memo) = Memo::parse_stored(&stored) else {
                report
                    .failed_files
                    .push(format!("{}: frontmatter 解析失败", file_path.display()));
                continue;
            };

            match markdown_body_to_wdf_json(memo.content()) {
                Ok((json, sanitized, plain_fallback)) => {
                    let converted = Memo::from_parts(
                        *memo.id(),
                        memo.create_t_utc(),
                        memo.modify_t_utc(),
                        memo.tags().to_vec(),
                        memo.refs().to_vec(),
                        json,
                    );
                    db.insert_memo_raw(&username, &converted).await?;
                    if plain_fallback {
                        report.memos_plain_fallback += 1;
                    } else if sanitized {
                        report.memos_sanitized += 1;
                    } else {
                        report.memos_converted += 1;
                    }
                }
                Err(error) => {
                    report
                        .failed_files
                        .push(format!("{}: {error}", file_path.display()));
                }
            }
        }
    }
    Ok(())
}

/// markdown 正文 → 规范 WDF JSON 文本。
///
/// 返回 (JSON, 是否经过消毒, 是否走了纯文本兜底)。from_markdown 对
/// 链接/斜体/行内代码等一律硬拒,消毒先把这些语法降级为纯文本。
pub fn markdown_body_to_wdf_json(
    markdown: &str,
) -> Result<(String, bool, bool), WeimoError> {
    let sanitized = sanitize_markdown_for_wdf(markdown);
    let used_sanitizer = sanitized != markdown;

    if let Ok(document) = weimo_wdf::from_markdown(&sanitized) {
        let json = serde_json::to_string(&document)
            .map_err(|error| WeimoError::InvalidMemoContent(error.to_string()))?;
        return Ok((json, used_sanitizer, false));
    }

    // 兜底:整篇按纯文本段落重建,内容零丢失、格式尽失
    let document = plain_text_document(markdown);
    let json = serde_json::to_string(&document)
        .map_err(|error| WeimoError::InvalidMemoContent(error.to_string()))?;
    Ok((json, true, true))
}

fn plain_text_document(markdown: &str) -> WdfDocument {
    let paragraphs: Vec<WdfBlock> = markdown
        .lines()
        .filter(|line| !line.trim().is_empty())
        .map(|line| {
            WdfBlock::Paragraph {
                content: vec![WdfText::plain(line.trim())],
            }
        })
        .collect();

    let content = if paragraphs.is_empty() {
        vec![WdfBlock::Paragraph {
            content: vec![WdfText::plain("")],
        }]
    } else {
        paragraphs
    };

    WdfDocument {
        schema: weimo_wdf::WDF_SCHEMA.to_string(),
        version: weimo_wdf::WDF_VERSION,
        root: weimo_wdf::WdfRoot {
            node_type: "doc".to_string(),
            content,
        },
    }
}

/// 将 markdown 降级为 WDF v0.1 可表达的子集。
///
/// 保留:标题、引用(含 `>=` 居中引)、有序/无序列表、粗体、普通段落。
/// 降级为纯文本:链接、图片、行内代码、斜体、删除线、高亮、行内公式、
/// HTML 标签;代码围栏、水平线删除;嵌套列表压平;超过 6 级的标题截断。
pub fn sanitize_markdown_for_wdf(markdown: &str) -> String {
    let mut text = markdown.to_string();

    // 引用式链接定义先删,避免正文里的 [text][ref] 残留 ref
    text = strip_reference_definitions(&text);
    // 链接与图片降级为纯文本
    text = replace_all(&text, &[
        // 图片 ![alt](url) → alt
        (r"!\[([^\]]*)\]\([^)]*\)", "$1"),
        // 引用式链接 [text][ref] → text
        (r"\[([^\]]+)\]\[[^\]]*\]", "$1"),
        // 行内链接 [text](url) → text
        (r"\[([^\]]+)\]\([^)]*\)", "$1"),
        // 尖括号自动链接 <http://…> → 原样 URL
        (r"<(https?://[^>]+)>", "$1"),
        // 行内代码 `x` → x
        (r"`+", ""),
    ]);

    // 粗体先替换为占位符再清斜体,避免 `*italic*` 误伤 `**bold**`
    const BOLD: char = '\u{E000}';
    text = replace_all(&text, &[
        (r"\*\*([^*\n]+)\*\*", &format!("{BOLD}$1{BOLD}")),
        (r"__([^_\n]+)__", &format!("{BOLD}$1{BOLD}")),
        // 行内公式 $x$ / $$x$$ → x
        (r"\$\$([^$\n]+)\$\$", "$1"),
        (r"\$([^$\n]+)\$", "$1"),
        // 删除线/高亮/斜体
        (r"~~([^~\n]+)~~", "$1"),
        (r"==([^=\n]+)==", "$1"),
        (r"\*([^*\n]+)\*", "$1"),
    ]);
    text = text
        .lines()
        .map(strip_underscore_italics)
        .collect::<Vec<_>>()
        .join("\n");
    text = text.replace(BOLD, "**");

    // HTML 标签
    text = replace_all(&text, &[(r"</?[A-Za-z][^>]*>", "")]);

    // 逐行处理块级语法
    let mut in_fence = false;
    let mut lines_out: Vec<String> = Vec::new();
    for line in text.lines() {
        let trimmed = line.trim_start();
        if trimmed.starts_with("```") {
            in_fence = !in_fence;
            continue; // 围栏本身删除,内部行保留为普通段落
        }
        if in_fence {
            lines_out.push(line.to_string());
            continue;
        }
        // 水平线
        if is_horizontal_rule(trimmed) {
            continue;
        }
        // 居中引用 >= → 普通引用
        if trimmed.starts_with(">=") {
            lines_out.push(format!("> {}", trimmed[2..].trim_start()));
            continue;
        }
        // 超深标题截断到 6 级
        if let Some(rest) = strip_heading(trimmed) {
            let hashes = rest.0;
            if hashes > 6 {
                lines_out.push(format!("###### {}", rest.1));
                continue;
            }
            lines_out.push(line.to_string());
            continue;
        }
        // 嵌套列表压平(保留列表语义)
        let list_marker_len = unordered_list_marker_len(trimmed)
            .or_else(|| ordered_list_marker_len(trimmed));
        if let Some(marker_len) = list_marker_len {
            if line.len() > marker_len + (line.len() - trimmed.len()) {
                let indent = line.len() - trimmed.len();
                let stripped = &line[indent + marker_len..];
                lines_out.push(format!("{}{}", &trimmed[..marker_len], stripped));
                continue;
            }
        }
        lines_out.push(line.to_string());
    }
    lines_out.join("\n")
}

/// 下划线斜体 `_x_`:仅当两侧下划线都贴着空白/行首行尾时才视为强调标记,
/// 避免 snake_case 单词被误伤(regex crate 不支持环视,手工扫描)
fn strip_underscore_italics(line: &str) -> String {
    let chars: Vec<char> = line.chars().collect();
    let is_word = |c: char| c.is_alphanumeric() || c == '_';
    let mut out = String::with_capacity(line.len());
    let mut index = 0;
    while index < chars.len() {
        let ch = chars[index];
        let boundary_before = index == 0 || !is_word(chars[index - 1]);
        if ch == '_' && boundary_before {
            // 找配对的闭合下划线
            if let Some(close) = (index + 1..chars.len()).find(|&at| {
                chars[at] == '_'
                    && at > index + 1
                    && (at + 1 == chars.len() || !is_word(chars[at + 1]))
            }) {
                let inner: String = chars[index + 1..close].iter().collect();
                if !inner.trim().is_empty() && !inner.contains('_') {
                    out.push_str(&inner);
                    index = close + 1;
                    continue;
                }
            }
        }
        out.push(ch);
        index += 1;
    }
    out
}

fn replace_all(text: &str, rules: &[(&str, &str)]) -> String {
    let mut result = text.to_string();
    for (pattern, replacement) in rules {
        let regex = match regex_lite(pattern) {
            Some(regex) => regex,
            None => continue,
        };
        result = regex.replace_all(&result, *replacement).into_owned();
    }
    result
}

fn regex_lite(pattern: &str) -> Option<regex::Regex> {
    regex::Regex::new(pattern).ok()
}

fn strip_reference_definitions(markdown: &str) -> String {
    markdown
        .lines()
        .filter(|line| {
            let trimmed = line.trim_start();
            !(trimmed.starts_with('[')
                && trimmed.contains("]:")
                && trimmed.find("]:").is_some_and(|at| trimmed[..at].ends_with(']')))
        })
        .collect::<Vec<_>>()
        .join("\n")
}

fn is_horizontal_rule(trimmed: &str) -> bool {
    let mut chars = trimmed.chars();
    let first = match chars.next() {
        Some(c @ ('*' | '-' | '_')) => c,
        _ => return false,
    };
    let mut count = 0;
    for ch in trimmed.chars() {
        if ch == first {
            count += 1;
        } else if !ch.is_whitespace() {
            return false;
        }
    }
    count >= 3
}

/// 返回 (井号数, 标题文本);非标题返回 None
fn strip_heading(trimmed: &str) -> Option<(usize, &str)> {
    let hashes = trimmed.chars().take_while(|c| *c == '#').count();
    if hashes == 0 {
        return None;
    }
    let rest = &trimmed[hashes..];
    if rest.is_empty() || rest.starts_with(' ') {
        Some((hashes, rest.trim_start()))
    } else {
        None
    }
}

fn unordered_list_marker_len(trimmed: &str) -> Option<usize> {
    let mut chars = trimmed.chars();
    match chars.next() {
        Some(_c @ ('*' | '+' | '-')) => {
            let after = chars.next();
            if matches!(after, Some(' ') | Some('\t')) {
                Some(2)
            } else {
                None
            }
        }
        _ => None,
    }
}

fn ordered_list_marker_len(trimmed: &str) -> Option<usize> {
    let digits = trimmed.chars().take_while(|c| c.is_ascii_digit()).count();
    if digits == 0 {
        return None;
    }
    let rest = &trimmed[digits..];
    if rest.starts_with(". ") || rest.starts_with(") ") {
        Some(digits + 2)
    } else {
        None
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::data::{MemoCreate, SqliteDb, UserCreate};
    use std::path::PathBuf;

    fn assert_wdf_roundtrip(markdown: &str, expected_plain: &str) {
        let (json, _sanitized, plain_fallback) =
            markdown_body_to_wdf_json(markdown).expect("markdown 应能转为 WDF");
        assert!(!plain_fallback, "该用例不应触发纯文本兜底: {markdown}");
        let document: WdfDocument =
            serde_json::from_str(&json).expect("产出应为合法 WDF JSON");
        assert_eq!(weimo_wdf::render_plain(&document).trim(), expected_plain);
    }

    #[test]
    fn sanitize_keeps_supported_syntax_verbatim() {
        assert_eq!(
            sanitize_markdown_for_wdf("# 标题\n\n段落 **加粗**\n\n- 甲\n- 乙\n\n> 引用"),
            "# 标题\n\n段落 **加粗**\n\n- 甲\n- 乙\n\n> 引用",
        );
    }

    #[test]
    fn sanitize_downgrades_links_images_code_italics() {
        assert_eq!(
            sanitize_markdown_for_wdf("见 [文档](https://a.b) 与 ![图](https://x.y/z.png) 及 `code` 和 *斜体*"),
            "见 文档 与 图 及 code 和 斜体",
        );
        // snake_case 不受下划线斜体影响
        assert_eq!(sanitize_markdown_for_wdf("snake_case_name 保持原样"), "snake_case_name 保持原样");
        assert_eq!(sanitize_markdown_for_wdf("_强调_ 下划线"), "强调 下划线");
    }

    #[test]
    fn sanitize_flattens_nested_lists_and_truncates_deep_heading() {
        assert_eq!(
            sanitize_markdown_for_wdf("- 甲\n  - 乙\n    - 丙"),
            "- 甲\n- 乙\n- 丙",
        );
        assert_eq!(
            sanitize_markdown_for_wdf("####### 七级标题"),
            "###### 七级标题",
        );
    }

    #[test]
    fn sanitize_converts_centered_quote_and_strips_rules_html() {
        let sanitized = sanitize_markdown_for_wdf(">= 居中引用\n\n---\n\n<b>加粗标签</b>");
        assert!(sanitized.starts_with("> 居中引用"), "{sanitized}");
        assert!(sanitized.contains("加粗标签") && !sanitized.contains('<'), "{sanitized}");
    }

    #[test]
    fn markdown_with_links_converts_after_sanitize() {
        assert_wdf_roundtrip(
            "参考 [Rust 官网](https://rust-lang.org) 学习",
            "参考 Rust 官网 学习",
        );
    }

    #[test]
    fn markdown_with_inline_code_converts_after_sanitize() {
        assert_wdf_roundtrip("运行 `cargo test` 通过", "运行 cargo test 通过");
    }

    #[test]
    fn markdown_unsupported_everything_falls_back_to_plain_paragraphs() {
        // 列表项内含第二段:消毒不展开该结构,from_markdown 拒绝后走纯文本兜底
        let hostile = "- 第一段\n\n  第二段继续\n";
        let (json, _sanitized, plain_fallback) =
            markdown_body_to_wdf_json(hostile).expect("兜底路径永远成功");
        assert!(plain_fallback, "不可表达结构应走纯文本兜底");
        let document: WdfDocument = serde_json::from_str(&json).unwrap();
        let plain = weimo_wdf::render_plain(&document);
        assert!(plain.contains("第一段"), "内容零丢失: {plain}");
        assert!(plain.contains("第二段继续"));

        // 空正文兜底为单个空段落文档,保证 WDF 结构合法
        let (empty_json, _, _) = markdown_body_to_wdf_json("").expect("空正文也应成功");
        let empty_doc: WdfDocument = serde_json::from_str(&empty_json).unwrap();
        assert_eq!(empty_doc.root.content.len(), 1);
    }

    #[tokio::test]
    async fn migrate_end_to_end_from_legacy_md_storage() {
        let dir = tempfile::tempdir().unwrap();
        // 旧用户文件
        let users = r#"[{"username":"alice","hashed_password":"h1","nickname":"爱丽丝","login_name":"alice"},{"username":"bob","hashed_password":"h2","nickname":"鲍勃","login_name":"bob","wechat_openid":"oX","wechat_unionid":null}]"#;
        tokio::fs::write(dir.path().join("users.json"), users).await.unwrap();

        let alice_dir = dir.path().join("alice");
        tokio::fs::create_dir_all(&alice_dir).await.unwrap();
        // 纯 markdown 笔记(含链接,验证消毒)
        tokio::fs::write(
            alice_dir.join("1.md"),
            "---\nid: 1\nct: 2024-01-02T03:04:05Z\nmt: 2024-01-02T03:04:05Z\ntags:\n  - 开发/后端\n---\n\n看 [文档](https://a.b) 与 **加粗**\n",
        )
        .await
        .unwrap();
        // 含未支持结构的笔记(列表项第二段 → 纯文本兜底)
        tokio::fs::write(
            alice_dir.join("2.md"),
            "---\nid: 2\nct: 2024-02-01T00:00:00Z\nmt: 2024-02-01T00:00:00Z\ntags: []\n---\n\n- 第一段\n\n  第二段继续\n",
        )
        .await
        .unwrap();

        let db = SqliteDb::new(dir.path()).await.unwrap();
        let report = migrate_md_storage_to_sqlite(dir.path(), &db).await.unwrap();

        assert_eq!(report.users, 2);
        assert_eq!(report.memos_total, 2);
        assert!(report.failed_files.is_empty(), "{:?}", report.failed_files);

        // 用户原样落库
        let alice = db.get_user("alice").await.unwrap();
        assert_eq!(alice.nickname(), "爱丽丝");
        let bob = db.get_user_by_wechat_openid("oX").await.unwrap();
        assert_eq!(bob.username(), "bob");

        // 笔记可读、正文为合法 WDF 且内容保留
        let memo = db.get_memo("alice", &1).await.unwrap();
        assert_eq!(memo.tags(), &["开发/后端".to_string()]);
        let document: WdfDocument = serde_json::from_str(memo.content()).unwrap();
        let plain = weimo_wdf::render_plain(&document);
        assert!(plain.contains("文档"), "链接文本应保留: {plain}");
        assert!(plain.contains("加粗"), "加粗文本应保留: {plain}");

        let fallback_memo = db.get_memo("alice", &2).await.unwrap();
        let fallback_doc = fallback_memo
            .wdf_document()
            .expect("兜底文档应为合法 WDF");
        let fallback_plain = weimo_wdf::render_plain(&fallback_doc);
        assert!(fallback_plain.contains("第二段继续"), "{fallback_plain}");
        assert_eq!(report.memos_plain_fallback, 1);

        // 幂等:重复迁移不报错不重复
        let report_again = migrate_md_storage_to_sqlite(dir.path(), &db).await.unwrap();
        assert_eq!(report_again.memos_total, 2);
        assert_eq!(db.get_memo_ids("alice").await.len(), 2);
    }

    #[tokio::test]
    async fn sqlite_db_reopen_persists_data() {
        let dir = tempfile::tempdir().unwrap();
        let db_path: PathBuf = dir.path().join("biji.db");

        {
            let mut db = SqliteDb::new(dir.path()).await.unwrap();
            db.create_user(UserCreate {
                username: "u".into(),
                password: "p".into(),
                nickname: None,
            })
            .await
            .unwrap();
            db.create_memo(
                "u",
                MemoCreate {
                    content: serde_json::json!({
                        "schema": "weimo.document",
                        "version": 1,
                        "root": { "type": "doc", "content": [
                            { "type": "paragraph", "content": [{ "type": "text", "text": "持久化" }] }
                        ]}
                    }),
                    tags: vec!["t".into()],
                    refs: vec![],
                },
                1,
            )
            .await
            .unwrap();
        }

        assert!(db_path.exists(), "数据库文件应已生成");
        let reopened = SqliteDb::new(dir.path()).await.unwrap();
        let memo = reopened.get_memo("u", &1).await.unwrap();
        assert!(memo.content().contains("持久化"));
        assert_eq!(memo.tags(), &["t".to_string()]);
    }
}
