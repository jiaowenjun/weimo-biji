import fs from 'node:fs'
import path from 'node:path'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { readWxStorage, removeWxStorage, writeWxStorage } from '../wx-storage'

const miniprogramRoot = path.join(__dirname, '..', '..')

describe('wx-storage helpers', () => {
  const getStorageSync = vi.fn()
  const setStorageSync = vi.fn()
  const removeStorageSync = vi.fn()

  beforeEach(() => {
    getStorageSync.mockReset()
    setStorageSync.mockReset()
    removeStorageSync.mockReset()
    ;(globalThis as any).wx = {
      getStorageSync,
      setStorageSync,
      removeStorageSync,
    }
  })

  it('reads from wx storage and returns undefined when storage access fails', () => {
    getStorageSync.mockReturnValueOnce({ ok: true })

    expect(readWxStorage('key')).toEqual({ ok: true })

    getStorageSync.mockImplementationOnce(() => {
      throw new Error('storage unavailable')
    })

    expect(readWxStorage('key')).toBeUndefined()
  })

  it('writes and removes without leaking storage exceptions', () => {
    setStorageSync.mockImplementationOnce(() => {
      throw new Error('write failed')
    })
    removeStorageSync.mockImplementationOnce(() => {
      throw new Error('remove failed')
    })

    expect(() => writeWxStorage('key', { ok: true })).not.toThrow()
    expect(() => removeWxStorage('key')).not.toThrow()
    expect(setStorageSync).toHaveBeenCalledWith('key', { ok: true })
    expect(removeStorageSync).toHaveBeenCalledWith('key')
  })

  it('keeps cache modules on the shared storage access helper', () => {
    const workspaceStorageTs = fs.readFileSync(
      path.join(miniprogramRoot, 'store/workspace-storage.ts'),
      'utf8',
    )
    const friendCacheTs = fs.readFileSync(
      path.join(miniprogramRoot, 'utils/friend-reference-preview-cache.ts'),
      'utf8',
    )

    expect(workspaceStorageTs).toContain("from '../utils/wx-storage'")
    expect(friendCacheTs).toContain("from './wx-storage'")
    expect(workspaceStorageTs).not.toMatch(/type\s+WxStorage|function\s+getWxStorage/)
    expect(friendCacheTs).not.toMatch(/type\s+WxStorage|function\s+getWxStorage/)
  })
})
