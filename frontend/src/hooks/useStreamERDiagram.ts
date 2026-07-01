/**
 * hooks/useStreamERDiagram.ts — 图表生成 SSE 流 Hook
 *
 * 与 useStreamRewrite 结构对称，管理图表生成的 SSE 流生命周期。
 *
 * === 核心区别 ===
 *   doneData 结构不同：包含 html_code（Mermaid 渲染的 HTML）、
 *   entities（解析出的实体）和 relationships（实体间关系）。
 *
 * === 不支持迭代 ===
 *   图表生成没有 triggerIterate，只有首次生成（trigger）。
 *   如需修改，用户直接在输入框修改描述后重新触发。
 */
import { useState, useRef, useCallback } from 'react'
import { streamDiagram } from '../services/api'
import type { DiagramType } from '../types'

export function useStreamDiagram() {
  const [streamedText, setStreamedText] = useState('')
  const [isStreaming, setIsStreaming] = useState(false)
  const [error, setError] = useState<{ message: string; code: string } | null>(null)
  const [doneData, setDoneData] = useState<{
    html_code: string
    diagram_type: string
    entities: unknown[]
    relationships: unknown[]
  } | null>(null)
  const controllerRef = useRef<AbortController | null>(null)

  /**
   * 触发图表生成
   * @param description  - 自然语言场景描述
   * @param diagramType  - 图表类型（er/flowchart/sequence/...）
   */
  const trigger = useCallback((description: string, diagramType: DiagramType) => {
    setStreamedText('')
    setIsStreaming(true)
    setError(null)
    setDoneData(null)

    controllerRef.current = streamDiagram(
      { description, diagram_type: diagramType },
      (content) => setStreamedText((prev) => prev + content),
      (data) => {
        setIsStreaming(false)
        setDoneData(data as typeof doneData)
      },
      (err) => {
        setIsStreaming(false)
        setError(err)
      },
    )
  }, [])

  /** 取消当前生成 */
  const abort = useCallback(() => {
    controllerRef.current?.abort()
    setIsStreaming(false)
  }, [])

  /** 重置所有状态 */
  const reset = useCallback(() => {
    setStreamedText('')
    setIsStreaming(false)
    setError(null)
    setDoneData(null)
  }, [])

  /**
   * 从历史记录恢复图表（直接使用缓存的 HTML 和 entity 数据）
   * 不走后端重新生成，实现即时回看
   */
  const restore = useCallback((data: typeof doneData) => {
    setStreamedText('')
    setIsStreaming(false)
    setError(null)
    setDoneData(data)
  }, [])

  return { streamedText, isStreaming, error, doneData, trigger, abort, reset, restore }
}
