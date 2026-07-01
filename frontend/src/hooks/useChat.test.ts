/**
 * hooks/useChat.test.ts — unit tests for useChat hook
 */
import { renderHook, act, waitFor } from '@testing-library/react'
import { useChat } from './useChat'
import type { ChatMessage } from '../types'

beforeEach(() => {
  localStorage.clear()
  vi.restoreAllMocks()
})

/**
 * Build a Response whose body is a ReadableStream of SSE-formatted text.
 */
function mockFetchStream(events: Array<{ event: string; data: unknown }>): Response {
  const body = events
    .map((e) => `event: ${e.event}\ndata: ${JSON.stringify(e.data)}\n\n`)
    .join('')

  const stream = new ReadableStream({
    start(controller) {
      controller.enqueue(new TextEncoder().encode(body))
      controller.close()
    },
  })

  return new Response(stream, { status: 200 })
}

/**
 * Build a Response with a non-OK status and error body.
 */
function mockFetchError(status: number, detail: string): Response {
  return new Response(JSON.stringify({ detail }), { status })
}

// ── Tests ──

test('starts with empty messages and idle state', () => {
  const { result } = renderHook(() => useChat())

  expect(result.current.messages).toEqual([])
  expect(result.current.isStreaming).toBe(false)
  expect(result.current.error).toBeNull()
})

test('send adds user and AI assistant messages', async () => {
  global.fetch = vi.fn().mockResolvedValue(mockFetchStream([]))

  const { result } = renderHook(() => useChat())

  await act(async () => {
    result.current.send('Hello world')
  })

  await waitFor(() => {
    expect(result.current.messages).toHaveLength(2)
  })

  const msgs = result.current.messages as ChatMessage[]
  expect(msgs[0].role).toBe('user')
  expect(msgs[0].content).toBe('Hello world')
  expect(msgs[1].role).toBe('assistant')
  expect(msgs[1].content).toBe('')
  expect(msgs[1].isStreaming).toBe(false)
})

test('isStreaming is true during send', async () => {
  // Use a deferred promise so we can observe isStreaming before fetch resolves
  let resolveFetch: (value: Response) => void
  const fetchPromise = new Promise<Response>((resolve) => {
    resolveFetch = resolve
  })
  global.fetch = vi.fn().mockReturnValue(fetchPromise)

  const { result } = renderHook(() => useChat())

  // Kick off send — it will block on the fetch promise
  act(() => {
    result.current.send('Hi')
  })

  // isStreaming should be true while fetch is pending
  expect(result.current.isStreaming).toBe(true)
  expect(result.current.messages).toHaveLength(2)

  // Resolve the fetch to let the stream complete
  await act(async () => {
    resolveFetch(mockFetchStream([]))
  })

  await waitFor(() => {
    expect(result.current.isStreaming).toBe(false)
  })
})

test('handles fetch error', async () => {
  global.fetch = vi.fn().mockResolvedValue(mockFetchError(500, 'Server error'))

  const { result } = renderHook(() => useChat())

  await act(async () => {
    result.current.send('test')
  })

  await waitFor(() => {
    expect(result.current.error).toBe('Server error')
  })

  expect(result.current.isStreaming).toBe(false)
})

test('stop aborts and resets streaming', async () => {
  // Deferred promise again so we can call stop before fetch resolves
  let resolveFetch: (value: Response) => void
  const fetchPromise = new Promise<Response>((resolve) => {
    resolveFetch = resolve
  })
  global.fetch = vi.fn().mockReturnValue(fetchPromise)

  const { result } = renderHook(() => useChat())

  act(() => {
    result.current.send('streaming message')
  })

  expect(result.current.isStreaming).toBe(true)

  act(() => {
    result.current.stop()
  })

  expect(result.current.isStreaming).toBe(false)

  // Resolve fetch — the AbortError should be caught silently
  await act(async () => {
    resolveFetch(mockFetchStream([]))
  })

  // Error should still be null (AbortError is swallowed)
  expect(result.current.error).toBeNull()

  // The assistant message should no longer have isStreaming
  const msgs = result.current.messages as ChatMessage[]
  const aiMsg = msgs.find((m) => m.role === 'assistant')
  expect(aiMsg?.isStreaming).toBe(false)
})

test('clear removes all messages', async () => {
  global.fetch = vi.fn().mockResolvedValue(mockFetchStream([]))

  const { result } = renderHook(() => useChat())

  // Send a message first
  await act(async () => {
    result.current.send('first message')
  })

  await waitFor(() => {
    expect(result.current.messages).toHaveLength(2)
  })

  // Now clear
  act(() => {
    result.current.clear()
  })

  expect(result.current.messages).toEqual([])
})
