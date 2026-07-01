/**
 * pages/ERDiagramPage.tsx — 图表生成页面
 *
 * 用自然语言描述场景，自动生成八种类型的图表。
 * 工作流：输入描述 → SSE 流式生成 → 渲染 HTML 图表 → 展示实体/关系列表
 *
 * === 与 RewritePage 的区别 ===
 *   - 不支持迭代修改（图表是一次性生成的）
 *   - 结果展示为 HTML 渲染（Mermaid → SVG/HTML）而非纯文本
 *   - 额外展示解析出的实体（Entity）和关系（Relationship）
 */
import { useState } from 'react'
import { useStreamDiagram } from '../hooks/useStreamERDiagram'
import { useHistory } from '../hooks/useHistory'
import { DescriptionInput } from '../components/ERDiagram/DescriptionInput'
import { DiagramView } from '../components/ERDiagram/DiagramView'
import { EntityList } from '../components/ERDiagram/EntityList'
import { LoadingSkeleton } from '../components/Shared/LoadingSkeleton'
import { ErrorAlert } from '../components/Shared/ErrorAlert'
import { HistoryPanel } from '../components/Shared/HistoryPanel'
import { ChevronDown, ChevronRight, History } from 'lucide-react'
import type { DiagramType, HistoryEntry } from '../types'

export function ERDiagramPage() {
  // 输入快照（用于重试）
  const [description, setDescription] = useState('')
  const [diagramType, setDiagramType] = useState<DiagramType>('er')
  const [showHistory, setShowHistory] = useState(false)

  const { isStreaming, error, doneData, trigger, abort, reset, restore } = useStreamDiagram()
  const history = useHistory('diagram')

  const handleSubmit = (text: string, type: DiagramType) => {
    if (text === '__abort__') {
      abort()
      return
    }
    setDescription(text)
    setDiagramType(type)
    trigger(text, type)
  }

  const handleRetry = () => {
    trigger(description, diagramType)
  }

  /** 保存当前图表到本地历史 */
  const handleSaveToHistory = () => {
    if (!doneData?.html_code) return
    history.addEntry(
      { text: description, diagramType: doneData.diagram_type },
      { output: doneData.html_code },
      undefined,
      `图表 - ${new Date().toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })}`,
    )
  }

  /** 从历史记录恢复图表（直接使用缓存的 HTML，不重新生成） */
  const handleRollback = (entry: HistoryEntry) => {
    setDescription(entry.input.text || '')
    if (entry.input.diagramType) {
      setDiagramType(entry.input.diagramType as DiagramType)
    }
    restore({
      html_code: entry.result.output,
      diagram_type: entry.input.diagramType || 'er',
      entities: (entry.result.meta as Record<string, unknown> | null)?.entities as unknown[] || [],
      relationships: (entry.result.meta as Record<string, unknown> | null)?.relationships as unknown[] || [],
    })
  }

  const handleReset = () => {
    reset()
    setDescription('')
  }

  return (
    <div className="max-w-5xl mx-auto p-6 space-y-6">
      {/* Page header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-1 h-8 rounded-full bg-emerald-500" />
          <div>
            <h2 className="text-xl font-bold text-gray-900">图表生成</h2>
            <p className="text-sm text-gray-500 mt-0.5">
              用自然语言描述场景，自动生成流程图、ER图、时序图等八种图表
            </p>
          </div>
        </div>
        <button
          onClick={() => setShowHistory(!showHistory)}
          className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg transition-colors ${
            showHistory
              ? 'bg-emerald-50 text-emerald-700'
              : 'text-gray-500 hover:bg-gray-100'
          }`}
        >
          <History size={14} />
          历史记录
          {showHistory ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
        </button>
      </div>

      {showHistory && (
        <div className="bg-white border border-gray-200 rounded-lg p-3">
          <HistoryPanel
            entries={history.entries}
            onRollback={handleRollback}
            onDelete={history.deleteEntry}
            onClearAll={history.clearAll}
          />
        </div>
      )}

      <DescriptionInput
        onSubmit={handleSubmit}
        isLoading={isStreaming}
        diagramType={diagramType}
        onDiagramTypeChange={setDiagramType}
      />

      {error && <ErrorAlert message={error.message} onRetry={handleRetry} />}

      {isStreaming && <LoadingSkeleton />}

      {doneData && !isStreaming && (
        <>
          {/* HTML 图表渲染（Mermaid → SVG） */}
          <DiagramView htmlCode={doneData.html_code} />

          {/* 实体/关系列表（仅 ER 图等有结构化数据的图表类型） */}
          {doneData.entities && doneData.entities.length > 0 && (
            <EntityList
              entities={doneData.entities as any[]}
              relationships={doneData.relationships as any[]}
            />
          )}

          <div className="flex items-center gap-3 pt-2">
            <button
              onClick={handleRetry}
              className="text-sm text-emerald-600 hover:text-emerald-800"
            >
              重新生成
            </button>
            <button
              onClick={handleSaveToHistory}
              className="text-sm text-emerald-600 hover:text-emerald-800"
            >
              保存到历史记录
            </button>
            <button
              onClick={handleReset}
              className="text-sm text-gray-400 hover:text-gray-600"
            >
              清空
            </button>
          </div>
        </>
      )}

      {!isStreaming && !doneData && !error && (
        <div className="text-center py-12 text-gray-400 text-sm">
          选择图表类型，描述你的场景，点击「生成图表」即可
        </div>
      )}
    </div>
  )
}
