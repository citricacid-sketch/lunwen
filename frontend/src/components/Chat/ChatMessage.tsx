interface Props {
  role: 'user' | 'assistant'
  content: string
  isStreaming?: boolean
}

export default function ChatMessage({ role, content, isStreaming }: Props) {
  const isUser = role === 'user'

  return (
    <div className={`flex ${isUser ? 'justify-end' : 'justify-start'} mb-4`}>
      <div className="flex items-start gap-2 max-w-[80%]">
        {!isUser && (
          <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center text-sm flex-shrink-0 mt-1">
            👩‍🏫
          </div>
        )}
        <div
          className={`px-4 py-2.5 rounded-2xl text-sm leading-relaxed whitespace-pre-wrap ${
            isUser
              ? 'bg-blue-600 text-white rounded-br-md'
              : 'bg-white border border-gray-200 text-gray-800 rounded-bl-md'
          }`}
        >
          {content || (isStreaming && <span className="animate-pulse">...</span>)}
          {isStreaming && content && <span className="animate-pulse">|</span>}
        </div>
        {isUser && (
          <div className="w-8 h-8 rounded-full bg-gray-300 flex items-center justify-center text-sm flex-shrink-0 mt-1">
            👨‍🎓
          </div>
        )}
      </div>
    </div>
  )
}
