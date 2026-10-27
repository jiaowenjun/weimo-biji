import { readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const wxml = readFileSync(path.join(__dirname, '..', 'index.wxml'), 'utf8')
const wxss = readFileSync(path.join(__dirname, '..', 'index.wxss'), 'utf8')
const ts = readFileSync(path.join(__dirname, '..', 'index.ts'), 'utf8')

describe('home-sidebar notification contract', () => {
  it('renders notification button before settings with unread badge', () => {
    expect(ts).toContain('unreadCount')
    expect(wxml.indexOf('icon="notification"')).toBeGreaterThan(-1)
    expect(wxml.indexOf('icon="notification"')).toBeLessThan(wxml.indexOf('icon="setting"'))
    expect(wxml).toContain('wx:if="{{unreadCount > 0}}"')
    expect(wxss).toContain('.sidebar-header__notification-badge')
  })

  it('does not wire friend selection through the tag tree', () => {
    expect(ts).not.toContain('handleFriendSelect')
    expect(ts).not.toContain("this.triggerEvent('friendselect'")
    expect(wxml).not.toContain('friend-profile="{{friendProfile}}"')
    expect(wxml).not.toContain('bind:friendselect="handleFriendSelect"')
  })

  it('forwards tagMenuEnabled to sidebar tag tree', () => {
    expect(ts).toContain('tagMenuEnabled')
    expect(wxml).toContain('tag-menu-enabled="{{tagMenuEnabled}}"')
  })

  it('left-aligns guest auth CTA in header when unauthenticated', () => {
    expect(wxml).toContain('sidebar-header--guest-auth')
    expect(wxml).toContain('!authenticated && authActionText')
    expect(wxss).toContain('.sidebar-header--guest-auth .sidebar-header__identity')
    expect(wxss).toContain('.sidebar-header--guest-auth .sidebar-header__notification')
    expect(wxss).toMatch(/\.sidebar-header--guest-auth\s*\{[^}]*justify-content:\s*flex-start/)
  })
})
