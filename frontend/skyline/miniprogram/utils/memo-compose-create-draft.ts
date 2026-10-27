import type { MemoRefId } from '../models/memo'
import { getSession } from './session'
import { isRecord } from './guards'
import { readWxStorage, removeWxStorage, writeWxStorage } from './wx-storage'

const STORAGE_KEY_PREFIX = 'biji-skyline.memo-compose.create-draft.'
const STORAGE_VERSION = 1
const ANONYMOUS_USERNAME = 'anonymous'

export interface MemoComposeCreateDraftEntry {
  contextKey: string
  content: string
  selectedTags: string[]
  referencePreviewText: string
  updatedAt: number
}

interface PersistedMemoComposeCreateDrafts {
  version: 1
  entries: MemoComposeCreateDraftEntry[]
}

function getViewerUsername(): string {
  const username = getSession().user?.username?.trim()
  return username || ANONYMOUS_USERNAME
}

function getStorageKey(): string {
  return `${STORAGE_KEY_PREFIX}${getViewerUsername()}`
}

function cloneEntry(entry: MemoComposeCreateDraftEntry): MemoComposeCreateDraftEntry {
  return {
    contextKey: entry.contextKey,
    content: entry.content,
    selectedTags: [...entry.selectedTags],
    referencePreviewText: entry.referencePreviewText,
    updatedAt: entry.updatedAt,
  }
}

function isDraftEntry(value: unknown): value is MemoComposeCreateDraftEntry {
  if (!isRecord(value)) return false
  return (
    typeof value.contextKey === 'string' &&
    typeof value.content === 'string' &&
    Array.isArray(value.selectedTags) &&
    value.selectedTags.every((tag) => typeof tag === 'string') &&
    typeof value.referencePreviewText === 'string' &&
    typeof value.updatedAt === 'number' &&
    Number.isFinite(value.updatedAt)
  )
}

function loadEntries(): MemoComposeCreateDraftEntry[] {
  const snapshot = readWxStorage(getStorageKey())
  if (!isRecord(snapshot) || snapshot.version !== STORAGE_VERSION || !Array.isArray(snapshot.entries)) {
    return []
  }

  return snapshot.entries
    .filter((entry): entry is MemoComposeCreateDraftEntry => isDraftEntry(entry))
    .map(cloneEntry)
}

function persistEntries(entries: MemoComposeCreateDraftEntry[]): void {
  if (entries.length === 0) {
    removeWxStorage(getStorageKey())
    return
  }

  const snapshot: PersistedMemoComposeCreateDrafts = {
    version: STORAGE_VERSION,
    entries: entries.map(cloneEntry),
  }
  writeWxStorage(getStorageKey(), snapshot)
}

export function buildMemoComposeCreateDraftContextKey(input: {
  initialRefs: MemoRefId[]
  initialTags: string[]
}): string {
  const refs = Array.isArray(input.initialRefs) ? [...input.initialRefs] : []
  if (refs.length > 0) {
    return JSON.stringify({ refs })
  }
  const initialTags = Array.isArray(input.initialTags) ? [...input.initialTags] : []
  return JSON.stringify({ initialTags })
}

export function readMemoComposeCreateDraft(contextKey: string): MemoComposeCreateDraftEntry | null {
  const entry = loadEntries().find((candidate) => candidate.contextKey === contextKey)
  return entry ? cloneEntry(entry) : null
}

export function writeMemoComposeCreateDraft(
  entry: Omit<MemoComposeCreateDraftEntry, 'updatedAt'> & { updatedAt?: number },
): void {
  const nextEntry: MemoComposeCreateDraftEntry = {
    contextKey: entry.contextKey,
    content: entry.content,
    selectedTags: [...entry.selectedTags],
    referencePreviewText: entry.referencePreviewText,
    updatedAt: typeof entry.updatedAt === 'number' && Number.isFinite(entry.updatedAt)
      ? entry.updatedAt
      : Date.now(),
  }

  const nextEntries = loadEntries().filter((candidate) => candidate.contextKey !== nextEntry.contextKey)
  nextEntries.push(nextEntry)
  persistEntries(nextEntries)
}

export function clearMemoComposeCreateDraft(contextKey: string): void {
  const nextEntries = loadEntries().filter((candidate) => candidate.contextKey !== contextKey)
  persistEntries(nextEntries)
}
