import { Check, Search, X } from 'lucide-react'
import type { KeyboardEvent, ReactNode } from 'react'

import { DialogPanel } from 'weimo-ui-core/components/coss/dialog'
import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
} from 'weimo-ui-tagtree/components/coss/input-group'
import { ScrollArea } from 'weimo-ui-tagtree/components/coss/scroll-area'
import { ActionDialog } from 'weimo-ui-core/components/action-dialog'
import { FrostedIconButton } from 'weimo-ui-core/components/frosted-icon-button'
import { cn } from 'weimo-ui-core/lib/utils'
import { useTagPicker } from './use-tag-picker'
import type {
  TagPickerApplyPayload,
  TagPickerMode,
  TagPickerOption,
} from './tag-picker-model'

import './tag-picker.css'

export type TagPickerProps = {
  open: boolean
  mode: TagPickerMode
  tagOptions: string[]
  selectedTags: string[]
  targetTag?: string
  initialDraft?: string
  allowEmptyRemove?: boolean
  title?: ReactNode
  onOpenChange: (open: boolean) => void
  onApply: (payload: TagPickerApplyPayload) => void
}

const emptyLabelByMode: Record<TagPickerMode, string> = {
  insert: '可直接输入新标签',
  pick: '未找到匹配标签，仅可选择已有标签',
  update: '可直接输入新标签',
}

const placeholderByMode: Record<TagPickerMode, string> = {
  insert: '输入或选择标签',
  pick: '搜索已有标签',
  update: '输入新标签，留空可移除',
}

const inputLabelByMode: Record<TagPickerMode, string> = {
  insert: '新增标签',
  pick: '选择标签',
  update: '编辑标签',
}

function getDefaultTitle(mode: TagPickerMode, targetTag: string) {
  if (mode === 'pick') return '选择标签'
  if (mode === 'update') return targetTag ? `编辑 #${targetTag}` : '编辑标签'
  return '新增标签'
}

function TagPickerOptionRow({
  currentDraft,
  onPress,
  option,
}: {
  currentDraft: string
  onPress: (option: TagPickerOption) => void
  option: TagPickerOption
}) {
  const isExactMatch = option.tag === currentDraft && !option.optionBadge

  return (
    <button
      className={cn(
        'tag-picker__option',
        isExactMatch && 'tag-picker__option--active',
      )}
      disabled={option.disabled}
      onClick={() => onPress(option)}
      type="button"
    >
      <span className="tag-picker__option-prefix" aria-hidden="true">
        #
      </span>
      <span className="tag-picker__option-label">{option.tag}</span>
      {option.optionBadge ? (
        <span className="tag-picker__option-badge">{option.optionBadge}</span>
      ) : isExactMatch ? (
        <span className="tag-picker__option-check" aria-hidden="true">
          <Check />
        </span>
      ) : null}
    </button>
  )
}

export function TagPicker({
  allowEmptyRemove = true,
  initialDraft = '',
  mode,
  onApply,
  onOpenChange,
  open,
  selectedTags,
  tagOptions,
  targetTag = '',
  title,
}: TagPickerProps) {
  const { applyDraft, draft, handleClearDraft, handleInputChange, handleOptionPress, state } =
    useTagPicker({
      allowEmptyRemove,
      initialDraft,
      mode,
      onApplyPayload(payload) {
        onApply(payload)
        onOpenChange(false)
      },
      open,
      selectedTags,
      tagOptions,
      targetTag,
    })
  const dialogTitle = title ?? getDefaultTitle(mode, targetTag)
  const inputAriaLabel = inputLabelByMode[mode]

  function handleInputKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key !== 'Enter' || state.confirmDisabled) return
    event.preventDefault()
    applyDraft()
  }

  return (
    <ActionDialog
      className="tag-picker"
      closeLabel="关闭标签选择器"
      floatBarClassName="tag-picker__float-bar"
      onOpenChange={onOpenChange}
      open={open}
      title={dialogTitle}
      titleClassName="tag-picker__title"
      toolbarLabel="标签选择器工具栏"
      bottomBarLabel="标签选择器输入栏"
      bottomBarClassName="tag-picker__bottom-float-bar"
      bottomBarLeftSlot={
        <div className="tag-picker__input-row">
          <InputGroup data-mode={mode}>
            <InputGroupInput
              aria-label={inputAriaLabel}
              onChange={(event) => handleInputChange(event.target.value)}
              onKeyDown={handleInputKeyDown}
              placeholder={placeholderByMode[mode]}
              type="text"
              value={draft}
            />
            {mode === 'pick' ? (
              <InputGroupAddon align="inline-start">
                <Search aria-hidden="true" />
              </InputGroupAddon>
            ) : null}
            {draft ? (
              <InputGroupAddon align="inline-end">
                <button
                  aria-label="清空"
                  className="tag-picker__clear"
                  onClick={handleClearDraft}
                  type="button"
                >
                  <X />
                </button>
              </InputGroupAddon>
            ) : null}
          </InputGroup>
          <FrostedIconButton
            aria-label="确认"
            className="tag-picker__confirm"
            disabled={state.confirmDisabled}
            onClick={() => applyDraft()}
          >
            <Check />
          </FrostedIconButton>
        </div>
      }
    >
      <DialogPanel className="tag-picker__panel">
        <ScrollArea
          className="tag-picker__scroll"
          scrollFade={false}
          scrollbarGutter
        >
          <div className="tag-picker__list" role="listbox">
            {state.options.length > 0 ? (
              state.options.map((option) => (
                <TagPickerOptionRow
                  currentDraft={state.draft}
                  key={option.tag}
                  onPress={handleOptionPress}
                  option={option}
                />
              ))
            ) : (
              <p className="tag-picker__empty">{emptyLabelByMode[mode]}</p>
            )}
          </div>
        </ScrollArea>
      </DialogPanel>
    </ActionDialog>
  )
}
