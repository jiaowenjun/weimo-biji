import { describe, expect, it } from 'vitest'
import { computePopoverPlacement } from '../placement'

describe('computePopoverPlacement', () => {
  const baseInput = {
    rect: {
      top: 240,
      right: 320,
      bottom: 280,
      left: 280,
      width: 40,
      height: 40,
    },
    windowWidth: 375,
    windowHeight: 667,
    safeAreaTop: 20,
    safeAreaBottom: 647,
    gap: 6,
    estimatedHeight: 124,
    margin: 8,
  } as const

  it('down-first: 两侧都放得下时优先向下', () => {
    expect(computePopoverPlacement(baseInput)).toEqual({
      placement: 'down',
      style: 'top: 286px; right: 55px;',
    })
  })

  it('up-first: 两侧都放得下时优先向上', () => {
    expect(
      computePopoverPlacement({
        ...baseInput,
        placementPriority: 'up-first',
      }),
    ).toEqual({
      placement: 'up',
      style: 'bottom: 433px; right: 55px;',
    })
  })

  it('up-first: 触发器靠近顶部时回退到向下', () => {
    expect(
      computePopoverPlacement({
        ...baseInput,
        rect: {
          ...baseInput.rect,
          top: 90,
          bottom: 130,
        },
        placementPriority: 'up-first',
      }),
    ).toEqual({
      placement: 'down',
      style: 'top: 136px; right: 55px;',
    })
  })

  it('down-first: 触发器靠近底部时回退到向上', () => {
    expect(
      computePopoverPlacement({
        ...baseInput,
        rect: {
          ...baseInput.rect,
          top: 560,
          bottom: 600,
        },
      }),
    ).toEqual({
      placement: 'up',
      style: 'bottom: 113px; right: 55px;',
    })
  })

  it('up-first: 上下都放不下时落到下方', () => {
    expect(
      computePopoverPlacement({
        ...baseInput,
        rect: {
          ...baseInput.rect,
          top: 120,
          bottom: 560,
          height: 440,
        },
        placementPriority: 'up-first',
      }),
    ).toEqual({
      placement: 'down',
      style: 'top: 566px; right: 55px;',
    })
  })

  it('start: 菜单左缘对齐触发器左缘，主体向右展开', () => {
    expect(
      computePopoverPlacement({
        ...baseInput,
        horizontalAlign: 'start',
        estimatedWidth: 110,
      }),
    ).toEqual({
      placement: 'down',
      style: 'top: 286px; left: 257px;',
    })
  })

  it('start: 触发器靠左时 left 取触发器左缘', () => {
    expect(
      computePopoverPlacement({
        ...baseInput,
        rect: {
          ...baseInput.rect,
          left: 40,
          right: 80,
        },
        horizontalAlign: 'start',
        estimatedWidth: 110,
      }),
    ).toEqual({
      placement: 'down',
      style: 'top: 286px; left: 40px;',
    })
  })

  it('center: 标题菜单在空间充足时水平居中于触发器下方', () => {
    expect(
      computePopoverPlacement({
        ...baseInput,
        horizontalAlign: 'center',
        estimatedWidth: 120,
      }),
    ).toEqual({
      placement: 'down',
      style: 'top: 286px; left: 240px;',
    })
  })

  it('center: 触发器靠近左侧时会 clamp 到安全边距', () => {
    expect(
      computePopoverPlacement({
        ...baseInput,
        rect: {
          ...baseInput.rect,
          left: 12,
          right: 52,
        },
        horizontalAlign: 'center',
        estimatedWidth: 120,
      }),
    ).toEqual({
      placement: 'down',
      style: 'top: 286px; left: 8px;',
    })
  })

  it('normalizes viewport trigger coordinates when the fixed layer starts below the page top', () => {
    expect(
      computePopoverPlacement({
        ...baseInput,
        rect: {
          ...baseInput.rect,
          top: 220,
          bottom: 260,
        },
        fixedLayerRect: {
          top: 64,
          left: 0,
          width: 375,
          height: 603,
        },
      }),
    ).toEqual({
      placement: 'down',
      style: 'top: 202px; right: 55px;',
    })
  })
})
