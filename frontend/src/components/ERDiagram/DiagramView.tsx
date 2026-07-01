/**
 * ERDiagram/DiagramView.tsx — 图表展示容器
 *
 * 管理：
 *   - 本地可编辑的 HTML 代码副本（code state）
 *   - 图表/源码双模式切换
 *
 * 用户在源码模式下编辑 HTML 后切换回图表模式，可即时预览效果。
 * 注意：code 状态从 props.htmlCode 初始化，之后独立维护。
 */
import { useState } from 'react'
import { DiagramToolbar } from './DiagramToolbar'
import { HtmlDiagramRenderer } from './HtmlDiagramRenderer'
import { SourceEditor } from './SourceEditor'

interface Props {
  htmlCode: string
}

export function DiagramView({ htmlCode }: Props) {
  const [code, setCode] = useState(htmlCode)
  const [mode, setMode] = useState<'diagram' | 'source'>('diagram')

  const handleCodeChange = (newCode: string) => {
    setCode(newCode)
  }

  return (
    <div className="space-y-4">
      <DiagramToolbar htmlCode={code} mode={mode} onModeChange={setMode} />
      {mode === 'diagram' ? (
        <HtmlDiagramRenderer htmlCode={code} />
      ) : (
        <SourceEditor value={code} onChange={handleCodeChange} />
      )}
    </div>
  )
}
