/**
 * hooks/useChat.ts — 论文导师聊天状态管理
 *
 * 管理聊天消息列表、SSE 流式接收、消息持久化。
 *
 * === 状态流转 ===
 *   idle → send() → isStreaming=true → delta... → isStreaming=false
 *                  ↓ stop()  → isStreaming=false（手动停止）
 *                  ↓ error   → isStreaming=false + error message
 *
 * === 持久化 ===
 *   使用 ahooks 的 useLocalStorageState，消息自动保存到 localStorage。
 *   最多保留 100 条消息（在 send 时裁剪）。
 *
 * === SSE 解析 ===
 *   不使用 api.ts 的 parseSSEStreamCore，因为有特殊需求：
 *     1. 每收到 delta 要更新最后一条 AI 消息的内容（增量拼接）
 *     2. 需要追踪 isStreaming 状态用于 UI 切换
 */
import { useState, useRef, useCallback, useEffect } from 'react'
import { useLocalStorageState } from 'ahooks'
import type { ChatMessage as Message } from '../types'

const STORAGE_KEY = 'lunwen_chat_messages'
const MAX_MESSAGES = 100

function generateId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8)
}

export function useChat() {
  const [messages, setMessages] = useLocalStorageState<Message[]>(STORAGE_KEY, {
    defaultValue: [],
  })
  const [isStreaming, setIsStreaming] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const controllerRef = useRef<AbortController | null>(null)
  const bottomRef = useRef<HTMLDivElement>(null)

  // 消息变化时自动滚到底部
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  /**
   * 发送消息并启动 SSE 流
   *
   * 流程：
   *   1. 创建用户消息 + 空的 AI 消息（标记 isStreaming）
   *   2. POST /api/chat/stream，携带完整对话历史
   *   3. 通过 ReadableStream 逐块读取 SSE 事件
   *   4. delta 事件 → 追加到 AI 消息的 content
   *   5. 流结束 → 取消 isStreaming 标记
   */
  const send = useCallback((content: string) => {
    const userMsg: Message = { id: generateId(), role: 'user', content }
    const aiMsg: Message = { id: generateId(), role: 'assistant', content: '', isStreaming: true }

    // 追加两条新消息，裁剪到 MAX_MESSAGES 防止 localStorage 膨胀
    setMessages((prev) => {
      const updated = [...prev, userMsg, aiMsg].slice(-MAX_MESSAGES)
      return updated
    })
    setIsStreaming(true)
    setError(null)

    // 构建 API 请求的对话历史（不含刚加的空 AI 消息）
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

        // SSE 逐块读取循环
        while (true) {
          const { done, value } = await reader.read()
          if (done) break
          buffer += decoder.decode(value, { stream: true })

          const lines = buffer.split('\n')
          buffer = lines.pop() || ''  // 最后一行可能不完整

          let event = ''
          for (const line of lines) {
            if (line.startsWith('event: ')) {
              event = line.slice(7).trim()
            } else if (line.startsWith('data: ')) {
              try {
                const data = JSON.parse(line.slice(6))
                if (event === 'delta') {
                  // 增量拼接到最后一条 AI 消息
                  setMessages((prev) =>
                    prev.map((m) =>
                      m.id === aiMsg.id ? { ...m, content: m.content + data.content } : m,
                    ),
                  )
                } else if (event === 'error') {
                  setError(data.message || '出错')
                }
              } catch {
                // 忽略 JSON 解析错误
              }
            }
          }
        }

        // 流结束，取消 streaming 标记
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

  /** 手动停止当前流 */
  const stop = useCallback(() => {
    controllerRef.current?.abort()
    setIsStreaming(false)
    setMessages((prev) =>
      prev.map((m) => (m.isStreaming ? { ...m, isStreaming: false } : m)),
    )
  }, [])

  /** 清空所有消息 */
  const clear = useCallback(() => {
    setMessages([])
  }, [setMessages])

  return { messages, isStreaming, error, send, stop, clear, bottomRef }
}
