import { readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const json = readFileSync(path.join(__dirname, '..', 'index.json'), 'utf8')
const wxml = readFileSync(path.join(__dirname, '..', 'index.wxml'), 'utf8')

describe('notifications layout contract', () => {
  it('uses custom nav and list scroll', () => {
    expect(json).toContain('"navigationStyle": "custom"')
    expect(json).toContain('"disableScroll": true')
    expect(wxml).toContain('<navigation-bar title="通知"')
    expect(wxml).toContain('class="notifications-scroll"')
    expect(wxml).toContain('scroll-y')
    expect(wxml).toContain('type="list"')
  })

  it('renders avatar title description and agree action', () => {
    expect(wxml).toContain('class="notification-row__avatar"')
    expect(wxml).toContain('{{item.title}}')
    expect(wxml).toContain('{{item.description}}')
    expect(wxml).toContain('bind:tap="handleAcceptTap"')
  })

  it('shows back navigation and empty state for guest visitors', () => {
    expect(wxml).toContain('back="{{true}}"')
    expect(wxml).toContain('暂无通知')
    const ts = readFileSync(path.join(__dirname, '..', 'index.ts'), 'utf8')
    expect(ts).toContain('hasSession')
    expect(ts).toMatch(/loadNotifications[\s\S]*if\s*\(!hasSession\(\)\)/)
  })
})
