import { useRef, useEffect } from 'react'

interface Props {
  htmlCode: string
}

export default function HtmlDiagramRenderer({ htmlCode }: Props) {
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!containerRef.current || !htmlCode.trim()) return

    containerRef.current.innerHTML = htmlCode

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
