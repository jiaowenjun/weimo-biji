import fs from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'

const utilsDir = path.join(__dirname, '..', '..')

describe('memo-permissions module entry', () => {
  it('has a same-name TS entry for Mini Program runtime resolution', () => {
    const entry = fs.readFileSync(path.join(utilsDir, 'memo-permissions.ts'), 'utf8')

    expect(entry).toContain("export * from './memo-permissions/index'")
  })
})
