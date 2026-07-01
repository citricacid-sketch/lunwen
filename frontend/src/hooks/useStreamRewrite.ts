/**
 * hooks/useStreamRewrite.ts — 文本润色 SSE 流 Hook
 *
 * 封装了文本润色（含迭代润色）的完整生命周期管理。
 *
 * === 使用方式 ===
 *   const { streamedText, isStreaming, error, doneData, trigger, abort, reset } = useStreamRewrite()
 *
 *   // 首次润色
 *   trigger(text, mode, style, language?)
 *   // 迭代润色
 *   triggerIterate(originalText, currentText, instruction, mode, style)
 *   // 取消
 *   abort()
 *   // 重置
 *   reset()
 *
 * === 状态说明 ===
 *   streamedText  - 实时累积的流式文本（delta 逐字符拼接）
 *   isStreaming   - 是否正在接收流
 *   error         - 错误信息（null = 无错误）
 *   doneData      - 流完成后的统计信息（原文/结果字数等）
 *
 * === 为什么不用 useRequest？ ===
 *   SSE 流式模式不适合 useRequest 的"一次请求一次响应"模型。
 *   useRequest 适合请求-响应式 API，而 SSE 需要在流进行中多次更新
 *   同一个状态（streamedText），所以这里用 callback + useState 手动管理。
 */
import { useState, useRef, useCallback } from 'react'
import { streamRewrite, streamRewriteIterate } from '../services/api'
import type { RewriteDoneData } from '../types'

export function useStreamRewrite() {
  const [streamedText, setStreamedText] = useState('')
  const [isStreaming, setIsStreaming] = useState(false)
  const [error, setError] = useState<{ message: string; code: string } | null>(null)
  const [doneData, setDoneData] = useState<RewriteDoneData | null>(null)
  const controllerRef = useRef<AbortController | null>(null)

  /**
   * 触发首次润色
   * 先重置所有状态，再启动 SSE 流
   */
  const trigger = useCallback((text: string, mode: string, style: string, language?: string) => {
    // 重置状态
    setStreamedText('')
    setIsStreaming(true)
    setError(null)
    setDoneData(null)

    controllerRef.current = streamRewrite(
      { text, mode, style, language },
      // onDelta: 逐字符追加到 streamedText
      (content) => setStreamedText((prev) => prev + content),
      // onDone: 流完成
      (data) => {
        setIsStreaming(false)
        setDoneData(data as unknown as RewriteDoneData)
      },
      // onError: 出错
      (err) => {
        setIsStreaming(false)
        setError(err)
      },
    )
  }, [])

  /**
   * 触发迭代润色（在已有结果基础上修改）
   * 与 trigger 的区别：多传 originalText 和 instruction
   */
  const triggerIterate = useCallback(
    (originalText: string, currentText: string, instruction: string, _mode: string, style: string) => {
      setStreamedText('')
      setIsStreaming(true)
      setError(null)
      setDoneData(null)

      controllerRef.current = streamRewriteIterate(
        { original_text: originalText, current_text: currentText, instruction, style },
        (content) => setStreamedText((prev) => prev + content),
        (data) => {
          setIsStreaming(false)
          setDoneData(data as unknown as RewriteDoneData)
        },
        (err) => {
          setIsStreaming(false)
          setError(err)
        },
      )
    },
    [],
  )

  /** 取消当前流 */
  const abort = useCallback(() => {
    controllerRef.current?.abort()
    setIsStreaming(false)
  }, [])

  /** 重置所有状态到初始值 */
  const reset = useCallback(() => {
    setStreamedText('')
    setIsStreaming(false)
    setError(null)
    setDoneData(null)
  }, [])

  /**
   * 从历史记录恢复状态（不回退到后端，直接用缓存结果）
   * 用于点击历史记录条目时快速回看
   */
  const restore = useCallback((text: string, data: RewriteDoneData) => {
    setStreamedText(text)
    setIsStreaming(false)
    setError(null)
    setDoneData(data)
  }, [])

  return { streamedText, isStreaming, error, doneData, trigger, triggerIterate, abort, reset, restore }
}
