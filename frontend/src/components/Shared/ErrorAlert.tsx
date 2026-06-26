import { AlertTriangle } from 'lucide-react'

interface Props {
  message: string
  onRetry?: () => void
}

export default function ErrorAlert({ message, onRetry }: Props) {
  return (
    <div className="flex items-start gap-3 p-4 bg-red-50 border border-red-200 rounded-lg">
      <AlertTriangle className="text-red-500 flex-shrink-0 mt-0.5" size={18} />
      <div className="flex-1">
        <p className="text-sm text-red-700">{message}</p>
        {onRetry && (
          <button
            onClick={onRetry}
            className="mt-2 text-sm text-red-600 underline hover:text-red-800"
          >
            重试
          </button>
        )}
      </div>
    </div>
  )
}
