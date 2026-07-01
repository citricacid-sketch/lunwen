/**
 * Chat/ChatMessage.tsx — 聊天消息气泡
 *
 * 用户消息：右对齐，蓝色气泡
 * AI 消息：  左对齐，白色气泡 + 打字光标动画
 *
 * isStreaming 为 true 时在消息末尾显示闪烁光标 |。
 */
interface Props {
  role: 'user' | 'assistant'
  content: string
  isStreaming?: boolean
}

export function ChatMessage({ role, content, isStreaming }: Props) {
  const isUser = role === 'user'

  return (
    <div className={`flex ${isUser ? 'justify-end' : 'justify-start'} mb-4`}>
      <div className="flex items-start gap-2 max-w-[80%]">
        {/* AI 头像 */}
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
          {/* 空内容 + streaming → 显示 ... ，有内容 + streaming → 追加 | 光标 */}
          {content || (isStreaming && <span className="animate-pulse">...</span>)}
          {isStreaming && content && <span className="animate-pulse">|</span>}
        </div>
        {/* 用户头像 */}
        {isUser && (
          <div className="w-8 h-8 rounded-full bg-gray-300 flex items-center justify-center text-sm flex-shrink-0 mt-1">
            👨‍🎓
          </div>
        )}
      </div>
    </div>
  )
}
