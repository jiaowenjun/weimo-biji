use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use tagtree::TagTree;

use crate::data::{Db, MemoDb, MemoId, UserDb};

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct Stats {
    pub note_count: usize,
    pub tag_count: usize,
    pub word_count: usize,
    pub daily_note_count: Vec<(u32, usize)>,
}

impl Stats {
    pub async fn build<U: UserDb, M: MemoDb>(
        username: &str,
        tag_tree: &TagTree<MemoId>,
        db: &Db<U, M>,
    ) -> Self {
        let ids = tag_tree.items_under("").unwrap();
        let summary = tag_tree.summary();

        let note_count = ids.len();
        let tag_count = summary.populated_path_count;

        let mut word_count = 0;
        let mut map = HashMap::<u32, usize>::new();

        for id in ids {
            if let Ok(memo) = db.get_memo(username, &id).await {
                word_count += memo.word_cnt();
                let ct = memo.create_t();
                let date = ct.year() as u32 * 10000 + ct.month() as u32 * 100 + ct.day() as u32;
                *map.entry(date).or_insert(0) += 1;
            }
        }

        let mut daily_note_count = map.into_iter().collect::<Vec<_>>();
        daily_note_count.sort_unstable_by_key(|(date, _)| *date);

        Stats {
            note_count,
            tag_count,
            word_count,
            daily_note_count,
        }
    }
}
