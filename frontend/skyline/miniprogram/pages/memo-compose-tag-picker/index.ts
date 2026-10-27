import { workspaceStore } from '../../store/store-bindings/workspace-store.instance'
import { computeCompactNavigationBarLayout } from '../../utils/navigation-bar-layout'
import { pruneMemoTagNoneWhenMixed } from '../../utils/tag-none'
import { type TagPickerDraftSource } from '../../utils/tag-search'
import { applyNavStatusBarStyle } from '../../utils/theme'
import { loadTagOptionsFromFriend, loadTagOptionsFromWorkspace } from './tag-options-source'
import { deriveTagPickerViewState, type TagPickerOption } from './view-state'

// 双击同一行的最大间隔（ms）。与系统双击常用阈值一致，避免过宽误触。
const DOUBLE_TAP_INTERVAL_MS = 300

interface MemoComposeTagPickerPageData {
  mode: MemoComposeTagPickerMode
  tagTreeScope: 'self' | 'friend'
  friendUsername: string
  targetTag: string
  selectedTags: string[]
  allowEmptyRemove: boolean
  draft: string
  listFilterQuery: string
  confirmDisabled: boolean
  options: TagPickerOption[]
  loading: boolean
  loadFailed: boolean
  initialized: boolean
  keyboardHeight: number
  navOverlayHeight: number
  navStatusMaskHeight: number
  inputFocus: boolean
}

interface MemoComposeTagPickerPageCustom {
  _eventChannel: WechatMiniprogram.EventChannel | null
  _rawTagOptions: string[]
  _lastOptionTapTag: string
  _lastOptionTapAt: number
  syncInit: (payload: MemoComposeTagPickerInitPayload) => void
  updateDraftState: (rawDraft: string, draftSource: TagPickerDraftSource) => void
  ensureTagTreeLoaded: () => Promise<void>
  emitApply: (selectedTags: string[]) => void
  applyPickedTag: (rawDraft: string) => void
  handleClose: () => void
  handleDraftInput: (e: WechatMiniprogram.Input) => void
  handleClearDraft: () => void
  handleConfirm: () => void
  handleRemove: () => void
  handleOptionTap: (e: WechatMiniprogram.BaseEvent) => void
  handleRetry: () => void
  handleKeyboardHeightChange: (e: WechatMiniprogram.CustomEvent<{ height: number; duration: number }>) => void
}

