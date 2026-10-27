import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { UserProfile } from '../../models/auth'
import {
  openFriendMemoReferenceDetail,
  openAccountDetail,
  openAccountEditSheet,
  openFriendSearch,
  openMemoCompose,
  openMemoReferenceDetail,
  openMemoReferenceList,
  openMemoReferences,
  openMemoSearch,
  openMemoShareImage,
  openNotifications,
  openSettings,
} from '../navigation'

const navigateTo = vi.fn()

describe('openMemoReferenceDetail', () => {
  beforeEach(() => {
    navigateTo.mockReset()
    ;(globalThis as any).wx = { navigateTo }
  })

  it('opens the memo reference detail page as a custom Cupertino route', () => {
    openMemoReferenceDetail(42)

    expect(navigateTo).toHaveBeenCalledWith({
      url: '/pages/memo-reference-detail/index?memoId=42',
      routeType: 'cupertino',
      routeConfig: {
        popGestureDirection: 'multi',
      },
    })
  })

  it('opens the memo references list page as a custom Cupertino route', () => {
    openMemoReferences(42)

    expect(navigateTo).toHaveBeenCalledWith({
      url: '/pages/memo-reference-detail/index?memoId=42&mode=references',
      routeType: 'cupertino',
      routeConfig: {
        popGestureDirection: 'multi',
      },
    })
  })

  it('opens friend memo reference detail with friend mode query', () => {
    openFriendMemoReferenceDetail(7)

    expect(navigateTo).toHaveBeenCalledWith({
      url: '/pages/memo-reference-detail/index?memoId=7&owner=friend',
      routeType: 'cupertino',
      routeConfig: {
        popGestureDirection: 'multi',
      },
    })
  })

  it('opens friend memo reference detail with explicit owner username when provided', () => {
    openFriendMemoReferenceDetail(7, { ownerUsername: 'bob' })

    expect(navigateTo).toHaveBeenCalledWith({
      url: '/pages/memo-reference-detail/index?memoId=7&owner=friend&ownerUsername=bob',
      routeType: 'cupertino',
      routeConfig: {
        popGestureDirection: 'multi',
      },
    })
  })

  it('opens an unsaved memo references list by mixed memo refs as a custom Cupertino route', () => {
    openMemoReferenceList(['7', 8, 'bob/9'])

    expect(navigateTo).toHaveBeenCalledWith({
      url: '/pages/memo-reference-detail/index?mode=references&memoRefs=7,8,bob%2F9',
      routeType: 'cupertino',
      routeConfig: {
        popGestureDirection: 'multi',
      },
    })
  })

  it('supports overriding the reference list route type for nested compose flows', () => {
    openMemoReferenceList(['7'], { routeType: 'cupertino-inside' })

    expect(navigateTo).toHaveBeenCalledWith({
      url: '/pages/memo-reference-detail/index?mode=references&memoRefs=7',
      routeType: 'cupertino-inside',
      routeConfig: {
        popGestureDirection: 'multi',
      },
    })
  })

  it('skips the unsaved memo references list route when no memo ids remain', () => {
    openMemoReferenceList([])

    expect(navigateTo).not.toHaveBeenCalled()
  })

  it('marks quoted create compose routes so the compose title can render as quote immediately', () => {
    openMemoCompose({
      mode: 'create',
      initialContent: '',
      initialTags: [],
      initialRefs: ['7'],
    })

    expect(navigateTo).toHaveBeenCalledWith(expect.objectContaining({
      url: '/pages/memo-compose/index?mode=create&quote=1',
    }))
  })

  it('keeps regular create compose routes unquoted', () => {
    openMemoCompose({
      mode: 'create',
      initialContent: '',
      initialTags: [],
      initialRefs: [],
    })

    expect(navigateTo).toHaveBeenCalledWith(expect.objectContaining({
      url: '/pages/memo-compose/index?mode=create',
    }))
  })
})

