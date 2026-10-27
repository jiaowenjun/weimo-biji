import assert from 'node:assert/strict'
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import {
  assertWithinBudget,
  collectStaticRouteAssets,
  measureStaticRouteGzipBytes,
} from './vite-bundle-budget.mjs'

const fixtureRoot = mkdtempSync(join(tmpdir(), 'weimo-vite-budget-'))

try {
  mkdirSync(join(fixtureRoot, 'assets'))
  for (const [file, contents] of [
    ['assets/entry.js', 'entry'.repeat(100)],
    ['assets/entry.css', 'entry-css'.repeat(100)],
    ['assets/workspace.js', 'workspace'.repeat(100)],
    ['assets/editor.js', 'editor'.repeat(100)],
  ]) {
    writeFileSync(join(fixtureRoot, file), contents)
  }

  const manifest = {
    'index.html': {
      file: 'assets/entry.js',
      css: ['assets/entry.css'],
      isEntry: true,
    },
    'src/workspace.tsx': {
      file: 'assets/workspace.js',
      imports: ['index.html'],
      dynamicImports: ['src/editor.tsx'],
      isDynamicEntry: true,
    },
    'src/editor.tsx': {
      file: 'assets/editor.js',
      isDynamicEntry: true,
    },
  }
  const closure = collectStaticRouteAssets(manifest, 'src/workspace.tsx')

  assert.deepEqual(
    [...closure.files].sort(),
    ['assets/entry.css', 'assets/entry.js', 'assets/workspace.js'],
  )
  assert.ok(!closure.files.has('assets/editor.js'))

  const measurement = measureStaticRouteGzipBytes(
    fixtureRoot,
    manifest,
    'src/workspace.tsx',
  )
  assert.ok(measurement.gzipBytes > 0)
  assert.doesNotThrow(() => assertWithinBudget('fixture', measurement.gzipBytes, 1024))
  assert.throws(
    () => assertWithinBudget('fixture', measurement.gzipBytes, 1),
    /fixture is .* KiB gzip; limit is 0\.0 KiB/,
  )
} finally {
  rmSync(fixtureRoot, { force: true, recursive: true })
}

console.log('Vite bundle budget model passed')
