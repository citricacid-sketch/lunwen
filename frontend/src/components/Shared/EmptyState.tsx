import { FileText } from 'lucide-react'

interface Props {
  title: string
  description: string
}

export default function EmptyState({ title, description }: Props) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-gray-400">
      <FileText size={48} className="mb-4" />
      <h3 className="text-lg font-medium text-gray-500">{title}</h3>
      <p className="text-sm mt-1">{description}</p>
    </div>
  )
}
