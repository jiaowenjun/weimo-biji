import type { WdfBlock, WdfDocument } from '../utils/wdf'
import { plainTextToWdfDocument } from '../utils/wdf'

/** 单段纯文本 WDF 文档(测试夹具) */
export function wdfDoc(text: string): WdfDocument {
  return plainTextToWdfDocument(text)
}

/** 指定块序列的 WDF 文档(测试夹具) */
export function wdfDocFromBlocks(blocks: WdfBlock[]): WdfDocument {
  return {
    schema: 'weimo.document',
    version: 1,
    root: { type: 'doc', content: blocks },
  }
}
