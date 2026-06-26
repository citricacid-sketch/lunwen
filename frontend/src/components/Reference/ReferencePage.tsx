import { useState, type FormEvent, type ChangeEvent, useRef } from 'react'
import { useStreamRewrite } from '../../hooks/useStreamRewrite'
import { uploadAndExtractText } from '../../services/api'
import { downloadText } from '../../utils'
import toast from 'react-hot-toast'
import {
  BookOpen, Upload, Loader2, FileText, Copy, Download, Trash2,
  Sparkles, Check
} from 'lucide-react'

interface FormattedRef {
  index: number
  refType: string
  text: string
}

function parseReferences(raw: string): FormattedRef[] {
  const refs: FormattedRef[] = []
  // Match pattern: [N] [TYPE] content
  const lines = raw.split('\n')
  for (const line of lines) {
    const match = line.match(/^\[(\d+)\]\s*\[([A-Z/]+)\]\s*(.+)/)
    if (match) {
      refs.push({
        index: parseInt(match[1]),
        refType: match[2],
        text: `[${match[1]}] ${match[3].trim()}`,
      })
    }
  }
  // If no structured output, fall back to splitting by empty lines
  if (refs.length === 0) {
    const blocks = raw.split(/\n\s*\n/).filter(b => b.trim())
    blocks.forEach((block, i) => {
      const typeMatch = block.match(/\[([A-Z/]+)\]/)
      refs.push({
        index: i + 1,
        refType: typeMatch ? typeMatch[1] : '?',
        text: block.trim(),
      })
    })
  }
  return refs
}

const TYPE_COLORS: Record<string, string> = {
  'J': 'bg-blue-100 text-blue-700',
  'M': 'bg-amber-100 text-amber-700',
  'D': 'bg-purple-100 text-purple-700',
  'C': 'bg-emerald-100 text-emerald-700',
  'P': 'bg-rose-100 text-rose-700',
  'EB/OL': 'bg-cyan-100 text-cyan-700',
  'S': 'bg-gray-100 text-gray-700',
}

const TYPE_LABELS: Record<string, string> = {
  'J': '期刊',
  'M': '专著',
  'D': '学位论文',
  'C': '会议',
  'P': '专利',
  'EB/OL': '电子资源',
  'S': '标准',
}

