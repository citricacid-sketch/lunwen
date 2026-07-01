/**
 * pages/RewritePage.tsx — 论文写作页面（核心页面）
 *
 * 八种写作模式的统一入口，完整的润色工作流：
 *   输入 → 流式生成 → 对比查看 → 迭代修改 → 导出/保存
 *
 * === 数据流 ===
 *   RewriteInput (表单输入)
 *     → useStreamRewrite (SSE 流管理)
 *       → ComparisonView (原文/结果对比)
 *         → RewriteToolbar (复制/导出/重试)
 *           → useHistory (本地持久化)
 *
 * === 迭代修改 ===
 *   用户对生成结果不满意时，可输入修改指令触发 triggerIterate，
 *   后端在已有结果基础上做增量修改（而非重新生成）。
 *
 * === 历史记录 ===
 *   本地存储（localStorage），支持回档到任意历史版本。
 *   回档时使用 restore() 直接恢复缓存的文本，不走后端。
 */
import { useState } from 'react'
import { useStreamRewrite } from '../hooks/useStreamRewrite'
import { useHistory } from '../hooks/useHistory'
import { RewriteInput } from '../components/Rewrite/RewriteInput'
import { ComparisonView } from '../components/Rewrite/ComparisonView'
import { RewriteToolbar } from '../components/Rewrite/RewriteToolbar'
import { LoadingSkeleton } from '../components/Shared/LoadingSkeleton'
import { ErrorAlert } from '../components/Shared/ErrorAlert'
import { HistoryPanel } from '../components/Shared/HistoryPanel'
import { ChevronDown, ChevronRight, History } from 'lucide-react'
import type { HistoryEntry } from '../types'

/** 模式/风格 → 中文显示名 */
const MODE_LABELS: Record<string, string> = {
  rewrite: '学术润色',
  deweight: '降重改写',
  abstract: '摘要生成',
  restructure: '结构优化',
  grammar: '语法校对',
  intro_conclusion: '引言/结论',
  literature_review: '文献综述',
  reference: '参考文献格式化',
}

const STYLE_LABELS: Record<string, string> = {
  formal: '正式学术化',
  concise: '简洁精炼',
  expanded: '学术扩写',
}

