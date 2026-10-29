import { useState } from 'react'
import { CardComposer } from 'weimo-ui-editor/components/card-composer'
import { TagBar } from '@/components/tag-bar'

import type { CardDraft, CardNote } from '@/components/note-card'

type PendingCreateCardProps = {
  clientId: string
  initialMode?: 'view' | 'edit'
  isClosing?: boolean
  note: CardNote
  onCancel?: () => void
  onExitAnimationEnd?: () => void
  onSave?: (draft: CardDraft) => void
  onViewTransitionEnd?: () => void
  onTagClick?: (tag: string) => void
  tagOptions?: string[]
}

export function PendingCreateCard({
  clientId,
  initialMode = 'edit',
  isClosing = false,
  note,
  onCancel,
  onExitAnimationEnd,
  onSave,
  onViewTransitionEnd,
  onTagClick,
  tagOptions = [],
}: PendingCreateCardProps) {
  // 会话标签草稿:与 CardComposer 的文档会话独立,保存时随文档一起上抛
  const [sessionTags, setSessionTags] = useState(() => note.tags ?? [])

  return (
    <CardComposer
      autoEnterEdit={initialMode !== 'view'}
      bottomBar={
        <TagBar
          editable
          onTagClick={onTagClick}
          onTagsChange={setSessionTags}
          tagOptions={tagOptions}
          tags={sessionTags}
        />
      }
      clientId={clientId}
      isClosing={isClosing}
      onCancel={onCancel}
      onExitAnimationEnd={onExitAnimationEnd}
      onModeChange={(mode) => {
        // 落定 view ≈ 旧卡的查看态过渡完成,衔接 pending-create 状态机
        if (mode === 'view') onViewTransitionEnd?.()
      }}
      onSave={(document) => onSave?.({ content: document, tags: [...sessionTags] })}
      title={note.createdAtText}
    />
  )
}
