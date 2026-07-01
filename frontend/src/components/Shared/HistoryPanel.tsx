/**
 * Shared/HistoryPanel.tsx — 历史记录面板
 *
 * 展示本地存储的修改历史列表，支持：
 *   - 回档到某个历史版本（调用 onRollback）
 *   - 删除单条记录
 *   - 清空全部记录
 *
 * 同时服务于 RewritePage 和 ERDiagramPage，通过 entry.type 区分显示。
 */
import { Clock, Trash2, RotateCcw, MessageSquare, GitBranch } from 'lucide-react'
import type { HistoryEntry } from '../../types'
import { DIAGRAM_TYPE_LABELS } from '../../types'

interface Props {
  entries: HistoryEntry[]
  onRollback: (entry: HistoryEntry) => void
  onDelete: (id: string) => void
  onClearAll: () => void
}

export function HistoryPanel({ entries, onRollback, onDelete, onClearAll }: Props) {
  if (entries.length === 0) {
    return (
      <div className="text-xs text-gray-400 py-4 text-center">
        暂无修改记录
      </div>
    )
  }

  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs font-medium text-gray-500 flex items-center gap-1">
          <Clock size={12} />
          修改历史 ({entries.length})
        </span>
        <button
          onClick={onClearAll}
          className="text-xs text-gray-400 hover:text-red-500 transition-colors"
        >
          清空
        </button>
      </div>
      <div className="max-h-64 overflow-y-auto space-y-1">
        {entries.map((entry) => (
          <div
            key={entry.id}
            className="flex items-start gap-2 p-2 rounded-md hover:bg-gray-50 group transition-colors"
          >
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-1.5">
                {/* 类型图标：论文写作 vs 图表生成 */}
                {entry.type === 'rewrite' ? (
                  <MessageSquare size={12} className="text-blue-400 flex-shrink-0" />
                ) : (
                  <GitBranch size={12} className="text-green-400 flex-shrink-0" />
                )}
                <span className="text-xs text-gray-600 truncate">
                  {entry.label || (entry.type === 'rewrite'
                    ? entry.input.style === 'concise' ? '简洁精炼' : entry.input.style === 'expanded' ? '学术扩写' : '正式学术化'
                    : DIAGRAM_TYPE_LABELS[entry.input.diagramType as keyof typeof DIAGRAM_TYPE_LABELS] || '图表')}
                </span>
                {entry.iterationOf && (
                  <span className="text-[10px] text-gray-400 bg-gray-100 px-1 rounded">迭代</span>
                )}
              </div>
              <div className="text-[10px] text-gray-400 mt-0.5">
                {new Date(entry.timestamp).toLocaleString('zh-CN', {
                  month: 'numeric',
                  day: 'numeric',
                  hour: '2-digit',
                  minute: '2-digit',
                })}
              </div>
            </div>
            {/* 操作按钮（hover 才显示，减少视觉噪音） */}
            <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
              <button
                onClick={() => onRollback(entry)}
                className="p-1 text-gray-400 hover:text-blue-500 rounded"
                title="回档到此版本"
              >
                <RotateCcw size={12} />
              </button>
              <button
                onClick={() => onDelete(entry.id)}
                className="p-1 text-gray-400 hover:text-red-500 rounded"
                title="删除记录"
              >
                <Trash2 size={12} />
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
