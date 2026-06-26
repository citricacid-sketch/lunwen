import { useState, useRef, useCallback } from 'react'
import { streamRewrite, streamRewriteIterate } from '../services/api'

export interface RewriteDoneData {
  original_length: number
  rewritten_length: number
  mode: string
  style: string
  is_iteration: boolean
}

export function useStreamRewrite() {
  const [streamedText, setStreamedText] = useState('')
  const [isStreaming, setIsStreaming] = useState(false)
  const [error, setError] = useState<{ message: string; code: string } | null>(null)
  const [doneData, setDoneData] = useState<RewriteDoneData | null>(null)
  const controllerRef = useRef<AbortController | null>(null)

  const trigger = useCallback((text: string, mode: string, style: string, language?: string) => {
    setStreamedText('')
    setIsStreaming(true)
    setError(null)
    setDoneData(null)

    controllerRef.current = streamRewrite(
      { text, mode, style, language },
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
  }, [])

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

  const abort = useCallback(() => {
    controllerRef.current?.abort()
    setIsStreaming(false)
  }, [])

  const reset = useCallback(() => {
    setStreamedText('')
    setIsStreaming(false)
    setError(null)
    setDoneData(null)
  }, [])

  const restore = useCallback((text: string, data: RewriteDoneData) => {
    setStreamedText(text)
    setIsStreaming(false)
    setError(null)
    setDoneData(data)
  }, [])

  return { streamedText, isStreaming, error, doneData, trigger, triggerIterate, abort, reset, restore }
}
