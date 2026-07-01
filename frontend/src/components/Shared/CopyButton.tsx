/**
 * Shared/CopyButton.tsx — 复制按钮
 *
 * 点击将文本写入剪贴板，成功后显示 2 秒"已复制"反馈。
 * 使用 ahooks:
 *   - useBoolean: 管理 copied 状态
 *   - useTimeout:  2 秒后自动重置
 */
import { Copy, Check } from 'lucide-react'
import { useBoolean, useTimeout } from 'ahooks'
import { copyToClipboard } from '../../utils'

interface Props {
  text: string
  label?: string
}

export function CopyButton({ text, label = '复制' }: Props) {
  const [copied, { setTrue, setFalse }] = useBoolean(false)

  // copied 为 true 时启动 2 秒定时器，到期后自动重置
  useTimeout(setFalse, copied ? 2000 : undefined)

  const handleCopy = async () => {
    const ok = await copyToClipboard(text)
    if (ok) setTrue()
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
