import { Lexer } from './lexer'
import { Parser } from './parser'
import { NodeParser } from './node-renderer'
import type { MarkedOptions, RichTextNode } from './types'

export { Renderer } from './renderer'
export type { MarkedOptions, RendererMethods, RichTextNode, RichTextElementNode, RichTextTextNode } from './types'

export function marked(src: string, options?: MarkedOptions): string {
  const tokens = Lexer.lex(src)
  return Parser.parse(tokens, options?.renderer)
}

export function markedToNodes(src: string): RichTextNode[] {
  const tokens = Lexer.lex(src)
  return NodeParser.parse(tokens)
}
