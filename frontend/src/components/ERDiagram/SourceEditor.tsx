interface Props {
  value: string
  onChange: (code: string) => void
}

export default function SourceEditor({ value, onChange }: Props) {
  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-1">
        HTML 源码 (可编辑)
      </label>
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        rows={12}
        className="w-full px-4 py-3 border border-gray-200 rounded-lg text-sm font-mono resize-y focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition"
        spellCheck={false}
      />
    </div>
  )
}