describe('openMemoSearch', () => {
  beforeEach(() => {
    navigateTo.mockReset()
    ;(globalThis as any).wx = { navigateTo }
  })

  it('emits memo-search-init payload without target friend when no target friend option is provided', () => {
    const onApplied = vi.fn()
    openMemoSearch(
      { keyword: 'test', selectedTag: '', dateMode: 'day', dateValue: '' },
      onApplied,
    )

    expect(navigateTo).toHaveBeenCalledTimes(1)
    const call = navigateTo.mock.calls[0][0]
    expect(call.url).toBe('/pages/search/index')

    const emitSpy = vi.fn()
    call.success({ eventChannel: { emit: emitSpy } })
    expect(emitSpy).toHaveBeenCalledWith('memo-search-init', {
      draft: { keyword: 'test', selectedTag: '', dateMode: 'day', dateValue: '' },
    })
  })

  it('emits memo-search-init payload with target friend when target friend option is provided', () => {
    const onApplied = vi.fn()
    const targetFriend = { username: 'bob', nickname: '小吴' }
    openMemoSearch(
      { keyword: '', selectedTag: '日记', dateMode: 'day', dateValue: '' },
      onApplied,
      { targetFriend },
    )

    const call = navigateTo.mock.calls[0][0]
    const emitSpy = vi.fn()
    call.success({ eventChannel: { emit: emitSpy } })
    expect(emitSpy).toHaveBeenCalledWith('memo-search-init', {
      draft: { keyword: '', selectedTag: '日记', dateMode: 'day', dateValue: '' },
      targetFriend: { username: 'bob', nickname: '小吴' },
    })
  })

  it('invokes onApplied callback when memo-search-apply event fires', () => {
    const onApplied = vi.fn()
    openMemoSearch(
      { keyword: '', selectedTag: '', dateMode: 'day', dateValue: '' },
      onApplied,
    )

    const call = navigateTo.mock.calls[0][0]
    const nextQuery = { keyword: 'new', selectedTag: '', dateMode: 'day', dateValue: '' }
    call.events['memo-search-apply'](nextQuery)
    expect(onApplied).toHaveBeenCalledWith(nextQuery)
  })
})

describe('openMemoShareImage', () => {
  beforeEach(() => {
    navigateTo.mockReset()
    ;(globalThis as any).wx = { navigateTo }
  })

  it('reparses contentNodes from markdown when list throttled so share shows rich text', async () => {
    const { renderMemoMarkdownToNodes } = await import('../memo-markdown')
    const card = {
      id: 42,
      ownerUsername: '',
      createdAtText: '2026-01-01',
      content: '# 标题',
      contentNodes: [],
      tags: [],
      referenceId: null,
      referencePreview: null,
      referencedByPreviews: [],
      exiting: false,
      renderRichText: false,
    }
    openMemoShareImage({ card })

    expect(navigateTo).toHaveBeenCalledWith(
      expect.objectContaining({
        url: '/pages/memo-share-image/index',
        routeType: 'cupertino',
        routeConfig: { popGestureDirection: 'multi' },
      }),
    )
    const call = navigateTo.mock.calls[0][0]
    const emitSpy = vi.fn()
    call.success({ eventChannel: { emit: emitSpy } })
    const emitted = emitSpy.mock.calls[0][1] as { card: typeof card }
    expect(emitted.card.renderRichText).toBe(true)
    expect(emitted.card.contentNodes).toEqual(renderMemoMarkdownToNodes('# 标题'))
  })

  it('reuses existing contentNodes when renderRichText is true and nodes have no search highlight', async () => {
    const { renderMemoMarkdownToNodes } = await import('../memo-markdown')
    const existingNodes = renderMemoMarkdownToNodes('hi')
    const card = {
      id: 77,
      ownerUsername: '',
      createdAtText: '2026-01-01',
      content: 'hi',
      contentNodes: existingNodes,
      tags: [],
      referenceId: null,
      referencePreview: null,
      referencedByPreviews: [],
      exiting: false,
      renderRichText: true,
    }
    openMemoShareImage({ card })

    const call = navigateTo.mock.calls[0][0]
    const emitSpy = vi.fn()
    call.success({ eventChannel: { emit: emitSpy } })
    const emitted = emitSpy.mock.calls[0][1] as { card: typeof card }
    expect(emitted.card.contentNodes).toBe(existingNodes)
  })

  it('rebuilds contentNodes from markdown when renderRichText is true so share omits search highlight', async () => {
    const { renderMemoMarkdownToNodes } = await import('../memo-markdown')
    const card = {
      id: 1,
      ownerUsername: '',
      createdAtText: '2026-01-01',
      content: '# 标题',
      contentNodes: [
        {
          name: 'mark',
          attrs: { class: 'memo-markdown__mark' },
          children: [{ type: 'text', text: '假高亮' }],
        },
      ],
      tags: [],
      referenceId: null,
      referencePreview: null,
      referencedByPreviews: [],
      exiting: false,
      renderRichText: true,
    }
    openMemoShareImage({ card })

    const call = navigateTo.mock.calls[0][0]
    const emitSpy = vi.fn()
    call.success({ eventChannel: { emit: emitSpy } })
    const emitted = emitSpy.mock.calls[0][1] as { card: typeof card }
    expect(emitted.card.contentNodes).toEqual(renderMemoMarkdownToNodes('# 标题'))
    expect(JSON.stringify(emitted.card.contentNodes)).not.toContain('memo-markdown__mark')
  })
})

