import { useState, useRef, useCallback, useEffect } from 'react'

interface Message {
  id: string
  role: 'user' | 'assistant'
  content: string
  isStreaming?: boolean
}

const STORAGE_KEY = 'lunwen_chat_messages'
const MAX_MESSAGES = 100

function generateId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8)
}

function loadMessages(): Message[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    return raw ? JSON.parse(raw) : []
  } catch {
    return []
  }
}

function saveMessages(msgs: Message[]) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(msgs.slice(-MAX_MESSAGES)))
  } catch {}
}

export function useChat() {
  const [messages, setMessages] = useState<Message[]>(loadMessages)
  const [isStreaming, setIsStreaming] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const controllerRef = useRef<AbortController | null>(null)
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    saveMessages(messages)
  }, [messages])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const send = useCallback((content: string) => {
    const userMsg: Message = { id: generateId(), role: 'user', content }
    const aiMsg: Message = { id: generateId(), role: 'assistant', content: '', isStreaming: true }

    setMessages((prev) => [...prev, userMsg, aiMsg])
    setIsStreaming(true)
    setError(null)

    const allMsgs = [...messages, userMsg]

    const controller = new AbortController()
    controllerRef.current = controller

    fetch('/api/chat/stream', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        messages: allMsgs.map((m) => ({ role: m.role, content: m.content })),
      }),
      signal: controller.signal,
    })
      .then(async (response) => {
        if (!response.ok) {
          const err = await response.json().catch(() => ({ detail: '请求失败' }))
          setError(err.detail || '请求失败')
          setIsStreaming(false)
          return
        }
        const reader = response.body?.getReader()
        if (!reader) return
        const decoder = new TextDecoder()
        let buffer = ''

        while (true) {
          const { done, value } = await reader.read()
          if (done) break
          buffer += decoder.decode(value, { stream: true })

          const lines = buffer.split('\n')
          buffer = lines.pop() || ''

          let event = ''
          for (const line of lines) {
            if (line.startsWith('event: ')) {
              event = line.slice(7).trim()
            } else if (line.startsWith('data: ')) {
              try {
                const data = JSON.parse(line.slice(6))
                if (event === 'delta') {
                  setMessages((prev) =>
                    prev.map((m) =>
                      m.id === aiMsg.id ? { ...m, content: m.content + data.content } : m,
                    ),
                  )
                } else if (event === 'error') {
                  setError(data.message || '出错')
                }
              } catch {}
            }
          }
        }

        setMessages((prev) =>
          prev.map((m) => (m.id === aiMsg.id ? { ...m, isStreaming: false } : m)),
        )
        setIsStreaming(false)
      })
      .catch((err) => {
        if (err.name !== 'AbortError') {
          setError(err.message)
          setIsStreaming(false)
        }
      })
  }, [messages])

  const stop = useCallback(() => {
    controllerRef.current?.abort()
    setIsStreaming(false)
    setMessages((prev) =>
      prev.map((m) => (m.isStreaming ? { ...m, isStreaming: false } : m)),
    )
  }, [])

  const clear = useCallback(() => {
    setMessages([])
    localStorage.removeItem(STORAGE_KEY)
  }, [])

  return { messages, isStreaming, error, send, stop, clear, bottomRef }
}
