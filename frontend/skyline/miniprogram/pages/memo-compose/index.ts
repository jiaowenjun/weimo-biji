import { workspaceStore } from '../../store/store-bindings/workspace-store.instance'
import { hapticTap } from '../../utils/haptic'
import { markdownCompatTextToWdfDocument } from '../../utils/wdf'
import { computeCompactNavigationBarLayout } from '../../utils/navigation-bar-layout'
import { openMemoComposeTagPicker, openMemoReferenceList, openMemoReferences } from '../../utils/navigation'
import {
  buildMemoComposeCreateDraftContextKey,
  clearMemoComposeCreateDraft,
  readMemoComposeCreateDraft,
  writeMemoComposeCreateDraft,
} from '../../utils/memo-compose-create-draft'
import { toErrorMessage } from '../../utils/request'
import { tagsWithoutNoneForComposeBar } from '../../utils/tag-none'
import { applyNavStatusBarStyle } from '../../utils/theme'
import type { MemoRefId } from '../../models/memo'
import {
  applyBlockEnterAutoFormat,
  CENTER_QUOTE_PREFIX,
  HEADING_PREFIX,
  LIST_PREFIX,
  QUOTE_PREFIX,
  resolveFormattingSelection,
  resolveToolbarState,
  safeIntermediateRange,
  toggleLinePrefixFormatting,
} from './editor-formatting'

interface MemoComposePageData {
  mode: MemoComposeMode
  pageTitle: string
  memoId: number | null
  content: string
  selectedTags: string[]
  tagChipsForEditor: string[]
  refs: MemoRefId[]
  referenceId: MemoRefId | null
  referencePreviewText: string
  textareaFocus: boolean
  saving: boolean
  canSave: boolean
  initError: boolean
  keyboardHeight: number
  safeAreaBottom: number
  navOverlayHeight: number
  navStatusMaskHeight: number
  selectionStart: number
  selectionEnd: number
  headingActive: boolean
  listActive: boolean
  quoteActive: boolean
  centerQuoteActive: boolean
  toolbarActiveIndex: number
  toolbarSliderAnimated: boolean
}

interface MemoComposePageCustom {
  _initialContent: string
  _initialTags: string[]
  _eventChannel: WechatMiniprogram.EventChannel | null
  _selStart: number
  _selEnd: number
  _isComposing: boolean
  _toolbarRecomputeTimer: number | null
  _createDraftContextKey: string | null
  _skipCreateDraftPersist: boolean
  handleKeyboardHeightChange: (e: WechatMiniprogram.CustomEvent<{ height: number; duration: number }>) => void
  handleContentInput: (e: WechatMiniprogram.Input) => void
  handleSelectionChange: (e: WechatMiniprogram.CustomEvent<{ selectionStart: number; selectionEnd: number }>) => void
  handleCompositionStart: () => void
  handleCompositionEnd: () => void
  handleHeadingTap: () => void
  handleListTap: () => void
  handleQuoteTap: () => void
  handleCenterQuoteTap: () => void
  toggleLinePrefix: (prefix: string) => void
  recomputeToolbarState: () => void
  scheduleToolbarRecompute: () => void
  cancelPendingToolbarRecompute: () => void
  handleBack: () => void
  handleReferenceTap: () => void
  handleSave: () => Promise<void>
  handleAddTagTap: () => void
  handleTagChipTap: (e: WechatMiniprogram.BaseEvent) => void
  launchTagPicker: (payload: MemoComposeTagPickerInitPayload) => void
  applyTagPickerResult: (result: MemoComposeTagPickerApplyPayload) => void
  updateCanSave: () => void
  maybeRestoreCreateDraft: (payload: MemoComposeInitPayload) => void
  persistCreateDraftIfNeeded: () => void
}

