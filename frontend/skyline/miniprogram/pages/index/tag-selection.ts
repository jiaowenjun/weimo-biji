/** 首页标签重选：仅完全相同路径 no-op；祖先/后代/兄弟路径仍应切换筛选。 */
export function shouldNoOpExactHomeTagReselect(selectedTag: string, clickedTag: string): boolean {
  return String(clickedTag || '').trim() === String(selectedTag || '').trim()
}
