import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createFriendUnreadPoller } from '../friend-polling'

describe('createFriendUnreadPoller', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('fetches immediately and then every 15 seconds until stopped', async () => {
    const fetchUnread = vi.fn().mockResolvedValue(2)
    const onUnread = vi.fn()
    const poller = createFriendUnreadPoller({ fetchUnread, onUnread })

    poller.start()
    await vi.advanceTimersByTimeAsync(0)

    expect(fetchUnread).toHaveBeenCalledTimes(1)
    expect(onUnread).toHaveBeenCalledWith(2)

    await vi.advanceTimersByTimeAsync(15000)
    expect(fetchUnread).toHaveBeenCalledTimes(2)

    poller.stop()
    await vi.advanceTimersByTimeAsync(15000)
    expect(fetchUnread).toHaveBeenCalledTimes(2)
  })

  it('keeps last unread count on silent failure', async () => {
    const fetchUnread = vi.fn().mockRejectedValue(new Error('network'))
    const onUnread = vi.fn()
    const poller = createFriendUnreadPoller({ fetchUnread, onUnread })

    poller.start()
    await vi.advanceTimersByTimeAsync(0)

    expect(onUnread).not.toHaveBeenCalled()
  })
})
