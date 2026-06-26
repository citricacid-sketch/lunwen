import { useState } from 'react'
import CopyButton from '../Shared/CopyButton'
import { downloadText } from '../../utils'
import { downloadDocx } from '../../services/api'
import { Download, RotateCcw, FileText } from 'lucide-react'

interface Props {
  rewritten: string
  onRetry: () => void
  onReset: () => void
}

export default function RewriteToolbar({ rewritten, onRetry, onReset }: Props) {
  const [exporting, setExporting] = useState(false)

  const handleExportDocx = async () => {
    setExporting(true)
    try {
      await downloadDocx(rewritten)
    } catch {
      // fallback: download as txt
      downloadText('润色结果.txt', rewritten)
    } finally {
      setExporting(false)
    }
  }

  return (
    <div className="flex items-center gap-3 pt-2 flex-wrap">
      <CopyButton text={rewritten} label="复制润色文本" />
      <button
        onClick={handleExportDocx}
        disabled={exporting}
        className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-indigo-600 bg-indigo-50 border border-indigo-200 rounded-md hover:bg-indigo-100 disabled:opacity-50 transition-colors"
      >
        <FileText size={14} />
        {exporting ? '导出中...' : '下载 Word'}
      </button>
      <button
        onClick={() => downloadText('润色结果.txt', rewritten)}
        className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-gray-600 bg-white border border-gray-200 rounded-md hover:bg-gray-50 transition-colors"
      >
        <Download size={14} />
        下载 TXT
      </button>
      <button
        onClick={onRetry}
        className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-gray-600 bg-white border border-gray-200 rounded-md hover:bg-gray-50 transition-colors"
      >
        <RotateCcw size={14} />
        重新润色
      </button>
      <button
        onClick={onReset}
        className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-gray-400 hover:text-gray-600 transition-colors"
      >
        清空
      </button>
    </div>
  )
}
