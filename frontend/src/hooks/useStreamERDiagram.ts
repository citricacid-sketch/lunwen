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

  const restore = useCallback((data: typeof doneData) => {
    setStreamedText('')
    setIsStreaming(false)
    setError(null)
    setDoneData(data)
  }, [])

  return { streamedText, isStreaming, error, doneData, trigger, abort, reset, restore }
}
