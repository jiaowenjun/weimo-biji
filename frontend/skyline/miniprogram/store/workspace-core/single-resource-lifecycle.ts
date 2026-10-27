import type { LifecycleSource, PendingCause, RuntimeGate } from './types'

export interface SingleResourceLifecycleConfig<TEntry> extends RuntimeGate {
  getEntry(): TEntry
  setEntry(entry: TEntry): void
  getInflight(): Promise<void> | null
  setInflight(value: Promise<void> | null): void
  getPendingCause(): PendingCause | null
  setPendingCause(value: PendingCause | null): void
  getInflightSource(): LifecycleSource | null
  setInflightSource(value: LifecycleSource | null): void
  isFresh(entry: TEntry): boolean
  invalidateEntry(): void
  fetchOnce(runtimeVersion: number): Promise<void>
  emit(): void
}

export function createSingleResourceLifecycle<TEntry>(
  config: SingleResourceLifecycleConfig<TEntry>,
) {
  function markPendingCause(cause: PendingCause): void {
    const current = config.getPendingCause()
    if (current === 'invalidate' || current === cause) return
    config.setPendingCause(cause)
  }

  function consumePendingCause(): PendingCause | null {
    const cause = config.getPendingCause()
    config.setPendingCause(null)
    return cause
  }

  function run(source: LifecycleSource): Promise<void> {
    const runtimeVersion = config.getRuntimeVersion()
    config.setInflightSource(source)

    const promise = (async () => {
      let currentRuntimeVersion = runtimeVersion
      let currentSource: LifecycleSource = source
      let lastError: unknown = null
      let hasError = false

      while (true) {
        config.setInflightSource(currentSource)
        try {
          await config.fetchOnce(currentRuntimeVersion)
          hasError = false
          lastError = null
        } catch (err) {
          hasError = true
          lastError = err
        }

        if (!config.isRuntimeCurrent(currentRuntimeVersion)) return

        const nextCause = consumePendingCause()
        if (!nextCause) {
          if (hasError) throw lastError
          return
        }

        currentRuntimeVersion = config.getRuntimeVersion()
        currentSource = nextCause
      }
    })().finally(() => {
      if (config.getInflight() === promise) {
        config.setInflight(null)
      }
      config.setInflightSource(null)
    })

    config.setInflight(promise)
    return promise
  }

  return {
    ensure(): Promise<void> {
      const entry = config.getEntry()
      if (config.isFresh(entry)) return Promise.resolve()
      const inflight = config.getInflight()
      if (inflight) return inflight
      return run('ensure')
    },
    refresh(): Promise<void> {
      config.invalidateEntry()
      const inflight = config.getInflight()
      if (inflight) {
        if (config.getInflightSource() !== 'refresh') {
          markPendingCause('refresh')
        }
        return inflight
      }
      return run('refresh')
    },
    invalidateFromMutation(): void {
      config.invalidateEntry()
      if (config.getInflight()) {
        markPendingCause('invalidate')
      }
    },
    resetForRuntimeReplace(): void {
      config.setInflight(null)
      config.setPendingCause(null)
      config.setInflightSource(null)
    },
  }
}
