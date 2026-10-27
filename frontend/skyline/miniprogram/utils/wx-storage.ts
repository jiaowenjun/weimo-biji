export type WxStorage = {
  getStorageSync?: (key: string) => unknown
  setStorageSync?: (key: string, value: unknown) => void
  removeStorageSync?: (key: string) => void
}

export function getWxStorage(): WxStorage {
  return ((globalThis as { wx?: WxStorage }).wx) ?? {}
}

export function readWxStorage(key: string): unknown {
  try {
    return getWxStorage().getStorageSync?.(key)
  } catch {
    return undefined
  }
}

export function writeWxStorage(key: string, value: unknown): void {
  try {
    getWxStorage().setStorageSync?.(key, value)
  } catch {
    // Ignore storage failures so callers can keep runtime state in memory.
  }
}

export function removeWxStorage(key: string): void {
  try {
    getWxStorage().removeStorageSync?.(key)
  } catch {
    // Ignore storage failures so callers can keep runtime state in memory.
  }
}
