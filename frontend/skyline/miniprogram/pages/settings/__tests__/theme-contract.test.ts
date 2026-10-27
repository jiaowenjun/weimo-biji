import { readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const settingsRoot = path.join(__dirname, '..')
const pagesRoot = path.join(settingsRoot, '..')

function readFromSettings(relativePath: string): string {
  return readFileSync(path.join(settingsRoot, relativePath), 'utf8')
}

function readFromPages(relativePath: string): string {
  return readFileSync(path.join(pagesRoot, relativePath), 'utf8')
}

describe('settings theme token contract', () => {
  it('uses an existing shared text token for secondary labels', () => {
    expect(readFromSettings('index.wxss')).toContain('color: var(--color-text-secondary);')
    expect(readFromSettings('index.wxss')).not.toContain('var(--color-text-tertiary)')

    expect(readFromPages('settings/account-detail/index.wxss')).toContain(
      'color: var(--color-text-secondary);',
    )
    expect(readFromPages('settings/account-detail/index.wxss')).not.toContain(
      'var(--color-text-tertiary)',
    )
  })
})
