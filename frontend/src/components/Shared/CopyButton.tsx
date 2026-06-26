import { Copy, Check } from 'lucide-react'
import { useState } from 'react'
import { copyToClipboard } from '../../utils'

interface Props {
  text: string
  label?: string
}

export default function CopyButton({ text, label = '复制' }: Props) {
  const [copied, setCopied] = useState(false)

  const handleCopy = async () => {
    const ok = await copyToClipboard(text)
    if (ok) {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    }
  }

  return (
    <button
      onClick={handleCopy}
      className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-gray-600 bg-white border border-gray-200 rounded-md hover:bg-gray-50 transition-colors"
    >
      {copied ? <Check size={14} className="text-green-500" /> : <Copy size={14} />}
      {copied ? '已复制' : label}
    </button>
  )
}
