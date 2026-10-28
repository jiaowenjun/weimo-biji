use crate::utils::markdown::{deserialize_string_list, render_front_matter, split_front_matter};
use serde::{Deserialize, Serialize};
use time::{OffsetDateTime, UtcOffset};
use weimo_wdf::WdfDocument;

use super::memo_ref::MemoRef;
use crate::error::{WeimoError, WeimoResult};

pub type MemoId = u32;

/// 校验并规范化 WDF 内容,序列化为规范存储文本。
///
/// 所有写入路径(API 创建/更新)都经此入口;外部输入必须是能通过
/// `weimo_wdf::validate_and_canonicalize` 的 WDF JSON,存储侧只保留
/// 规范形态,读取侧因此可以信任存储文本直接反序列化。
pub fn canonicalize_wdf_content(value: &serde_json::Value) -> WeimoResult<String> {
    let document = weimo_wdf::validate_and_canonicalize(value).map_err(|diagnostics| {
        let reason = diagnostics
            .iter()
            .map(|diagnostic| {
                if diagnostic.path.is_empty() {
                    diagnostic.message.clone()
                } else {
                    format!("{} ({})", diagnostic.message, diagnostic.code)
                }
            })
            .collect::<Vec<_>>()
            .join("; ");
        WeimoError::InvalidMemoContent(reason)
    })?;
    serde_json::to_string(&document)
        .map_err(|error| WeimoError::InvalidMemoContent(error.to_string()))
}

/// 创建笔记所需的信息
#[derive(Debug, Default, Serialize, Deserialize)]
pub struct MemoCreate {
    /// 笔记内容(WDF 文档 JSON)
    pub content: serde_json::Value,
    /// 笔记标签列表
    pub tags: Vec<String>,
    /// 笔记引用的其他笔记 ID 列表，缺省视为空
    #[serde(default)]
    pub refs: Vec<MemoRef>,
}

/// 更新笔记所需的信息
#[derive(Debug, Default, Serialize, Deserialize)]
pub struct MemoUpdate {
    /// 可选的笔记内容(WDF 文档 JSON)，如果不更新则为 None
    pub content: Option<serde_json::Value>,
    /// 可选的笔记标签列表，如果不更新则为 None
    pub tags: Option<Vec<String>>,
    /// 可选的引用列表；None=不动，Some([])=清空，Some([..])=替换
    #[serde(default)]
    pub refs: Option<Vec<MemoRef>>,
}

/// 笔记结构体，表示一条备忘记录
#[derive(Debug, Serialize, Deserialize)]
pub struct Memo {
    /// 唯一标识符
    id: MemoId,
    /// 创建时间: UTC 时间
    ct_utc: OffsetDateTime,
    /// 修改时间: UTC 时间
    mt_utc: OffsetDateTime,
    /// 标签列表
    tags: Vec<String>,
    /// 引用的其他笔记列表
    #[serde(default)]
    refs: Vec<MemoRef>,
    /// 内容(规范形态的 WDF 文档 JSON 文本)
    content: String,
}

#[derive(Serialize, Deserialize)]
struct MemoFrontMatter {
    id: MemoId,
    #[serde(with = "time::serde::rfc3339")]
    ct: OffsetDateTime,
    #[serde(with = "time::serde::rfc3339")]
    mt: OffsetDateTime,
    #[serde(default, deserialize_with = "deserialize_string_list")]
    tags: Vec<String>,
    #[serde(default, deserialize_with = "deserialize_refs")]
    refs: Vec<MemoRef>,
}

fn deserialize_refs<'de, D>(deserializer: D) -> Result<Vec<MemoRef>, D::Error>
where
    D: serde::Deserializer<'de>,
{
    let noyalib::Value::Sequence(values) = noyalib::Value::deserialize(deserializer)? else {
        return Ok(Vec::new());
    };
    Ok(values
        .iter()
        .map_while(|value| noyalib::from_value(value).ok())
        .collect())
}

