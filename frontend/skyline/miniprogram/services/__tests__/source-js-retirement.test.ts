import fs from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'

const miniprogramRoot = path.join(__dirname, '..', '..')

function collectRetiredSourceJsFiles(options: {
  includeEntryModules: boolean
}): string[] {
  const retiredJsFiles: string[] = []

  function walk(dir: string) {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const absolutePath = path.join(dir, entry.name)
      if (entry.isDirectory()) {
        walk(absolutePath)
        continue
      }
      if (!entry.isFile() || !entry.name.endsWith('.ts') || entry.name.endsWith('.d.ts')) {
        continue
      }

      const isEntryModule = entry.name === 'index.ts' || entry.name === 'app.ts'
      if (options.includeEntryModules !== isEntryModule) {
        continue
      }

      const jsPath = absolutePath.replace(/\.ts$/, '.js')
      if (!fs.existsSync(jsPath)) {
        continue
      }

      retiredJsFiles.push(path.relative(miniprogramRoot, jsPath))
    }
  }

  walk(miniprogramRoot)
  return retiredJsFiles.sort()
}

describe('source js retirement', () => {
  it('round 1 retires helper and non-entry source js files sourced from TypeScript only', () => {
    expect(collectRetiredSourceJsFiles({ includeEntryModules: false })).toEqual([])
  })

  it('round 2 retires entry source js files sourced from TypeScript only', () => {
    expect(collectRetiredSourceJsFiles({ includeEntryModules: true })).toEqual([])
  })
})
