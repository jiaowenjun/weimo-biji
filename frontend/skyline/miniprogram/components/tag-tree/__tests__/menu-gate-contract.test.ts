import { readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { readRuntimeJsFromTs } from '../../../test-utils/runtime-output'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const componentDir = path.join(__dirname, '..')
const tsPath = path.join(componentDir, 'index.ts')
const wxmlPath = path.join(componentDir, 'index.wxml')
const ts = readFileSync(tsPath, 'utf8')
const runtimeJs = readRuntimeJsFromTs(tsPath)
const wxml = readFileSync(wxmlPath, 'utf8')

function methodSource(source: string, name: string, nextName: string) {
  const start = source.indexOf(`${name}(`)
  const end = source.indexOf(`${nextName}(`, start + name.length)
  expect(start).toBeGreaterThanOrEqual(0)
  expect(end).toBeGreaterThan(start)
  return source.slice(start, end)
}

describe('tag-tree menu gesture gate contract', () => {
  it('raises a long-press candidate gate across the row touch lifecycle', () => {
    expect(ts).toContain('MENU_GESTURE_GATE_DELAY_MS')
    expect(ts).toContain('_setMenuGestureGateActive(active: boolean)')
    expect(runtimeJs).toContain('MENU_GESTURE_GATE_DELAY_MS')
    expect(runtimeJs).toContain("this.triggerEvent('gesturegatechange', { active })")

    const touchStart = methodSource(ts, 'handleRowTouchStart', 'handleRowTouchMove')
    const touchMove = methodSource(ts, 'handleRowTouchMove', 'handleRowTouchEnd')
    const touchEnd = methodSource(ts, 'handleRowTouchEnd', '_cancelLift')

    expect(touchStart).toContain('setTimeout(() => {')
    expect(touchStart).toContain('this._setMenuGestureGateActive(true)')
    expect(touchMove).toContain('this._setMenuGestureGateActive(false)')
    expect(touchEnd).toContain('this._setMenuGestureGateActive(false)')
  })

  it('optimistically raises menuchange before async menu anchor measurement and rolls back on rect failure', () => {
    const openSource = methodSource(ts, '_openTagMenu', 'closeMenu')
    const activePos = openSource.indexOf("this.triggerEvent('menuchange', { active: true })")
    const execPos = openSource.indexOf('query.exec((res) => {')
    const rectGuard = openSource.indexOf('if (!rect) {')
    const rollbackPos = openSource.indexOf("this.triggerEvent('menuchange', { active: false })", rectGuard)

    expect(activePos).toBeGreaterThanOrEqual(0)
    expect(execPos).toBeGreaterThan(activePos)
    expect(rectGuard).toBeGreaterThanOrEqual(0)
    expect(rollbackPos).toBeGreaterThan(rectGuard)
    expect(runtimeJs).toContain("this.triggerEvent('menuchange', { active: true })")
    expect(runtimeJs).toContain("this.triggerEvent('menuchange', { active: false })")
  })

  it('keeps row touch bindings bubbled while forwarding menu and gesture gate changes to the parent scroll owner', () => {
    expect(wxml).toContain('bind:touchmove="handleRowTouchMove"')
    expect(wxml).toContain('bind:longpress="handleRowMenuLongPress"')
    expect(ts).toContain("this.triggerEvent('gesturegatechange', { active })")
    expect(ts).toContain("this.triggerEvent('menuchange', { active: false })")
  })
})
