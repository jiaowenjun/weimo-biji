import fs from 'node:fs'
import path from 'node:path'
import { pathToFileURL } from 'node:url'
import { afterEach, describe, expect, it } from 'vitest'

const generatedRoots: string[] = []

function rememberGeneratedRoot(name: string) {
  const root = path.join(
    path.join(__dirname, '..', '..', '..', '.generated'),
    `runtime-build-test-${name}-${Date.now()}`,
  )
  generatedRoots.push(root)
  return root
}

afterEach(() => {
  for (const root of generatedRoots.splice(0)) {
    fs.rmSync(root, { recursive: true, force: true })
  }
})

describe('buildRuntime', () => {
  it('emits runtime output to a caller-provided directory so test workers can isolate artifacts', async () => {
    const modulePath = path.join(__dirname, '..', 'build-runtime.js')
    const { buildRuntime } = await import(pathToFileURL(modulePath).href)

    const rootA = rememberGeneratedRoot('a')
    const rootB = rememberGeneratedRoot('b')

    buildRuntime(rootA)
    expect(fs.existsSync(path.join(rootA, 'components', 'memo-card', 'index.js'))).toBe(true)

    buildRuntime(rootB)
    expect(fs.existsSync(path.join(rootB, 'components', 'memo-card', 'index.js'))).toBe(true)
    expect(fs.existsSync(path.join(rootA, 'components', 'memo-card', 'index.js'))).toBe(true)
  })
})
