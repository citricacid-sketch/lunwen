interface Props {
  title: string
  content: string
  variant?: 'original' | 'rewritten'
}

export default function TextPanel({ title, content, variant = 'original' }: Props) {
  const bgClass = variant === 'original' ? 'bg-white border-gray-200' : 'bg-blue-50/50 border-blue-200'

  return (
    <div className={`flex-1 border rounded-lg overflow-hidden ${bgClass}`}>
      <div className="px-4 py-2 border-b border-inherit bg-white/50">
        <h3 className="text-sm font-medium text-gray-600">{title}</h3>
      </div>
      <div className="p-4 overflow-auto max-h-[500px]">
        <p className="text-sm text-gray-800 leading-relaxed whitespace-pre-wrap">
          {content || (
            <span className="text-gray-400 italic">
              {variant === 'rewritten' ? '润色结果将在此显示...' : '原文将显示在此...'}
            </span>
          )}
        </p>
      </div>
    </div>
  )
}
