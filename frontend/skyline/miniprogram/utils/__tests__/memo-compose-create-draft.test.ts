import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  buildMemoComposeCreateDraftContextKey,
  clearMemoComposeCreateDraft,
  readMemoComposeCreateDraft,
  writeMemoComposeCreateDraft,
} from '../memo-compose-create-draft'

const SESSION_STORAGE_KEY = 'biji-skyline.session'
const DRAFT_STORAGE_KEY = 'biji-skyline.memo-compose.create-draft.alice'

function seedSession(storage: Map<string, unknown>, username = 'alice') {
  storage.set(SESSION_STORAGE_KEY, {
    accessToken: 'token',
    refreshToken: 'refresh',
    user: {
      username,
      nickname: 'Alice',
      login_name: username,
      has_login_password: true,
    },
  })
}

describe('memo-compose-create-draft', () => {
  const storage = new Map<string, unknown>()
  const getStorageSync = vi.fn((key: string) => storage.get(key))
  const setStorageSync = vi.fn((key: string, value: unknown) => {
    storage.set(key, value)
  })
  const removeStorageSync = vi.fn((key: string) => {
    storage.delete(key)
  })

  beforeEach(() => {
    storage.clear()
    getStorageSync.mockClear()
    setStorageSync.mockClear()
    removeStorageSync.mockClear()
    ;(globalThis as any).wx = {
      getStorageSync,
      setStorageSync,
      removeStorageSync,
    }
    seedSession(storage)
  })

  it('uses refs-only keys for quoted drafts and initial-tags keys for plain create drafts', () => {
    expect(buildMemoComposeCreateDraftContextKey({
      initialRefs: ['7'],
      initialTags: ['日记'],
    })).toBe(JSON.stringify({ refs: ['7'] }))

    expect(buildMemoComposeCreateDraftContextKey({
      initialRefs: ['7'],
      initialTags: ['工作'],
    })).toBe(JSON.stringify({ refs: ['7'] }))

    expect(buildMemoComposeCreateDraftContextKey({
      initialRefs: [],
      initialTags: ['日记'],
    })).toBe(JSON.stringify({ initialTags: ['日记'] }))

    expect(buildMemoComposeCreateDraftContextKey({
      initialRefs: [],
      initialTags: ['工作'],
    })).toBe(JSON.stringify({ initialTags: ['工作'] }))
  })

  it('stores multiple create contexts side by side and clears only the matching context', () => {
    const quotedContextKey = buildMemoComposeCreateDraftContextKey({
      initialRefs: ['7'],
      initialTags: ['旧标签'],
    })
    const plainContextKey = buildMemoComposeCreateDraftContextKey({
      initialRefs: [],
      initialTags: ['工作'],
    })

    writeMemoComposeCreateDraft({
      contextKey: quotedContextKey,
      content: 'quoted draft',
      selectedTags: ['引用'],
      referencePreviewText: 'quoted preview',
      updatedAt: 100,
    })
    writeMemoComposeCreateDraft({
      contextKey: plainContextKey,
      content: 'plain draft',
      selectedTags: ['工作'],
      referencePreviewText: '',
      updatedAt: 200,
    })

    expect(readMemoComposeCreateDraft(quotedContextKey)).toEqual({
      contextKey: quotedContextKey,
      content: 'quoted draft',
      selectedTags: ['引用'],
      referencePreviewText: 'quoted preview',
      updatedAt: 100,
    })
    expect(readMemoComposeCreateDraft(plainContextKey)).toEqual({
      contextKey: plainContextKey,
      content: 'plain draft',
      selectedTags: ['工作'],
      referencePreviewText: '',
      updatedAt: 200,
    })

    clearMemoComposeCreateDraft(plainContextKey)

    expect(readMemoComposeCreateDraft(plainContextKey)).toBeNull()
    expect(readMemoComposeCreateDraft(quotedContextKey)).toEqual({
      contextKey: quotedContextKey,
      content: 'quoted draft',
      selectedTags: ['引用'],
      referencePreviewText: 'quoted preview',
      updatedAt: 100,
    })
    expect(storage.get(DRAFT_STORAGE_KEY)).toEqual({
      version: 1,
      entries: [{
        contextKey: quotedContextKey,
        content: 'quoted draft',
        selectedTags: ['引用'],
        referencePreviewText: 'quoted preview',
        updatedAt: 100,
      }],
    })
  })
})
