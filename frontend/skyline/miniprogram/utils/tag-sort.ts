import { pinyin } from 'pinyin-pro'
import type { TagTreeMeta } from '../models/tag'
import { TAG_NONE_LITERAL } from './tag-none'
import { resolveTagLabel } from './tag-tree'

const SORT_KEY_CACHE = new Map<string, string>()
const HAN_RE = /[\u4e00-\u9fff]/

/**
 * 将一段标签字面（可含混合中英文）转为用于排序的拉丁小写键：汉字为无声调全拼，与 tag-search 一致。
 */
export function tagLiteralLatinKey(flat: string): string {
  const hit = SORT_KEY_CACHE.get(flat)
  if (hit !== undefined) {
    return hit
  }
  let out = ''
  for (const ch of flat) {
    if (HAN_RE.test(ch)) {
      const seg = pinyin(ch, { pattern: 'pinyin', toneType: 'none' })
      out += String(seg).replace(/\s+/g, '').toLowerCase()
    } else if (/[a-zA-Z0-9]/.test(ch)) {
      out += ch.toLowerCase()
    }
  }
  SORT_KEY_CACHE.set(flat, out)
  return out
}

/** 完整 tag 路径：去掉「/」后生成排序键。 */
export function tagPathSortKey(tagPath: string): string {
  return tagLiteralLatinKey(tagPath.replace(/\//g, ''))
}

export function compareTagPathPinyin(a: string, b: string): number {
  const c = tagPathSortKey(a).localeCompare(tagPathSortKey(b), 'en')
  if (c !== 0) return c
  return a.localeCompare(b, 'en')
}

export function compareTagTreeMetaSiblings(a: TagTreeMeta, b: TagTreeMeta): number {
  const c = tagLiteralLatinKey(resolveTagLabel(a)).localeCompare(
    tagLiteralLatinKey(resolveTagLabel(b)),
    'en',
  )
  if (c !== 0) return c
  return a.tag.localeCompare(b.tag, 'en')
}

export function sortTagTreeMetaDeep(nodes: TagTreeMeta[]): TagTreeMeta[] {
  return [...nodes]
    .sort(compareTagTreeMetaSiblings)
    .map((node) => ({
      ...node,
      children: sortTagTreeMetaDeep(node.children),
    }))
}

/** 侧栏标签树同级展示：占位「无」节点永远排在末尾，其余沿用拼音/字典序 sibling 规则 */
export function reorderTagTreeSiblingsNoneLast(nodes: TagTreeMeta[]): TagTreeMeta[] {
  return [...nodes]
    .sort((a, b) => {
      const aNone = a.tag === TAG_NONE_LITERAL ? 1 : 0
      const bNone = b.tag === TAG_NONE_LITERAL ? 1 : 0
      if (aNone !== bNone) return aNone - bNone
      return compareTagTreeMetaSiblings(a, b)
    })
    .map((node) => ({
      ...node,
      children: reorderTagTreeSiblingsNoneLast(node.children),
    }))
}
