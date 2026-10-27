use std::collections::{BTreeSet, HashMap};

use crate::data::{MemoId, MemoRef};

#[derive(Debug, Default)]
pub struct CrossRefIndex {
    outgoing: HashMap<MemoId, Vec<(String, MemoId)>>,
    incoming: HashMap<(String, MemoId), BTreeSet<MemoId>>,
}

impl CrossRefIndex {
    pub fn record_created(&mut self, id: MemoId, refs: &[MemoRef]) {
        self.set_outgoing(id, refs);
    }

    pub fn record_updated(&mut self, id: MemoId, refs: &[MemoRef]) {
        self.set_outgoing(id, refs);
    }

    pub fn record_deleted(&mut self, id: MemoId) {
        let Some(old) = self.outgoing.remove(&id) else {
            return;
        };
        for target in old {
            let should_remove = if let Some(set) = self.incoming.get_mut(&target) {
                set.remove(&id);
                set.is_empty()
            } else {
                false
            };
            if should_remove {
                self.incoming.remove(&target);
            }
        }
    }

    pub fn get_referenced_by(&self, username: &str, memo_id: MemoId) -> Vec<MemoId> {
        let mut ids = self
            .incoming
            .get(&(username.to_string(), memo_id))
            .map(|set| set.iter().copied().collect::<Vec<_>>())
            .unwrap_or_default();
        ids.sort_unstable_by(|a, b| b.cmp(a));
        ids
    }

    pub fn get_referenced_memo_ids(&self, username: &str) -> Vec<MemoId> {
        let mut ids = self
            .incoming
            .iter()
            .filter_map(|((target_username, memo_id), sources)| {
                (target_username == username && !sources.is_empty()).then_some(*memo_id)
            })
            .collect::<Vec<_>>();
        ids.sort_unstable_by(|a, b| b.cmp(a));
        ids
    }

    pub fn get_referrer_ids_for_target_user(&self, username: &str) -> Vec<MemoId> {
        let mut ids = self
            .outgoing
            .iter()
            .filter_map(|(id, targets)| {
                targets
                    .iter()
                    .any(|(target_username, _)| target_username == username)
                    .then_some(*id)
            })
            .collect::<Vec<_>>();
        ids.sort_unstable_by(|a, b| b.cmp(a));
        ids
    }

    fn set_outgoing(&mut self, id: MemoId, refs: &[MemoRef]) {
        self.record_deleted(id);

        let targets = refs
            .iter()
            .filter_map(|r| {
                r.friend_target()
                    .map(|(username, memo_id)| (username.to_string(), memo_id))
            })
            .collect::<Vec<_>>();

        if targets.is_empty() {
            return;
        }

        for target in &targets {
            self.incoming.entry(target.clone()).or_default().insert(id);
        }
        self.outgoing.insert(id, targets);
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn friend(username: &str, memo_id: MemoId) -> MemoRef {
        MemoRef::Friend {
            username: username.to_string(),
            memo_id,
        }
    }

    #[test]
    fn tracks_friend_ref_incoming_by_current_user_memo() {
        let mut index = CrossRefIndex::default();
        index.record_created(3, &[friend("bob", 7), MemoRef::Own(1)]);
        index.record_created(9, &[friend("bob", 7)]);

        assert_eq!(index.get_referenced_by("bob", 7), vec![9, 3]);
    }

    #[test]
    fn lists_friend_memo_ids_referenced_by_current_user() {
        let mut index = CrossRefIndex::default();
        index.record_created(3, &[friend("bob", 7), friend("bob", 8)]);
        index.record_created(9, &[friend("bob", 7)]);
        index.record_created(10, &[friend("carol", 7)]);

        assert_eq!(index.get_referenced_memo_ids("bob"), vec![8, 7]);
    }

    #[test]
    fn lists_current_user_memos_referencing_friend() {
        let mut index = CrossRefIndex::default();
        index.record_created(3, &[friend("bob", 7), friend("bob", 8)]);
        index.record_created(9, &[friend("carol", 7)]);
        index.record_created(10, &[MemoRef::Own(1)]);
        index.record_created(11, &[friend("bob", 9)]);

        assert_eq!(index.get_referrer_ids_for_target_user("bob"), vec![11, 3]);
    }

    #[test]
    fn update_removes_old_friend_targets() {
        let mut index = CrossRefIndex::default();
        index.record_created(3, &[friend("bob", 7)]);
        index.record_updated(3, &[friend("bob", 8)]);

        assert!(index.get_referenced_by("bob", 7).is_empty());
        assert_eq!(index.get_referenced_by("bob", 8), vec![3]);
    }

    #[test]
    fn delete_removes_only_current_user_memo_outgoing() {
        let mut index = CrossRefIndex::default();
        index.record_created(3, &[friend("bob", 7)]);
        index.record_created(9, &[friend("bob", 7)]);
        index.record_deleted(3);

        assert_eq!(index.get_referenced_by("bob", 7), vec![9]);
    }
}
