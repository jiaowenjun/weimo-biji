import { describe, expect, it } from 'vitest'
import type { RichTextElementNode, RichTextNode } from '../markdown/types'
import { markedToNodes } from '../markdown/index'

/** 仅保留标签名与 text/br，便于在测试中对照分析与调试打印 */
function summarizeNodes(nodes: RichTextNode[]): unknown[] {
  return nodes.map((n) => {
    if ('type' in n && n.type === 'text') {
      return { kind: 'text', text: n.text }
    }
    const el = n as Extract<RichTextNode, { name: string }>
    const attrsClass = el.attrs?.class
    const children = el.children ? summarizeNodes(el.children) : undefined
    if (el.name === 'br') {
      return { kind: 'br' }
    }
    return {
      kind: 'element',
      name: el.name,
      class: attrsClass,
      ...(children !== undefined ? { children } : {}),
    }
  })
}

function summarizeRoots(markdown: string): unknown[] {
  const roots = markedToNodes(markdown)
  return summarizeNodes(roots)
}

function expectBlockquoteDiv(node: RichTextNode): asserts node is RichTextElementNode {
  if ('type' in node && node.type === 'text') throw new Error('expected element')
  const el = node as RichTextElementNode
  expect(el.name).toBe('div')
  expect(el.attrs?.class).toContain('memo-markdown__blockquote')
}

const INPUT_1 = '> 引用行1\n> 引用行2\n> 引用行3'

const INPUT_2 = '> 引用行1\n\n> 引用行2\n\n> 引用行3'

const INPUT_3 = '> 引用行1\n>\n> 引用行2\n>\n> 引用行3'

describe('blockquote 多行解析结构（验证 Skyline 换行分析）', () => {
  it('输入1：单引用块 / 三段落 / 无 br，带 tight-lines（紧凑间距）', () => {
    const roots = markedToNodes(INPUT_1)
    // eslint-disable-next-line no-console -- 刻意打印完整解析树供对照分析
    console.log('[输入1] summarizeRoots:', JSON.stringify(summarizeRoots(INPUT_1), null, 2))

    expect(roots).toHaveLength(1)
    expectBlockquoteDiv(roots[0])
    expect((roots[0] as RichTextElementNode).attrs?.class).toContain('memo-markdown__blockquote--tight-lines')

    const inner = summarizeNodes(roots[0].children ?? [])
    expect(inner).toHaveLength(3)

    for (const item of inner) {
      const p = item as Record<string, unknown>
      expect(p.kind).toBe('element')
      expect(p.name).toBe('p')
      const ch = p.children as unknown[]
      expect(ch).toHaveLength(1)
      expect((ch[0] as { kind: string }).kind).toBe('text')
    }

    expect(
      inner.map((p) => ((p as { children: { text: string }[] }).children[0] as { text: string }).text),
    ).toEqual(['引用行1', '引用行2', '引用行3'])

    expect(JSON.stringify(summarizeRoots(INPUT_1))).not.toContain('"kind":"br"')
  })

  it('输入2：空行打断 blockquote → 三个并列引用块，每块仅一行（无 br，块级堆叠正常）', () => {
    const roots = markedToNodes(INPUT_2)
    // eslint-disable-next-line no-console -- 刻意打印完整解析树供对照分析
    console.log('[输入2] summarizeRoots:', JSON.stringify(summarizeRoots(INPUT_2), null, 2))

    expect(roots).toHaveLength(3)
    const linesFromSeparateQuotes: string[] = []
    for (const root of roots) {
      expectBlockquoteDiv(root)
      expect((root as RichTextElementNode).attrs?.class).not.toContain('memo-markdown__blockquote--tight-lines')
      const inner = summarizeNodes(root.children ?? [])
      expect(inner).toHaveLength(1)
      const p = inner[0] as Record<string, unknown>
      expect(p.name).toBe('p')
      const ch = p.children as unknown[]
      expect(ch).toHaveLength(1)
      expect((ch[0] as { kind: string }).kind).toBe('text')
      linesFromSeparateQuotes.push((ch[0] as { text: string }).text)
    }

    expect(linesFromSeparateQuotes).toEqual(['引用行1', '引用行2', '引用行3'])

    expect(JSON.stringify(summarizeRoots(INPUT_2))).not.toContain('"kind":"br"')
  })

  it('输入3：单引用块 / 多段落（仅 > 的空行在内部形成分段），无 br，无 tight-lines', () => {
    const roots = markedToNodes(INPUT_3)
    // eslint-disable-next-line no-console -- 刻意打印完整解析树供对照分析
    console.log('[输入3] summarizeRoots:', JSON.stringify(summarizeRoots(INPUT_3), null, 2))

    expect(roots).toHaveLength(1)
    expectBlockquoteDiv(roots[0])
    expect((roots[0] as RichTextElementNode).attrs?.class).not.toContain('memo-markdown__blockquote--tight-lines')

    const inner = summarizeNodes(roots[0].children ?? [])
    expect(inner).toHaveLength(3)

    for (const item of inner) {
      const p = item as Record<string, unknown>
      expect(p.kind).toBe('element')
      expect(p.name).toBe('p')
      const ch = p.children as unknown[]
      expect(ch).toHaveLength(1)
      expect((ch[0] as { kind: string }).kind).toBe('text')
    }

    expect(
      inner.map((p) => ((p as { children: { text: string }[] }).children[0] as { text: string }).text),
    ).toEqual(['引用行1', '引用行2', '引用行3'])

    expect(JSON.stringify(summarizeRoots(INPUT_3))).not.toContain('"kind":"br"')
  })
})
