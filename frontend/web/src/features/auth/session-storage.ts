export const AUTH_STORAGE_KEY = 'biji-react.auth'
export const AUTH_SESSION_EVENT = 'biji-react.auth-session'

type SessionTokenListener = (token: string | null) => void

function emitSessionToken(token: string | null) {
  window.dispatchEvent(
    new CustomEvent(AUTH_SESSION_EVENT, {
      detail: { token },
    }),
  )
}

export function readSessionToken() {
  return localStorage.getItem(AUTH_STORAGE_KEY)
}

export function writeSessionToken(token: string) {
  localStorage.setItem(AUTH_STORAGE_KEY, token)
  emitSessionToken(token)
}

export function clearSessionToken() {
  localStorage.removeItem(AUTH_STORAGE_KEY)
  emitSessionToken(null)
}

export function subscribeSessionToken(listener: SessionTokenListener) {
  const handleSessionEvent = (event: Event) => {
    const detail = event instanceof CustomEvent ? event.detail : null
    const token = typeof detail?.token === 'string' ? detail.token : null

    listener(token)
  }

  const handleStorageEvent = (event: StorageEvent) => {
    if (event.key !== AUTH_STORAGE_KEY) return

    listener(event.newValue)
  }

  window.addEventListener(AUTH_SESSION_EVENT, handleSessionEvent)
  window.addEventListener('storage', handleStorageEvent)

  return () => {
    window.removeEventListener(AUTH_SESSION_EVENT, handleSessionEvent)
    window.removeEventListener('storage', handleStorageEvent)
  }
}
