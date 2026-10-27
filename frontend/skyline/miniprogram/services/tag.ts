import type { TagTreeMeta } from '../models/tag'
import { request } from '../utils/request'

export function getTagTree() {
  return request<TagTreeMeta>({
    url: '/tag/meta',
  })
}

function encodeTagPathParam(tag: string): string {
  return encodeURIComponent(tag.replaceAll('/', '|'))
}

export function renameTag(oldTag: string, newTag: string) {
  return request<string, { new_tag: string }>({
    url: `/tag/${encodeTagPathParam(oldTag)}`,
    method: 'PUT',
    data: { new_tag: newTag },
  })
}

export function deleteTag(tag: string) {
  return request<string>({
    url: `/tag/${encodeTagPathParam(tag)}`,
    method: 'DELETE',
  }).then(() => {})
}
