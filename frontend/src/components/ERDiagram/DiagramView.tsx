import { useState } from 'react'
import DiagramToolbar from './DiagramToolbar'
import HtmlDiagramRenderer from './HtmlDiagramRenderer'
import SourceEditor from './SourceEditor'

interface Props {
  htmlCode: string
}

export default function DiagramView({ htmlCode }: Props) {
  const [code, setCode] = useState(htmlCode)
  const [mode, setMode] = useState<'diagram' | 'source'>('diagram')

  const handleCodeChange = (newCode: string) => {
    setCode(newCode)
  }

  return (
    <div className="space-y-4">
      <DiagramToolbar
        htmlCode={code}
        mode={mode}
        onModeChange={setMode}
      />
      {mode === 'diagram' ? (
        <HtmlDiagramRenderer htmlCode={code} />
      ) : (
        <SourceEditor value={code} onChange={handleCodeChange} />
      )}
    </div>
  )
}
