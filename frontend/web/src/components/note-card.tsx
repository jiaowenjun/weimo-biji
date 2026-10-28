import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { MoreHorizontal } from 'lucide-react'
import { WdfCard, type WdfCardHandle, type WdfCardMode } from 'weimo-ui-editor/components/wdf-card'
import { WdfCardBridgeContext } from 'weimo-ui-editor/components/wdf-card'
import { GlassIconButton } from 'weimo-ui/components/glass-icon-button'
import { ActionMenu, type ActionMenuItem } from 'weimo-ui/components/menu'
import { TagBar } from 'weimo-ui/components/tag-bar'
import type { WdfDocument } from 'weimo-wdf'

export type CardNote = {
  content: WdfDocument
  createdAtText: string
  tags?: string[]
}

export type CardDraft = {
  content: WdfDocument
  tags: string[]
}

export type NoteCardProps = {
  note: CardNote
  /** 挂载即进入编辑态(批注弹窗等场景),默认 view */
  defaultMode?: WdfCardMode
  disabled?: boolean
  /** 顶栏菜单项;空数组时不渲染菜单入口 */
  displayMenuItems?: ActionMenuItem[]
  /** 附加到底部插槽、标签栏之后的卡内内容(引用关系条等) */
  bottomBarExtra?: ReactNode
  onCancel?: () => void
  onTagClick?: (tag: string) => void
  onSave?: (draft: CardDraft) => void
  tagOptions?: string[]
}

/** 与旧 Card 一致的双击编辑豁免:交互元素上的双击不进入编辑 */
const NOTE_CARD_DOUBLE_CLICK_IGNORE_SELECTOR = [
  'a',
  'button',
  'input',
  'textarea',
  'select',
  'summary',
  '[contenteditable="true"]',
  '[role="button"]',
  '[role="link"]',
  '[role="menuitem"]',
].join(', ')

export function NoteCard({
  bottomBarExtra,
  defaultMode = 'view',
  disabled = false,
  displayMenuItems = [],
  note,
  onCancel,
  onTagClick,
  onSave,
  tagOptions = [],
}: NoteCardProps) {
  const cardRef = useRef<WdfCardHandle>(null)
  // 模式镜像:onModeChange 在用户请求时同步;view 落定即一次会话结束
  const [cardMode, setCardMode] = useState<WdfCardMode>(defaultMode)
  // 会话标签草稿:进入编辑时取 note.tags,保存时随文档一起上抛
  const [sessionTags, setSessionTags] = useState(() => note.tags ?? [])
  // 保存回调经 ref 读取最新会话标签,避免闭包过期
  const sessionTagsRef = useRef(sessionTags)
  useEffect(() => {
    sessionTagsRef.current = sessionTags
  }, [sessionTags])
  // 会话内是否已保存:用于区分 view 落定是保存收起还是取消收起
  const savedInSessionRef = useRef(false)
  const noteTags = useMemo(() => note.tags ?? [], [note.tags])

  const handleModeChange = useCallback(
    (mode: WdfCardMode) => {
      setCardMode(mode)
      if (mode === 'edit') {
        savedInSessionRef.current = false
        setSessionTags(noteTags)
        return
      }
      // view 落定:保存路径已先触发 onChange;未保存的收起视为取消
      if (savedInSessionRef.current) {
        savedInSessionRef.current = false
        return
      }
      onCancel?.()
    },
    [noteTags, onCancel],
  )

  const handleChange = useCallback(
    (document: WdfDocument) => {
      savedInSessionRef.current = true
      onSave?.({ content: document, tags: [...sessionTagsRef.current] })
    },
    [onSave],
  )

  const handleDoubleClick = useCallback(
    (event: React.MouseEvent<HTMLDivElement>) => {
      if (disabled || cardMode !== 'view') return
      if (
        event.target instanceof Element &&
        event.target.closest(NOTE_CARD_DOUBLE_CLICK_IGNORE_SELECTOR) !== null
      ) {
        return
      }
      cardRef.current?.open()
    },
    [cardMode, disabled],
  )

  // 只读场景(详情弹窗)经 bridge 关闭编辑入口;常规卡不走 bridge,
  // 保存由 onChange 上抛、失败回滚由父级 display override 负责
  const cancelRef = useRef<(() => void) | null>(null)
  const readOnlyBridge = useMemo(
    () =>
      disabled
        ? {
            readOnly: true,
            saving: false,
            error: '',
            cancelRef,
            save: (_content: unknown, close: () => void) => close(),
          }
        : null,
    [disabled],
  )

  const actionMenu =
    displayMenuItems.length > 0 ? (
      <ActionMenu
        ariaLabel="笔记操作"
        items={displayMenuItems}
        triggerProps={{
          render: <GlassIconButton aria-label="笔记操作" />,
        }}
        triggerIcon={<MoreHorizontal />}
      />
    ) : null

  const bottomBar = (
    <>
      <TagBar
        disabled={disabled}
        editable={cardMode === 'edit'}
        onTagClick={onTagClick}
        onTagsChange={setSessionTags}
        tagOptions={tagOptions}
        tags={cardMode === 'edit' ? sessionTags : noteTags}
      />
      {bottomBarExtra}
    </>
  )

  return (
    <div className="note-card" onDoubleClick={handleDoubleClick}>
      <WdfCardBridgeContext.Provider value={readOnlyBridge}>
        <WdfCard
          actionSlot={actionMenu}
          bottomBar={bottomBar}
          defaultMode={defaultMode}
          onChange={disabled ? undefined : handleChange}
          onModeChange={handleModeChange}
          ref={cardRef}
          title={note.createdAtText}
          value={note.content}
        />
      </WdfCardBridgeContext.Provider>
    </div>
  )
}
