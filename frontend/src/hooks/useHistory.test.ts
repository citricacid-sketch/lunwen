/**
 * hooks/useHistory.test.ts — unit tests for useHistory hook
 */
import { renderHook, act } from '@testing-library/react'
import { useHistory } from './useHistory'
import type { HistoryEntry } from '../types'

beforeEach(() => {
  localStorage.clear()
})

function makeInput(text: string) {
  return { text, style: 'academic' }
}

function makeResult(output: string) {
  return { output }
}

test('starts with empty entries', () => {
  const { result } = renderHook(() => useHistory('rewrite'))
  expect(result.current.entries).toEqual([])
})

test('addEntry prepends entry with correct fields', () => {
  const { result } = renderHook(() => useHistory('rewrite'))

  let entry: HistoryEntry | undefined
  act(() => {
    entry = result.current.addEntry(makeInput('test input'), makeResult('test output'), undefined, 'My Label')
  })

  expect(result.current.entries).toHaveLength(1)
  const saved = result.current.entries[0]
  expect(saved.id).toBeDefined()
  expect(saved.type).toBe('rewrite')
  expect(saved.timestamp).toBeGreaterThan(0)
  expect(saved.input).toEqual(makeInput('test input'))
  expect(saved.result).toEqual(makeResult('test output'))
  expect(saved.label).toBe('My Label')
  expect(saved.iterationOf).toBeUndefined()
  // Verify the returned entry matches
  expect(entry).toEqual(saved)
})

test('capped at 50 entries', () => {
  const { result } = renderHook(() => useHistory('diagram'))

  act(() => {
    for (let i = 0; i < 55; i++) {
      result.current.addEntry({ text: `input ${i}` }, { output: `output ${i}` })
    }
  })

  expect(result.current.entries).toHaveLength(50)
  // The first entry (most recent) should be input 54, the oldest should be input 5
  expect(result.current.entries[0].input.text).toBe('input 54')
  expect(result.current.entries[49].input.text).toBe('input 5')
})

test('deleteEntry removes by id', () => {
  const { result } = renderHook(() => useHistory('rewrite'))

  let id1: string
  let id2: string
  act(() => {
    const e1 = result.current.addEntry(makeInput('first'), makeResult('r1'))
    const e2 = result.current.addEntry(makeInput('second'), makeResult('r2'))
    id1 = e1.id
    id2 = e2.id
  })

  expect(result.current.entries).toHaveLength(2)

  act(() => {
    result.current.deleteEntry(id1)
  })

  expect(result.current.entries).toHaveLength(1)
  expect(result.current.entries[0].id).toBe(id2)
})

test('clearAll empties entries', () => {
  const { result } = renderHook(() => useHistory('rewrite'))

  act(() => {
    result.current.addEntry(makeInput('a'), makeResult('r'))
    result.current.addEntry(makeInput('b'), makeResult('r'))
  })

  expect(result.current.entries).toHaveLength(2)

  act(() => {
    result.current.clearAll()
  })

  expect(result.current.entries).toEqual([])
})

test('separates entries by type (rewrite vs diagram)', () => {
  const rewrite = renderHook(() => useHistory('rewrite'))
  const diagram = renderHook(() => useHistory('diagram'))

  act(() => {
    rewrite.result.current.addEntry(makeInput('rewrite input'), makeResult('rewrite output'))
  })

  expect(rewrite.result.current.entries).toHaveLength(1)
  expect(rewrite.result.current.entries[0].type).toBe('rewrite')
  // Diagram hook should still be empty
  expect(diagram.result.current.entries).toEqual([])

  act(() => {
    diagram.result.current.addEntry(
      { text: 'diagram input', diagramType: 'flowchart' },
      { output: 'diagram output' },
    )
  })

  expect(diagram.result.current.entries).toHaveLength(1)
  expect(diagram.result.current.entries[0].type).toBe('diagram')
  // Rewrite hook should still have 1 entry
  expect(rewrite.result.current.entries).toHaveLength(1)
})
