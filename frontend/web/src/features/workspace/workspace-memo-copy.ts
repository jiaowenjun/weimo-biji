export interface MemoClipboard {
  writeText(content: string): Promise<void>
}

function getMemoClipboard(): MemoClipboard | null {
  if (typeof navigator === 'undefined') return null

  return navigator.clipboard ?? null
}

export async function copyMemoContentToClipboard(
  content: string,
  clipboard: MemoClipboard | null = getMemoClipboard(),
) {
  if (!clipboard) {
    throw new Error('Clipboard API unavailable')
  }

  await clipboard.writeText(content)
}
