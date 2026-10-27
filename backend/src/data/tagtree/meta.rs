use serde::{Deserialize, Serialize};
use tagtree::TagNode;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TreeMeta {
    pub label: String,
    pub tag: String,
    pub item_count: usize,
    pub children: Vec<TreeMeta>,
    #[serde(default, skip_serializing_if = "is_zero")]
    pub untagged_count: usize,
}

fn is_zero(v: &usize) -> bool {
    *v == 0
}

impl From<TagNode> for TreeMeta {
    fn from(view: TagNode) -> Self {
        Self {
            label: view.name,
            tag: view.path,
            item_count: view.item_count,
            children: view.children.into_iter().map(Self::from).collect(),
            untagged_count: 0,
        }
    }
}
