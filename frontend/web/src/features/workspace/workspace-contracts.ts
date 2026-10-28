import * as z from 'zod/mini'
import type { WdfDocument } from 'weimo-wdf'

import type {
  MemoDto,
  MemoSearchPageDto,
  MemoUtcArray,
  TagTreeMeta,
  WorkspaceStats,
} from './workspace-types'

const nonnegativeIntegerSchema = z.number().check(z.int(), z.nonnegative())
const utcArraySchema: z.ZodMiniType<MemoUtcArray> = z.tuple([
  z.number().check(z.int()),
  z.number().check(z.int()),
  z.number().check(z.int()),
  z.number().check(z.int()),
  z.number().check(z.int()),
  z.number().check(z.int()),
  z.number().check(z.int()),
  z.number().check(z.int()),
  z.number().check(z.int()),
])

export const workspaceStatsSchema: z.ZodMiniType<WorkspaceStats> = z.object({
  note_count: nonnegativeIntegerSchema,
  tag_count: nonnegativeIntegerSchema,
  word_count: nonnegativeIntegerSchema,
  daily_note_count: z.array(z.tuple([
    nonnegativeIntegerSchema,
    nonnegativeIntegerSchema,
  ])),
})

export const tagTreeMetaSchema: z.ZodMiniType<TagTreeMeta> = z.lazy(() =>
  z.object({
    label: z.string(),
    tag: z.string(),
    item_count: nonnegativeIntegerSchema,
    children: z.array(tagTreeMetaSchema),
    untagged_count: z.optional(nonnegativeIntegerSchema),
  }),
)

/**
 * WDF 文档信封校验:仅断言外层结构,块级合法性由后端 weimo-wdf
 * (validate_and_canonicalize)在写入时把关;读取侧数据即存储的规范形态。
 */
const wdfDocumentSchema: z.ZodMiniType<WdfDocument> = z.object({
  schema: z.string(),
  version: z.number(),
  root: z.object({
    type: z.string(),
    content: z.array(z.unknown()),
  }),
}) as unknown as z.ZodMiniType<WdfDocument>

export const memoDtoSchema: z.ZodMiniType<MemoDto> = z.object({
  id: nonnegativeIntegerSchema,
  ct_utc: utcArraySchema,
  mt_utc: utcArraySchema,
  tags: z.array(z.string()),
  content: wdfDocumentSchema,
  refs: z.optional(z.array(z.string())),
  referenced_by: z.optional(z.array(z.string())),
})

export const memoSearchPageDtoSchema: z.ZodMiniType<MemoSearchPageDto> = z.object({
  items: z.array(memoDtoSchema),
  next_cursor: z.nullable(z.string()),
  has_more: z.boolean(),
  total_count: nonnegativeIntegerSchema,
})

export const tagMutationResultSchema = z.string()
export const mutationIdSchema = nonnegativeIntegerSchema
