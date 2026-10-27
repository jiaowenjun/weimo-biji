import fs from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import { readRuntimeJsFromTs } from '../../../test-utils/runtime-output'

const componentDir = path.join(__dirname, '..')
const ts = fs.readFileSync(path.join(componentDir, 'index.ts'), 'utf8')
const js = readRuntimeJsFromTs(path.join(componentDir, 'index.ts'))

function methodSource(name: string, nextName: string) {
  const start = ts.indexOf(`${name}(`)
  const end = ts.indexOf(`${nextName}(`, start + name.length)
  expect(start).toBeGreaterThanOrEqual(0)
  expect(end).toBeGreaterThan(start)
  return ts.slice(start, end)
}

describe('memo-card menu gesture gate contract', () => {
  it('does not keep debug trace output in production menu gate code', () => {
    expect(ts).not.toContain('MEMO_CARD_MENU_TRACE_PREFIX')
    expect(ts).not.toContain('createMenuGestureTraceId(')
    expect(ts).not.toContain('_beginMenuGestureTrace(')
    expect(ts).not.toContain('_logMenuGestureTrace(')
    expect(ts).not.toContain('_finishMenuGestureTrace(')
    expect(ts).not.toContain('[memo-card menu-trace]')
    expect(js).not.toContain('MEMO_CARD_MENU_TRACE_PREFIX')
    expect(js).not.toContain('[memo-card menu-trace]')
  })

  it('exposes an opt-in relation gesture gate and emits candidate-state changes across the card touch lifecycle', () => {
    expect(ts).toContain('menuGestureGate: { type: Boolean, value: false }')
    expect(ts).toContain('MENU_GESTURE_GATE_DELAY_MS')
    expect(ts).toContain('_setMenuGestureGateActive(active: boolean)')
    expect(js).toContain('menuGestureGate: { type: Boolean, value: false }')
    expect(js).toContain("this.triggerEvent('gesturegatechange', { active })")
    expect(js).toContain('MENU_GESTURE_GATE_DELAY_MS')

    const touchStartSection = methodSource('handleLiftTouchStart', 'handleLiftTouchMove')
    const touchMoveSection = methodSource('handleLiftTouchMove', 'handleLiftTouchEnd')
    const touchEndSection = methodSource('handleLiftTouchEnd', '_cancelLift')

    expect(touchStartSection).toContain('setTimeout(() => {')
    expect(touchStartSection).toContain('this._setMenuGestureGateActive(true)')
    expect(touchMoveSection).toContain('this._setMenuGestureGateActive(false)')
    expect(touchEndSection).toContain('this._setMenuGestureGateActive(false)')
    expect(ts).toContain("this.triggerEvent('gesturegatechange', { active })")
    expect(js).toContain('this._setMenuGestureGateActive(true)')
    expect(js).toContain('this._setMenuGestureGateActive(false)')
  })

  it('raises menuchange before async card-menu measurement so parent gesture gates can close immediately', () => {
    const section = methodSource('_openCardMenu', 'closeMenu')
    const activePos = section.indexOf("this._emitMenuChange(true, 'open-card-menu')")
    const execPos = section.indexOf('query.exec((res) => {')

    expect(activePos).toBeGreaterThanOrEqual(0)
    expect(execPos).toBeGreaterThanOrEqual(0)
    expect(activePos).toBeLessThan(execPos)
  })

  it('rolls back the optimistic menuchange gate if the card-menu anchor rect cannot be measured', () => {
    const section = methodSource('_openCardMenu', 'closeMenu')
    const rectGuard = section.indexOf('if (!rect) {')
    const rollback = section.indexOf("this._emitMenuChange(false, 'card-menu-anchor-missing')", rectGuard)

    expect(rectGuard).toBeGreaterThanOrEqual(0)
    expect(rollback).toBeGreaterThan(rectGuard)
  })
})
