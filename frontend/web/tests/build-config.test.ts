import { describe, expect, it } from 'vitest'

import viteConfig from '../vite.config'

describe('Biji build and development config', () => {
  it('keeps the deployed base path and manifest output enabled', () => {
    expect(viteConfig.base).toBe('/biji/')
    expect(viteConfig.build?.manifest).toBe(true)
  })

  it('rewrites the app-scoped API path through the production origin', () => {
    const proxy = viteConfig.server?.proxy?.['/biji/api']

    expect(proxy).toMatchObject({
      changeOrigin: true,
      target: 'https://weimo.ink',
    })
    expect(typeof proxy === 'object' ? proxy.rewrite?.('/biji/api/me') : undefined)
      .toBe('/api/me')
  })
})
