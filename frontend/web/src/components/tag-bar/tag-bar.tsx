// 移植自 weimo-ui 的 TagBar(含 chip-button/chip-surface 小闭包):
// 交互状态机按原语义保留,涉及 prop 驱动的 setState-in-effect 处按调用点窄域豁免。
import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import type { ComponentPropsWithoutRef } from 'react'

import { FloatBar } from 'weimo-ui-core/components/float-bar'
import { cn } from 'weimo-ui-core/lib/utils'
import { ChipButton } from './chip-button'
import {
  TagPicker,
  type TagPickerApplyPayload,
  type TagPickerMode,
} from '../tag-picker'

import './tag-bar.css'

export type TagBarProps = Omit<
  ComponentPropsWithoutRef<'div'>,
  'children' | 'onChange'
> & {
  tags: string[]
  editable?: boolean
  tagOptions?: string[]
  onTagsChange?: (tags: string[]) => void
  onTagClick?: (tag: string) => void
  isTagClickEnabled?: (tag: string) => boolean
  disabled?: boolean
  addLabel?: string
  emptyLabel?: string
}

type TagBarRootParentOffset = {
  left: number
  top: number
}

export function TagBar({
  addLabel = '标签',
  className,
  disabled,
  editable = false,
  emptyLabel = '无',
  isTagClickEnabled = () => true,
  onTagClick,
  onTagsChange,
  tagOptions = [],
  tags,
  ...props
}: TagBarProps) {
  const [pickerOpen, setPickerOpen] = useState(false)
  const [pickerMode, setPickerMode] = useState<TagPickerMode>('insert')
  const [activeTag, setActiveTag] = useState('')
  const [renderAddChip, setRenderAddChip] = useState(editable)
  const [addChipExiting, setAddChipExiting] = useState(false)
  const rootRef = useRef<HTMLDivElement | null>(null)
  const rootPositionAnimationRef = useRef<Animation | null>(null)
  const previousRootParentOffsetRef = useRef<TagBarRootParentOffset | null>(null)
  const emptyChipMeasureRef = useRef<HTMLSpanElement | null>(null)
  const [emptyChipSize, setEmptyChipSize] = useState<number | null>(null)
  const canEdit = editable && !disabled && Boolean(onTagsChange)
  const isEmpty = tags.length === 0
  const visibleTags = isEmpty ? [editable ? addLabel : emptyLabel] : tags
  const showAddChip = !isEmpty && (editable || renderAddChip)
  const emptyChipLabel = editable ? addLabel : emptyLabel
  const emptyChipPrefix = editable ? '+' : '#'
  const emptyChipWidthStyle = emptyChipSize === null
    ? undefined
    : { inlineSize: `${emptyChipSize}px` }
  const rootPositionLayoutSignature = [
    editable ? 'edit' : 'view',
    renderAddChip ? 'add' : 'no-add',
    addChipExiting ? 'exit' : 'stable',
    emptyChipLabel,
    emptyChipPrefix,
    emptyChipSize ?? 'auto',
    tags.join('\u0000'),
  ].join('\u0001')

  function clearRootPositionAnimation() {
    rootPositionAnimationRef.current = null
    delete rootRef.current?.dataset.positionAnimating
  }

  function cancelRootPositionAnimation() {
    rootPositionAnimationRef.current?.cancel()
    clearRootPositionAnimation()
  }

  function readRootParentOffset(
    root: HTMLDivElement,
    parent: HTMLElement,
  ): TagBarRootParentOffset {
    const parentRect = parent.getBoundingClientRect()
    const rootRect = root.getBoundingClientRect()

    return {
      left: rootRect.left - parentRect.left,
      top: rootRect.top - parentRect.top,
    }
  }

  function resolveRootPositionAnimationStartOffset(
    root: HTMLDivElement,
    parent: HTMLElement,
  ) {
    return rootPositionAnimationRef.current
      ? readRootParentOffset(root, parent)
      : previousRootParentOffsetRef.current
  }

  function animateRootFromPreviousParentOffset() {
    const root = rootRef.current
    const parent = root?.parentElement
    if (!root || !parent) return

    const previousOffset = resolveRootPositionAnimationStartOffset(root, parent)
    cancelRootPositionAnimation()
    const nextOffset = readRootParentOffset(root, parent)
    previousRootParentOffsetRef.current = nextOffset
    if (!previousOffset) return

    const deltaX = previousOffset.left - nextOffset.left
    const deltaY = previousOffset.top - nextOffset.top
    if (Math.abs(deltaX) < 0.5 && Math.abs(deltaY) < 0.5) return
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return

    root.dataset.positionAnimating = 'true'
    rootPositionAnimationRef.current = root.animate(
      [
        { transform: `translate(${deltaX}px, ${deltaY}px)` },
        { transform: 'translate(0, 0)' },
      ],
      {
        duration: 180,
        easing: 'cubic-bezier(0.2, 0, 0, 1)',
        fill: 'none',
      },
    )
    rootPositionAnimationRef.current.onfinish = clearRootPositionAnimation
    rootPositionAnimationRef.current.oncancel = clearRootPositionAnimation
  }

  useLayoutEffect(() => {
    animateRootFromPreviousParentOffset()
  }, [rootPositionLayoutSignature])

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- 移植代码保留原语义
    if ((!editable || disabled || !onTagsChange) && pickerOpen) setPickerOpen(false)
  }, [disabled, editable, onTagsChange, pickerOpen])

  useEffect(() => () => {
    cancelRootPositionAnimation()
  }, [])

  useEffect(() => {
    /* eslint-disable react-hooks/set-state-in-effect -- 移植代码保留原语义 */
    if (editable) {
      setRenderAddChip(true)
      setAddChipExiting(false)
      return
    }

    if (renderAddChip) setAddChipExiting(true)
    /* eslint-enable react-hooks/set-state-in-effect */
  }, [editable, renderAddChip])

  useLayoutEffect(() => {
    /* eslint-disable react-hooks/set-state-in-effect -- 移植代码保留原语义(空标签胶囊测量) */
    if (!isEmpty) {
      setEmptyChipSize(null)
      return
    }

    const element = emptyChipMeasureRef.current
    if (!element) return

    const nextSize = element.getBoundingClientRect().width
    setEmptyChipSize((currentSize) =>
      currentSize === nextSize ? currentSize : nextSize,
    )
    /* eslint-enable react-hooks/set-state-in-effect */
  }, [emptyChipLabel, emptyChipPrefix, isEmpty])

  function openInsert() {
    if (!canEdit) return

    setPickerMode('insert')
    setActiveTag('')
    setPickerOpen(true)
  }

  function openUpdate(tag: string) {
    if (!canEdit) return

    setPickerMode('update')
    setActiveTag(tag)
    setPickerOpen(true)
  }

  function handleDisplayTagClick(tag: string) {
    if (editable || disabled) return
    if (!isTagClickEnabled(tag)) return

    onTagClick?.(tag)
  }

  function getChipClickHandler(tag: string) {
    if (editable) return () => (isEmpty ? openInsert() : openUpdate(tag))
    if (isEmpty) return undefined

    return () => handleDisplayTagClick(tag)
  }

  function handleApply(payload: TagPickerApplyPayload) {
    onTagsChange?.(payload.selectedTags)
  }

  function handleAddChipAnimationEnd() {
    if (!addChipExiting) return

    setRenderAddChip(false)
    setAddChipExiting(false)
  }

  return (
    <div
      aria-label={editable ? '编辑标签栏' : '标签栏'}
      className={cn('tag-bar', className)}
      data-editable={editable ? 'true' : 'false'}
      ref={rootRef}
      role={editable ? undefined : 'group'}
      {...props}
    >
      <FloatBar
        className="tag-bar__float-bar"
        role={editable ? undefined : 'presentation'}
        leftSlot={
          <div className="tag-bar__chips" aria-label="笔记标签">
            {visibleTags.map((tag, index) => (
              <span
                className={isEmpty ? 'tag-bar__morph-slot' : undefined}
                key={isEmpty ? 'empty' : `${tag}-${index}`}
                style={isEmpty ? emptyChipWidthStyle : undefined}
              >
                <ChipButton
                  disabled={
                    editable
                      ? !canEdit
                      : !isEmpty && !isTagClickEnabled(tag)
                  }
                  onClick={getChipClickHandler(tag)}
                  prefix={editable && isEmpty ? '+' : '#'}
                  state={editable ? 'glass' : 'default'}
                >
                  {tag}
                </ChipButton>
              </span>
            ))}
            {isEmpty ? (
              <span className="tag-bar__morph-measure" aria-hidden="true">
                <span ref={emptyChipMeasureRef}>
                  <ChipButton
                    disabled={editable && !canEdit}
                    prefix={emptyChipPrefix}
                    state={editable ? 'glass' : 'default'}
                  >
                    {emptyChipLabel}
                  </ChipButton>
                </span>
              </span>
            ) : null}
            {showAddChip ? (
              <ChipButton
                aria-label={`新增${addLabel}`}
                className="tag-bar__add-chip"
                data-exiting={!editable && addChipExiting ? 'true' : undefined}
                disabled={!canEdit}
                onAnimationEnd={handleAddChipAnimationEnd}
                onClick={openInsert}
                prefix="+"
                state="glass"
              >
                {addLabel}
              </ChipButton>
            ) : null}
          </div>
        }
      />
      <TagPicker
        initialDraft={activeTag}
        mode={pickerMode}
        onApply={handleApply}
        onOpenChange={setPickerOpen}
        open={pickerOpen}
        selectedTags={tags}
        tagOptions={tagOptions}
        targetTag={activeTag}
      />
    </div>
  )
}
