import fs from 'node:fs'
import path from 'node:path'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  captureComponentOptions,
  createComponentInstance,
} from '../../../test-utils/component-harness'

const componentDir = path.join(__dirname, '..')
const ts = fs.readFileSync(path.join(componentDir, 'index.ts'), 'utf8')
const wxml = fs.readFileSync(path.join(componentDir, 'index.wxml'), 'utf8')
const wxss = fs.readFileSync(path.join(componentDir, 'index.wxss'), 'utf8')

describe('memo-card reference bar contract', () => {
  it('allows callers to hide the reference bar without changing card content', () => {
    expect(ts).toContain("showReferenceBar: { type: Boolean, value: true }")
    expect(wxml).toContain('showReferenceBar &&')
  })

  it('renders the reference bar directly from reference props without measured animation state', () => {
    expect(wxml).toContain('wx:if="{{showReferenceBar && (referencePreview !== null || referencedByPreviews.length)}}"')
    expect(wxml).toContain('{{referencePreview.displayText}}')
    expect(wxml).toContain('wx:for="{{referencedByPreviews}}"')
    expect(ts).not.toContain('referenceBarRendered')
    expect(ts).not.toContain('referenceBarActive')
    expect(ts).not.toContain('referenceBarStyle')
    expect(ts).not.toContain('displayReferencePreview')
    expect(ts).not.toContain('displayReferencedByPreviews')
    expect(ts).not.toContain('_measureReferenceBarHeight')
  })

  it('catches reference bar taps and emits a dedicated event', () => {
    expect(wxml).toContain('catch:tap="handleReferenceTap"')
    expect(ts).toContain("this.triggerEvent('referencetap', {")
    expect(ts).toContain('memoId: this.data.memoId')
    expect(ts).not.toContain('ownerUsername')
  })

  it('opens the three-dot menu through a non-lifting button handler', () => {
    expect(wxml).toContain('mark:memoCardControl="more"')
    expect(wxml).toContain('bind:touchstart="handleMoreButtonTouchStart"')
    expect(wxml).not.toContain('catch:touchstart="handleMoreButtonTouchStart"')
    expect(wxml).toContain('bind:tap="handleMoreButtonTap"')
    expect(ts).toContain('handleMoreButtonTap()')
    expect(ts).toContain('this._openCardMenu({ liftCard: false })')
    expect(ts).toContain('handleMoreTap()')
    expect(ts).toContain('this._openCardMenu({ liftCard: true })')
  })

  it('keeps tag capsule touch events tappable while routing long press to the tag menu', () => {
    expect(wxml).toContain('mark:memoCardControl="tag"')
    expect(wxml).toContain('catch:longpress="handleTagLongPress"')
    expect(wxml).toContain('bind:touchstart="handleTagTouchStart"')
    expect(wxml).toContain('bind:touchmove="handleTagTouchMove"')
    expect(wxml).toContain('bind:touchend="handleTagTouchEnd"')
    expect(wxml).toContain('bind:touchcancel="handleTagTouchEnd"')
    expect(wxml).not.toContain('catch:touchstart="handleTagTouchStart"')
    expect(wxml).not.toContain('catch:touchmove="handleTagTouchMove"')
    expect(wxml).not.toContain('catch:touchend="handleTagTouchEnd"')
    expect(wxml).not.toContain('catch:touchcancel="handleTagTouchEnd"')
    expect(wxml).toContain('bind:tap="handleTagTap"')
    expect(ts).toContain("this.triggerEvent('tagtap', { tag })")
    expect(ts).toContain('handleTagLongPress(event: WechatMiniprogram.BaseEvent)')
    expect(ts).toContain("mode: 'tag'")
  })

  it('does not import the standalone touch-lift module from the lazy-loaded component', () => {
    expect(ts).not.toContain("from '../../utils/touch-lift'")
  })

  it('menu memo-detail triggers same event as reference bar tap', () => {
    expect(ts).toContain("id === 'memo-detail'")

    expect(ts).toContain("this.triggerEvent('referencetap', { memoId })")
  })

  it('binds capsule tag full-path title into popover header', () => {
    expect(wxml).toContain('header="{{menuPopoverHeader}}"')
    expect(wxml).toContain('scale-anchor="{{popoverScaleAnchor}}"')
    expect(ts).toContain('menuPopoverHeader: tag')
    expect(ts).toContain("menuPopoverHeader: ''")
    expect(ts).toContain("popoverScaleAnchor: 'start'")
    expect(ts).toContain("popoverScaleAnchor: 'end'")
  })

  it('does not clip the reference bar with animated max-height', () => {
    const referenceRule = wxss.match(/\.memo-card__reference\s*\{([\s\S]*?)\}/)?.[1] ?? ''

    expect(referenceRule).not.toContain('max-height')
    expect(referenceRule).not.toContain('overflow: hidden')
    expect(referenceRule).not.toContain('transition:')
    expect(wxss).not.toContain('.memo-card__reference--active')
  })

  it('uses justified typography for plain text and rich-text hosts', () => {
    expect(wxss).toMatch(
      /\.memo-card__rich\s*\{[\s\S]*text-align:\s*justify;[\s\S]*text-justify:\s*inter-ideograph;/,
    )
    expect(wxss).toMatch(
      /\.memo-card__plain\s*\{[\s\S]*text-align:\s*justify;[\s\S]*text-justify:\s*inter-ideograph;/,
    )
  })

  it('derives memo-card inset directly from the shared spacing-md token', () => {
    expect(wxss).toMatch(
      /\.memo-card\s*\{[\s\S]*padding:\s*var\(--spacing-md\);/,
    )
  })

  it('keeps reference rows visually separated without height measurement', () => {
    const innerRule = wxss.match(/\.memo-card__reference-inner\s*\{([\s\S]*?)\}/)?.[1] ?? ''

    expect(innerRule).toContain('gap: 4rpx')
    expect(wxml).not.toContain('wx:for-index="idx"')
    expect(wxml).not.toContain('memo-card__reference-line--spaced')
  })

  it('exposes referenceDisabled property that suppresses referencetap', () => {
    expect(ts).toContain("referenceDisabled: { type: Boolean, value: false }")
    expect(ts).toContain('this.data.referenceDisabled')
  })
})

describe('memo-card referenceDisabled behavior', () => {
  beforeEach(() => {
    vi.resetModules()
    vi.unstubAllGlobals()
  })

  it('does not emit referencetap when referenceDisabled is true', async () => {
    const options = await captureComponentOptions(() => import('../index'))
    const instance = createComponentInstance(options, {
      memoId: 5,
      referenceDisabled: true,
      referencePreview: { id: '3', displayText: '2026-04-30: hello' },
    }) as any
    Object.assign(instance, options.methods)
    instance.triggerEvent = vi.fn()

    instance.handleReferenceTap()

    expect(instance.triggerEvent).not.toHaveBeenCalled()
  })

  it('emits referencetap when referenceDisabled is false', async () => {
    const options = await captureComponentOptions(() => import('../index'))
    const instance = createComponentInstance(options, {
      memoId: 5,
      referenceDisabled: false,
      referencePreview: { id: '3', displayText: '2026-04-30: hello' },
    }) as any
    Object.assign(instance, options.methods)
    instance.triggerEvent = vi.fn()

    instance.handleReferenceTap()

    expect(instance.triggerEvent).toHaveBeenCalledWith('referencetap', {
      memoId: 5,
    })
  })
})
