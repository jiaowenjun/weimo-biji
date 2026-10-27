const FRIEND_UNREAD_POLL_INTERVAL_MS = 15_000

interface FriendUnreadPollerOptions {
  fetchUnread: () => Promise<number>
  onUnread: (count: number) => void
}

export function createFriendUnreadPoller(options: FriendUnreadPollerOptions) {
  let timer: ReturnType<typeof setInterval> | null = null
  let running = false

  const tick = () => {
    try {
      void options.fetchUnread().then((count) => {
        if (!running) return
        options.onUnread(count)
      }).catch(() => {
        // Notification polling is non-blocking UI chrome; keep failures quiet.
      })
    } catch {
      // Notification polling is non-blocking UI chrome; keep failures quiet.
    }
  }

  return {
    start() {
      if (running) return
      running = true
      tick()
      timer = setInterval(() => {
        tick()
      }, FRIEND_UNREAD_POLL_INTERVAL_MS)
    },

    stop() {
      running = false
      if (timer == null) return
      clearInterval(timer)
      timer = null
    },
  }
}