describe('openSettings / openNotifications', () => {
  beforeEach(() => {
    navigateTo.mockReset()
    ;(globalThis as any).wx = { navigateTo }
  })

  it('opens settings with local upwards route type', () => {
    openSettings()

    expect(navigateTo).toHaveBeenCalledWith({
      url: '/pages/settings/index',
      routeType: 'upwards',
    })
  })

  it('opens account detail from settings with local Cupertino route type', () => {
    openAccountDetail()

    expect(navigateTo).toHaveBeenCalledWith({
      url: '/pages/settings/account-detail/index',
      routeType: 'cupertino',
    })
  })

  it('opens friend search from settings with local Cupertino route type', () => {
    openFriendSearch()

    expect(navigateTo).toHaveBeenCalledWith({
      url: '/pages/friend-search/index',
      routeType: 'cupertino',
      routeConfig: {
        popGestureDirection: 'multi',
      },
    })
  })

  it('opens account edit sheet with local cupertino-inside route and init payload', () => {
    const profile: UserProfile = {
      username: 'alice',
      nickname: 'Alice',
      login_name: 'alice',
      has_login_password: false,
    }
    const onUpdated = vi.fn()

    openAccountEditSheet('nickname', profile, onUpdated)

    expect(navigateTo).toHaveBeenCalledTimes(1)
    const call = navigateTo.mock.calls[0][0]
    expect(call).toEqual(expect.objectContaining({
      url: '/pages/settings/account-edit-sheet/index?mode=nickname',
      routeType: 'cupertino-inside',
      routeConfig: {
        popGestureDirection: 'multi',
      },
    }))

    const emitSpy = vi.fn()
    call.success({ eventChannel: { emit: emitSpy } })
    expect(emitSpy).toHaveBeenCalledWith('account-edit-sheet-init', {
      mode: 'nickname',
      profile,
    })

    const updatedProfile: UserProfile = {
      ...profile,
      nickname: '阿衡',
    }
    call.events['account-profile-updated'](updatedProfile)
    expect(onUpdated).toHaveBeenCalledWith(updatedProfile)
  })

  it('opens account edit sheet for login name and password modes', () => {
    const profile: UserProfile = {
      username: 'alice',
      nickname: 'Alice',
      login_name: 'alice',
      has_login_password: false,
    }

    openAccountEditSheet('login-name', profile, vi.fn())
    expect(navigateTo).toHaveBeenLastCalledWith(expect.objectContaining({
      url: '/pages/settings/account-edit-sheet/index?mode=login-name',
      routeType: 'cupertino-inside',
    }))

    openAccountEditSheet('password', profile, vi.fn())
    expect(navigateTo).toHaveBeenLastCalledWith(expect.objectContaining({
      url: '/pages/settings/account-edit-sheet/index?mode=password',
      routeType: 'cupertino-inside',
    }))
  })

  it('opens notifications with local upwards route type', () => {
    openNotifications()

    expect(navigateTo).toHaveBeenCalledWith({
      url: '/pages/notifications/index',
      routeType: 'upwards',
    })
  })
})
