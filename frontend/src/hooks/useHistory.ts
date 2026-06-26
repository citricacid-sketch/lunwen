import { useState, useCallback, useEffect } from 'react'
import type { HistoryEntry } from '../types'

function storageKey(type: 'rewrite' | 'diagram') {
  return `lunwen_history_${type}`
}

function generateId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8)
}

export function useHistory(type: 'rewrite' | 'diagram') {
  const [entries, setEntries] = useState<HistoryEntry[]>([])

  useEffect(() => {
    try {
      const raw = localStorage.getItem(storageKey(type))
      if (raw) setEntries(JSON.parse(raw))
    } catch {
      // corrupted data
    }
  }, [type])

  const persist = useCallback(
    (updated: HistoryEntry[]) => {
      setEntries(updated)
      localStorage.setItem(storageKey(type), JSON.stringify(updated))
    },
    [type],
  )

  const addEntry = useCallback(
    (
      input: HistoryEntry['input'],
      result: HistoryEntry['result'],
      iterationOf?: string,
      label?: string,
    ) => {
      const entry: HistoryEntry = {
        id: generateId(),
        type,
        timestamp: Date.now(),
        input,
        result,
        iterationOf,
        label,
      }
      setEntries((prev) => {
        const updated = [entry, ...prev].slice(0, 50)
        try {
          localStorage.setItem(storageKey(type), JSON.stringify(updated))
        } catch {
          // localStorage quota exceeded or unavailable — entries remain in-memory this session
        }
        return updated
      })
      return entry
    },
    [type],
  )

  const deleteEntry = useCallback(
    (id: string) => {
      setEntries((prev) => {
        const updated = prev.filter((e) => e.id !== id)
        try { localStorage.setItem(storageKey(type), JSON.stringify(updated)) } catch {}
        return updated
      })
    },
    [type],
  )

  const clearAll = useCallback(() => {
    persist([])
  }, [persist])

  return { entries, addEntry, deleteEntry, clearAll }
}
