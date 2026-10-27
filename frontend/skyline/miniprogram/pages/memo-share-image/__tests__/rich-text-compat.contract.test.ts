import { readFileSync } from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'

describe('memo-share-image rich-text contract', () => {
  it('uses rich-text mode compat for Skyline tag mapping parity', () => {
    const wxml = readFileSync(path.join(__dirname, '../index.wxml'), 'utf8')
    expect(wxml).toMatch(/<rich-text[\s\S]*?mode="compat"/)
  })
})