impl Memo {
    /// 创建新笔记;内容经 WDF 校验规范化后存储
    pub fn create(info: MemoCreate, id: MemoId) -> WeimoResult<Self> {
        let now = OffsetDateTime::now_utc();
        Ok(Self {
            id,
            ct_utc: now,
            mt_utc: now,
            tags: info.tags,
            refs: info.refs,
            content: canonicalize_wdf_content(&info.content)?,
        })
    }

    /// 笔记ID
    pub fn id(&self) -> &MemoId {
        &self.id
    }

    /// 获取笔记标签
    pub fn tags(&self) -> &[String] {
        &self.tags
    }

    /// 获取笔记内容(规范形态的 WDF 文档 JSON 文本)
    pub fn content(&self) -> &str {
        &self.content
    }

    /// 将存储内容解析为 WDF 文档;存储数据损坏时返回 None
    pub fn wdf_document(&self) -> Option<WdfDocument> {
        serde_json::from_str(&self.content).ok()
    }

    /// 笔记字数(WDF 正文纯文本字符数)
    pub fn word_cnt(&self) -> usize {
        self.wdf_document()
            .map(|document| weimo_wdf::render_plain(&document).trim().chars().count())
            .unwrap_or(0)
    }

    /// 创建时间: UTC 时间
    pub fn create_t_utc(&self) -> OffsetDateTime {
        self.ct_utc
    }

    /// 修改时间: UTC 时间
    pub fn modify_t_utc(&self) -> OffsetDateTime {
        self.mt_utc
    }

    /// 创建时间: 本地时间
    pub fn create_t(&self) -> OffsetDateTime {
        // UTC 时间转换为本地时间
        self.ct_utc
            .to_offset(UtcOffset::current_local_offset().unwrap_or(UtcOffset::UTC))
    }

    /// 更新内容并更新修改时间;内容经 WDF 校验规范化后存储
    pub fn set_content(&mut self, content: &serde_json::Value) -> WeimoResult<()> {
        self.content = canonicalize_wdf_content(content)?;
        self.mt_utc = OffsetDateTime::now_utc();
        Ok(())
    }

    /// 更新标签(不更新修改时间)
    pub fn set_tags(&mut self, tags: &[String]) {
        self.tags = tags.to_owned();
    }

    /// 获取笔记引用列表
    pub fn refs(&self) -> &[MemoRef] {
        &self.refs
    }

    /// 更新引用(不更新修改时间，与 set_tags 对齐)
    pub fn set_refs(&mut self, refs: &[MemoRef]) {
        self.refs = refs.to_owned();
    }

    /// 创建 YAML FrontMatter
    fn to_front_matter(&self) -> String {
        noyalib::to_string(&MemoFrontMatter {
            id: self.id,
            ct: self.ct_utc,
            mt: self.mt_utc,
            tags: self.tags.clone(),
            refs: self.refs.clone(),
        })
        .expect("serializing Memo front matter should not fail")
    }

    /// 保存为 YAML FrontMatter + WDF JSON 体格式
    pub fn to_stored(&self) -> String {
        render_front_matter(&self.to_front_matter(), &self.content)
    }

