import { Code, Eye, Download } from 'lucide-react'
import CopyButton from '../Shared/CopyButton'
import { downloadText } from '../../utils'

interface Props {
  htmlCode: string
  mode: 'diagram' | 'source'
  onModeChange: (mode: 'diagram' | 'source') => void
}

export default function DiagramToolbar({ htmlCode, mode, onModeChange }: Props) {

  const handleExportHTML = () => {
    downloadText('diagram.html', htmlCode)
  }

  return (
    <div className="flex items-center gap-2">
      <div className="flex items-center bg-gray-100 rounded-lg p-0.5">
        <button
          onClick={() => onModeChange('diagram')}
          className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
            mode === 'diagram'
              ? 'bg-white text-gray-800 shadow-sm'
              : 'text-gray-500 hover:text-gray-700'
          }`}
        >
          <Eye size={14} />
          图表
        </button>
        <button
          onClick={() => onModeChange('source')}
          className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
            mode === 'source'
              ? 'bg-white text-gray-800 shadow-sm'
              : 'text-gray-500 hover:text-gray-700'
          }`}
        >
          <Code size={14} />
          源码
        </button>
      </div>

      <div className="w-px h-5 bg-gray-200" />

      {mode === 'diagram' ? (
        <button
          onClick={handleExportHTML}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-gray-600 bg-white border border-gray-200 rounded-md hover:bg-gray-50 transition-colors"
        >
          <Download size={14} />
          导出 HTML
        </button>
      ) : (
        <CopyButton text={htmlCode} label="复制源码" />
      )}

      <span className="text-xs text-gray-400 ml-auto">
        在源码模式下编辑 HTML 代码后切换回图表模式查看效果
      </span>
    </div>
  )
}
