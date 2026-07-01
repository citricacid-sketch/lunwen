/**
 * Shared/LoadingSkeleton.tsx — 加载骨架屏
 *
 * 使用 Tailwind animate-pulse 实现呼吸动画。
 * 在 SSE 流式生成进行中显示，给用户"正在加载"的视觉反馈。
 */
export function LoadingSkeleton() {
  return (
    <div className="space-y-4 p-6 animate-pulse">
      <div className="h-4 bg-gray-200 rounded w-3/4" />
      <div className="h-4 bg-gray-200 rounded w-1/2" />
      <div className="h-4 bg-gray-200 rounded w-5/6" />
      <div className="h-4 bg-gray-200 rounded w-2/3" />
      <div className="h-4 bg-gray-200 rounded w-3/4" />
    </div>
  )
}