export default function ReferencePage() {
  const [text, setText] = useState('')
  const [uploading, setUploading] = useState(false)
  const [uploadedFile, setUploadedFile] = useState('')
  const [copiedIdx, setCopiedIdx] = useState<number | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const { streamedText, isStreaming, error, doneData, trigger, abort, reset } = useStreamRewrite()

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault()
    if (text.trim() && !isStreaming) {
      trigger(text.trim(), 'reference', 'formal')
    }
  }

  const handleFileUpload = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setUploading(true)
    setUploadedFile('')
    const result = await uploadAndExtractText(file, (msg) => toast.error(msg))
    if (result) {
      setText(result.text)
      setUploadedFile(result.filename)
    }
    setUploading(false)
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  const handleCopyRef = async (ref: FormattedRef, idx: number) => {
    await navigator.clipboard.writeText(ref.text)
    setCopiedIdx(idx)
    setTimeout(() => setCopiedIdx(null), 1500)
  }

  const handleCopyAll = async () => {
    if (!streamedText) return
    await navigator.clipboard.writeText(streamedText)
    toast.success('已复制全部参考文献')
  }

  const references = streamedText && !isStreaming ? parseReferences(streamedText) : []

  return (
    <div className="max-w-4xl mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="p-2 rounded-lg bg-amber-50">
          <BookOpen size={20} className="text-amber-600" />
        </div>
        <div>
          <h2 className="text-xl font-bold text-gray-900">参考文献格式化</h2>
          <p className="text-sm text-gray-500 mt-0.5">
            粘贴格式杂乱的参考文献，自动整理为 GB/T 7714-2015 国家标准格式
          </p>
        </div>
      </div>

      {/* Input */}
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <div className="flex items-center justify-between mb-1">
            <label className="text-sm font-medium text-gray-700">原始文献列表</label>
            <div className="flex items-center gap-2">
              {uploading && (
                <span className="inline-flex items-center gap-1 text-xs text-indigo-600">
                  <Loader2 size={12} className="animate-spin" />
                  提取中...
                </span>
              )}
              {uploadedFile && !uploading && (
                <span className="inline-flex items-center gap-1 text-xs text-green-600">
                  <FileText size={12} />{uploadedFile}
                </span>
              )}
              <input
                ref={fileInputRef}
                type="file"
                accept=".docx,.pdf,.txt"
                onChange={handleFileUpload}
                className="hidden"
              />
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={uploading}
                className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium text-gray-500 bg-white border border-gray-200 rounded-md hover:bg-gray-50 disabled:opacity-50 transition-colors"
              >
                <Upload size={12} />上传文件
              </button>
            </div>
          </div>
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder={`在此粘贴需要整理的参考文献，支持任意格式...\n\n例如：\n张三, 李四. 基于深度学习的文本分类研究. 计算机学报, 2023, 46(3): 512-528.\nSmith J, Brown A. Advances in Neural Machine Translation. Proc of ACL, 2022: 89-97.\n王五. 人工智能导论. 北京: 清华大学出版社, 2022.`}
            rows={10}
            maxLength={50000}
            className="w-full px-4 py-3 border border-gray-200 rounded-lg text-sm resize-y focus:ring-2 focus:ring-amber-500 focus:border-transparent outline-none transition font-mono"
          />
          <div className="flex justify-between mt-1">
            <span className="text-xs text-gray-400">{text.length} / 50000 字符</span>
            <span className="text-xs text-gray-400">支持粘贴或上传 .docx/.pdf 文件</span>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button
            type="submit"
            disabled={!text.trim() || isStreaming}
            className="inline-flex items-center gap-2 px-5 py-2.5 bg-amber-600 text-white text-sm font-medium rounded-lg hover:bg-amber-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            <Sparkles size={16} />
            {isStreaming ? '格式化中...' : '开始格式化'}
          </button>
          {isStreaming && (
            <button
              type="button"
              onClick={() => abort()}
              className="px-4 py-2.5 text-sm text-gray-500 hover:text-gray-700 transition-colors"
            >
              取消
            </button>
          )}
        </div>
      </form>

      {/* Loading */}
      {isStreaming && (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="animate-pulse flex items-center gap-3 p-4 bg-gray-50 rounded-lg">
              <div className="w-10 h-5 bg-gray-200 rounded" />
              <div className="flex-1 h-4 bg-gray-200 rounded" />
            </div>
          ))}
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
          {error.message}
        </div>
      )}

      {/* Results */}
      {references.length > 0 && !isStreaming && (
        <div className="space-y-3">
          {/* Toolbar */}
          <div className="flex items-center justify-between">
            <span className="text-sm text-gray-500">
              共 {references.length} 条文献
              {doneData && `（原文 ${doneData.original_length} → 处理后 ${doneData.rewritten_length} 字符）`}
            </span>
            <div className="flex items-center gap-2">
              <button
                onClick={handleCopyAll}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-gray-600 bg-white border border-gray-200 rounded-md hover:bg-gray-50 transition-colors"
              >
                <Copy size={14} />复制全部
              </button>
              <button
                onClick={() => downloadText('参考文献.txt', streamedText)}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-gray-600 bg-white border border-gray-200 rounded-md hover:bg-gray-50 transition-colors"
              >
                <Download size={14} />下载 TXT
              </button>
              <button
                onClick={() => { reset(); setText(''); setUploadedFile('') }}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-gray-400 hover:text-gray-600 transition-colors"
              >
                <Trash2 size={14} />清空
              </button>
            </div>
          </div>

          {/* Reference cards */}
          <div className="space-y-2">
            {references.map((ref, idx) => (
              <div
                key={idx}
                className="flex items-start gap-3 p-4 bg-white border border-gray-200 rounded-lg hover:border-gray-300 transition-colors group"
              >
                <span className={`inline-flex items-center px-2 py-0.5 rounded text-[11px] font-bold flex-shrink-0 mt-0.5 ${TYPE_COLORS[ref.refType] || 'bg-gray-100 text-gray-600'}`}>
                  [{ref.refType}] {TYPE_LABELS[ref.refType] || ref.refType}
                </span>
                <p className="flex-1 text-sm text-gray-800 leading-relaxed">{ref.text}</p>
                <button
                  onClick={() => handleCopyRef(ref, idx)}
                  className="flex-shrink-0 p-1.5 text-gray-300 hover:text-gray-600 transition-colors opacity-0 group-hover:opacity-100"
                  title="复制此条"
                >
                  {copiedIdx === idx ? <Check size={16} className="text-green-500" /> : <Copy size={16} />}
                </button>
              </div>
            ))}
          </div>

          {/* Raw output (collapsible) */}
          <details className="text-xs text-gray-400">
            <summary className="cursor-pointer hover:text-gray-600">查看原始输出</summary>
            <pre className="mt-2 p-3 bg-gray-50 rounded-lg whitespace-pre-wrap text-xs">{streamedText}</pre>
          </details>
        </div>
      )}

      {/* Empty state */}
      {!isStreaming && !streamedText && !error && (
        <div className="text-center py-12 text-gray-400 text-sm space-y-1">
          <BookOpen size={32} className="mx-auto mb-3 text-gray-300" />
          <p>粘贴你的参考文献列表，点击「开始格式化」</p>
          <p className="text-xs">支持期刊[J]、专著[M]、学位论文[D]、会议[C]、专利[P]、电子资源[EB/OL]、标准[S] 七种类型</p>
        </div>
      )}
    </div>
  )
}
