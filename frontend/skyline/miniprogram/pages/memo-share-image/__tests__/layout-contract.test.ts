import fs from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'

const pageDir = path.join(__dirname, '..')

function read(file: string) {
  return fs.readFileSync(path.join(pageDir, file), 'utf8')
}

describe('memo-share-image layout contract', () => {
  it('uses the same floating transparent nav shell as the tag picker while preserving the share options trigger', () => {
    const wxml = read('index.wxml')
    const wxss = read('index.wxss')
    const ts = read('index.ts')

    expect(wxml.trimStart().startsWith('<navigation-bar')).toBe(false)
    expect(wxml).toContain('class="memo-share-nav-overlay"')
    expect(wxml).toContain('class="memo-share-nav-mask"')
    expect(wxml).toContain('background="transparent"')
    expect(wxml).toContain('back="{{false}}"')
    expect(wxml).toContain('class="memo-share-nav-back-slot"')
    expect(wxml).toContain('icon="chevron-left"')
    expect(wxml).toContain('variant="glass"')
    expect(wxml).toContain('feedbackStyle="nav-glass"')
    expect(wxml).toContain('size="md"')
    expect(wxml).toContain('bind:tap="handleClose"')
    expect(wxml).toContain('slot="right"')
    expect(wxml).toContain('class="memo-share-nav-actions"')
    expect(wxml).toContain('id="memo-share-visibility-trigger"')
    expect(wxml).toContain('icon="adjustment"')
    expect(wxml).toContain('visibilityMenuActive')
    expect(wxml).toContain('padding-top: calc({{navOverlayHeight}}px + var(--spacing-md));')

    expect(ts).toContain("import { computeCompactNavigationBarLayout } from '../../utils/navigation-bar-layout'")
    expect(ts).toContain('navOverlayHeight: number')
    expect(ts).toContain('navStatusMaskHeight: number')
    expect(ts).toContain('navOverlayHeight: 0')
    expect(ts).toContain('navStatusMaskHeight: 0')
    expect(ts).toContain('const capsuleRect = wx.getMenuButtonBoundingClientRect()')
    expect(ts).toContain('const compactNavLayout = computeCompactNavigationBarLayout({ height: capsuleRect.height })')
    expect(ts).toContain('navOverlayHeight: compactNavLayout.overlayHeight')
    expect(ts).toContain('navStatusMaskHeight: statusBarHeight || capsuleRect.top')
    expect(ts).toContain('handleClose: () => void')
    expect(ts).toContain('handleClose()')
    expect(ts).toContain('wx.navigateBack({ delta: 1 })')

    expect(wxss).toMatch(/\.memo-share-shell\s*\{[\s\S]*position:\s*relative/s)
    expect(wxss).toMatch(/\.memo-share-shell\s*\{[\s\S]*display:\s*flex/s)
    expect(wxss).toMatch(/\.memo-share-shell\s*\{[\s\S]*flex-direction:\s*column/s)
    expect(wxss).toMatch(/\.memo-share-shell\s*\{[\s\S]*overflow:\s*visible/s)
    expect(wxss).toMatch(
      /\.memo-share-nav-overlay\s*\{[\s\S]*position:\s*absolute[\s\S]*z-index:\s*5[\s\S]*pointer-events:\s*none/s,
    )
    expect(wxss).toMatch(
      /\.memo-share-nav-overlay\s*\{[\s\S]*left:\s*calc\(0rpx - var\(--page-inline-shell-margin\)\)/s,
    )
    expect(wxss).toMatch(
      /\.memo-share-nav-mask\s*\{[\s\S]*linear-gradient\([\s\S]*--color-nav-status-mask-start[\s\S]*--color-nav-status-mask-mid[\s\S]*--color-nav-status-mask-end/s,
    )
    expect(wxss).toMatch(/\.memo-share-nav-overlay \.weui-navigation-bar\s*\{[\s\S]*overflow:\s*visible/s)
  })
})
