export interface TagTreeMeta {
  label: string
  tag: string
  item_count: number
  children: TagTreeMeta[]
  untagged_count?: number
}
