/**
 * App.tsx — 根组件
 *
 * 职责：
 *   1. 认证守卫 — 未登录显示 LoginPage，加载中显示骨架屏
 *   2. 页面路由 — 基于 URL pathname 的 hidden 切换（非 React Router 标准路由）
 *
 * 为什么用 hidden 而非 <Routes>？
 *   所有页面在 AppLayout 内共享同一个侧边栏 + Toast 容器，
 *   用 hidden 切换可以保持各页面 DOM 状态不丢失。
 */
import { useLocation } from 'react-router-dom'
import { useAuth } from './contexts/AuthContext'
import { AppLayout } from './components/Layout/AppLayout'
import { RewritePage } from './pages/RewritePage'
import { ERDiagramPage } from './pages/ERDiagramPage'
import { ReferencePage } from './pages/ReferencePage'
import { SettingsPage } from './pages/SettingsPage'
import { ChatPage } from './pages/ChatPage'
import { LoginPage } from './pages/LoginPage'
import { LoadingSkeleton } from './components/Shared/LoadingSkeleton'

/** 根据当前 URL 路径，用 hidden 属性显示/隐藏各页面 */
function PageContent() {
  const path = useLocation().pathname

  return (
    <>
      {/* 论文写作 — 默认页（/ 或 /rewrite） */}
      <div hidden={path !== '/' && !path.startsWith('/rewrite')} className="h-full">
        <RewritePage />
      </div>
      {/* 图表生成 */}
      <div hidden={!path.startsWith('/er-diagram')} className="h-full">
        <ERDiagramPage />
      </div>
      {/* 参考文献 */}
      <div hidden={!path.startsWith('/reference')} className="h-full">
        <ReferencePage />
      </div>
      {/* 论文导师（聊天） */}
      <div hidden={!path.startsWith('/chat')} className="h-full">
        <ChatPage />
      </div>
      {/* 设置 */}
      <div hidden={!path.startsWith('/settings')} className="h-full">
        <SettingsPage />
      </div>
    </>
  )
}

/**
 * 认证路由守卫
 * - isLoading: 正在验证 token → 显示骨架屏
 * - 未认证 → 显示登录页
 * - 已认证 → 显示 AppLayout + 页面内容
 */
function ProtectedRoutes() {
  const { isAuthenticated, isLoading } = useAuth()

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <LoadingSkeleton />
      </div>
    )
  }

  if (!isAuthenticated) {
    return <LoginPage onSuccess={() => {}} />
  }

  return (
    <AppLayout>
      <PageContent />
    </AppLayout>
  )
}

export function App() {
  return <ProtectedRoutes />
}
