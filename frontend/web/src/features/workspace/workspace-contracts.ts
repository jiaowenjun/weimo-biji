import * as z from 'zod/mini'

import type {
  FriendSummary,
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

export const memoDtoSchema: z.ZodMiniType<MemoDto> = z.object({
  id: nonnegativeIntegerSchema,
  ct_utc: utcArraySchema,
  mt_utc: utcArraySchema,
  tags: z.array(z.string()),
  content: z.string(),
  refs: z.optional(z.array(z.string())),
  referenced_by: z.optional(z.array(z.string())),
})

export const memoSearchPageDtoSchema: z.ZodMiniType<MemoSearchPageDto> = z.object({
  items: z.array(memoDtoSchema),
  next_cursor: z.nullable(z.string()),
  has_more: z.boolean(),
  total_count: nonnegativeIntegerSchema,
})

const friendProfileSchema = z.object({
  username: z.string(),
  nickname: z.string(),
})

export const friendSummarySchema: z.ZodMiniType<FriendSummary> = z.object({
  friends: z.array(friendProfileSchema),
  pending_outgoing: z.array(z.object({
    id: z.string(),
    to: friendProfileSchema,
    created_at: z.string(),
  })),
  pending_incoming_count: nonnegativeIntegerSchema,
  unread_count: nonnegativeIntegerSchema,
})

export const tagMutationResultSchema = z.string()
export const mutationIdSchema = nonnegativeIntegerSchema
