import { useState } from 'react'
import { useStreamDiagram } from '../../hooks/useStreamERDiagram'
import { useHistory } from '../../hooks/useHistory'
import DescriptionInput from './DescriptionInput'
import DiagramView from './DiagramView'
import EntityList from './EntityList'
import LoadingSkeleton from '../Shared/LoadingSkeleton'
import ErrorAlert from '../Shared/ErrorAlert'
import HistoryPanel from '../Shared/HistoryPanel'
import { ChevronDown, ChevronRight, History } from 'lucide-react'
import type { DiagramType, HistoryEntry } from '../../types'

export default function ERDiagramPage() {
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

  const handleSaveToHistory = () => {
    if (!doneData?.html_code) return
    history.addEntry(
      { text: description, diagramType: doneData.diagram_type },
      { output: doneData.html_code },
      undefined,
      `图表 - ${new Date().toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })}`,
    )
  }

  const handleRollback = (entry: HistoryEntry) => {
    setDescription(entry.input.text || '')
    if (entry.input.diagramType) {
      setDiagramType(entry.input.diagramType as DiagramType)
    }
    // Restore from cached result instead of re-generating
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
          <DiagramView htmlCode={doneData.html_code} />
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
