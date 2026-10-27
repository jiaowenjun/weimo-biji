import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

describe('index logout filter reset contract', () => {
  const ts = readFileSync(resolve(__dirname, '../index.ts'), 'utf8')
  const settingsTs = readFileSync(
    resolve(__dirname, '../../settings/index.ts'),
    'utf8',
  )

  function methodSource(name: string, nextName: string) {
    const markers = [`\n  ${name}(`, `\n  async ${name}(`]
    const nextMarkers = [`\n  ${nextName}(`, `\n  async ${nextName}(`]
    const starts = markers
      .map((marker) => ts.indexOf(marker))
      .filter((index) => index >= 0)
    const start = starts.length ? Math.min(...starts) : -1
    const ends = nextMarkers
      .map((marker) => ts.indexOf(marker, start + name.length))
      .filter((index) => index >= 0)
    const end = ends.length ? Math.min(...ends) : -1
    expect(start).toBeGreaterThanOrEqual(0)
    expect(end).toBeGreaterThan(start)
    return ts.slice(start, end)
  }

  it('tracks session transitions in onShow and resets filters after logout', () => {
    const onShow = methodSource('onShow', 'onHide')

    expect(onShow).toContain('const hadSession = this._hadSessionOnLastShow')
    expect(onShow).toContain('const nowHasSession = hasSession()')
    expect(onShow).toContain('this._hadSessionOnLastShow = nowHasSession')
    expect(onShow).toContain('const sessionEnded = hadSession && !nowHasSession')
    expect(onShow).toContain('if (sessionEnded)')
    expect(onShow).toContain('this.resetFiltersAfterLogout()')
  })

  it('initializes session tracking on load', () => {
    const onLoad = methodSource('onLoad', 'onReady')

    expect(onLoad).toContain('this._hadSessionOnLastShow = hasSession()')
  })

  it('clears self and friend filters and returns to self scope on logout reset', () => {
    const reset = methodSource('resetFiltersAfterLogout', 'applyFriendMemoQuery')

    expect(reset).toContain('stopFriendUnreadPolling')
    expect(reset).toContain('friendProfiles: []')
    expect(reset).toContain('createEmptyMemoQueryDraft()')
    expect(reset).toContain("if (this.data.homeMemoScope.kind === 'friend')")
    expect(reset).toContain('this.switchToSelfScope({ resetScroll: true })')
    expect(reset).toContain(
      'void this.applyMemoQuery(createEmptyMemoQueryDraft(), { resetScroll: true })',
    )
  })

  it('uses shared performLogout and resets filters before relaunching home', () => {
    const handleLogout = methodSource('handleLogout', 'handleSidebarAuth')

    expect(handleLogout).toContain('this.resetFiltersAfterLogout()')
    expect(handleLogout).toContain('performLogout()')
    expect(handleLogout).toContain('reLaunchToHome()')
    expect(handleLogout).not.toContain('clearSession()')
    expect(handleLogout).not.toContain('clearVisitorWorkspaceData()')
  })

  it('settings logout uses performLogout', () => {
    expect(settingsTs).toContain("import { performLogout } from '../../utils/logout'")
    expect(settingsTs).toContain('performLogout()')
    expect(settingsTs).not.toContain('clearVisitorWorkspaceData')
  })
})
