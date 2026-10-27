use base64::Engine as _;
use base64::engine::general_purpose::URL_SAFE_NO_PAD;
use serde::{Deserialize, Serialize};
use time::{Date, Month, OffsetDateTime};

use crate::data::{FriendMemoView, Memo, MemoId, MemoView};
use crate::error::{WeimoError, WeimoResult};

pub const DEFAULT_MEMO_SEARCH_PAGE_SIZE: usize = 20;
pub const MAX_MEMO_SEARCH_PAGE_SIZE: usize = 100;

#[derive(Debug, Clone, Copy, Default, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum CreatedAtSortOrder {
    #[default]
    Desc,
    Asc,
}

#[derive(Debug, Clone, Default, Serialize, Deserialize, PartialEq, Eq)]
pub struct MemoSearchQuery {
    pub tag: Option<String>,
    pub created_at: Option<MemoDateFilter>,
    pub text: Option<MemoTextFilter>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub has_annotation: Option<bool>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub has_markdown_quote: Option<bool>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub has_heading: Option<bool>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub has_unordered_list: Option<bool>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub has_no_tag: Option<bool>,
    #[serde(default)]
    pub created_at_sort: CreatedAtSortOrder,
}

impl MemoSearchQuery {
    pub fn validate(&self) -> WeimoResult<()> {
        if let Some(filter) = &self.created_at {
            filter.validate()?;
        }
        Ok(())
    }

    pub fn matches(&self, memo: &Memo) -> bool {
        self.matches_tag(memo)
            && self.matches_no_tag(memo)
            && self.matches_created_at(memo)
            && self.matches_text(memo)
            && self.matches_markdown_quote(memo)
            && self.matches_heading(memo)
            && self.matches_unordered_list(memo)
    }

    fn matches_tag(&self, memo: &Memo) -> bool {
        let Some(tag) = self.tag.as_deref().filter(|tag| !tag.is_empty()) else {
            return true;
        };

        memo.tags().iter().any(|memo_tag| {
            memo_tag == tag
                || memo_tag
                    .strip_prefix(tag)
                    .is_some_and(|suffix| suffix.starts_with('/'))
        })
    }

    fn matches_no_tag(&self, memo: &Memo) -> bool {
        if self.has_no_tag == Some(true) {
            return memo.tags().is_empty();
        }
        true
    }

    fn matches_created_at(&self, memo: &Memo) -> bool {
        let Some(filter) = &self.created_at else {
            return true;
        };

        filter.matches(memo)
    }

    fn matches_text(&self, memo: &Memo) -> bool {
        let Some(text) = &self.text else {
            return true;
        };

        text.matches(memo.content())
    }

    fn matches_markdown_quote(&self, memo: &Memo) -> bool {
        match self.has_markdown_quote {
            Some(true) => memo.content().lines().any(|line| {
                let trimmed = line.trim_start();
                trimmed == ">"
                    || trimmed.starts_with("> ")
                    || trimmed == ">="
                    || trimmed.starts_with(">= ")
            }),
            _ => true,
        }
    }

    fn matches_heading(&self, memo: &Memo) -> bool {
        match self.has_heading {
            Some(true) => memo.content().lines().any(|line| {
                let trimmed = line.trim_start();
                let hashes = trimmed.chars().take_while(|c| *c == '#').count();
                if !(1..=6).contains(&hashes) {
                    return false;
                }
                let after = &trimmed[hashes..];
                after.is_empty() || after.starts_with(' ')
            }),
            _ => true,
        }
    }

    fn matches_unordered_list(&self, memo: &Memo) -> bool {
        match self.has_unordered_list {
            Some(true) => memo.content().lines().any(|line| {
                let trimmed = line.trim_start();
                let mut chars = trimmed.chars();
                let marker = match chars.next() {
                    Some(c) if c == '*' || c == '+' || c == '-' => c,
                    _ => return false,
                };
                // Require space after marker so plain dashes / horizontal rules don't match
                matches!(chars.next(), Some(' ') | Some('\t'))
                    && !is_horizontal_rule(trimmed, marker)
            }),
            _ => true,
        }
    }
}

