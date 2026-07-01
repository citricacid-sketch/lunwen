/**
 * hooks/useHistory.ts — 本地历史记录管理
 *
 * 为「论文写作」和「图表生成」两个模块提供本地历史记录功能。
 * 数据持久化到 localStorage，不依赖后端。
 *
 * 存储 key: lunwen_history_{type}（type 为 'rewrite' 或 'diagram'）
 * 最多保留 50 条记录（在 addEntry 时裁剪）。
 *
 * 使用 ahooks 的 useLocalStorageState 自动处理序列化/反序列化，
 * 无需手动调用 JSON.parse/stringify 和 localStorage.setItem。
 */
import { useCallback } from 'react'
import { useLocalStorageState } from 'ahooks'
import type { HistoryEntry } from '../types'

/** 生成唯一 ID：时间戳(36进制) + 随机串 */
function generateId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8)
}

/**
 * @param type - 'rewrite' 或 'diagram'，决定 localStorage key
 */
export function useHistory(type: 'rewrite' | 'diagram') {
  // useLocalStorageState 自动从 localStorage 读取初始值，写入时自动持久化
  const [entries, setEntries] = useLocalStorageState<HistoryEntry[]>(
    `lunwen_history_${type}`,
    { defaultValue: [] },
  )

  /**
   * 添加一条历史记录
   * 新记录插入到数组头部，保留最近 50 条
   * @returns 新创建的 entry 对象
   */
  const addEntry = useCallback(
    (
      input: HistoryEntry['input'],
      result: HistoryEntry['result'],
      iterationOf?: string,   // 如果是迭代修改，指向父条目 ID
      label?: string,         // 列表展示用短标签
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
        const updated = [entry, ...(prev || [])].slice(0, 50)
        return updated
      })
      return entry
    },
    [type, setEntries],
  )

  /** 删除指定 ID 的记录 */
  const deleteEntry = useCallback(
    (id: string) => {
      setEntries((prev) => (prev || []).filter((e) => e.id !== id))
    },
    [setEntries],
  )

  /** 清空所有记录 */
  const clearAll = useCallback(() => {
    setEntries([])
  }, [setEntries])

  return { entries: entries || [], addEntry, deleteEntry, clearAll }
}
