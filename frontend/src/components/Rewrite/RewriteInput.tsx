import { useState, useRef, type FormEvent, type ChangeEvent } from 'react'
import { Sparkles, Upload, Loader2, FileText } from 'lucide-react'
import toast from 'react-hot-toast'
import { uploadAndExtractText } from '../../services/api'

interface Props {
  onSubmit: (text: string, mode: string, style: string, language?: string) => void
  isLoading: boolean
}

const MODES = [
  { value: 'rewrite', label: '学术润色' },
  { value: 'deweight', label: '降重改写' },
  { value: 'abstract', label: '摘要生成' },
  { value: 'restructure', label: '结构优化' },
  { value: 'grammar', label: '语法校对' },
  { value: 'intro_conclusion', label: '引言/结论' },
  { value: 'literature_review', label: '文献综述' },
]

const STYLES = [
  { value: 'formal', label: '正式学术化' },
  { value: 'concise', label: '简洁精炼' },
  { value: 'expanded', label: '学术扩写' },
]

export default function RewriteInput({ onSubmit, isLoading }: Props) {
  const [text, setText] = useState('')
  const [mode, setMode] = useState('rewrite')
  const [style, setStyle] = useState('formal')
  const [language, setLanguage] = useState('zh')
  const [uploading, setUploading] = useState(false)
  const [uploadedFile, setUploadedFile] = useState('')
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault()
    if (text.trim() && !isLoading) {
      onSubmit(text.trim(), mode, style, mode === 'abstract' ? language : undefined)
    }
  }

  const handleFileUpload = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    setUploading(true)
    setUploadedFile('')
    const result = await uploadAndExtractText(file, (msg) => {
      toast.error(msg)
    })

    if (result) {
      setText(result.text)
      setUploadedFile(result.filename)
    }
    setUploading(false)
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  const placeholder =
    mode === 'abstract'
      ? language === 'en'
        ? '在此粘贴论文正文内容，将自动生成英文摘要（English Abstract）...'
        : '在此粘贴论文正文内容，将自动生成中文摘要...'
      : mode === 'grammar'
        ? '在此粘贴需要校对的论文段落...'
        : mode === 'intro_conclusion'
          ? '在此粘贴论文正文内容，将生成引言或结论...'
          : '在此粘贴需要处理的论文段落...'

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          功能模式
        </label>
        <div className="flex flex-wrap gap-1.5">
          {MODES.map((m) => (
            <button
              key={m.value}
              type="button"
              onClick={() => setMode(m.value)}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
                mode === m.value
                  ? 'bg-indigo-600 text-white'
                  : 'bg-white text-gray-600 border border-gray-200 hover:bg-gray-50'
              }`}
            >
              {m.label}
            </button>
          ))}
        </div>
      </div>

      <div>
        <div className="flex items-center justify-between mb-1">
          <label className="text-sm font-medium text-gray-700">
            原文内容
          </label>
          <div className="flex items-center gap-2">
            {uploading && (
              <span className="inline-flex items-center gap-1 text-xs text-blue-600">
                <Loader2 size={12} className="animate-spin" />
                提取文字中...
              </span>
            )}
            {uploadedFile && !uploading && (
              <span className="inline-flex items-center gap-1 text-xs text-green-600">
                <FileText size={12} />
                {uploadedFile}
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
              className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium text-gray-500 bg-white border border-gray-200 rounded-md hover:bg-gray-50 hover:text-gray-700 disabled:opacity-50 transition-colors"
            >
              <Upload size={12} />
              上传文件
            </button>
          </div>
        </div>
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder={placeholder}
          rows={10}
          maxLength={50000}
          className="w-full px-4 py-3 border border-gray-200 rounded-lg text-sm resize-y focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none transition"
        />
        <div className="flex justify-between mt-1">
          <span className="text-xs text-gray-400">
            {text.length} / 50000 字符
          </span>
          <span className="text-xs text-gray-400">
            支持粘贴文本或上传 .docx / .pdf 文件
          </span>
        </div>
      </div>

      <div className="flex items-center gap-4">
        {mode === 'rewrite' && (
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              润色风格
            </label>
            <select
              value={style}
              onChange={(e) => setStyle(e.target.value)}
              className="px-3 py-2 border border-gray-200 rounded-lg text-sm bg-white outline-none focus:ring-2 focus:ring-indigo-500"
            >
              {STYLES.map((s) => (
                <option key={s.value} value={s.value}>
                  {s.label}
                </option>
              ))}
            </select>
          </div>
        )}

        {mode === 'abstract' && (
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              摘要语言
            </label>
            <div className="inline-flex bg-gray-100 rounded-lg p-0.5">
              <button
                type="button"
                onClick={() => setLanguage('zh')}
                className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
                  language === 'zh' ? 'bg-white text-gray-800 shadow-sm' : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                中文摘要
              </button>
              <button
                type="button"
                onClick={() => setLanguage('en')}
                className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
                  language === 'en' ? 'bg-white text-gray-800 shadow-sm' : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                英文摘要
              </button>
            </div>
          </div>
        )}

        <button
          type="submit"
          disabled={!text.trim() || isLoading}
          className="self-end inline-flex items-center gap-2 px-5 py-2.5 bg-indigo-600 text-white text-sm font-medium rounded-lg hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          <Sparkles size={16} />
          {isLoading ? '处理中...' : `开始${MODES.find((m) => m.value === mode)?.label || '处理'}`}
        </button>

        {isLoading && (
          <button
            type="button"
            onClick={() => onSubmit('__abort__', mode, style)}
            className="self-end px-4 py-2.5 text-sm text-gray-500 hover:text-gray-700 transition-colors"
          >
            取消
          </button>
        )}
      </div>
    </form>
  )
}
