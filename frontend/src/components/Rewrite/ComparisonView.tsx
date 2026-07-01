/**
 * Rewrite/ComparisonView.tsx — 原文/润色结果对比视图
 *
 * 两种查看模式：
 *   1. 对比视图 — 原文和结果左右并排显示
 *   2. 修订视图 — 使用 diff-match-patch 做词级差异高亮
 *      （绿色 = 新增，红色 = 删除）
 */
import { useState } from 'react'
import { TextPanel } from './TextPanel'
import { DiffView } from './DiffView'
import { Columns2, GitCompare } from 'lucide-react'

interface Props {
  original: string
  rewritten: string
}

export function ComparisonView({ original, rewritten }: Props) {
  const [mode, setMode] = useState<'compare' | 'diff'>('compare')

  return (
    <div className="space-y-2">
      {/* 模式切换 */}
      <div className="flex items-center gap-2">
        <div className="inline-flex bg-gray-100 rounded-lg p-0.5">
          <button
            onClick={() => setMode('compare')}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
              mode === 'compare' ? 'bg-white text-gray-800 shadow-sm' : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            <Columns2 size={14} />
            对比视图
          </button>
          <button
            onClick={() => setMode('diff')}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
              mode === 'diff' ? 'bg-white text-gray-800 shadow-sm' : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            <GitCompare size={14} />
            修订视图
          </button>
        </div>
      </div>

      {mode === 'compare' ? (
        <div className="flex gap-4">
          <TextPanel title="原文" content={original} variant="original" />
          <TextPanel title="润色结果" content={rewritten} variant="rewritten" />
        </div>
      ) : (
        <DiffView original={original} rewritten={rewritten} />
      )}
    </div>
  )
}