    /// 从 YAML FrontMatter + WDF JSON 体格式解析笔记
    ///
    /// 该函数用于解析包含 YAML FrontMatter 的存储文本，并从中提取笔记信息。
    /// 期望的格式为：
    /// ```
    /// ---
    /// id: 123
    /// ct: 2023-01-01T00:00:00Z
    /// mt: 2023-01-01T00:00:00Z
    /// tags:
    ///   - tag1
    ///   - tag2
    /// ---
    ///
    /// {"schema":"weimo.document","version":1,"root":{...}}
    /// ```
    ///
    /// # 参数
    /// * `stored` - 包含 YAML FrontMatter 的存储文本
    ///
    /// # 返回值
    /// * `Some(Memo)` - 成功解析时返回笔记对象
    /// * `None` - 解析失败时返回 None（格式错误、缺少必需字段等）
    pub fn parse_stored(stored: &str) -> Option<Self> {
        let (front_matter, content) = split_front_matter(stored)?;
        let front_matter = noyalib::from_str::<MemoFrontMatter>(&front_matter).ok()?;

        Some(Self {
            id: front_matter.id,
            ct_utc: front_matter.ct,
            mt_utc: front_matter.mt,
            tags: front_matter.tags,
            refs: front_matter.refs,
            content,
        })
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;
    use std::thread;
    use std::time::Duration;
    use time::format_description::well_known::Rfc3339;

    /// 单段纯文本的合法 WDF 文档 JSON
    fn wdf_value(text: &str) -> serde_json::Value {
        json!({
            "schema": "weimo.document",
            "version": 1,
            "root": {
                "type": "doc",
                "content": [
                    { "type": "paragraph", "content": [{ "type": "text", "text": text }] }
                ]
            }
        })
    }

    /// 单段纯文本的规范存储文本
    fn wdf_stored(text: &str) -> String {
        canonicalize_wdf_content(&wdf_value(text)).expect("测试 WDF 文档应合法")
    }

    #[test]
    fn test_word_cnt_counts_plain_text() {
        let memo = Memo {
            id: 123,
            ct_utc: OffsetDateTime::now_utc(),
            mt_utc: OffsetDateTime::now_utc(),
            tags: vec!["测试".to_string()],
            content: wdf_stored("这是一个测试内容"),
            refs: vec![],
        };
        // word_cnt 统计 WDF 正文纯文本字符数(忽略渲染分隔符)
        assert_eq!(memo.word_cnt(), 8);
    }

    /// 测试创建时间
    #[test]
    fn test_create_t() {
        let memo = Memo {
            id: 123,
            ct_utc: OffsetDateTime::parse("2021-01-01T00:00:00Z", &Rfc3339).unwrap(),
            mt_utc: OffsetDateTime::now_utc(),
            tags: vec![],
            content: String::new(),
            refs: vec![],
        };
        let dt = memo.create_t();
        assert_eq!(dt.year(), 2021);
        assert_eq!(dt.month() as u8, 1);
        assert_eq!(dt.day(), 1);
    }

    /// 测试修改时间
    #[test]
    fn test_modify_t() {
        let memo = Memo {
            id: 123,
            ct_utc: OffsetDateTime::parse("2021-01-01T00:00:00Z", &Rfc3339).unwrap(),
            mt_utc: OffsetDateTime::parse("2021-01-02T00:00:00Z", &Rfc3339).unwrap(),
            tags: vec![],
            content: String::new(),
            refs: vec![],
        };
        let dt = memo.mt_utc;
        assert_eq!(dt.year(), 2021);
        assert_eq!(dt.month() as u8, 1);
        assert_eq!(dt.day(), 2);
    }

    /// 测试创建笔记(内容经 WDF 校验规范化)
    #[test]
    fn test_from_add_info() {
        let info = MemoCreate {
            content: wdf_value("测试内容"),
            tags: vec!["标签1".to_string(), "标签2".to_string()],
            refs: vec![],
        };

        let memo = Memo::create(info, 123).expect("合法 WDF 内容应能创建笔记");

        assert_eq!(memo.content, wdf_stored("测试内容"));
        assert_eq!(memo.tags, vec!["标签1", "标签2"]);
        assert_eq!(memo.ct_utc, memo.mt_utc); // 创建时间和更新时间应该相同
    }

    #[test]
    fn test_create_rejects_invalid_wdf_content() {
        let info = MemoCreate {
            content: json!({ "schema": "weimo.document", "version": 1,
                "root": { "type": "doc", "content": [] } }),
            tags: vec![],
            refs: vec![],
        };

        let error = Memo::create(info, 123).expect_err("空文档应被拒绝");
        assert!(matches!(error, WeimoError::InvalidMemoContent(_)));

        let info = MemoCreate {
            content: json!("普通字符串不是 WDF 文档"),
            tags: vec![],
            refs: vec![],
        };
        assert!(matches!(
            Memo::create(info, 124),
            Err(WeimoError::InvalidMemoContent(_))
        ));
    }

    /// 测试更新内容
    #[test]
    fn test_set_content() {
        let info = MemoCreate {
            content: wdf_value("原始内容"),
            tags: vec!["标签".to_string()],
            refs: vec![],
        };

        let mut memo = Memo::create(info, 123).expect("合法 WDF 内容应能创建笔记");
        let original_ut = memo.mt_utc;

        // 等待一小段时间以确保时间戳变化
        thread::sleep(Duration::from_millis(10));

        memo.set_content(&wdf_value("新内容"))
            .expect("合法 WDF 内容应能更新");

        assert_eq!(memo.content, wdf_stored("新内容"));
        assert!(memo.mt_utc > original_ut); // 确保更新时间已更新
    }

    #[test]
    fn test_set_content_rejects_invalid_wdf_and_keeps_state() {
        let info = MemoCreate {
            content: wdf_value("原始内容"),
            tags: vec![],
            refs: vec![],
        };
        let mut memo = Memo::create(info, 123).expect("合法 WDF 内容应能创建笔记");
        let original_ut = memo.mt_utc;

        let result = memo.set_content(&json!({ "root": { "type": "doc", "content": [] } }));

        assert!(matches!(result, Err(WeimoError::InvalidMemoContent(_))));
        assert_eq!(memo.content, wdf_stored("原始内容"));
        assert_eq!(memo.mt_utc, original_ut); // 失败时不更新修改时间
    }

    /// 测试更新标签
    #[test]
    fn test_set_tags() {
        let info = MemoCreate {
            content: wdf_value("测试内容"),
            tags: vec!["原始标签".to_string()],
            refs: vec![],
        };

        let mut memo = Memo::create(info, 123).expect("合法 WDF 内容应能创建笔记");
        let original_ut = memo.mt_utc;

        thread::sleep(Duration::from_millis(10));

        memo.set_tags(&[
            "标签1".to_string(),
            "标签2".to_string(),
            "标签3".to_string(),
        ]);

        assert_eq!(memo.tags, vec!["标签1", "标签2", "标签3"]);
        assert_eq!(memo.mt_utc, original_ut); // 确保不更新修改时间
    }

    /// 测试综合更新内容和标签
    #[test]
    fn test_update_memo() {
        let info = MemoCreate {
            content: wdf_value("原始内容"),
            tags: vec!["原始标签".to_string()],
            refs: vec![],
        };

        let mut memo = Memo::create(info, 123).expect("合法 WDF 内容应能创建笔记");
        let original_ct = memo.ct_utc;
        let original_id = memo.id;

        thread::sleep(Duration::from_millis(10));

        memo.set_content(&wdf_value("更新内容"))
            .expect("合法 WDF 内容应能更新");
        memo.set_tags(&["新标签1".to_string(), "新标签2".to_string()]);

        // 验证内容和标签已更新
        assert_eq!(memo.content, wdf_stored("更新内容"));
        assert_eq!(memo.tags, vec!["新标签1", "新标签2"]);

        // 验证 ID 和创建时间保持不变
        assert_eq!(memo.id, original_id);
        assert_eq!(memo.ct_utc, original_ct);

        // 验证更新时间已变更
        assert!(memo.mt_utc > original_ct);
    }

    /// 测试序列化和反序列化
    #[test]
    fn test_memo_serialization() {
        let memo = Memo {
            id: 123,
            ct_utc: OffsetDateTime::parse("2021-01-01T00:00:00Z", &Rfc3339).unwrap(),
            mt_utc: OffsetDateTime::parse("2021-01-01T00:00:00Z", &Rfc3339).unwrap(),
            tags: vec!["标签1".to_string(), "标签2".to_string()],
            content: wdf_stored("测试内容"),
            refs: vec![],
        };

        // 序列化为 JSON
        let json = serde_json::to_string(&memo).unwrap();

        // 反序列化回 Memo
        let deserialized_memo: Memo = serde_json::from_str(&json).unwrap();

        // 验证反序列化后的数据是否与原始数据一致
        assert_eq!(memo.id, deserialized_memo.id);
        assert_eq!(memo.content, deserialized_memo.content);
        assert_eq!(memo.tags, deserialized_memo.tags);

        // 验证时间戳
        assert_eq!(
            memo.ct_utc.unix_timestamp(),
            deserialized_memo.ct_utc.unix_timestamp()
        );
        assert_eq!(
            memo.mt_utc.unix_timestamp(),
            deserialized_memo.mt_utc.unix_timestamp()
        );
    }

    /// 测试创建结构体的序列化和反序列化
    #[test]
    fn test_add_memo_info_serialization() {
        let add_info = MemoCreate {
            content: wdf_value("测试内容"),
            tags: vec!["标签1".to_string(), "标签2".to_string()],
            refs: vec![],
        };

        // 序列化为 JSON
        let json = serde_json::to_string(&add_info).unwrap();

        // 反序列化回 AddMemoInfo
        let deserialized_info: MemoCreate = serde_json::from_str(&json).unwrap();

        // 验证反序列化后的数据是否与原始数据一致
        assert_eq!(add_info.content, deserialized_info.content);
        assert_eq!(add_info.tags, deserialized_info.tags);
    }

    /// 测试更新结构体的序列化和反序列化
    #[test]
    fn test_upd_memo_info_serialization() {
        let upd_info = MemoUpdate {
            content: Some(wdf_value("更新的内容")),
            tags: Some(vec!["新标签1".to_string(), "新标签2".to_string()]),
            refs: None,
        };

        // 序列化为 JSON
        let json = serde_json::to_string(&upd_info).unwrap();

        // 反序列化回 UpdMemoInfo
        let deserialized_info: MemoUpdate = serde_json::from_str(&json).unwrap();

        // 验证反序列化后的数据是否与原始数据一致
        assert_eq!(upd_info.content, deserialized_info.content);
        assert_eq!(upd_info.tags, deserialized_info.tags);

        // 测试部分更新
        let partial_upd_info = MemoUpdate {
            content: Some(wdf_value("只更新内容")),
            tags: None,
            refs: None,
        };

        let json = serde_json::to_string(&partial_upd_info).unwrap();

        let deserialized_partial: MemoUpdate = serde_json::from_str(&json).unwrap();
        assert_eq!(partial_upd_info.content, deserialized_partial.content);
        assert_eq!(partial_upd_info.tags, deserialized_partial.tags);
    }

    /// 测试 YAML FrontMatter 生成（包含标签）
    #[test]
    fn test_to_stored_with_tags() {
        let memo = Memo {
            id: 42,
            ct_utc: OffsetDateTime::parse("2021-01-01T00:00:00Z", &Rfc3339).unwrap(),
            mt_utc: OffsetDateTime::parse("2021-01-02T12:34:56Z", &Rfc3339).unwrap(),
            tags: vec!["tag1".to_string(), "tag2".to_string()],
            content: wdf_stored("内容正文"),
            refs: vec![],
        };

        let expected = format!(
            "---\nid: 42\nct: 2021-01-01T00:00:00Z\nmt: 2021-01-02T12:34:56Z\ntags:\n  - tag1\n  - tag2\nrefs: []\n---\n\n{}",
            memo.content
        );
        assert_eq!(memo.to_stored(), expected);
    }

    /// 测试 YAML FrontMatter 生成（无标签）
    #[test]
    fn test_to_stored_without_tags() {
        let memo = Memo {
            id: 7,
            ct_utc: OffsetDateTime::parse("2022-05-01T08:00:00Z", &Rfc3339).unwrap(),
            mt_utc: OffsetDateTime::parse("2022-05-01T08:00:00Z", &Rfc3339).unwrap(),
            tags: vec![],
            content: wdf_stored("无标签内容"),
            refs: vec![],
        };

        let expected = format!(
            "---\nid: 7\nct: 2022-05-01T08:00:00Z\nmt: 2022-05-01T08:00:00Z\ntags: []\nrefs: []\n---\n\n{}",
            memo.content
        );
        assert_eq!(memo.to_stored(), expected);
    }

    /// 测试从存储文本解析（包含标签）
    #[test]
    fn test_parse_stored_with_tags() {
        let stored = format!(
            "---\nid: 42\nct: 2021-01-01T00:00:00Z\nmt: 2021-01-02T12:34:56Z\ntags:\n  - tag1\n  - tag2\n---\n\n{}",
            wdf_stored("内容正文")
        );

        let memo = Memo::parse_stored(&stored).unwrap();

        assert_eq!(memo.id, 42);
        assert_eq!(
            memo.ct_utc,
            OffsetDateTime::parse("2021-01-01T00:00:00Z", &Rfc3339).unwrap()
        );
        assert_eq!(
            memo.mt_utc,
            OffsetDateTime::parse("2021-01-02T12:34:56Z", &Rfc3339).unwrap()
        );
        assert_eq!(memo.tags, vec!["tag1", "tag2"]);
        assert_eq!(memo.content, wdf_stored("内容正文"));
        assert!(memo.wdf_document().is_some());
    }

    /// 测试从存储文本解析（无标签）
    #[test]
    fn test_parse_stored_without_tags() {
        let stored = format!(
            "---\nid: 7\nct: 2022-05-01T08:00:00Z\nmt: 2022-05-01T08:00:00Z\ntags: []\n---\n\n{}",
            wdf_stored("无标签内容")
        );

        let memo = Memo::parse_stored(&stored).unwrap();

        assert_eq!(memo.id, 7);
        assert_eq!(
            memo.mt_utc,
            OffsetDateTime::parse("2022-05-01T08:00:00Z", &Rfc3339).unwrap()
        );
        assert_eq!(memo.tags, Vec::<String>::new());
        assert_eq!(memo.content, wdf_stored("无标签内容"));
    }

    /// 测试存储文本往返转换（有标签）
    #[test]
    fn test_stored_roundtrip_with_tags() {
        let original = Memo {
            id: 123,
            ct_utc: OffsetDateTime::parse("2023-01-01T12:00:00Z", &Rfc3339).unwrap(),
            mt_utc: OffsetDateTime::parse("2023-01-01T13:00:00Z", &Rfc3339).unwrap(),
            tags: vec!["测试".to_string(), "标签".to_string()],
            content: wdf_stored("这是测试内容"),
            refs: vec![],
        };

        let stored = original.to_stored();
        let parsed = Memo::parse_stored(&stored).unwrap();

        assert_eq!(original.id, parsed.id);
        assert_eq!(original.ct_utc, parsed.ct_utc);
        assert_eq!(original.mt_utc, parsed.mt_utc);
        assert_eq!(original.tags, parsed.tags);
        assert_eq!(original.content, parsed.content);
    }

    /// 测试存储文本往返转换（无标签）
    #[test]
    fn test_stored_roundtrip_without_tags() {
        let original = Memo {
            id: 456,
            ct_utc: OffsetDateTime::parse("2023-02-01T10:30:00Z", &Rfc3339).unwrap(),
            mt_utc: OffsetDateTime::parse("2023-02-01T10:30:00Z", &Rfc3339).unwrap(),
            tags: vec![],
            content: wdf_stored("单行内容"),
            refs: vec![],
        };

        let stored = original.to_stored();
        let parsed = Memo::parse_stored(&stored).unwrap();

        assert_eq!(original.id, parsed.id);
        assert_eq!(original.ct_utc, parsed.ct_utc);
        assert_eq!(original.mt_utc, parsed.mt_utc);
        assert_eq!(original.tags, parsed.tags);
        assert_eq!(original.content, parsed.content);
    }

    /// 测试解析无效的存储文本
    #[test]
    fn test_parse_invalid_stored() {
        // 没有 front matter
        assert!(Memo::parse_stored("只是普通的内容").is_none());

        // 不完整的 front matter
        assert!(Memo::parse_stored("---\nid: 123\n").is_none());

        // 缺少必需字段
        assert!(Memo::parse_stored("---\nid: 123\n---\n内容").is_none());

        // 无效的日期格式
        let invalid_date = format!(
            "---\nid: 123\nct: invalid-date\nmt: 2023-01-01T00:00:00Z\ntags: []\n---\n{}",
            wdf_stored("内容")
        );
        assert!(Memo::parse_stored(&invalid_date).is_none());
    }

    /// frontmatter 写出含 refs 列表
    #[test]
    fn test_to_stored_with_refs() {
        let memo = Memo {
            id: 42,
            ct_utc: OffsetDateTime::parse("2026-01-01T00:00:00Z", &Rfc3339).unwrap(),
            mt_utc: OffsetDateTime::parse("2026-01-02T00:00:00Z", &Rfc3339).unwrap(),
            tags: vec!["t1".to_string()],
            refs: vec![MemoRef(7), MemoRef(12)],
            content: wdf_stored("正文"),
        };
        let expected = format!(
            "---\nid: 42\nct: 2026-01-01T00:00:00Z\nmt: 2026-01-02T00:00:00Z\ntags:\n  - t1\nrefs:\n  - \"7\"\n  - \"12\"\n---\n\n{}",
            memo.content
        );
        assert_eq!(memo.to_stored(), expected);
    }

    /// frontmatter 写出空 refs 仍为 refs: []
    #[test]
    fn test_to_stored_empty_refs() {
        let memo = Memo {
            id: 7,
            ct_utc: OffsetDateTime::parse("2026-01-01T00:00:00Z", &Rfc3339).unwrap(),
            mt_utc: OffsetDateTime::parse("2026-01-01T00:00:00Z", &Rfc3339).unwrap(),
            tags: vec![],
            refs: vec![],
            content: wdf_stored("x"),
        };
        let expected = format!(
            "---\nid: 7\nct: 2026-01-01T00:00:00Z\nmt: 2026-01-01T00:00:00Z\ntags: []\nrefs: []\n---\n\n{}",
            memo.content
        );
        assert_eq!(memo.to_stored(), expected);
    }

    /// 解析含多行 refs 的 frontmatter
    #[test]
    fn test_parse_stored_with_refs() {
        let stored = format!(
            "---\nid: 50\nct: 2026-01-03T00:00:00Z\nmt: 2026-01-03T00:00:00Z\ntags: []\nrefs:\n  - 7\n  - 12\n---\n\n{}",
            wdf_stored("正文")
        );
        let memo = Memo::parse_stored(&stored).unwrap();
        assert_eq!(memo.refs, vec![MemoRef(7), MemoRef(12)]);
    }

    /// 缺 refs 字段：兼容旧文件，refs 默认空
    #[test]
    fn test_parse_stored_missing_refs_defaults_empty() {
        let stored = format!(
            "---\nid: 1\nct: 2026-01-01T00:00:00Z\nmt: 2026-01-01T00:00:00Z\ntags: []\n---\n\n{}",
            wdf_stored("正文")
        );
        let memo = Memo::parse_stored(&stored).unwrap();
        assert_eq!(memo.refs, Vec::<MemoRef>::new());
    }

    #[test]
    fn test_parse_stored_with_refs_before_tags() {
        let stored = format!(
            "---\nid: 8\nct: 2026-01-03T00:00:00Z\nmt: 2026-01-03T00:00:00Z\nrefs:\n  - 1\n  - 2\ntags:\n  - work/rust\n  - inbox\n---\n\n{}",
            wdf_stored("正文")
        );
        let memo = Memo::parse_stored(&stored).unwrap();
        assert_eq!(memo.refs, vec![MemoRef(1), MemoRef(2)]);
        assert_eq!(
            memo.tags,
            vec!["work/rust".to_string(), "inbox".to_string()]
        );
    }

    #[test]
    fn test_parse_stored_with_crlf_refs() {
        let stored = format!(
            "---\r\nid: 9\r\nct: 2026-01-03T00:00:00Z\r\nmt: 2026-01-03T00:00:00Z\r\ntags:\r\n  - work/windows\r\nrefs:\r\n  - 3\r\n  - 4\r\n---\r\n\r\n{}",
            wdf_stored("正文")
        );
        let memo = Memo::parse_stored(&stored).unwrap();
        assert_eq!(memo.tags, vec!["work/windows".to_string()]);
        assert_eq!(memo.refs, vec![MemoRef(3), MemoRef(4)]);
        assert_eq!(memo.content, wdf_stored("正文"));
    }

    #[test]
    fn test_parse_stored_invalid_refs_line_stops_refs_section() {
        let stored = format!(
            "---\nid: 10\nct: 2026-01-03T00:00:00Z\nmt: 2026-01-03T00:00:00Z\nrefs:\n  - 7\n  - nope\n  - 12\ntags:\n  - work/backend\n---\n\n{}",
            wdf_stored("正文")
        );
        let memo = Memo::parse_stored(&stored).unwrap();
        assert_eq!(memo.refs, vec![MemoRef(7)]);
        assert_eq!(memo.tags, vec!["work/backend".to_string()]);
    }

    #[test]
    fn test_parse_stored_non_list_refs_defaults_empty() {
        let stored = format!(
            "---\nid: 11\nct: 2026-01-03T00:00:00Z\nmt: 2026-01-03T00:00:00Z\ntags: []\nrefs: stale\n---\n\n{}",
            wdf_stored("正文")
        );
        let memo = Memo::parse_stored(&stored).unwrap();
        assert_eq!(memo.refs, Vec::<MemoRef>::new());
    }

    #[test]
    fn test_front_matter_serde_escapes_special_tags() {
        let memo = Memo {
            id: 3,
            ct_utc: OffsetDateTime::parse("2026-01-02T00:00:00Z", &Rfc3339).unwrap(),
            mt_utc: OffsetDateTime::parse("2026-01-02T00:00:00Z", &Rfc3339).unwrap(),
            tags: vec![
                "true".to_string(),
                "7".to_string(),
                "a: b".to_string(),
                "#hash".to_string(),
                "line\nbreak".to_string(),
            ],
            refs: vec![],
            content: wdf_stored("body"),
        };

        let stored = memo.to_stored();
        let parsed = Memo::parse_stored(&stored).expect("特殊 YAML 字符串应能往返");

        assert_eq!(parsed.tags, memo.tags);
        assert_eq!(parsed.content, memo.content);
    }

    #[test]
    fn test_front_matter_accepts_legacy_scalar_tags_and_unknown_fields() {
        let stored = format!(
            "---\nid: 4\nct: 2026-01-02T00:00:00Z\nmt: 2026-01-02T00:00:00Z\ntags:\n- true\n- 7\nrefs: []\nfuture: value\n---\n\n{}",
            wdf_stored("body")
        );

        let parsed = Memo::parse_stored(&stored).expect("兼容字段应保持可读");

        assert_eq!(parsed.tags, vec!["true".to_string(), "7".to_string()]);
    }
}
