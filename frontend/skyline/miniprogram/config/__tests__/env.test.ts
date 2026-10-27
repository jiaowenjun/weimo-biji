import { beforeEach, describe, expect, it, vi } from 'vitest'

describe('environment config', () => {
  beforeEach(() => {
    vi.resetModules()
    vi.unstubAllGlobals()
  })

  it.each(['develop', 'trial', 'release'])('uses the Biji API prefix in %s', async (envVersion) => {
    vi.stubGlobal('wx', {
      getAccountInfoSync: () => ({ miniProgram: { envVersion } }),
    })

    const { ENVIRONMENT_CONFIG } = await import('../env')

    expect(ENVIRONMENT_CONFIG).toEqual({
      apiBaseUrl: 'https://weimo.ink/biji/api',
      envVersion,
    })
  })
})
