use std::collections::{HashMap, HashSet};

use time::OffsetDateTime;

use crate::data::MemoId;

/// 笔记引用关系内存索引：outgoing / incoming / ct_index 三张表，不持久化。
#[derive(Debug, Default)]
pub struct RefIndex {
    outgoing: HashMap<MemoId, Vec<MemoId>>,
    incoming: HashMap<MemoId, HashSet<MemoId>>,
    ct_index: HashMap<MemoId, OffsetDateTime>,
}

impl RefIndex {
    pub fn record_created(&mut self, id: MemoId, ct: OffsetDateTime, refs: &[MemoId]) {
        self.ct_index.insert(id, ct);
        self.set_outgoing(id, refs);
    }

    pub fn record_updated(&mut self, id: MemoId, refs: &[MemoId]) {
        self.set_outgoing(id, refs);
    }

    pub fn record_deleted(&mut self, id: MemoId) {
        if let Some(prev) = self.outgoing.remove(&id) {
            for target in prev {
                if let Some(set) = self.incoming.get_mut(&target) {
                    set.remove(&id);
                }
            }
        }
        self.incoming.remove(&id);
        self.ct_index.remove(&id);
    }

    #[cfg(test)]
    pub fn get_refs(&self, id: MemoId) -> &[MemoId] {
        self.outgoing.get(&id).map(Vec::as_slice).unwrap_or(&[])
    }

    /// 返回引用本笔记的 ID 列表，按 id 倒序。
    pub fn get_referenced_by(&self, id: MemoId) -> Vec<MemoId> {
        let mut ids: Vec<MemoId> = self
            .incoming
            .get(&id)
            .map(|set| set.iter().copied().collect())
            .unwrap_or_default();
        ids.sort_unstable_by(|a, b| b.cmp(a));
        ids
    }

    pub fn contains(&self, id: MemoId) -> bool {
        self.ct_index.contains_key(&id)
    }

    pub fn ct_of(&self, id: MemoId) -> Option<OffsetDateTime> {
        self.ct_index.get(&id).copied()
    }

    /// Returns the set of memo IDs that participate in any annotation relationship
    /// (either have outgoing refs or are referenced by another memo).
    pub fn annotated_memo_ids(&self) -> HashSet<MemoId> {
        let mut ids = HashSet::new();
        for (id, targets) in &self.outgoing {
            if !targets.is_empty() {
                ids.insert(*id);
            }
        }
        for (target, sources) in &self.incoming {
            if !sources.is_empty() {
                ids.insert(*target);
            }
        }
        ids
    }

    fn set_outgoing(&mut self, id: MemoId, new_refs: &[MemoId]) {
        let old = self
            .outgoing
            .insert(id, new_refs.to_vec())
            .unwrap_or_default();
        for target in &old {
            if let Some(set) = self.incoming.get_mut(target) {
                set.remove(&id);
            }
        }
        for target in new_refs {
            self.incoming.entry(*target).or_default().insert(id);
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use time::format_description::well_known::Rfc3339;

    fn ts(s: &str) -> OffsetDateTime {
        OffsetDateTime::parse(s, &Rfc3339).unwrap()
    }

    #[test]
    fn test_record_created_populates_outgoing_and_incoming() {
        let mut idx = RefIndex::default();
        idx.record_created(1, ts("2026-01-01T00:00:00Z"), &[]);
        idx.record_created(2, ts("2026-01-02T00:00:00Z"), &[1]);
        idx.record_created(3, ts("2026-01-03T00:00:00Z"), &[1, 2]);

        assert_eq!(idx.get_refs(3), &[1, 2]);
        assert_eq!(idx.get_referenced_by(1), vec![3, 2]);
        assert_eq!(idx.get_referenced_by(2), vec![3]);
        assert!(idx.contains(2));
        assert_eq!(idx.ct_of(2), Some(ts("2026-01-02T00:00:00Z")));
    }

    #[test]
    fn test_record_updated_swaps_incoming() {
        let mut idx = RefIndex::default();
        idx.record_created(1, ts("2026-01-01T00:00:00Z"), &[]);
        idx.record_created(2, ts("2026-01-02T00:00:00Z"), &[]);
        idx.record_created(3, ts("2026-01-03T00:00:00Z"), &[1]);

        idx.record_updated(3, &[2]);

        assert_eq!(idx.get_refs(3), &[2]);
        assert!(idx.get_referenced_by(1).is_empty());
        assert_eq!(idx.get_referenced_by(2), vec![3]);
    }

    #[test]
    fn test_record_deleted_clears_both_directions() {
        let mut idx = RefIndex::default();
        idx.record_created(1, ts("2026-01-01T00:00:00Z"), &[]);
        idx.record_created(2, ts("2026-01-02T00:00:00Z"), &[1]);
        idx.record_created(3, ts("2026-01-03T00:00:00Z"), &[2]);

        idx.record_deleted(2);

        assert!(!idx.contains(2));
        assert_eq!(idx.get_refs(2), &[] as &[MemoId]);
        assert!(idx.get_referenced_by(1).is_empty());
        // 注：3 仍然 outgoing 含 2（悬挂指针），那是 DataManager 级联清理的责任
        assert_eq!(idx.get_refs(3), &[2]);
    }

    #[test]
    fn test_record_updated_to_empty_clears_incoming() {
        let mut idx = RefIndex::default();
        idx.record_created(1, ts("2026-01-01T00:00:00Z"), &[]);
        idx.record_created(2, ts("2026-01-02T00:00:00Z"), &[1]);

        idx.record_updated(2, &[]);

        assert_eq!(idx.get_refs(2), &[] as &[MemoId]);
        assert!(idx.get_referenced_by(1).is_empty());
    }

    #[test]
    fn test_unknown_id_lookups_return_empty() {
        let idx = RefIndex::default();
        assert_eq!(idx.get_refs(99), &[] as &[MemoId]);
        assert!(idx.get_referenced_by(99).is_empty());
        assert!(!idx.contains(99));
        assert!(idx.ct_of(99).is_none());
    }

    #[test]
    fn test_annotated_memo_ids_returns_outgoing_and_incoming() {
        let mut idx = RefIndex::default();
        idx.record_created(1, ts("2026-01-01T00:00:00Z"), &[]);
        idx.record_created(2, ts("2026-01-02T00:00:00Z"), &[1]);
        idx.record_created(3, ts("2026-01-03T00:00:00Z"), &[]);
        idx.record_created(4, ts("2026-01-04T00:00:00Z"), &[3, 1]);

        let ids = idx.annotated_memo_ids();

        assert!(ids.contains(&1)); // incoming
        assert!(ids.contains(&2)); // outgoing
        assert!(ids.contains(&3)); // incoming
        assert!(ids.contains(&4)); // outgoing
    }

    #[test]
    fn test_annotated_memo_ids_empty_when_no_refs() {
        let mut idx = RefIndex::default();
        idx.record_created(1, ts("2026-01-01T00:00:00Z"), &[]);
        idx.record_created(2, ts("2026-01-02T00:00:00Z"), &[]);

        let ids = idx.annotated_memo_ids();
        assert!(ids.is_empty());
    }
}
