import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { gzipSync } from 'node:zlib'

const BOOTSTRAP_GZIP_LIMIT_BYTES = 115 * 1024
const WORKSPACE_GZIP_LIMIT_BYTES = 455 * 1024

export function collectStaticRouteAssets(manifest, startKey) {
  const manifestKeys = new Set()
  const files = new Set()

  function visit(key) {
    if (manifestKeys.has(key)) return

    const chunk = manifest[key]
    if (!chunk) throw new Error(`Vite manifest entry is missing: ${key}`)

    manifestKeys.add(key)
    files.add(chunk.file)
    for (const cssFile of chunk.css ?? []) files.add(cssFile)
    for (const importedKey of chunk.imports ?? []) visit(importedKey)
  }

  visit(startKey)
  return { files, manifestKeys }
}

export function measureStaticRouteGzipBytes(distDirectory, manifest, startKey) {
  const closure = collectStaticRouteAssets(manifest, startKey)
  let gzipBytes = 0

  for (const file of closure.files) {
    const contents = readFileSync(resolve(distDirectory, file))
    gzipBytes += gzipSync(contents, { level: 6 }).length
  }

  return { ...closure, gzipBytes }
}

export function assertWithinBudget(label, gzipBytes, limitBytes) {
  if (gzipBytes <= limitBytes) return

  throw new Error(
    `${label} is ${(gzipBytes / 1024).toFixed(1)} KiB gzip; limit is ${(limitBytes / 1024).toFixed(1)} KiB`,
  )
}

function findManifestKey(manifest, predicate, label) {
  const key = Object.keys(manifest).find(predicate)
  if (!key) throw new Error(`Vite manifest does not contain ${label}`)
  return key
}

function reportBudget(label, result, limitBytes) {
  assertWithinBudget(label, result.gzipBytes, limitBytes)
  console.log(
    `${label}: ${(result.gzipBytes / 1024).toFixed(1)} KiB gzip / ${(limitBytes / 1024).toFixed(0)} KiB`,
  )
}

function main() {
  const distDirectory = resolve(process.argv[2] ?? 'dist')
  const manifest = JSON.parse(
    readFileSync(resolve(distDirectory, '.vite/manifest.json'), 'utf8'),
  )
  const entryKey = findManifestKey(
    manifest,
    (key) => manifest[key].isEntry === true,
    'an application entry',
  )
  const guestKey = findManifestKey(
    manifest,
    (key) => key.endsWith('guest-workspace-page.tsx'),
    'the guest workspace route',
  )
  const workspaceKey = findManifestKey(
    manifest,
    (key) => key.endsWith('workspace-demo-page.tsx'),
    'the authenticated workspace route',
  )
  const bootstrap = measureStaticRouteGzipBytes(distDirectory, manifest, entryKey)
  const guest = measureStaticRouteGzipBytes(distDirectory, manifest, guestKey)
  const workspace = measureStaticRouteGzipBytes(distDirectory, manifest, workspaceKey)
  const editorFiles = new Set(
    Object.entries(manifest)
      .filter(([key]) =>
        /ui\/src\/components\/md-editor(?:\.tsx|\/md-editor-toolbar\.tsx)$/.test(key),
      )
      .map(([, chunk]) => chunk.file),
  )

  for (const [label, result] of [
    ['guest workspace', guest],
    ['authenticated workspace', workspace],
  ]) {
    for (const editorFile of editorFiles) {
      if (result.files.has(editorFile)) {
        throw new Error(`${label} statically loads deferred editor asset: ${editorFile}`)
      }
    }
  }

  reportBudget('login bootstrap', bootstrap, BOOTSTRAP_GZIP_LIMIT_BYTES)
  reportBudget('guest workspace', guest, WORKSPACE_GZIP_LIMIT_BYTES)
  reportBudget('authenticated workspace', workspace, WORKSPACE_GZIP_LIMIT_BYTES)
}

if (
  process.argv[1] &&
  resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
  main()
}
