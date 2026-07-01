/**
 * ERDiagram/HtmlDiagramRenderer.tsx — HTML 图表渲染器
 *
 * 将后端生成的 HTML 代码注入 DOM 并重新执行其中的 <script> 标签。
 *
 * 为什么需要重新执行 <script>？
 *   Mermaid 等图表库生成的 HTML 包含 <script> 标签用于渲染 SVG，
 *   直接设置 innerHTML 不会执行 <script>，因此需要逐个重建脚本元素。
 *
 * 安全注意：htmlCode 来自后端，假设后端已做 XSS 防护。
 */
import { useRef, useEffect } from 'react'

interface Props {
  htmlCode: string
}

export function HtmlDiagramRenderer({ htmlCode }: Props) {
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!containerRef.current || !htmlCode.trim()) return

    // 注入 HTML 内容
    containerRef.current.innerHTML = htmlCode

    // 重新执行所有 <script> 标签（innerHTML 不会执行脚本）
    const scripts = containerRef.current.querySelectorAll('script')
    scripts.forEach((oldScript) => {
      const newScript = document.createElement('script')
      Array.from(oldScript.attributes).forEach((attr) => {
        newScript.setAttribute(attr.name, attr.value)
      })
      newScript.textContent = oldScript.textContent
      oldScript.parentNode?.replaceChild(newScript, oldScript)
    })
  }, [htmlCode])

  if (!htmlCode.trim()) {
    return (
      <div className="flex justify-center py-12 text-gray-400 text-sm">
        暂无图表内容
      </div>
    )
  }

  return (
    <div
      ref={containerRef}
      style={{ width: '100%', overflowX: 'auto' }}
    />
  )
}
