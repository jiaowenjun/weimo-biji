// @ts-nocheck

import fs from 'node:fs'
import path from 'node:path'
import { buildRuntime } from '../scripts/build-runtime.js'

const miniprogramRoot = path.join(__dirname, '..')
const runtimeWorkerId =
  process.env.VITEST_POOL_ID ||
  process.env.VITEST_WORKER_ID ||
  String(process.pid)
const runtimeRoot = path.join(
  miniprogramRoot,
  '..',
  '.generated',
  `miniprogram-runtime-vitest-${runtimeWorkerId}`,
)

let runtimeBuilt = false

function ensureRuntimeBuild() {
  if (runtimeBuilt) {
    return
  }

  buildRuntime(runtimeRoot)
  runtimeBuilt = true
}

export function readRuntimeJsFromTs(tsPath: string) {
  if (!tsPath.endsWith('.ts')) {
    throw new Error(`Expected a .ts file path, received: ${tsPath}`)
  }

  ensureRuntimeBuild()

  const relativePath = path.relative(miniprogramRoot, tsPath)
  const runtimeJsPath = path.join(runtimeRoot, relativePath.replace(/\.ts$/, '.js'))

  if (!fs.existsSync(runtimeJsPath)) {
    throw new Error(`Runtime JS output not found for ${relativePath}: ${runtimeJsPath}`)
  }

  return fs.readFileSync(runtimeJsPath, 'utf8')
}
