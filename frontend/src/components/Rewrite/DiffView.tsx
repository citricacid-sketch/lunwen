/**
 * Rewrite/DiffView.tsx — 词级差异高亮视图
 *
 * 使用 Google diff-match-patch 库进行词级/语义级文本 diff。
 *   - 绿色背景 + 下划线  = 新增内容
 *   - 红色背景 + 删除线  = 删除内容
 *
 * diff 计算用 useMemo 缓存，仅在 original 或 rewritten 变化时重新计算。
 */
import { useMemo } from 'react'
import { diff_match_patch as DiffMatchPatch } from 'diff-match-patch'

interface Props {
  original: string
  rewritten: string
}

interface DiffSegment {
  type: 'equal' | 'insert' | 'delete'
  text: string
}

/** 使用 diff-match-patch 计算词级差异 */
function computeWordDiff(original: string, rewritten: string): DiffSegment[] {
  const dmp = new DiffMatchPatch()
  const diffs = dmp.diff_main(original, rewritten)
  dmp.diff_cleanupSemantic(diffs)  // 语义清理，让 diff 结果更易读

  const result: DiffSegment[] = diffs.map(([op, text]) => {
    if (op === 0) return { type: 'equal', text }
    if (op === 1) return { type: 'insert', text }
    return { type: 'delete', text }
  })

  return result
}

export function DiffView({ original, rewritten }: Props) {
  const diffs = useMemo(() => computeWordDiff(original, rewritten), [original, rewritten])

  return (
    <div className="border border-gray-200 rounded-lg overflow-hidden">
      <div className="px-4 py-2 border-b border-gray-200 bg-gray-50">
        <h3 className="text-sm font-medium text-gray-600">修订视图</h3>
      </div>
      <div className="p-4 overflow-auto max-h-[500px] bg-white">
        <p className="text-sm text-gray-800 leading-relaxed whitespace-pre-wrap">
          {diffs.map((seg, i) => {
            if (seg.type === 'insert') {
              return (
                <span key={i} className="bg-green-100 text-green-800 underline">
                  {seg.text}
                </span>
              )
            }
            if (seg.type === 'delete') {
              return (
                <span key={i} className="bg-red-100 text-red-800 line-through">
                  {seg.text}
                </span>
              )
            }
            return <span key={i}>{seg.text}</span>
          })}
          {diffs.length === 0 && (
            <span className="text-gray-400 italic">修订结果将在此显示...</span>
          )}
        </p>
      </div>
      {/* 图例 */}
      <div className="px-4 py-2 border-t border-gray-200 bg-gray-50 flex gap-4 text-xs text-gray-500">
        <span className="inline-flex items-center gap-1">
          <span className="w-3 h-3 rounded bg-green-100 border border-green-300" />
          新增内容
        </span>
        <span className="inline-flex items-center gap-1">
          <span className="w-3 h-3 rounded bg-red-100 border border-red-300" />
          删除内容
        </span>
      </div>
    </div>
  )
}