fn is_horizontal_rule(line: &str, marker: char) -> bool {
    if marker != '*' && marker != '-' {
        return false;
    }
    let count = line.chars().filter(|c| *c == marker).count();
    count >= 3 && line.chars().all(|c| c == marker || c == ' ' || c == '\t')
}

#[derive(Debug, Clone, Default, Serialize, Deserialize, PartialEq, Eq)]
pub struct MemoSearchRequest {
    #[serde(flatten)]
    pub query: MemoSearchQuery,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub cursor: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub page_size: Option<usize>,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct MemoSearchHit {
    pub id: MemoId,
    pub created_at_utc: OffsetDateTime,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct MemoSearchSlice {
    pub ids: Vec<MemoId>,
    pub next_cursor: Option<String>,
    pub has_more: bool,
    pub total_count: usize,
}

impl MemoSearchRequest {
    pub fn validate(&self) -> WeimoResult<()> {
        self.query.validate()?;
        if let Some(cursor) = &self.cursor {
            MemoSearchCursor::decode(cursor)?;
        }
        Ok(())
    }

    pub fn resolved_page_size(&self) -> usize {
        self.page_size
            .unwrap_or(DEFAULT_MEMO_SEARCH_PAGE_SIZE)
            .clamp(1, MAX_MEMO_SEARCH_PAGE_SIZE)
    }

    pub fn paginate_hits(&self, hits: Vec<MemoSearchHit>) -> WeimoResult<MemoSearchSlice> {
        let total_count = hits.len();
        let page_size = self.resolved_page_size();
        let sort_order = self.query.created_at_sort;
        let start_index = match self.cursor.as_deref() {
            Some(raw_cursor) => {
                let cursor = MemoSearchCursor::decode(raw_cursor)?;
                if cursor.order != sort_order {
                    return Err(WeimoError::InvalidSearchQuery(
                        "排序与游标不匹配".to_string(),
                    ));
                }
                hits.iter()
                    .position(|hit| cursor.should_include_hit(hit))
                    .unwrap_or(total_count)
            }
            None => 0,
        };
        let page_hits = hits
            .into_iter()
            .skip(start_index)
            .take(page_size)
            .collect::<Vec<_>>();
        let has_more = start_index.saturating_add(page_hits.len()) < total_count;
        let next_cursor = if has_more {
            page_hits
                .last()
                .map(|hit| MemoSearchCursor::encode_from_hit(hit, sort_order))
                .transpose()?
        } else {
            None
        };

        Ok(MemoSearchSlice {
            ids: page_hits.into_iter().map(|hit| hit.id).collect(),
            next_cursor,
            has_more,
            total_count,
        })
    }
}

#[derive(Debug, Serialize)]
pub struct MemoSearchPage {
    pub items: Vec<MemoView>,
    pub next_cursor: Option<String>,
    pub has_more: bool,
    pub total_count: usize,
}

#[derive(Debug, Clone, Default, Serialize, Deserialize, PartialEq, Eq)]
pub struct FriendMemoSearchRequest {
    #[serde(flatten)]
    pub query: MemoSearchQuery,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub cursor: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub page_size: Option<usize>,
}

impl FriendMemoSearchRequest {
    pub fn validate(&self) -> WeimoResult<()> {
        self.query.validate()?;
        if let Some(cursor) = &self.cursor {
            MemoSearchCursor::decode(cursor)?;
        }
        Ok(())
    }

    pub fn paginate_hits(&self, hits: Vec<MemoSearchHit>) -> WeimoResult<MemoSearchSlice> {
        MemoSearchRequest {
            query: self.query.clone(),
            cursor: self.cursor.clone(),
            page_size: self.page_size,
        }
        .paginate_hits(hits)
    }
}

#[derive(Debug, Serialize)]
pub struct FriendMemoSearchPage {
    pub items: Vec<FriendMemoView>,
    pub next_cursor: Option<String>,
    pub has_more: bool,
    pub total_count: usize,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
struct MemoSearchCursorPayload {
    ts_nanos: i128,
    id: MemoId,
    #[serde(default)]
    order: CreatedAtSortOrder,
}

#[derive(Debug, Clone, PartialEq, Eq)]
struct MemoSearchCursor {
    ts_nanos: i128,
    id: MemoId,
    order: CreatedAtSortOrder,
}

impl MemoSearchCursor {
    fn encode_from_hit(hit: &MemoSearchHit, order: CreatedAtSortOrder) -> WeimoResult<String> {
        Self {
            ts_nanos: hit.created_at_utc.unix_timestamp_nanos(),
            id: hit.id,
            order,
        }
        .encode()
    }

    fn encode(&self) -> WeimoResult<String> {
        let payload = MemoSearchCursorPayload {
            ts_nanos: self.ts_nanos,
            id: self.id,
            order: self.order,
        };
        let bytes = serde_json::to_vec(&payload)
            .map_err(|_| WeimoError::InvalidSearchQuery("非法游标".to_string()))?;
        Ok(URL_SAFE_NO_PAD.encode(bytes))
    }

    fn decode(raw: &str) -> WeimoResult<Self> {
        let bytes = URL_SAFE_NO_PAD
            .decode(raw)
            .map_err(|_| WeimoError::InvalidSearchQuery("非法游标".to_string()))?;
        let payload: MemoSearchCursorPayload = serde_json::from_slice(&bytes)
            .map_err(|_| WeimoError::InvalidSearchQuery("非法游标".to_string()))?;
        Ok(Self {
            ts_nanos: payload.ts_nanos,
            id: payload.id,
            order: payload.order,
        })
    }

    fn should_include_hit(&self, hit: &MemoSearchHit) -> bool {
        let memo_key = (hit.created_at_utc.unix_timestamp_nanos(), hit.id);
        let cursor_key = (self.ts_nanos, self.id);
        match self.order {
            CreatedAtSortOrder::Desc => memo_key < cursor_key,
            CreatedAtSortOrder::Asc => memo_key > cursor_key,
        }
    }
}

impl MemoSearchHit {
    pub fn from_memo(memo: &Memo) -> Self {
        Self {
            id: *memo.id(),
            created_at_utc: memo.create_t_utc(),
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(tag = "kind", rename_all = "lowercase")]
pub enum MemoDateFilter {
    Day { year: i32, month: u8, day: u8 },
    Month { year: i32, month: u8 },
    Year { year: i32 },
}

impl MemoDateFilter {
    pub fn validate(&self) -> WeimoResult<()> {
        match self {
            Self::Day { year, month, day } => {
                let month_value = *month;
                let month = Self::parse_month(month_value)?;
                Date::from_calendar_date(*year, month, *day).map_err(|_| {
                    WeimoError::InvalidSearchQuery(format!(
                        "非法日期: {year:04}-{month:02}-{day:02}",
                        month = month_value,
                        day = *day
                    ))
                })?;
            }
            Self::Month { year, month } => {
                let _ = year;
                Self::parse_month(*month)?;
            }
            Self::Year { .. } => {}
        }

        Ok(())
    }

    pub fn matches(&self, memo: &Memo) -> bool {
        // Keep date filters aligned with workspace stats / heatmap, which group notes by local date.
        self.matches_local_datetime(memo.create_t())
    }

    fn matches_local_datetime(&self, created_at: OffsetDateTime) -> bool {
        match self {
            Self::Day { year, month, day } => {
                created_at.year() == *year
                    && u8::from(created_at.month()) == *month
                    && created_at.day() == *day
            }
            Self::Month { year, month } => {
                created_at.year() == *year && u8::from(created_at.month()) == *month
            }
            Self::Year { year } => created_at.year() == *year,
        }
    }

    fn parse_month(month: u8) -> WeimoResult<Month> {
        Month::try_from(month).map_err(|_| {
            WeimoError::InvalidSearchQuery(format!("非法月份: {month}，必须在 1..=12 之间"))
        })
    }
}

#[derive(Debug, Clone, Default, Serialize, Deserialize, PartialEq, Eq)]
pub struct MemoTextFilter {
    pub contains: String,
}

impl MemoTextFilter {
    pub fn matches(&self, content: &str) -> bool {
        if self.contains.is_empty() {
            return true;
        }

        content
            .to_lowercase()
            .contains(&self.contains.to_lowercase())
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn test_memo(id: u32, ct: &str, tags: &[&str], content: &str) -> Memo {
        let tags = if tags.is_empty() {
            "tags: []".to_string()
        } else {
            let items = tags
                .iter()
                .map(|tag| format!("  - {tag}"))
                .collect::<Vec<_>>()
                .join("\n");
            format!("tags:\n{items}")
        };

        let markdown = format!("---\nid: {id}\nct: {ct}\nmt: {ct}\n{tags}\n---\n\n{content}");

        Memo::parse_markdown(&markdown).expect("测试数据应能解析为 Memo")
    }

    #[test]
    fn test_empty_query_matches_all() {
        let memo = test_memo(1, "2026-03-25T08:00:00Z", &["work/rust"], "Axum Search");
        let query = MemoSearchQuery::default();

        assert!(query.matches(&memo));
        assert!(query.validate().is_ok());
    }

    #[test]
    fn test_day_filter_matches() {
        let memo = test_memo(1, "2026-03-25T08:00:00Z", &["work/rust"], "Axum Search");
        let query = MemoSearchQuery {
            created_at: Some(MemoDateFilter::Day {
                year: 2026,
                month: 3,
                day: 25,
            }),
            ..MemoSearchQuery::default()
        };

        assert!(query.matches(&memo));
    }

    #[test]
    fn test_month_filter_matches() {
        let memo = test_memo(1, "2026-03-25T08:00:00Z", &["work/rust"], "Axum Search");
        let query = MemoSearchQuery {
            created_at: Some(MemoDateFilter::Month {
                year: 2026,
                month: 3,
            }),
            ..MemoSearchQuery::default()
        };

        assert!(query.matches(&memo));
    }

    #[test]
    fn test_year_filter_matches() {
        let memo = test_memo(1, "2026-03-25T08:00:00Z", &["work/rust"], "Axum Search");
        let query = MemoSearchQuery {
            created_at: Some(MemoDateFilter::Year { year: 2026 }),
            ..MemoSearchQuery::default()
        };

        assert!(query.matches(&memo));
    }

    #[test]
    fn test_date_filter_matches_local_date_boundary() {
        let created_at = Date::from_calendar_date(2026, Month::April, 18)
            .expect("日期有效")
            .with_hms(0, 30, 0)
            .expect("时间有效")
            .assume_offset(time::UtcOffset::from_hms(8, 0, 0).expect("时区有效"));

        let local_day = MemoDateFilter::Day {
            year: 2026,
            month: 4,
            day: 18,
        };
        let utc_day = MemoDateFilter::Day {
            year: 2026,
            month: 4,
            day: 17,
        };

        assert!(local_day.matches_local_datetime(created_at));
        assert!(!utc_day.matches_local_datetime(created_at));
    }

    #[test]
    fn test_text_filter_is_case_insensitive() {
        let memo = test_memo(1, "2026-03-25T08:00:00Z", &["work/rust"], "Axum Search");
        let query = MemoSearchQuery {
            text: Some(MemoTextFilter {
                contains: "axum".to_string(),
            }),
            ..MemoSearchQuery::default()
        };

        assert!(query.matches(&memo));
    }

    #[test]
    fn test_combined_filters_use_and() {
        let memo = test_memo(1, "2026-03-25T08:00:00Z", &["work/rust"], "Axum Search");
        let query = MemoSearchQuery {
            tag: Some("work".to_string()),
            created_at: Some(MemoDateFilter::Month {
                year: 2026,
                month: 3,
            }),
            text: Some(MemoTextFilter {
                contains: "missing".to_string(),
            }),
            ..MemoSearchQuery::default()
        };

        assert!(!query.matches(&memo));
    }

    #[test]
    fn test_tag_filter_matches_nested_tags() {
        let memo = test_memo(1, "2026-03-25T08:00:00Z", &["work/rust"], "Axum Search");
        let query = MemoSearchQuery {
            tag: Some("work".to_string()),
            ..MemoSearchQuery::default()
        };

        assert!(query.matches(&memo));
    }

    #[test]
    fn test_empty_text_filter_is_ignored() {
        let memo = test_memo(1, "2026-03-25T08:00:00Z", &["work/rust"], "Axum Search");
        let query = MemoSearchQuery {
            text: Some(MemoTextFilter {
                contains: String::new(),
            }),
            ..MemoSearchQuery::default()
        };

        assert!(query.matches(&memo));
    }

    #[test]
    fn test_validate_rejects_invalid_month() {
        let query = MemoSearchQuery {
            created_at: Some(MemoDateFilter::Month {
                year: 2026,
                month: 13,
            }),
            ..MemoSearchQuery::default()
        };

        assert!(matches!(
            query.validate(),
            Err(WeimoError::InvalidSearchQuery(_))
        ));
    }

    #[test]
    fn test_validate_rejects_invalid_day() {
        let query = MemoSearchQuery {
            created_at: Some(MemoDateFilter::Day {
                year: 2026,
                month: 2,
                day: 30,
            }),
            ..MemoSearchQuery::default()
        };

        assert!(matches!(
            query.validate(),
            Err(WeimoError::InvalidSearchQuery(_))
        ));
    }

    #[test]
    fn test_friend_search_request_deserializes_flat_filters() {
        let request: FriendMemoSearchRequest = serde_json::from_value(serde_json::json!({
            "page_size": 8,
            "tag": "work",
            "created_at": { "kind": "day", "year": 2026, "month": 5, "day": 1 }
        }))
        .expect("friend search request should parse flat filters");

        assert_eq!(request.page_size, Some(8));
        assert_eq!(request.query.tag.as_deref(), Some("work"));
        assert_eq!(
            request.query.created_at,
            Some(MemoDateFilter::Day {
                year: 2026,
                month: 5,
                day: 1,
            })
        );
    }

    #[test]
    fn test_friend_search_request_rejects_invalid_date_filter() {
        let request: FriendMemoSearchRequest = serde_json::from_value(serde_json::json!({
            "created_at": { "kind": "day", "year": 2026, "month": 2, "day": 30 }
        }))
        .expect("serde accepts shape before domain validation");

        assert!(matches!(
            request.validate(),
            Err(WeimoError::InvalidSearchQuery(_))
        ));
    }

    #[test]
    fn test_request_clamps_page_size() {
        let request = MemoSearchRequest {
            page_size: Some(MAX_MEMO_SEARCH_PAGE_SIZE + 100),
            ..MemoSearchRequest::default()
        };

        assert_eq!(request.resolved_page_size(), MAX_MEMO_SEARCH_PAGE_SIZE);
    }

    #[test]
    fn test_paginate_uses_cursor() {
        let memos = [
            test_memo(4, "2026-03-28T08:00:00Z", &["work"], "latest"),
            test_memo(3, "2026-03-27T08:00:00Z", &["work"], "newer"),
            test_memo(2, "2026-03-26T08:00:00Z", &["work"], "older"),
            test_memo(1, "2026-03-25T08:00:00Z", &["work"], "oldest"),
        ];
        let hits: Vec<MemoSearchHit> = memos.iter().map(MemoSearchHit::from_memo).collect();

        let first_slice = MemoSearchRequest {
            page_size: Some(2),
            ..MemoSearchRequest::default()
        }
        .paginate_hits(hits.clone())
        .expect("应能分页");

        assert_eq!(first_slice.ids.len(), 2);
        assert!(first_slice.has_more);

        let second_slice = MemoSearchRequest {
            cursor: first_slice.next_cursor,
            page_size: Some(2),
            ..MemoSearchRequest::default()
        }
        .paginate_hits(hits)
        .expect("应能拿到下一页");

        assert_eq!(second_slice.ids, vec![2, 1]);
        assert!(!second_slice.has_more);
        assert!(second_slice.next_cursor.is_none());
    }

    #[test]
    fn test_paginate_uses_cursor_asc() {
        let memos = [
            test_memo(1, "2026-03-25T08:00:00Z", &["work"], "oldest"),
            test_memo(2, "2026-03-26T08:00:00Z", &["work"], "older"),
            test_memo(3, "2026-03-27T08:00:00Z", &["work"], "newer"),
            test_memo(4, "2026-03-28T08:00:00Z", &["work"], "latest"),
        ];
        let hits: Vec<MemoSearchHit> = memos.iter().map(MemoSearchHit::from_memo).collect();

        let first_slice = MemoSearchRequest {
            query: MemoSearchQuery {
                created_at_sort: CreatedAtSortOrder::Asc,
                ..MemoSearchQuery::default()
            },
            page_size: Some(2),
            ..MemoSearchRequest::default()
        }
        .paginate_hits(hits.clone())
        .expect("应能分页");

        assert_eq!(first_slice.ids, vec![1, 2]);
        assert!(first_slice.has_more);

        let second_slice = MemoSearchRequest {
            query: MemoSearchQuery {
                created_at_sort: CreatedAtSortOrder::Asc,
                ..MemoSearchQuery::default()
            },
            cursor: first_slice.next_cursor,
            page_size: Some(2),
        }
        .paginate_hits(hits)
        .expect("应能拿到下一页");

        assert_eq!(second_slice.ids, vec![3, 4]);
        assert!(!second_slice.has_more);
    }

    #[test]
    fn test_paginate_rejects_cursor_when_sort_order_mismatch() {
        let memos = [
            test_memo(4, "2026-03-28T08:00:00Z", &["work"], "latest"),
            test_memo(3, "2026-03-27T08:00:00Z", &["work"], "newer"),
            test_memo(2, "2026-03-26T08:00:00Z", &["work"], "older"),
            test_memo(1, "2026-03-25T08:00:00Z", &["work"], "oldest"),
        ];
        let hits: Vec<MemoSearchHit> = memos.iter().map(MemoSearchHit::from_memo).collect();

        let desc_cursor = MemoSearchRequest {
            page_size: Some(2),
            ..MemoSearchRequest::default()
        }
        .paginate_hits(hits.clone())
        .expect("desc 第一页")
        .next_cursor
        .expect("应有游标");

        let err = MemoSearchRequest {
            query: MemoSearchQuery {
                created_at_sort: CreatedAtSortOrder::Asc,
                ..MemoSearchQuery::default()
            },
            cursor: Some(desc_cursor),
            page_size: Some(2),
        }
        .paginate_hits(hits)
        .expect_err("升序请求不得复用降序游标");

        assert!(matches!(err, WeimoError::InvalidSearchQuery(_)));
    }

    #[test]
    fn test_validate_rejects_invalid_cursor() {
        let request = MemoSearchRequest {
            cursor: Some("not-a-valid-cursor".to_string()),
            ..MemoSearchRequest::default()
        };

        assert!(matches!(
            request.validate(),
            Err(WeimoError::InvalidSearchQuery(_))
        ));
    }

    #[test]
    fn test_has_markdown_quote_matches_blockquote() {
        let memo = test_memo(1, "2026-03-25T08:00:00Z", &[], "hello\n> quoted line\nend");
        let query = MemoSearchQuery {
            has_markdown_quote: Some(true),
            ..MemoSearchQuery::default()
        };
        assert!(query.matches(&memo));
    }

    #[test]
    fn test_has_markdown_quote_matches_centered_quote() {
        let memo = test_memo(1, "2026-03-25T08:00:00Z", &[], "hello\n>= centered\nend");
        let query = MemoSearchQuery {
            has_markdown_quote: Some(true),
            ..MemoSearchQuery::default()
        };
        assert!(query.matches(&memo));
    }

    #[test]
    fn test_has_markdown_quote_rejects_no_quote() {
        let memo = test_memo(
            1,
            "2026-03-25T08:00:00Z",
            &[],
            "hello world\nno quotes here",
        );
        let query = MemoSearchQuery {
            has_markdown_quote: Some(true),
            ..MemoSearchQuery::default()
        };
        assert!(!query.matches(&memo));
    }

    #[test]
    fn test_has_markdown_quote_none_matches_all() {
        let memo = test_memo(1, "2026-03-25T08:00:00Z", &[], "no quotes");
        let query = MemoSearchQuery {
            has_markdown_quote: None,
            ..MemoSearchQuery::default()
        };
        assert!(query.matches(&memo));
    }

    #[test]
    fn test_has_markdown_quote_bare_gt_matches() {
        let memo = test_memo(1, "2026-03-25T08:00:00Z", &[], "line1\n>\nline3");
        let query = MemoSearchQuery {
            has_markdown_quote: Some(true),
            ..MemoSearchQuery::default()
        };
        assert!(query.matches(&memo));
    }

    #[test]
    fn test_has_markdown_quote_gt_without_space_does_not_match() {
        let memo = test_memo(1, "2026-03-25T08:00:00Z", &[], ">nospace");
        let query = MemoSearchQuery {
            has_markdown_quote: Some(true),
            ..MemoSearchQuery::default()
        };
        assert!(!query.matches(&memo));
    }

    #[test]
    fn test_has_heading_matches_atx_heading() {
        let memo = test_memo(1, "2026-03-25T08:00:00Z", &[], "body\n# Title\nend");
        let query = MemoSearchQuery {
            has_heading: Some(true),
            ..MemoSearchQuery::default()
        };
        assert!(query.matches(&memo));
    }

    #[test]
    fn test_has_heading_matches_multi_level() {
        let memo = test_memo(1, "2026-03-25T08:00:00Z", &[], "### Section\nbody");
        let query = MemoSearchQuery {
            has_heading: Some(true),
            ..MemoSearchQuery::default()
        };
        assert!(query.matches(&memo));
    }

    #[test]
    fn test_has_heading_rejects_more_than_six_hashes() {
        let memo = test_memo(1, "2026-03-25T08:00:00Z", &[], "####### too many");
        let query = MemoSearchQuery {
            has_heading: Some(true),
            ..MemoSearchQuery::default()
        };
        assert!(!query.matches(&memo));
    }

    #[test]
    fn test_has_heading_rejects_hash_without_space() {
        let memo = test_memo(1, "2026-03-25T08:00:00Z", &[], "#tag\nbody");
        let query = MemoSearchQuery {
            has_heading: Some(true),
            ..MemoSearchQuery::default()
        };
        assert!(!query.matches(&memo));
    }

    #[test]
    fn test_has_heading_rejects_when_none() {
        let memo = test_memo(1, "2026-03-25T08:00:00Z", &[], "plain text");
        let query = MemoSearchQuery {
            has_heading: Some(true),
            ..MemoSearchQuery::default()
        };
        assert!(!query.matches(&memo));
    }

    #[test]
    fn test_has_unordered_list_matches_dash() {
        let memo = test_memo(
            1,
            "2026-03-25T08:00:00Z",
            &[],
            "intro\n- item one\n- item two",
        );
        let query = MemoSearchQuery {
            has_unordered_list: Some(true),
            ..MemoSearchQuery::default()
        };
        assert!(query.matches(&memo));
    }

    #[test]
    fn test_has_unordered_list_matches_asterisk() {
        let memo = test_memo(1, "2026-03-25T08:00:00Z", &[], "* item");
        let query = MemoSearchQuery {
            has_unordered_list: Some(true),
            ..MemoSearchQuery::default()
        };
        assert!(query.matches(&memo));
    }

    #[test]
    fn test_has_unordered_list_matches_plus() {
        let memo = test_memo(1, "2026-03-25T08:00:00Z", &[], "+ item");
        let query = MemoSearchQuery {
            has_unordered_list: Some(true),
            ..MemoSearchQuery::default()
        };
        assert!(query.matches(&memo));
    }

    #[test]
    fn test_has_unordered_list_rejects_horizontal_rule() {
        let memo = test_memo(1, "2026-03-25T08:00:00Z", &[], "before\n---\nafter");
        let query = MemoSearchQuery {
            has_unordered_list: Some(true),
            ..MemoSearchQuery::default()
        };
        assert!(!query.matches(&memo));
    }

    #[test]
    fn test_has_unordered_list_rejects_ordered_list() {
        let memo = test_memo(1, "2026-03-25T08:00:00Z", &[], "1. item");
        let query = MemoSearchQuery {
            has_unordered_list: Some(true),
            ..MemoSearchQuery::default()
        };
        assert!(!query.matches(&memo));
    }

    #[test]
    fn test_has_unordered_list_rejects_dash_without_space() {
        let memo = test_memo(1, "2026-03-25T08:00:00Z", &[], "-nodash");
        let query = MemoSearchQuery {
            has_unordered_list: Some(true),
            ..MemoSearchQuery::default()
        };
        assert!(!query.matches(&memo));
    }
}