Page<MemoComposePageData, MemoComposePageCustom>({
  data: {
    mode: 'create' as MemoComposeMode,
    pageTitle: '新建',
    memoId: null as number | null,
    content: '',
    selectedTags: [] as string[],
    tagChipsForEditor: [] as string[],
    refs: [] as MemoRefId[],
    referenceId: null as MemoRefId | null,
    referencePreviewText: '',
    textareaFocus: true,
    saving: false,
    canSave: false,
    initError: false,
    keyboardHeight: 0,
    safeAreaBottom: 0,
    navOverlayHeight: 0,
    navStatusMaskHeight: 0,
    selectionStart: -1,
    selectionEnd: -1,
    headingActive: false,
    listActive: false,
    quoteActive: false,
    centerQuoteActive: false,
    toolbarActiveIndex: -1,
    toolbarSliderAnimated: false,
  },

  _initialContent: '',
  _initialTags: [],
  _eventChannel: null,
  _selStart: -1,
  _selEnd: -1,
  _isComposing: false,
  _toolbarRecomputeTimer: null,
  _createDraftContextKey: null,
  _skipCreateDraftPersist: false,

  onLoad(query) {
    const mode = (query.mode === 'edit' ? 'edit' : 'create') as MemoComposeMode
    const memoId = query.memoId ? Number(query.memoId) : null
    const pageTitle = mode === 'edit' ? '编辑' : query.quote === '1' ? '批注' : '新建'
    const capsuleRect = wx.getMenuButtonBoundingClientRect()
    const compactNavLayout = computeCompactNavigationBarLayout({ height: capsuleRect.height })

    let safeAreaBottom = 0
    let navStatusMaskHeight = capsuleRect.top
    try {
      const windowInfo = wx.getWindowInfo()
      const { statusBarHeight = 0 } = windowInfo
      safeAreaBottom = windowInfo.screenHeight - (windowInfo.safeArea?.bottom ?? windowInfo.screenHeight)
      navStatusMaskHeight = statusBarHeight || capsuleRect.top
    } catch {
      // keep defaults
    }

    this.setData({
      mode,
      memoId,
      safeAreaBottom,
      pageTitle,
      navOverlayHeight: compactNavLayout.overlayHeight,
      navStatusMaskHeight,
    })

    this._eventChannel = this.getOpenerEventChannel()
    if (this._eventChannel) {
      this._eventChannel.on('memo-compose-init', (payload: MemoComposeInitPayload) => {
        this._initialContent = payload.initialContent
        this._initialTags = [...payload.initialTags]
        this._createDraftContextKey = payload.mode === 'create'
          ? buildMemoComposeCreateDraftContextKey({
            initialRefs: payload.initialRefs,
            initialTags: payload.initialTags,
          })
          : null
        this._skipCreateDraftPersist = false
        const refs = Array.isArray(payload.initialRefs) ? [...payload.initialRefs] : []
        const referencePreviewText = refs[0] != null ? payload.initialReferencePreview || `笔记${refs[0]}` : ''
        const patch: Partial<MemoComposePageData> = {
          content: payload.initialContent,
          selectedTags: [...payload.initialTags],
          tagChipsForEditor: tagsWithoutNoneForComposeBar(payload.initialTags),
          refs,
          referenceId: refs[0] ?? null,
          referencePreviewText,
          pageTitle: payload.mode === 'edit' ? '编辑' : refs.length > 0 ? '批注' : '新建',
        }
        if (payload.mode === 'edit') {
          patch.selectionStart = 0
          patch.selectionEnd = 0
        }
        this.setData(patch, () => {
          if (payload.mode === 'edit') {
            this._selStart = 0
            this._selEnd = 0
            this.recomputeToolbarState()
            this.updateCanSave()
            return
          }
          this.maybeRestoreCreateDraft(payload)
        })
      })
    }

    if (mode === 'create') {
      this.updateCanSave()
    } else {
      setTimeout(() => {
        if (!this._initialContent && !this.data.content) {
          this.setData({ initError: true })
        }
      }, 500)
    }
  },

  onShow() {
    applyNavStatusBarStyle()
  },

  onHide() {
    this.persistCreateDraftIfNeeded()
  },

  onUnload() {
    this.persistCreateDraftIfNeeded()
    this.cancelPendingToolbarRecompute()
  },

  handleKeyboardHeightChange(e: WechatMiniprogram.CustomEvent<{ height: number; duration: number }>) {
    const height = e.detail?.height ?? 0
    if (height === this.data.keyboardHeight) return
    this.setData({ keyboardHeight: height })
  },

  updateCanSave() {
    const { mode, content, selectedTags } = this.data
    const trimmed = content.trim()
    let canSave = false

    if (mode === 'create') {
      canSave = trimmed.length > 0
    } else {
      const contentChanged = trimmed !== this._initialContent.trim()
      const tagsChanged =
        selectedTags.length !== this._initialTags.length ||
        selectedTags.some((t, i) => t !== this._initialTags[i])
      canSave = trimmed.length > 0 && (contentChanged || tagsChanged)
    }

    if (canSave !== this.data.canSave) {
      this.setData({ canSave })
    }
  },

  maybeRestoreCreateDraft(payload: MemoComposeInitPayload) {
    if (payload.mode !== 'create' || !this._createDraftContextKey) {
      this.updateCanSave()
      return
    }

    const draft = readMemoComposeCreateDraft(this._createDraftContextKey)
    if (!draft) {
      this.updateCanSave()
      return
    }

    const patch: Partial<MemoComposePageData> = {
      content: draft.content,
      selectedTags: [...draft.selectedTags],
      tagChipsForEditor: tagsWithoutNoneForComposeBar(draft.selectedTags),
    }
    if (!this.data.referencePreviewText && draft.referencePreviewText) {
      patch.referencePreviewText = draft.referencePreviewText
    }

    this.setData(patch, () => {
      this.updateCanSave()
    })
  },

  persistCreateDraftIfNeeded() {
    if (this.data.mode !== 'create' || !this._createDraftContextKey || this._skipCreateDraftPersist) {
      return
    }

    const trimmed = this.data.content.trim()
    if (!trimmed) {
      clearMemoComposeCreateDraft(this._createDraftContextKey)
      return
    }

    writeMemoComposeCreateDraft({
      contextKey: this._createDraftContextKey,
      content: this.data.content,
      selectedTags: [...this.data.selectedTags],
      referencePreviewText: this.data.referencePreviewText,
    })
  },

  handleContentInput(e: WechatMiniprogram.Input) {
    const content = e.detail.value

    if (!this._isComposing) {
      const autoFormat = applyBlockEnterAutoFormat(this.data.content, content)
      if (autoFormat) {
        const intermediate = safeIntermediateRange(
          this._selStart,
          this._selEnd,
          autoFormat.content.length,
        )
        this._selStart = autoFormat.selectionStart
        this._selEnd = autoFormat.selectionEnd
        this.cancelPendingToolbarRecompute()
        this.setData({
          content: autoFormat.content,
          selectionStart: intermediate.start,
          selectionEnd: intermediate.end,
        }, () => {
          this.setData({
            selectionStart: autoFormat.selectionStart,
            selectionEnd: autoFormat.selectionEnd,
          })
          this.cancelPendingToolbarRecompute()
          this.recomputeToolbarState()
        })
        this.updateCanSave()
        return
      }
    }

    const cursor = typeof e.detail.cursor === 'number' ? e.detail.cursor : -1
    if (cursor >= 0) {
      this._selStart = cursor
      this._selEnd = cursor
    }
    this.setData({ content })
    this.cancelPendingToolbarRecompute()
    this.recomputeToolbarState()
    this.updateCanSave()
  },

  handleSelectionChange(e: WechatMiniprogram.CustomEvent<{ selectionStart: number; selectionEnd: number }>) {
    const { selectionStart, selectionEnd } = e.detail || { selectionStart: -1, selectionEnd: -1 }
    this._selStart = selectionStart
    this._selEnd = selectionEnd
    // 拼音合成场景下，selectionchange 与 keyboardcompositionstart 在小程序事件
    // 队列里没有保证顺序；如果 selectionchange 先派发，立刻 recompute 会读到
    // 包含 composing buffer 的「视觉光标」并把工具栏高亮误关掉。
    // 这里改为延迟一个 idle 周期再 recompute，让合成事件有机会先把 _isComposing
    // 置位、或者后续 selectionchange/bindinput 取消并替代当前调度。
    this.scheduleToolbarRecompute()
  },

  handleCompositionStart() {
    this._isComposing = true
    // 进入合成态，挂起的 selectionchange recompute 一律作废。
    this.cancelPendingToolbarRecompute()
  },

  handleCompositionEnd() {
    this._isComposing = false
    this.cancelPendingToolbarRecompute()
    // 合成结束后用最新缓存重新校准一次工具栏状态：
    // - 正常上屏路径：随后 bindinput 还会再算一次，重复无副作用。
    // - 取消合成路径：bindinput 不会触发，这里负责把状态校回。
    this.recomputeToolbarState()
  },

  scheduleToolbarRecompute() {
    if (this._toolbarRecomputeTimer !== null) {
      clearTimeout(this._toolbarRecomputeTimer)
    }
    // 80ms 是一个经验值：
    //   - 比单次 IME 派发事件的间隔（< 16ms）大，足以让 compositionstart/update
    //     在同一手势里先于 recompute 落地。
    //   - 比用户感知阈值（~100ms）小，tap 移动光标的工具栏反馈仍然「即时」。
    this._toolbarRecomputeTimer = setTimeout(() => {
      this._toolbarRecomputeTimer = null
      this.recomputeToolbarState()
    }, 80) as unknown as number
  },

  cancelPendingToolbarRecompute() {
    if (this._toolbarRecomputeTimer !== null) {
      clearTimeout(this._toolbarRecomputeTimer)
      this._toolbarRecomputeTimer = null
    }
  },

  recomputeToolbarState() {
    const start = this._selStart
    const end = this._selEnd
    const contentLen = this.data.content.length
    // 拼音/中文合成期间的两类「假信号」需要冻结工具栏状态：
    //   1) keyboardcompositionstart/end 事件（仅特定 IME 触发）正常派发时，靠 _isComposing 判定。
    //   2) 事件不触发或派发顺序异常时：selectionchange 报告的是包含 composing buffer 的视觉光标位置，
    //      可能超出 committed content.length。此时按物理越界判定，维持原状态。
    // 两种情况都不切换，等合成确定上屏（content 与 cursor 同步更新）后由 bindinput 触发的
    // recomputeToolbarState 重新校准。
    if (this._isComposing) return
    if (start > contentLen || end > contentLen) return
    const { headingActive, listActive, quoteActive, centerQuoteActive } = resolveToolbarState(this.data.content, start, end)
    const patch: Partial<MemoComposePageData> = {}
    if (headingActive !== this.data.headingActive) patch.headingActive = headingActive
    if (listActive !== this.data.listActive) patch.listActive = listActive
    if (quoteActive !== this.data.quoteActive) patch.quoteActive = quoteActive
    if (centerQuoteActive !== this.data.centerQuoteActive) patch.centerQuoteActive = centerQuoteActive
    const activeIndex = headingActive ? 0 : listActive ? 1 : quoteActive ? 2 : centerQuoteActive ? 3 : -1
    if (activeIndex !== this.data.toolbarActiveIndex) {
      patch.toolbarActiveIndex = activeIndex
      patch.toolbarSliderAnimated = this.data.toolbarActiveIndex >= 0 && activeIndex >= 0
    }
    if (Object.keys(patch).length > 0) this.setData(patch)
  },

  handleHeadingTap() {
    this.toggleLinePrefix(HEADING_PREFIX)
  },

  handleListTap() {
    this.toggleLinePrefix(LIST_PREFIX)
  },

  handleQuoteTap() {
    this.toggleLinePrefix(QUOTE_PREFIX)
  },

  handleCenterQuoteTap() {
    this.toggleLinePrefix(CENTER_QUOTE_PREFIX)
  },

  toggleLinePrefix(prefix: string) {
    if (this._isComposing) return

    const preEditSelection = resolveFormattingSelection(
      this._selStart,
      this._selEnd,
      this.data.content.length,
    )
    const result = toggleLinePrefixFormatting(this.data.content, this._selStart, this._selEnd, prefix)
    const intermediate = safeIntermediateRange(
      preEditSelection.start,
      preEditSelection.end,
      result.content.length,
    )

    this._selStart = result.selectionStart
    this._selEnd = result.selectionEnd

    this.cancelPendingToolbarRecompute()

    this.setData({
      content: result.content,
      selectionStart: intermediate.start,
      selectionEnd: intermediate.end,
    }, () => {
      this.setData({
        selectionStart: result.selectionStart,
        selectionEnd: result.selectionEnd,
      })
      this.cancelPendingToolbarRecompute()
      this.recomputeToolbarState()
    })

    this.updateCanSave()
  },

  handleBack() {
    wx.navigateBack({ delta: 1 })
  },

  handleReferenceTap() {
    if (this.data.mode === 'edit' && this.data.memoId) {
      openMemoReferences(this.data.memoId)
      return
    }
    openMemoReferenceList(this.data.refs, { routeType: 'cupertino-inside' })
  },

  async handleSave() {
    if (!this.data.canSave || this.data.saving) return

    const { mode, memoId, content } = this.data
    const trimmed = content.trim()
    if (!trimmed) return

    const tags = [...this.data.selectedTags]

    hapticTap('light')
    this.setData({ saving: true })

    try {
      if (mode === 'edit') {
        if (!memoId) {
          wx.showToast({ title: '笔记 ID 缺失', icon: 'none' })
          this.setData({ saving: false })
          return
        }
        await workspaceStore.updateMemo(memoId, { content: markdownCompatTextToWdfDocument(trimmed), tags, refs: [...this.data.refs] })
      } else {
        await workspaceStore.createMemo({ content: markdownCompatTextToWdfDocument(trimmed), tags, refs: [...this.data.refs] })
      }
    } catch (error) {
      wx.showToast({ title: toErrorMessage(error, '保存笔记失败'), icon: 'none' })
      this.setData({ saving: false })
      return
    }

    if (mode === 'create' && this._createDraftContextKey) {
      this._skipCreateDraftPersist = true
      clearMemoComposeCreateDraft(this._createDraftContextKey)
    }

    this.setData({ saving: false })

    this._initialContent = trimmed
    this._initialTags = [...tags]
    this.updateCanSave()

    try {
      const savedPayload: MemoComposeSavedPayload = {
        mode,
        memoId: memoId ?? undefined,
      }
      this.getOpenerEventChannel().emit('memo-compose-saved', savedPayload)
    } catch {
      // EventChannel may not exist
    }

    wx.showToast({ title: mode === 'edit' ? '笔记已更新' : '笔记已保存', icon: 'success' })
    wx.navigateBack({ delta: 1 })
  },

  // --- Tag picker ---

  applyTagPickerResult(result: MemoComposeTagPickerApplyPayload) {
    this.setData({
      selectedTags: [...result.selectedTags],
      tagChipsForEditor: tagsWithoutNoneForComposeBar(result.selectedTags),
    })
    this.updateCanSave()
  },

  launchTagPicker(payload: MemoComposeTagPickerInitPayload) {
    openMemoComposeTagPicker(payload, (result) => {
      this.applyTagPickerResult(result)
    })
  },

  handleAddTagTap() {
    this.launchTagPicker({
      mode: 'insert',
      targetTag: '',
      selectedTags: [...this.data.selectedTags],
      initialDraft: '',
    })
  },

  handleTagChipTap(e: WechatMiniprogram.BaseEvent) {
    const detail = (e as WechatMiniprogram.CustomEvent<{ value?: string }>).detail
    const tag = String(detail?.value ?? '')
    if (!tag) return

    this.launchTagPicker({
      mode: 'update',
      targetTag: tag,
      selectedTags: [...this.data.selectedTags],
      initialDraft: tag,
    })
  },
})