export function RewritePage() {
  // 用户输入的快照（用于重试和历史记录）
  const [originalText, setOriginalText] = useState('')
  const [currentMode, setCurrentMode] = useState('rewrite')
  const [currentStyle, setCurrentStyle] = useState('formal')
  const [currentLanguage, setCurrentLanguage] = useState('zh')
  // UI 折叠状态
  const [showHistory, setShowHistory] = useState(false)
  const [showIterate, setShowIterate] = useState(false)
  const [iterateInstruction, setIterateInstruction] = useState('')

  const { streamedText, isStreaming, error, doneData, trigger, triggerIterate, abort, reset, restore } =
    useStreamRewrite()
  const history = useHistory('rewrite')

  /**
   * 处理表单提交
   * '__abort__' 是取消信号（RewriteInput 发送），其他情况正常触发润色
   */
  const handleSubmit = (text: string, mode: string, style: string, language?: string) => {
    if (text === '__abort__') {
      abort()
      return
    }
    // 保存输入快照，用于后续重试
    setOriginalText(text)
    setCurrentMode(mode)
    setCurrentStyle(style)
    if (language) setCurrentLanguage(language)
    setShowIterate(false)
    setIterateInstruction('')
    trigger(text, mode, style, language)
  }

  /** 用相同参数重试 */
  const handleRetry = () => {
    trigger(originalText, currentMode, currentStyle)
  }

  /** 迭代修改：在当前结果基础上，根据用户指令继续修改 */
  const handleIterate = () => {
    if (!iterateInstruction.trim() || isStreaming) return
    triggerIterate(originalText, streamedText, iterateInstruction.trim(), currentMode, currentStyle)
    setIterateInstruction('')
  }

  /** 保存当前结果到本地历史记录 */
  const handleSaveToHistory = () => {
    if (!streamedText || !doneData) return
    history.addEntry(
      { text: originalText, style: currentStyle, diagramType: currentMode },
      { output: streamedText, meta: { ...doneData } },
      undefined,
      `${MODE_LABELS[currentMode] || currentMode} - ${new Date().toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })}`,
    )
  }

  /** 从历史记录回档 */
  const handleRollback = (entry: HistoryEntry) => {
    setOriginalText(entry.input.text || '')
    setCurrentMode((entry.input.diagramType as string) || 'rewrite')
    setCurrentStyle((entry.input.style as string) || 'formal')
    setShowIterate(false)
    setIterateInstruction('')
    restore(entry.result.output, {
      original_length: entry.input.text?.length || 0,
      rewritten_length: entry.result.output.length || 0,
      mode: (entry.input.diagramType as string) || 'rewrite',
      style: entry.input.style || 'formal',
      is_iteration: !!entry.iterationOf,
    })
  }

  /** 重置所有状态 */
  const handleReset = () => {
    reset()
    setOriginalText('')
    setShowIterate(false)
    setIterateInstruction('')
  }

  return (
    <div className="max-w-5xl mx-auto p-6 space-y-6">
      {/* Page header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-1 h-8 rounded-full bg-indigo-500" />
          <div>
            <h2 className="text-xl font-bold text-gray-900">论文写作助手</h2>
            <p className="text-sm text-gray-500 mt-0.5">
              支持学术润色、降重改写、摘要生成、语法校对等八种写作辅助功能
            </p>
          </div>
        </div>
        <button
          onClick={() => setShowHistory(!showHistory)}
          className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg transition-colors ${
            showHistory ? 'bg-indigo-50 text-indigo-700' : 'text-gray-500 hover:bg-gray-100'
          }`}
        >
          <History size={14} />
          历史记录
          {showHistory ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
        </button>
      </div>

      {/* 历史记录面板（可折叠） */}
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

      {/* 输入表单 */}
      <RewriteInput onSubmit={handleSubmit} isLoading={isStreaming} />

      {/* 错误提示 + 重试 */}
      {error && <ErrorAlert message={error.message} onRetry={handleRetry} />}

      {/* 流式进行中 → 骨架屏 */}
      {isStreaming && <LoadingSkeleton />}

      {/* 流式完成 → 对比视图 + 操作栏 + 迭代面板 */}
      {streamedText && !isStreaming && doneData && (
        <>
          <ComparisonView original={originalText} rewritten={streamedText} />

          {/* 统计信息 */}
          <div className="text-xs text-gray-400 flex gap-4 flex-wrap">
            <span>原文 {doneData.original_length} 字符</span>
            <span>→ 处理后 {doneData.rewritten_length} 字符</span>
            <span>模式：{MODE_LABELS[doneData.mode] || doneData.mode}</span>
            {doneData.mode === 'rewrite' && (
              <span>风格：{STYLE_LABELS[doneData.style] || doneData.style}</span>
            )}
            {doneData.mode === 'abstract' && (
              <span>语言：{currentLanguage === 'en' ? '英文' : '中文'}</span>
            )}
            {doneData.is_iteration && (
              <span className="text-blue-500 font-medium">迭代修改</span>
            )}
          </div>

          <RewriteToolbar rewritten={streamedText} onRetry={handleRetry} onReset={handleReset} />

          <button onClick={handleSaveToHistory} className="text-xs text-indigo-600 hover:text-indigo-800">
            保存到历史记录
          </button>

          {/* 迭代修改面板 */}
          <div className="border border-gray-200 rounded-lg overflow-hidden">
            <button
              onClick={() => setShowIterate(!showIterate)}
              className="w-full flex items-center gap-2 px-4 py-2.5 bg-gray-50 hover:bg-gray-100 text-sm text-gray-600 transition-colors"
            >
              {showIterate ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
              对此结果不满意？输入修改指令继续调整
            </button>
            {showIterate && (
              <div className="p-4 space-y-3">
                <textarea
                  value={iterateInstruction}
                  onChange={(e) => setIterateInstruction(e.target.value)}
                  placeholder="例如：把第三句话写得更学术化一些；第二段的逻辑需要更清晰..."
                  rows={3}
                  maxLength={5000}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm resize-y focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none"
                />
                <div className="flex items-center gap-3">
                  <button
                    onClick={handleIterate}
                    disabled={!iterateInstruction.trim() || isStreaming}
                    className="px-4 py-1.5 bg-indigo-600 text-white text-sm rounded-lg hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  >
                    进一步处理
                  </button>
                  <span className="text-xs text-gray-400">将在当前结果基础上根据你的指令修改</span>
                </div>
              </div>
            )}
          </div>
        </>
      )}

      {/* 初始空状态 */}
      {!isStreaming && !streamedText && !error && (
        <div className="text-center py-12 text-gray-400 text-sm">
          选择功能模式，粘贴论文段落，点击「开始处理」即可
        </div>
      )}
    </div>
  )
}