Page<MemoComposeTagPickerPageData, MemoComposeTagPickerPageCustom>({
  data: {
    mode: 'insert' as MemoComposeTagPickerMode,
    tagTreeScope: 'self' as 'self' | 'friend',
    friendUsername: '',
    targetTag: '',
    selectedTags: [] as string[],
    allowEmptyRemove: true,
    draft: '',
    listFilterQuery: '',
    confirmDisabled: true,
    options: [] as TagPickerOption[],
    loading: false,
    loadFailed: false,
    initialized: false,
    keyboardHeight: 0,
    navOverlayHeight: 0,
    navStatusMaskHeight: 0,
    /** 默认 false，避免 pick 等模式首帧在 onLoad 前因默认 true 而抢焦点；insert/update 在 onLoad 里再置为 true。 */
    inputFocus: false,
  },

  _eventChannel: null,
  _rawTagOptions: [],
  _lastOptionTapTag: '',
  _lastOptionTapAt: 0,

  onLoad(query) {
    const m = query.mode
    const mode: MemoComposeTagPickerMode =
      m === 'update' ? 'update' : m === 'pick' ? 'pick' : 'insert'
    const capsuleRect = wx.getMenuButtonBoundingClientRect()
    const { statusBarHeight = 0 } = wx.getWindowInfo()
    const compactNavLayout = computeCompactNavigationBarLayout({ height: capsuleRect.height })

    this.setData({
      mode,
      navOverlayHeight: compactNavLayout.overlayHeight,
      navStatusMaskHeight: statusBarHeight || capsuleRect.top,
      inputFocus: mode !== 'pick',
    })

    this._eventChannel = this.getOpenerEventChannel()
    if (this._eventChannel) {
      this._eventChannel.on('memo-compose-tag-picker-init', (payload: MemoComposeTagPickerInitPayload) => {
        this.syncInit(payload)
        void this.ensureTagTreeLoaded()
      })
    }
  },

  onShow() {
    applyNavStatusBarStyle()
  },

  syncInit(payload: MemoComposeTagPickerInitPayload) {
    // 每次初始化时清空双击计时，避免极端复用场景下的跨次误判。
    this._lastOptionTapTag = ''
    this._lastOptionTapAt = 0

    const mode = payload.mode
    const allowEmptyRemove = payload.allowEmptyRemove ?? true
    const tagTreeScope = payload.tagTreeScope ?? 'self'
    const friendUsername = tagTreeScope === 'friend' ? String(payload.friendUsername || '').trim() : ''
    const selectedTags = [...payload.selectedTags]
    const viewState = deriveTagPickerViewState({
      mode,
      targetTag: payload.targetTag,
      selectedTags,
      rawDraft: payload.initialDraft,
      rawTagOptions: this._rawTagOptions,
      listFilterQuery: '',
      draftSource: 'sync-init',
      allowEmptyRemove,
    })

    this.setData({
      mode,
      tagTreeScope,
      friendUsername,
      targetTag: payload.targetTag,
      selectedTags,
      allowEmptyRemove,
      inputFocus: payload.mode !== 'pick',
      ...viewState,
    })
  },

  updateDraftState(rawDraft: string, draftSource: TagPickerDraftSource) {
    const viewState = deriveTagPickerViewState({
      mode: this.data.mode,
      targetTag: this.data.targetTag,
      selectedTags: this.data.selectedTags,
      rawDraft,
      rawTagOptions: this._rawTagOptions,
      listFilterQuery: this.data.listFilterQuery,
      draftSource,
      allowEmptyRemove: this.data.allowEmptyRemove,
    })

    this.setData({
      ...viewState,
    })
  },

  async ensureTagTreeLoaded() {
    if (this.data.initialized || this.data.loading) return

    this.setData({ loading: true, loadFailed: false })

    try {
      if (this.data.tagTreeScope === 'friend') {
        const friendUsername = this.data.friendUsername.trim()
        if (!friendUsername) throw new Error('friend unavailable')
        this._rawTagOptions = await loadTagOptionsFromFriend(friendUsername)
      } else {
        this._rawTagOptions = await loadTagOptionsFromWorkspace(workspaceStore)
      }

      const viewState = deriveTagPickerViewState({
        mode: this.data.mode,
        targetTag: this.data.targetTag,
        selectedTags: this.data.selectedTags,
        rawDraft: this.data.draft,
        rawTagOptions: this._rawTagOptions,
        listFilterQuery: this.data.listFilterQuery,
        allowEmptyRemove: this.data.allowEmptyRemove,
      })

      this.setData({
        ...viewState,
        loading: false,
        loadFailed: false,
        initialized: true,
      })
    } catch {
      this.setData({
        loading: false,
        loadFailed: true,
      })
    }
  },

  emitApply(selectedTags: string[]) {
    const nextTags = pruneMemoTagNoneWhenMixed(selectedTags)
    if (this._eventChannel) {
      this._eventChannel.emit('memo-compose-tag-picker-apply', {
        selectedTags: nextTags,
      } as MemoComposeTagPickerApplyPayload)
    }

    wx.navigateBack({ delta: 1 })
  },

  handleClose() {
    wx.navigateBack({ delta: 1 })
  },

  handleDraftInput(e: WechatMiniprogram.Input) {
    this.updateDraftState(e.detail.value || '', 'input')
  },

  handleClearDraft() {
    this.updateDraftState('', 'input')
  },

  handleConfirm() {
    if (this.data.confirmDisabled) return
    this.applyPickedTag(this.data.draft)
  },

  // 与点击「确认」按钮等价的提交核心：
  // - 双击列表行可直接调用，避免依赖 setData(draft) 的异步性
  // - 调用方负责保证已通过 disabled / confirmDisabled 等前置校验
  // 注意：replace 模式下若 rawDraft 与 targetTag 相同，按既有 handleConfirm
  // 的语义为「不变更并关闭」，等价于用户主动放弃修改，这里保持一致。
  applyPickedTag(rawDraft: string) {
    const { mode, targetTag, selectedTags } = this.data
    const draft = (rawDraft || '').replace(/^#+/, '').trim()

    if (mode === 'update' && !draft) {
      if (!this.data.allowEmptyRemove) return
      this.handleRemove()
      return
    }

    if (!draft) return

    if (mode === 'insert' || mode === 'pick') {
      if (selectedTags.includes(draft)) return
      this.emitApply([...selectedTags, draft])
      return
    }

    if (draft === targetTag) {
      this.handleClose()
      return
    }

    const otherTags = selectedTags.filter((tag) => tag !== targetTag)
    if (otherTags.includes(draft)) return

    const next = [...selectedTags]
    const idx = next.indexOf(targetTag)
    if (idx !== -1) {
      next[idx] = draft
    } else {
      next.push(draft)
    }

    this.emitApply(next)
  },

  handleRemove() {
    this.emitApply(this.data.selectedTags.filter((tag) => tag !== this.data.targetTag))
  },

  handleOptionTap(e: WechatMiniprogram.BaseEvent) {
    const tag = String(e.currentTarget.dataset.tag || '')
    if (!tag) return

    const option = this.data.options.find((item) => item.tag === tag)
    if (option?.disabled) return

    // 同一行在 DOUBLE_TAP_INTERVAL_MS 内第二次点击 = 双击 = 直接提交
    const now = Date.now()
    if (
      this._lastOptionTapTag === tag &&
      now - this._lastOptionTapAt <= DOUBLE_TAP_INTERVAL_MS
    ) {
      this._lastOptionTapTag = ''
      this._lastOptionTapAt = 0
      this.applyPickedTag(tag)
      return
    }

    this._lastOptionTapTag = tag
    this._lastOptionTapAt = now
    this.updateDraftState(tag, 'list-tap')
  },

  handleRetry() {
    this.setData({ loadFailed: false })
    void this.ensureTagTreeLoaded()
  },

  handleKeyboardHeightChange(e: WechatMiniprogram.CustomEvent<{ height: number; duration: number }>) {
    const height = e.detail?.height ?? 0
    if (height === this.data.keyboardHeight) return
    this.setData({ keyboardHeight: height })
  },
})
