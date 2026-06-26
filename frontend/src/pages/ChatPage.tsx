import { useState, useRef, type FormEvent, type KeyboardEvent, type ChangeEvent } from 'react'
import { useChat } from '../hooks/useChat'
import ChatMessage from '../components/Chat/ChatMessage'
import { uploadAndExtractText } from '../services/api'
import toast from 'react-hot-toast'
import { Send, Square, Trash2, MessageSquare, Upload, Loader2, FileText } from 'lucide-react'

export default function ChatPage() {
  const { messages, isStreaming, error, send, stop, clear, bottomRef } = useChat()
  const [input, setInput] = useState('')
  const [uploading, setUploading] = useState(false)
  const [uploadedFile, setUploadedFile] = useState('')
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault()
    if (!input.trim() || isStreaming) return
    send(input.trim())
    setInput('')
    setUploadedFile('')
  }

  const handleKeyDown = (e: KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSubmit(e)
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
      const prefix = result.text.length > 4000
        ? result.text.slice(0, 4000) + '\n\n[文本过长，已截取前4000字]'
        : result.text
      setInput((prev) => (prev ? prev + '\n\n---\n' + prefix : prefix))
      setUploadedFile(result.filename)
    }
    setUploading(false)
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-3 border-b border-gray-200 bg-white">
        <div>
          <h2 className="text-lg font-bold text-gray-800">论文导师</h2>
          <p className="text-xs text-gray-400">随时讨论你的论文写作问题</p>
        </div>
        <button
          onClick={clear}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs text-gray-400 hover:text-red-500 transition-colors"
        >
          <Trash2 size={14} />
          清空对话
        </button>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-6 py-4">
        {messages.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full text-gray-400">
            <MessageSquare size={40} className="mb-3" />
            <p className="text-sm">你好！我是你的论文导师</p>
            <p className="text-xs mt-1">可以问我论文选题、结构设计、写作方法、参考文献格式等问题</p>
            <p className="text-xs mt-1 text-gray-300">也可以上传论文段落让我帮你分析</p>
          </div>
        )}

        {messages.map((msg) => (
          <ChatMessage
            key={msg.id}
            role={msg.role}
            content={msg.content}
            isStreaming={msg.isStreaming}
          />
        ))}

        {error && (
          <div className="text-center text-sm text-red-500 py-2">{error}</div>
        )}

        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <form onSubmit={handleSubmit} className="px-6 py-3 border-t border-gray-200 bg-white">
        <div className="flex items-end gap-2">
          <div className="flex-1 relative">
            <textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="输入你的问题...（Enter 发送，Shift+Enter 换行）"
              rows={2}
              className="w-full px-3 py-2 pr-10 border border-gray-200 rounded-lg text-sm resize-none outline-none focus:ring-2 focus:ring-indigo-500"
            />
            <div className="absolute right-2 bottom-2 flex items-center gap-1">
              {uploadedFile && !uploading && (
                <span className="inline-flex items-center gap-1 text-xs text-green-600">
                  <FileText size={12} />
                </span>
              )}
              {uploading && (
                <Loader2 size={14} className="animate-spin text-blue-600" />
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
                className="p-1 text-gray-400 hover:text-gray-600 disabled:opacity-50 transition-colors"
                title="上传论文文件（.docx / .pdf）"
              >
                <Upload size={14} />
              </button>
            </div>
          </div>
          {isStreaming ? (
            <button
              type="button"
              onClick={stop}
              className="p-2.5 bg-red-500 text-white rounded-lg hover:bg-red-600 transition-colors"
            >
              <Square size={16} />
            </button>
          ) : (
            <button
              type="submit"
              disabled={!input.trim()}
              className="p-2.5 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50 transition-colors"
            >
              <Send size={16} />
            </button>
          )}
        </div>
      </form>
    </div>
  )
}
