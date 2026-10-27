import fs from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'

const ts = fs.readFileSync(
  path.join(__dirname, '..', 'index.ts'),
  'utf8',
)

describe('memo-share-image entrancePath wiring', () => {
  it('does not define a local buildShareEntrancePath helper anymore', () => {
    expect(ts).not.toMatch(/function\s+buildShareEntrancePath\s*\(/)
  })

  it('imports buildShareEntrancePath from utils/routes', () => {
    expect(ts).toContain("buildShareEntrancePath } from '../../utils/routes'")
  })

  it('no longer imports AppPagePaths directly for the share entrance path', () => {
    expect(ts).not.toContain("AppPagePaths } from '../../utils/routes'")
  })

  it('handleShareToFriendTap uses the helper with the current card and session', () => {
    const handler = ts.slice(ts.indexOf('handleShareToFriendTap'), ts.length)
    expect(handler).toContain('buildShareEntrancePath(')
    expect(handler).toContain('this.data.card')
  })
})
