import { act, renderHook } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

import { usePendingCreate } from '../src/use-pending-create.ts'

type Draft = {
  content: string
  createdItem: string | null
}

describe('usePendingCreate', () => {
  it('commits a synchronous guest result after the view transition', () => {
    const commit = vi.fn()
    const { result } = renderHook(() =>
      usePendingCreate<Draft, string, string>({
        createClientId: () => 'guest-1',
        createDraft: () => ({ content: '', createdItem: null }),
        onReadyToCommit: (state) => {
          if (state.createdItem) commit(state.createdItem)
        },
        prepareSubmission: (content) => ({
          changes: { content },
          getResultChanges: (createdItem) => ({ createdItem }),
          run: () => `created:${content}`,
        }),
      }),
    )

    act(() => result.current.start())
    act(() => result.current.submit('draft'))

    expect(result.current.pending).toMatchObject({
      content: 'draft',
      createSettled: true,
      createdItem: 'created:draft',
      status: 'creating',
    })

    act(() => result.current.finishViewTransition())

    expect(commit).toHaveBeenCalledOnce()
    expect(commit).toHaveBeenCalledWith('created:draft')
    expect(result.current.pending).toBeNull()
  })

  it('waits for an authenticated request when the transition finishes first', async () => {
    let resolveRequest: (() => void) | undefined
    const request = new Promise<void>((resolve) => {
      resolveRequest = resolve
    })
    const { result } = renderHook(() =>
      usePendingCreate<Draft, string, void>({
        createClientId: () => 'auth-1',
        createDraft: () => ({ content: '', createdItem: null }),
        prepareSubmission: (content) => ({
          changes: { content },
          run: () => request,
        }),
      }),
    )

    act(() => result.current.start())
    act(() => result.current.submit('draft'))
    act(() => result.current.finishViewTransition())

    expect(result.current.pending?.viewTransitionEnded).toBe(true)

    await act(async () => resolveRequest?.())

    expect(result.current.pending).toBeNull()
  })

  it('commits an asynchronous result when the transition finishes first', async () => {
    let resolveRequest: ((value: string) => void) | undefined
    const request = new Promise<string>((resolve) => {
      resolveRequest = resolve
    })
    const commit = vi.fn()
    const { result } = renderHook(() =>
      usePendingCreate<Draft, string, string>({
        createClientId: () => 'guest-async',
        createDraft: () => ({ content: '', createdItem: null }),
        onReadyToCommit: (state) => {
          if (state.createdItem) commit(state.createdItem)
        },
        prepareSubmission: (content) => ({
          changes: { content },
          getResultChanges: (createdItem) => ({ createdItem }),
          run: () => request,
        }),
      }),
    )

    act(() => result.current.start())
    act(() => result.current.submit('draft'))
    act(() => result.current.finishViewTransition())
    act(() => result.current.finishViewTransition())
    await act(async () => resolveRequest?.('created later'))

    expect(commit).toHaveBeenCalledOnce()
    expect(commit).toHaveBeenCalledWith('created later')
    expect(result.current.pending).toBeNull()
  })

  it('keeps a failed draft available for retry', async () => {
    const onError = vi.fn()
    const { result } = renderHook(() =>
      usePendingCreate<Draft, string, void>({
        createClientId: () => 'auth-2',
        createDraft: () => ({ content: '', createdItem: null }),
        onError,
        prepareSubmission: (content) => ({
          changes: { content },
          run: () => Promise.reject(new Error('failed')),
        }),
      }),
    )

    act(() => result.current.start())
    await act(async () => result.current.submit('retry me'))

    expect(result.current.pending).toMatchObject({
      content: 'retry me',
      status: 'failed',
    })
    expect(onError).toHaveBeenCalledOnce()
  })
})
