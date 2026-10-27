import fs from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import { readRuntimeJsFromTs } from '../../../test-utils/runtime-output'

const pageDir = path.join(__dirname, '..')
const rootDir = path.join(pageDir, '..', '..')

function read(file: string) {
  return fs.readFileSync(path.join(pageDir, file), 'utf8')
}

function readRoot(file: string) {
  return fs.readFileSync(path.join(rootDir, file), 'utf8')
}

function methodSource(ts: string, name: string, nextName: string) {
  const start = ts.indexOf(`${name}(`)
  const end = ts.indexOf(`${nextName}(`, start + name.length)
  expect(start).toBeGreaterThanOrEqual(0)
  expect(end).toBeGreaterThan(start)
  return ts.slice(start, end)
}

describe('memo-reference-detail page contract', () => {
  it('does not keep JS-thread page trace output in production code', () => {
    const ts = read('index.ts')
    expect(ts).not.toContain('logMemoReferenceDetailPageTrace(')
    expect(ts).not.toContain('[memo-reference-detail page-trace]')
  })

  it('is registered as a custom-scroll Skyline page', () => {
    const appJson = fs.readFileSync(path.join(rootDir, 'app.json'), 'utf8')
    const json = read('index.json')

    expect(appJson).toContain('"pages/memo-reference-detail/index"')
    expect(json).toContain('"navigationStyle": "custom"')
    expect(json).toContain('"disableScroll": true')
    expect(json).toContain('"memo-reference-detail-view": "/components/memo-reference-detail-view/index"')
    expect(json).not.toContain('memo-reference-relation-tab')
  })

  it('uses the share-page shell contract so the bottom toolbar is not clipped by cupertino routing', () => {
    const wxml = read('index.wxml')
    const wxss = read('index.wxss')

    expect(wxml).toContain('class="memo-reference-detail-shell ds-page-inline-shell"')
    expect(wxml).not.toContain('class="memo-reference-detail-page"')
    expect(wxml).toContain('class="memo-reference-detail-scroll__content"')
    expect(wxml).toContain('class="memo-reference-detail-toolbar memo-reference-detail-toolbar--rest"')
    expect(wxml).toContain('memo-reference-detail-toolbar__pill')
    expect(wxml).toContain('wx:if="{{mode === \'detail\' && !loading && errorMessage.length === 0 && rootViewerRole !== \'denied\' && tabRenderState !== \'hidden\'}}"')
    expect(wxml).toContain('tabRenderState === \'exiting\' ? \' memo-reference-detail-toolbar__pill--exiting\' : \'\'')
    expect(wxml).toContain('bind:tap="handleRelationTabTap"')
    expect(wxml).toContain('class="memo-reference-detail-toolbar__items"')
    expect(wxml).not.toContain('<memo-reference-relation-tab')
    expect(wxss).toMatch(/page\s*\{[\s\S]*display:\s*flex;[\s\S]*flex-direction:\s*column/)
    expect(wxss).not.toContain('.memo-reference-detail-page')
    expect(wxss).not.toMatch(/\.memo-reference-detail-shell\s*\{[^}]*width:\s*100%/)
    expect(wxss).toMatch(/\.memo-reference-detail-toolbar\s*\{[\s\S]*position:\s*absolute/)
    expect(wxss).toMatch(/\.memo-reference-detail-scroll__content\s*\{[\s\S]*176rpx/)
    expect(wxss).toMatch(/\.memo-reference-detail-toolbar__pill\s*\{[\s\S]*width:\s*360rpx/)
    expect(wxss).toMatch(/\.memo-reference-detail-toolbar__pill--exiting\s*\{[\s\S]*opacity:\s*0/)
  })

  it('promotes the tab items to a dedicated composition layer so the animated slider cannot intercept their taps', () => {
    const wxss = read('index.wxss')

    // Skyline 下 applyAnimatedStyle 会把 slider 提升为动画合成层，需要给 items wrapper
    // 也建立独立合成层（position+z-index+translateZ）才能稳定地把 items 排在 slider 之上。
    expect(wxss).toMatch(/\.memo-reference-detail-toolbar__items\s*\{[\s\S]*position:\s*relative/)
    expect(wxss).toMatch(/\.memo-reference-detail-toolbar__items\s*\{[\s\S]*z-index:\s*2/)
    expect(wxss).toMatch(/\.memo-reference-detail-toolbar__items\s*\{[\s\S]*transform:\s*translateZ\(0\)/)
    // items 自身不再设 z-index，避免与 wrapper 形成嵌套堆叠上下文带来歧义
    expect(wxss).not.toMatch(/\.memo-reference-detail-toolbar__item\s*\{[^}]*z-index/)
  })

  it('matches home memo-list horizontal gutter without triple-stacking ds-page-inline-shell spacing', () => {
    const wxss = read('index.wxss')

    expect(wxss).toMatch(
      /\.memo-reference-detail-shell\.ds-page-inline-shell\s*\{[^}]*margin-left:\s*0/,
    )
    expect(wxss).toMatch(
      /\.memo-reference-detail-shell\.ds-page-inline-shell\s*\{[^}]*margin-right:\s*0/,
    )
    expect(wxss).toMatch(
      /\.memo-reference-detail-shell\.ds-page-inline-shell\s*\{[^}]*padding-left:\s*0/,
    )
    expect(wxss).toMatch(
      /\.memo-reference-detail-shell\.ds-page-inline-shell\s*\{[^}]*padding-right:\s*0/,
    )
    expect(wxss).toMatch(
      /\.memo-reference-detail-scroll__content\s*\{[^}]*padding:\s*var\(--spacing-md\)\s+var\(--memo-layout-gutter\)\s+176rpx/,
    )
    expect(wxss).toMatch(
      /\.memo-reference-relation-panels \.memo-card-host[\s\S]*margin-left:\s*var\(--memo-layout-gutter\)/,
    )
    expect(wxss).not.toMatch(
      /\.memo-reference-relation-flat \.memo-card-host[\s\S]*margin-left:\s*var\(--memo-layout-gutter\)/,
    )
    const detailViewWxss = readRoot('components/memo-reference-detail-view/index.wxss')
    expect(detailViewWxss).toMatch(
      /\.memo-reference-relation-panels\s*\{[^}]*width:\s*calc\(100% \+ 2 \* var\(--memo-layout-gutter\)\)/,
    )
  })

  it('owns relation tab state on the page with sync helpers', () => {
    const ts = read('index.ts')
    expect(ts).toContain("from '../../utils/memo-reference-relation-tab'")
    expect(ts).toContain('createRelationTabState()')
    expect(ts).toContain('handleRelationTabTap(')
    expect(ts).toContain('reduceRelationTabOnSelect')
    expect(ts).toContain('reduceRelationTabOnCardsChange')
    expect(ts).toContain('reduceRelationTabExitComplete')
    expect(ts).toContain('RELATION_TAB_EXIT_TRANSITION_MS')
    expect(ts).toContain('_syncRelationTabFromData(')
    expect(ts).toContain('_setDataWithRelationTab(')
    expect(ts).toContain('_clearRelationTabExitTimer')
    expect(ts).toContain('_ensureRelationSwipeCtx')
    expect(ts).toContain('handleRelationTabSwipe(')
    expect(ts).toContain('_syncRelationGestureFill(')
    expect(ts).toContain('handleRelationPanelLayout(')
    expect(ts).toContain('computeRelationGestureFillHeightPx')
    expect(ts).toContain("applyAnimatedStyle('.memo-reference-detail-toolbar__slider'")
    expect(ts).toContain('transform: `translateX(${ctx.progress.value * 100}%)`')
    expect(ts).toContain('tabRenderState')
    expect(ts).toContain('onUnload()')
  })

  it('renders entry-specific nav skeletons and keeps in-app navigation inside a transparent overlay', () => {
    const wxml = read('index.wxml')
    const wxss = read('index.wxss')

    expect(wxml).toContain(`wx:if="{{entry === 'share'}}"`)
    expect(wxml).toContain('ext-class="weui-navigation-bar--title-base"')
    expect(wxml).toContain('home-button="{{true}}"')
    expect(wxml).toContain('bind:home="handleHomeTap"')
    expect(wxml).toContain('class="memo-reference-detail-nav-overlay"')
    expect(wxml).toContain('class="memo-reference-detail-nav-mask"')
    expect(wxml).toContain('style="height: {{navStatusMaskHeight}}px;"')
    expect(wxml).toContain('background="transparent"')
    expect(wxml).toContain('back="{{false}}"')
    expect(wxml).toContain('class="memo-reference-detail-nav-back-slot"')
    expect(wxml).toContain('slot="left"')
    expect(wxml).toContain('icon="chevron-left"')
    expect(wxml).toContain('variant="glass"')
    expect(wxml).toContain('feedbackStyle="nav-glass"')
    expect(wxml).toContain('size="md"')
    expect(wxml).toContain('bind:tap="handleClose"')
    expect(wxml).not.toContain('<navigation-bar\n    wx:else\n    title="{{navTitle}}"\n    modal="{{true}}"\n    compact="{{true}}"')
    expect(wxml).toContain(
      'style="padding-top: {{entry === \'in-app\' ? navOverlayHeight : 0}}px;"',
    )

    expect(wxml).toContain('scroll-y="{{!cardMenuActive && !cardGestureGateActive}}"')
    expect(wxml).toContain('type="list"')
    expect(wxml).toContain('enhanced="{{true}}"')
    expect(wxml).toContain('show-scrollbar="{{false}}"')

    expect(wxss).toMatch(
      /\.memo-reference-detail-nav-overlay\s*\{[^}]*position:\s*absolute[^}]*top:\s*0[^}]*z-index:\s*5[^}]*pointer-events:\s*none/s,
    )
    expect(wxss).toMatch(
      /\.memo-reference-detail-nav-mask\s*\{[^}]*pointer-events:\s*none[^}]*linear-gradient\([^}]*var\(--color-nav-status-mask-start\)[^}]*var\(--color-nav-status-mask-mid\)[^}]*var\(--color-nav-status-mask-end\)/s,
    )
    expect(wxss).toMatch(
      /\.memo-reference-detail-nav-overlay\s+\.weui-navigation-bar\s*\{[^}]*overflow:\s*visible/s,
    )
  })

  it('tracks card menu state on the page and forwards it into the detail-view gate', () => {
    const ts = read('index.ts')
    const js = readRuntimeJsFromTs(path.join(pageDir, 'index.ts'))
    const wxml = read('index.wxml')
    const method = methodSource(ts, 'handleCardMenuChange', 'handleRelationTabTap')

    expect(ts).toContain('cardMenuActive: false')
    expect(method).toContain('const nextActive = !!event.detail?.active')
    expect(method).toContain('this.setData({ cardMenuActive: nextActive })')
    expect(js).toContain('cardMenuActive: false')
    expect(js).toContain('const nextActive = !!event.detail?.active')
    expect(js).toContain('this.setData({ cardMenuActive: nextActive })')
    expect(wxml).toContain('card-menu-active="{{cardMenuActive}}"')
    expect(wxml).toContain('bind:menuchange="handleCardMenuChange"')
  })

  it('tracks long-press gesture candidates on the page so same-touch scroll is gated before the menu fully opens', () => {
    const ts = read('index.ts')
    const js = readRuntimeJsFromTs(path.join(pageDir, 'index.ts'))
    const wxml = read('index.wxml')
    const method = methodSource(ts, 'handleCardGestureGateChange', 'handleCardMenuChange')

    expect(ts).toContain('cardGestureGateActive: false')
    expect(method).toContain('const nextActive = !!event.detail?.active')
    expect(method).toContain('this.setData({ cardGestureGateActive: nextActive })')
    expect(js).toContain('cardGestureGateActive: false')
    expect(js).toContain('handleCardGestureGateChange(event)')
    expect(js).toContain('const nextActive = !!event.detail?.active')
    expect(js).toContain('this.setData({ cardGestureGateActive: nextActive })')
    expect(wxml).toContain('bind:gesturegatechange="handleCardGestureGateChange"')
  })

  it('renders a denied empty state with fixed copy and a back-to-home CTA', () => {
    const wxml = read('index.wxml')

    expect(wxml).toContain(`wx:elif="{{rootViewerRole === 'denied'}}"`)
    expect(wxml).toContain('无权限查看此笔记')
    expect(wxml).toContain('仅笔记作者和其好友可查看')
    expect(wxml).toContain('返回首页')
  })

  it('registers weimo-button and weimo-icon-button so the denied CTA and overlay back button render', () => {
    const json = read('index.json')
    expect(json).toContain('"weimo-button": "/components/weimo-button/index"')
    expect(json).toContain('"weimo-icon-button": "/components/weimo-icon-button/index"')
  })

  it('parses the entry option (share | in-app) defaulting to in-app', () => {
    const ts = read('index.ts')
    expect(ts).toContain("type MemoReferenceDetailEntry = 'share' | 'in-app'")
    expect(ts).toContain("entry: MemoReferenceDetailEntry")
    expect(ts).toContain("options.entry === 'share' ? 'share' : 'in-app'")
  })

  it('share entry resolves viewer role from session and friend summary', () => {
    const ts = read('index.ts')
    expect(ts).toContain("from '../../services/friend'")
    expect(ts).toContain('friendByUsername')
    expect(ts).toContain("from '../../utils/session'")
    expect(ts).toContain("ownerUsername === sessionUsername")
    expect(ts).toContain("? 'self'")
    expect(ts).toContain("'我的笔记'")
    expect(ts).toContain('的笔记`')
  })

  it('share entry sends the user home when the root memo is deleted', () => {
    const ts = read('index.ts')
    const start = ts.indexOf('_handleMemoDeleted(')
    const end = ts.indexOf('_handleMemoTagsUpdated(', start)
    expect(start).toBeGreaterThan(0)
    expect(end).toBeGreaterThan(start)
    const section = ts.slice(start, end)
    expect(section).toContain("d.entry === 'share'")
    expect(section).toContain('reLaunchToHome()')
  })

  it('handleHomeTap reLaunches to the user home', () => {
    const ts = read('index.ts')
    const start = ts.indexOf('handleHomeTap(')
    expect(start).toBeGreaterThan(0)
    const section = ts.slice(start, start + 200)
    expect(section).toContain('wx.reLaunch({ url: AppRoutes.home })')
  })

  it('reserves bottom scroll space like memo-share-image', () => {
    const wxss = read('index.wxss')

    expect(wxss).toMatch(
      /\.memo-reference-detail-scroll__content\s*\{[\s\S]*padding:\s*var\(--spacing-md\)\s+var\(--memo-layout-gutter\)\s+176rpx/,
    )
    expect(wxss).not.toContain('calc(var(--spacing-md) + 96rpx)')
  })

  it('imports memo markdown styles for rich-text cards', () => {
    const wxss = read('index.wxss')

    expect(wxss).toContain("@import '../../styles/memo-markdown.wxss';")
  })

  it('delegates relation rendering to the shared memo-reference-detail-view component', () => {
    const wxml = read('index.wxml')

    expect(wxml).toContain('<memo-reference-detail-view')
    expect(wxml).toContain('id="memo-reference-detail-view"')
    expect(wxml).toContain('mode="{{mode}}"')
    expect(wxml).toContain('owner="{{owner}}"')
    expect(wxml).toContain('root-viewer-role="{{rootViewerRole}}"')
    expect(wxml).toContain('root-card="{{rootCard}}"')
    expect(wxml).toContain('reference-cards="{{referenceCards}}"')
    expect(wxml).toContain('own-reference-cards="{{ownReferenceCards}}"')
    expect(wxml).toContain('friend-reference-cards="{{friendReferenceCards}}"')
    expect(wxml).toContain('own-referenced-by-cards="{{ownReferencedByCards}}"')
    expect(wxml).toContain('friend-referenced-by-cards="{{friendReferencedByCards}}"')
    expect(wxml).toContain('selected-relation-tab="{{selectedRelationTab}}"')
    expect(wxml).toContain('tab-render-state="{{tabRenderState}}"')
    expect(wxml).toContain('tab-slider-animated="{{tabSliderAnimated}}"')
    expect(wxml).not.toContain('tabContentSliderAnimated')
    expect(wxml).toContain('bind:cardreferencetap="handleMemoReferenceTap"')
    expect(wxml).toContain('bind:relationtabswipe="handleRelationTabSwipe"')
    expect(wxml).toContain('relation-gesture-fill-style="{{relationGestureFillStyle}}"')
    expect(wxml).toContain('bind:relationpanellayout="handleRelationPanelLayout"')
    expect(wxml).not.toContain('<memo-card')
  })

  it('uses the required section titles with visible counts', () => {
    const wxml = fs.readFileSync(
      path.join(rootDir, 'components', 'memo-reference-detail-view', 'index.wxml'),
      'utf8',
    )

    expect(wxml).toContain('- 引用以下 {{ownReferenceCards.length}} 条笔记 -')
    expect(wxml).toContain('- 引用我的 {{ownReferenceCards.length}} 条笔记 -')
    expect(wxml).toContain('- 引用{{friendReferenceOwnerLabel}}的 {{friendReferenceCards.length}} 条笔记 -')
    expect(wxml).toContain('- 被以下 {{ownReferencedByCards.length}} 条笔记引用 -')
    expect(wxml).toContain('- 被我的 {{ownReferencedByCards.length}} 条笔记引用 -')
    expect(wxml).toContain('- 被{{friendReferencedByOwnerLabel}}的 {{friendReferencedByCards.length}} 条笔记引用 -')
  })

  it('supports a references-only mode for memo compose', () => {
    const ts = read('index.ts')
    const wxml = read('index.wxml')

    expect(ts).toContain("type MemoReferenceDetailMode = 'detail' | 'references'")
    expect(ts).toContain('parseMemoRefList(options.memoRefs || options.memoIds)')
    expect(ts).toContain('referenceMemoRefs: MemoRefId[]')
    expect(ts).toContain('ownReferenceCards: MemoCardItem[]')
    expect(ts).toContain('friendReferenceCards: MemoCardItem[]')
    expect(ts).toContain('friendReferenceOwnerLabel: string')
    expect(ts).toContain('ownReferencedByCards: MemoCardItem[]')
    expect(ts).toContain('friendReferencedByCards: MemoCardItem[]')
    expect(ts).toContain('friendReferencedByOwnerLabel: string')
    expect(ts).toContain('loadMemoReferenceList: (memoRefs: MemoRefId[]) => Promise<void>')
    expect(ts).toContain("const mode: MemoReferenceDetailMode = options.mode === 'references' ? 'references' : 'detail'")
    expect(ts).toContain("const navTitle = mode === 'references' ? `引用 ${memoRefs.length} 条笔记` : '笔记详情'")
    expect(ts).toContain('void this.loadMemoReferenceList(memoRefs)')
    expect(ts).toContain("if (this.data.mode === 'references' && this.data.referenceMemoRefs.length > 0)")
    expect(ts).toContain("this.data.mode === 'references' ? `引用 ${projection.referenceCards.length} 条笔记` : '笔记详情'")
    expect(wxml).toContain('<memo-reference-detail-view')
    expect(wxml).toContain('mode="{{mode}}"')
    expect(wxml).toContain('reference-cards="{{referenceCards}}"')
    expect(wxml).toContain('bind:cardreferencetap="handleMemoReferenceTap"')
  })

  it('supports friend-owned memo detail without exposing friend refs', () => {
    const ts = read('index.ts')
    const wxml = read('index.wxml')
    const loader = readRoot('utils/memo-reference-detail-loader.ts')

    expect(ts).not.toContain("type MemoReferenceDetailOwner = 'self' | 'friend'")
    expect(ts).toContain('rootViewerRole')
    expect(ts).toContain('loadFriendMemoReferenceDetailData')
    expect(loader).toContain('getFriendMemo')
    expect(loader).toContain('buildFriendMemoReferenceDetailProjection')
    expect(loader).toContain('const ownIds = collectMemoReferenceDetailFetchIds(root)')
    expect(loader).toMatch(/async function loadFriendMemoReferenceDetailData[\s\S]*const previewIds = collectMemoReferencePreviewFetchIds\(root, relationMemos\)/)
    expect(ts).toContain("const owner: ViewerRole = options.owner === 'friend' ? 'friend' : 'self'")
    expect(ts).toContain("if (owner === 'friend')")
    expect(ts).toContain('const friendOwnerUsername = String(options.ownerUsername || \'\').trim()')
    expect(ts).toContain('void this.loadFriendMemoReferenceDetail(memoId, friendOwnerUsername)')
    expect(ts).toContain("if (this.data.owner === 'friend')")
    expect(wxml).toContain('root-viewer-role="{{rootViewerRole}}"')
    expect(wxml).toContain('friend-reference-cards="{{friendReferenceCards}}"')
    expect(wxml).not.toContain('action-mode=')
    expect(wxml).not.toContain('- 我的 {{referencedByCards.length}} 条批注 -')
  })

  it('passes hydrated friend reference memos into self-owned detail projection', () => {
    const ts = read('index.ts')
    const loader = readRoot('utils/memo-reference-detail-loader.ts')

    expect(ts).toContain('loadSelfMemoReferenceDetailData')
    expect(loader).toContain('friendReferenceMemos')
    expect(loader).toContain('friendReferences.memos')
    expect(loader).toContain('collectFriendMemoReferencedByRefs')
    expect(loader).toContain('...collectFriendMemoReferencedByRefs')
    expect(loader).toContain("referencedByOwnerLabel: '我'")
    expect(ts).toContain('openFriendMemoReferenceDetail')
    expect(ts).toContain('event.detail?.ownerUsername')
    expect(loader).not.toContain(
      "relation === 'reference' ? friendReferences.previews.get(ref) : undefined",
    )
  })

  it('hydrates outgoing friend refs on own relation cards in friend-owned detail', () => {
    const loader = readRoot('utils/memo-reference-detail-loader.ts')
    const start = loader.indexOf('export async function loadFriendMemoReferenceDetailData')
    const end = loader.indexOf('export async function loadMemoReferenceListData', start)
    expect(start).toBeGreaterThanOrEqual(0)
    expect(end).toBeGreaterThan(start)
    const section = loader.slice(start, end)

    expect(section).toContain('const allMemos = [')
    expect(section).toContain('loadFriendMemoReferences(')
    expect(section).toContain('collectFriendMemoReferenceRefs(allMemos)')
    expect(section).toContain('collectFriendMemoReferencedByRefs(allMemos)')
    expect(section).toContain('resolveReferencePreview: (ref) => friendReferences.previews.get(ref)')
  })

  it('uses explicit friend usernames when hydrating friend-owned relation data', () => {
    const loader = readRoot('utils/memo-reference-detail-loader.ts')

    expect(loader).toContain('friendByUsername')
    expect(loader).toContain('const username = String(friendUsername || \'\').trim()')
    expect(loader).toContain('getFriendMemo(username, memoId)')
    expect(loader).toContain('getFriendMemo(parsed.username, parsed.memoId)')
    expect(loader).not.toMatch(/summary\?\.friend\b/)
    expect(loader).not.toContain('getFriendMemo(memoId)')
    expect(loader).not.toContain('getFriendMemo(parsed.memoId)')
  })

  it('passes explicit owner username when opening friend-owned detail routes', () => {
    const ts = read('index.ts')
    const section = methodSource(ts, 'handleMemoReferenceTap', '_getAllCards')

    expect(section).toContain("this.data.owner === 'friend' && this.data.rootCard?.id === memoId")
    expect(section).toContain("this.data.friendOwnerUsername || '').trim()")
    expect(section).toContain('openFriendMemoReferenceDetail(memoId, this._navOptions({ ownerUsername }))')
  })

  it('routes nested reference taps through _navOptions so share-entry uses cupertino and in-app uses cupertino-inside', () => {
    const ts = read('index.ts')
    const section = methodSource(ts, 'handleMemoReferenceTap', '_getAllCards')

    expect(section).toContain('openMemoReferenceDetail(memoId, this._navOptions())')
    expect(section).toContain('openFriendMemoReferenceDetail(memoId, this._navOptions({ ownerUsername }))')
    expect(section).not.toContain("routeType: 'cupertino-inside'")
  })

  it('refreshes the local rendered cards after editable card actions succeed', () => {
    const ts = read('index.ts')

    expect(ts).toContain('removeMemoReferenceDetailCard')
    expect(ts).toContain('updateMemoReferenceDetailCardTags')
    expect(ts).toContain('_createCardActionsHost')
    expect(ts).toContain('_refreshAfterMemoComposeSaved')
    expect(ts).toContain('onMemoDeleted')
    expect(ts).toContain('onMemoTagsUpdated')
    expect(ts).toContain('_setDataWithRelationTab(removeMemoReferenceDetailCard')
    expect(ts).toContain('this.setData(updateMemoReferenceDetailCardTags')
    expect(ts).toContain('loadSelfMemoReferenceDetailData(memoId)')
    expect(ts).toContain('loadFriendMemoReferenceDetailData(memoId, friendUsername)')
  })

  it('supports double tap edit for own cards and double tap quote for friend cards', () => {
    const ts = read('index.ts')
    const wxml = read('index.wxml')
    const cardTap = methodSource(ts, 'handleCardTap', 'handleCardEdit')

    expect(ts).toContain('handleCardTap: (event: WechatMiniprogram.CustomEvent<{ memoId: number }>) => void')
    expect(wxml).toContain('bind:cardtap="handleCardTap"')
    expect(cardTap).toContain('detectMemoCardDoubleTap(this._createCardActionsHost(), memoId, Date.now())')
    expect(cardTap).toContain('this._permissionsFor(memoId)')
    expect(cardTap).toContain('readMemoCardDoubleTapBehavior()')
    expect(cardTap).toContain('openMemoShareForCard(')
    expect(cardTap).toContain("p.doubleTapPreferred === 'quote'")
    expect(cardTap).toContain("openEditComposeForCard(cards, memoId, () => void this._refreshAfterMemoComposeSaved(), this._navOptions())")
  })

  it('routes editable actions through local guards and card action helpers', () => {
    const ts = read('index.ts')
    const edit = methodSource(ts, 'handleCardEdit', 'handleCardQuote')
    const quote = methodSource(ts, 'handleCardQuote', 'handleCardDelete')
    const deleteAction = methodSource(ts, 'handleCardDelete', 'handleCardModifyTag')
    const modifyTag = methodSource(ts, 'handleCardModifyTag', 'handleCardTagAdd')
    const addTag = methodSource(ts, 'handleCardTagAdd', 'handleCardTagRemove')
    const removeTag = methodSource(ts, 'handleCardTagRemove', 'handleCardShare')

    expect(ts).toContain('_permissionsFor(memoId: number): MemoPermissions')
    expect(ts).toContain("this.data.owner === 'friend' && this.data.rootCard?.id === memoId")
    expect(ts).toContain("resolvePermissions(card.ownerUsername ? 'friend' : 'self')")
    expect(ts).toContain('type CardActionsHost')
    expect(ts).toContain('_createCardActionsHost(): CardActionsHost')
    expect(ts).not.toContain('type MemoCardEventHost')
    expect(ts).not.toContain('dispatchMemoEdit')
    expect(ts).not.toContain('dispatchMemoDelete')
    expect(ts).not.toContain('dispatchMemoModifyTag')
    expect(ts).not.toContain('dispatchMemoAddTag')
    expect(ts).not.toContain('dispatchMemoRemoveTag')
    expect(ts).not.toContain('get dataForActions()')
    expect(ts).not.toContain('_cardActionContext()')

    expect(edit).toContain('!this._permissionsFor(memoId).canEdit')
    expect(edit).toContain(
      '() => void this._refreshAfterMemoComposeSaved()',
    )

    expect(quote).toContain('const p = this._permissionsFor(memoId)')
    expect(quote).toContain('if (!p.canQuote) return')
    expect(quote).toContain('onSaved: () => void this._refreshAfterMemoComposeSaved()')
    expect(quote).toContain('openQuoteComposeForCard(cards, memoId, this._navOptions({')

    expect(deleteAction).toContain('!this._permissionsFor(memoId).canDelete')
    expect(deleteAction).toContain('confirmDeleteMemo(this._createCardActionsHost(), memoId)')

    expect(modifyTag).toContain('!this._permissionsFor(memoId).canModifyTag')
    expect(modifyTag).toContain('runMemoModifyTag(')
    expect(modifyTag).toContain('this._createCardActionsHost()')

    expect(addTag).toContain('!this._permissionsFor(memoId).canAddTag')
    expect(addTag).toContain(
      "runMemoAddTagFromList(this._createCardActionsHost(), memoId, this._navOptions())",
    )

    expect(removeTag).toContain('!this._permissionsFor(memoId).canRemoveTag')
    expect(removeTag).toContain('runMemoRemoveTagFromMemo(this._createCardActionsHost(), memoId, tag)')
  })

  it('routes card copy through the detail page clipboard helper', () => {
    const ts = read('index.ts')
    const wxml = read('index.wxml')
    const copyAction = methodSource(ts, 'handleCardCopy', 'handleCardShare')

    expect(wxml).toContain('bind:cardcopy="handleCardCopy"')
    expect(ts).toContain('handleCardCopy: (event: WechatMiniprogram.CustomEvent<{ memoId: number; ownerUsername?: string }>) => void')
    expect(copyAction).toContain('copyMemoContentForCard(this._getAllCards(), memoId)')
    expect(copyAction).not.toContain('openMemoShareImage')
  })
})
