import { http, HttpResponse } from 'msw'
import { describe, expect, it } from 'vitest'

import {
  createMemo,
  searchMemos,
} from '@/features/workspace/workspace-api'

import { API_ORIGIN, server } from './test-server'

const utc = [2026, 200, 12, 30, 0, 0, 0, 0, 0]

describe('Biji workspace API', () => {
  it('sends the active search filters and validates the returned page', async () => {
    server.use(
      http.post(`${API_ORIGIN}/api/memo/search`, async ({ request }) => {
        expect(request.headers.get('Authorization')).toBe('Bearer access-1')
        await expect(request.json()).resolves.toEqual({
          created_at_sort: 'asc',
          cursor: 'next-page',
          has_annotation: true,
          has_heading: true,
          page_size: 20,
          tag: '工作',
          text: { contains: '计划' },
        })

        return HttpResponse.json({
          items: [{
            id: 1,
            ct_utc: utc,
            mt_utc: utc,
            tags: ['工作'],
            content: '计划内容',
            refs: [],
            referenced_by: [],
            future_field: 'ignored',
          }],
          next_cursor: null,
          has_more: false,
          total_count: 1,
          future_field: 'ignored',
        })
      }),
    )

    const result = await searchMemos(
      'access-1',
      {
        created_at_sort: 'asc',
        has_annotation: true,
        has_heading: true,
        tag: '工作',
        text: { contains: '计划' },
      },
      'next-page',
      20,
    )

    expect(result.data.items[0]).toMatchObject({ id: 1, content: '计划内容' })
    expect(result.data).not.toHaveProperty('future_field')
    expect(result.data.items[0]).not.toHaveProperty('future_field')
  })

  it('sends a create mutation and returns the validated identifier', async () => {
    const payload = {
      content: '新笔记',
      tags: ['工作'],
      refs: ['1'],
    }

    server.use(
      http.post(`${API_ORIGIN}/api/memo`, async ({ request }) => {
        await expect(request.json()).resolves.toEqual(payload)
        return HttpResponse.json(42)
      }),
    )

    await expect(createMemo('access-1', payload)).resolves.toMatchObject({
      data: 42,
      token: 'access-1',
    })
  })
})
