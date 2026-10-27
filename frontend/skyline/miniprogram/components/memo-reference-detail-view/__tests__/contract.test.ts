import fs from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import { readRuntimeJsFromTs } from '../../../test-utils/runtime-output'

const componentDir = path.join(__dirname, '..')
const miniprogramDir = path.join(componentDir, '..', '..')

function read(file: string) {
  return fs.readFileSync(path.join(componentDir, file), 'utf8')
}

function readMiniprogram(file: string) {
  return fs.readFileSync(path.join(miniprogramDir, file), 'utf8')
}

describe('memo-reference-detail-view relation sections contract', () => {
  it('does not keep JS-thread relation trace output in production code', () => {
    const ts = read('index.ts')
    expect(ts).not.toContain('logRelationGestureTrace(')
    expect(ts).not.toContain('[memo-reference-detail relation-trace]')
  })

  it('accepts relation tab properties including tabSliderAnimated', () => {
    const ts = read('index.ts')
    const js = readRuntimeJsFromTs(path.join(componentDir, 'index.ts'))
    expect(ts).toContain('selectedRelationTab: { type: String')
    expect(ts).toContain('tabRenderState: { type: String')
    expect(ts).toContain('tabSliderAnimated: { type: Boolean')
    expect(ts).toContain('cardMenuActive: { type: Boolean')
    expect(ts).toContain('relationGestureFillStyle: { type: String')
    expect(ts).toContain('relationPanelsHeightStyle')
    expect(ts).toContain('relationPanelsTrackMounted')
    expect(ts).toContain('_syncRelationPanelsHeight')
    expect(ts).toContain('_syncRelationPanelsRenderState')
    expect(ts).toContain('_clearRelationPanelsUnmountTimer')
    expect(ts).toContain('getRelationSwipeAnimationContext')
    expect(ts).toContain('applyAnimatedStyle')
    expect(ts).toContain('runOnUI')
    expect(ts).toContain('handleCardMenuChange(')
    expect(ts).toContain('_localCardMenuActive')
    expect(ts).toContain('_localCardGestureGateActive')
    expect(ts).toContain('handleCardGestureGateChange(')
    expect(ts).toContain('this._syncRelationGestureSharedValues(')
    expect(ts).toContain("triggerEvent('gesturegatechange', event.detail)")
    expect(ts).toContain("triggerEvent('menuchange', event.detail)")
    expect(js).toContain('_localCardGestureGateActive')
    expect(js).toContain('handleCardGestureGateChange(event)')
    expect(js).toContain("this.triggerEvent('gesturegatechange', event.detail)")
    expect(ts).toContain("triggerEvent('relationtabswipe'")
    expect(ts).toContain("triggerEvent('relationpanellayout'")
    expect(ts).not.toContain('handleRelationTabTap(')
    expect(ts).not.toContain('_updateTabVisibility(')
  })

  it('keeps gesture worklets free of `this`/`self` so Skyline cannot freeze the component instance', () => {
    // 实测：worklet 通过 `this.xxx` / `self.xxx` 访问 SharedValue 会让 Skyline 冻结
    // 整个 component instance，父页面再 setData(selectedRelationTab) 时框架尝试写入
    // `this.properties.selectedRelationTab` 会抛 “Cannot assign to read only property”。
    // 必须把 SharedValue 提到模块顶层，让 worklet 通过模块闭包访问，绝不引用 `this`/`self`。
    const ts = read('index.ts')
    const shouldAcceptStart = ts.indexOf('shouldAcceptRelationPanelDrag(')
    const handleDragStart = ts.indexOf('handleRelationPanelDrag(', shouldAcceptStart)
    const dragEnd = ts.indexOf('_syncRelationPanelsHeight(', handleDragStart)
    expect(shouldAcceptStart).toBeGreaterThanOrEqual(0)
    expect(handleDragStart).toBeGreaterThan(shouldAcceptStart)
    expect(dragEnd).toBeGreaterThan(handleDragStart)
    const shouldAccept = ts.slice(shouldAcceptStart, handleDragStart)
    const handleDrag = ts.slice(handleDragStart, dragEnd)

    expect(ts).toMatch(/^const relationProgress = shared\(/m)
    expect(ts).toMatch(/^const relationDragging = shared\(/m)
    expect(ts).toMatch(/^const relationSelectedTabValue = shared\(/m)
    expect(ts).toMatch(/^const relationGestureEnabled = shared\(/m)

    expect(shouldAccept).not.toMatch(/\bthis\./)
    expect(shouldAccept).not.toMatch(/\bself\./)
    expect(handleDrag).not.toMatch(/\bthis\./)
    expect(handleDrag).not.toMatch(/\bself\./)
  })

  it('keeps relation swipe worklets free of debug-only mutable module state', () => {
    const ts = read('index.ts')
    const shouldAcceptStart = ts.indexOf('shouldAcceptRelationPanelDrag(')
    const handleDragStart = ts.indexOf('handleRelationPanelDrag(', shouldAcceptStart)
    const dragEnd = ts.indexOf('_syncRelationPanelsHeight(', handleDragStart)
    expect(shouldAcceptStart).toBeGreaterThanOrEqual(0)
    expect(handleDragStart).toBeGreaterThan(shouldAcceptStart)
    expect(dragEnd).toBeGreaterThan(handleDragStart)

    const shouldAccept = ts.slice(shouldAcceptStart, handleDragStart)
    const handleDrag = ts.slice(handleDragStart, dragEnd)

    expect(ts).not.toContain('relationLastShouldAcceptOutcome')
    expect(ts).not.toContain('relationDragActiveLogged')
    expect(shouldAccept).not.toContain('runOnJS(logRelationGestureTrace)')
    expect(handleDrag).not.toContain('runOnJS(logRelationGestureTrace)')
  })

  it('cleans up delayed track unmount timer on detached', () => {
    const ts = read('index.ts')
    expect(ts).toContain('detached()')
    expect(ts).toContain('_clearRelationPanelsUnmountTimer()')
  })

  it('does not render the tab switcher markup', () => {
    const wxml = read('index.wxml')
    expect(wxml).not.toContain('memo-reference-detail-view__tab')
    expect(wxml).not.toContain('handleRelationTabTap')
  })

  it('uses card ownership to derive viewer-role in references-only mode', () => {
    const wxml = read('index.wxml')
    const referencesEnd = wxml.indexOf(`<block wx:elif="{{mode === 'detail'}}">`)

    expect(referencesEnd).toBeGreaterThan(0)
    const referencesSection = wxml.slice(0, referencesEnd)
    expect(referencesSection).toContain(`viewer-role="{{item.ownerUsername ? 'friend' : 'self'}}"`)
    expect(referencesSection).not.toContain('viewer-role="self"')
  })

  it('renders root card before relation panels and uses horizontal track when mounted', () => {
    const ts = read('index.ts')
    const wxml = read('index.wxml')
    const rootIndex = wxml.indexOf('show-reference-bar="{{false}}"')
    const panelsIndex = wxml.indexOf('class="memo-reference-relation-panels"')

    expect(rootIndex).toBeGreaterThanOrEqual(0)
    expect(panelsIndex).toBeGreaterThan(rootIndex)
    expect(ts).toContain('shouldRespondRelationPanelDrag(')
    expect(wxml).toContain('wx:if="{{relationPanelsTrackMounted}}"')
    expect(wxml).toContain('class="memo-reference-relation-gesture-stack"')
    expect(wxml).toContain('class="memo-reference-relation-gesture-hitfill"')
    expect(wxml).toContain('relationGestureFillStyle')
    expect(wxml).toContain('<horizontal-drag-gesture-handler')
    expect(wxml).toContain('worklet:ongesture="handleRelationPanelDrag"')
    expect(wxml).toContain('worklet:should-accept-gesture="shouldAcceptRelationPanelDrag"')
    expect(wxml).toContain('worklet:should-response-on-move="shouldRespondRelationPanelDrag"')
    expect(wxml).toContain('class="memo-reference-relation-panels__track"')
    expect(wxml).not.toContain('transform: translateX({{selectedRelationTab === \'reference\' ? \'0%\' : \'-50%\'}});')
    expect(wxml).toContain('data-relation-panel="reference"')
    expect(wxml).toContain('data-relation-panel="referencedBy"')
  })

  it('forwards menu changes from every memo-card instance and disables relation swipe while a card menu is active', () => {
    const ts = read('index.ts')
    const js = readRuntimeJsFromTs(path.join(componentDir, 'index.ts'))
    const wxml = read('index.wxml')
    const memoCardCount = (wxml.match(/<memo-card/g) || []).length
    const menuBindingCount = (wxml.match(/bind:menuchange="handleCardMenuChange"/g) || []).length
    const gateBindingCount = (wxml.match(/bind:gesturegatechange="handleCardGestureGateChange"/g) || []).length
    const gateOptInCount = (wxml.match(/menu-gesture-gate="\{\{true\}\}"/g) || []).length
    const syncStart = ts.indexOf("\n    _syncRelationGestureSharedValues(")
    const syncEnd = ts.indexOf('_animateRelationProgressToSelected()', syncStart)

    expect(memoCardCount).toBeGreaterThan(0)
    expect(menuBindingCount).toBe(memoCardCount)
    expect(gateBindingCount).toBe(memoCardCount)
    expect(gateOptInCount).toBe(memoCardCount)
    expect(ts).toContain("'cardMenuActive': function () {")
    expect(syncStart).toBeGreaterThanOrEqual(0)
    expect(syncEnd).toBeGreaterThan(syncStart)
    expect(ts.slice(syncStart, syncEnd)).toContain('!self._localCardGestureGateActive')
    expect(ts.slice(syncStart, syncEnd)).toContain('!this.properties.cardMenuActive')
    expect(js).toContain('!self._localCardGestureGateActive')
    expect(js).toContain('!this.properties.cardMenuActive')
  })

  it('forwards copy from every memo-card instance through the detail-view bridge', () => {
    const ts = read('index.ts')
    const wxml = read('index.wxml')
    const memoCardCount = (wxml.match(/<memo-card/g) || []).length
    const copyBindingCount = (wxml.match(/bind:copy="handleCardCopy"/g) || []).length

    expect(memoCardCount).toBeGreaterThan(0)
    expect(copyBindingCount).toBe(memoCardCount)
    expect(ts).toContain('handleCardCopy(event:')
    expect(ts).toContain("this.triggerEvent('cardcopy', event.detail)")
  })

  it('keeps flat sections for hidden tabRenderState with flex wrapper to prevent margin collapse', () => {
    const wxml = read('index.wxml')
    const wxss = read('index.wxss')

    expect(wxml).toContain('wx:else class="memo-reference-relation-flat"')
    expect(wxml).not.toContain('<block wx:else>')
    expect(wxml).toContain('wx:if="{{ownReferenceCards.length}}"')
    expect(wxml).toContain('wx:if="{{friendReferenceCards.length}}"')
    expect(wxml).toContain('wx:if="{{ownReferencedByCards.length}}"')
    expect(wxml).toContain('wx:if="{{friendReferencedByCards.length}}"')
    expect(wxss).toMatch(/\.memo-reference-relation-flat\s*\{[\s\S]*display:\s*flex[\s\S]*flex-direction:\s*column/)
  })

  it('styles relation panels track with panel gap and px-based swipe stride', () => {
    const wxss = read('index.wxss')
    const ts = read('index.ts')
    const gestureTs = read('relation-swipe-gesture.ts')

    expect(gestureTs).toContain('RELATION_PANEL_GAP_RPX = 52')
    expect(gestureTs).toContain('MEMO_LIST_GUTTER_RPX = 26')
    expect(gestureTs).toContain('computeRelationPanelLayoutMetrics')
    expect(wxss).toMatch(/\.memo-reference-relation-panels__track\s*\{[\s\S]*gap:\s*var\(--memo-reference-relation-panel-gap\)/)
    expect(wxss).toMatch(/\.memo-reference-relation-panels__panel\s*\{[\s\S]*flex:\s*0\s+0\s+100%/)
    expect(wxss).toMatch(/\.memo-reference-relation-panels__track--animated\s*\{[\s\S]*transition:\s*transform\s+260ms/)
    expect(ts).toContain('computeRelationPanelLayoutMetrics')
    expect(ts).toContain('relationPanelStridePx')
    expect(ts).toContain('relationProgress.value * relationPanelStridePx')
    expect(ts).not.toContain('-50 * relationProgress.value')
    expect(ts).toContain('evt.deltaX / relationPanelStridePx')
  })

  it('keeps tab icons in the bundled iconfont subset', () => {
    const iconfont = readMiniprogram('styles/iconfont.wxss')

    expect(iconfont).toContain('.iconfont--arrow-left-up-circle::before')
    expect(iconfont).toContain('.iconfont--arrow-right-down-circle::before')
  })
})
