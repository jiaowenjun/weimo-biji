use crate::data::{
    CreatedAtSortOrder, Memo, MemoCreate, MemoId, MemoSearchHit, MemoSearchQuery, MemoUpdate,
};
use crate::error::WeimoResult;

/// 异步笔记数据库操作接口
#[async_trait::async_trait]
pub trait MemoDb: Send + Sync + Clone {
    /// 创建笔记
    ///
    /// 返回:
    /// * 成功 - Ok(Memo)
    /// * 错误 - 用户不存在/数据库错误
    async fn create(&mut self, user: &str, info: MemoCreate, id: MemoId) -> WeimoResult<Memo>;

    /// 删除笔记
    ///
    /// 返回:
    /// * 成功 - Ok(Memo)
    /// * 错误 - 用户不存在/笔记不存在/数据库错误
    async fn delete(&mut self, user: &str, id: &MemoId) -> WeimoResult<Memo>;

    /// 更新笔记
    ///
    /// 返回:
    /// * 成功 - Ok(Memo)
    /// * 错误 - 用户不存在/笔记不存在/数据库错误
    async fn update(&mut self, user: &str, id: &MemoId, info: MemoUpdate) -> WeimoResult<Memo>;

    /// 根据 ID 查询笔记
    ///
    /// 返回:
    /// * 成功 - Ok(Memo)
    /// * 错误 - 用户不存在/笔记不存在
    async fn get(&self, user: &str, id: &MemoId) -> WeimoResult<Memo>;

    /// 根据 ID 列表查询笔记
    ///
    /// 返回:
    /// * 成功 - Ok(Vec<Memo>)
    /// * 错误 - 用户不存在/笔记不存在
    async fn get_many(&self, user: &str, ids: &[MemoId]) -> WeimoResult<Vec<Memo>> {
        let mut memos = Vec::with_capacity(ids.len());
        for id in ids {
            memos.push(self.get(user, id).await?);
        }
        Ok(memos)
    }

    /// 获取用户所有笔记的 ID 列表，失败返回空列表
    async fn get_ids(&self, user: &str) -> Vec<MemoId>;

    /// 删除指定用户的全部笔记数据
    async fn delete_user_data(&mut self, _user: &str) -> WeimoResult<()> {
        Ok(())
    }

    /// 统一搜索接口
    async fn search_hits(
        &self,
        user: &str,
        query: &MemoSearchQuery,
        candidates: Option<&[MemoId]>,
    ) -> WeimoResult<Vec<MemoSearchHit>> {
        query.validate()?;

        let ids = match candidates {
            Some(ids) => ids.to_vec(),
            None => self.get_ids(user).await,
        };

        let mut matched = Vec::new();
        for id in ids {
            let memo = self.get(user, &id).await?;
            if query.matches(&memo) {
                matched.push(MemoSearchHit::from_memo(&memo));
            }
        }

        matched.sort_unstable_by(|left, right| match query.created_at_sort {
            CreatedAtSortOrder::Desc => right
                .created_at_utc
                .cmp(&left.created_at_utc)
                .then_with(|| right.id.cmp(&left.id)),
            CreatedAtSortOrder::Asc => left
                .created_at_utc
                .cmp(&right.created_at_utc)
                .then_with(|| left.id.cmp(&right.id)),
        });

        Ok(matched)
    }
}
