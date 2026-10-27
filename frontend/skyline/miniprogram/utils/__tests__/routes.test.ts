import fs from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import { AppPagePaths, AppRoutes, buildShareEntrancePath } from '../routes'

const miniprogramRoot = path.join(__dirname, '..', '..')
const utilsRoot = path.join(__dirname, '..')

describe('AppRoutes', () => {
  it('collects app page routes as path constants only', () => {
    expect(AppRoutes).toEqual({
      auth: '/pages/auth/index',
      home: '/pages/index/index',
      memoCompose: '/pages/memo-compose/index',
      memoComposeTagPicker: '/pages/memo-compose-tag-picker/index',
      memoReferenceDetail: '/pages/memo-reference-detail/index',
      search: '/pages/search/index',
      settings: '/pages/settings/index',
      accountDetail: '/pages/settings/account-detail/index',
      accountEditSheet: '/pages/settings/account-edit-sheet/index',
      friendSearch: '/pages/friend-search/index',
      notifications: '/pages/notifications/index',
      memoShareImage: '/pages/memo-share-image/index',
    })
  })

  it('keeps relative page paths available for share entrance paths', () => {
    expect(AppPagePaths.home).toBe('pages/index/index')
    expect(AppPagePaths.memoReferenceDetail).toBe('pages/memo-reference-detail/index')
  })

  it('matches the registered app.json pages without changing their order', () => {
    const appJson = JSON.parse(
      fs.readFileSync(path.join(miniprogramRoot, 'app.json'), 'utf8'),
    ) as { pages: string[] }

    expect(appJson.pages).toEqual(Object.values(AppPagePaths))
  })

  it('lets request auth redirect checks reuse the auth page path constant', () => {
    const requestTs = fs.readFileSync(path.join(utilsRoot, 'request.ts'), 'utf8')

    expect(requestTs).toContain('AppPagePaths.auth')
    expect(requestTs).not.toContain("currentPage.route === 'pages/auth/index'")
  })

  it('builds a share entrance path with the card owner when present', () => {
    expect(buildShareEntrancePath({
      id: 12,
      ownerUsername: 'bob',
    }, {
      user: { username: 'alice' } as WeimoSessionUser,
    } as WeimoSessionState)).toBe('pages/memo-reference-detail/index?entry=share&memoId=12&ownerUsername=bob')
  })

  it('falls back to the session username for own-card shares', () => {
    expect(buildShareEntrancePath({
      id: 34,
      ownerUsername: '',
    }, {
      user: { username: 'alice' } as WeimoSessionUser,
    } as WeimoSessionState)).toBe('pages/memo-reference-detail/index?entry=share&memoId=34&ownerUsername=alice')
  })

  it('falls back to home when memo id or owner cannot be resolved', () => {
    expect(buildShareEntrancePath(null, { user: null } as WeimoSessionState)).toBe(AppPagePaths.home)
    expect(buildShareEntrancePath({
      id: 0,
      ownerUsername: 'bob',
    }, {
      user: { username: 'alice' } as WeimoSessionUser,
    } as WeimoSessionState)).toBe(AppPagePaths.home)
    expect(buildShareEntrancePath({
      id: 12,
      ownerUsername: '',
    }, {
      user: null,
    } as WeimoSessionState)).toBe(AppPagePaths.home)
  })
})
