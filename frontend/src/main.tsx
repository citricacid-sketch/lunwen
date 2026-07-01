/**
 * main.tsx — 应用入口
 *
 * 初始化 React 根节点，挂载全局 Provider 栈：
 *   1. StrictMode    — 开发环境双重渲染，检测副作用
 *   2. BrowserRouter — React Router，提供客户端路由
 *   3. AuthProvider  — 认证上下文（token 管理 + 登录状态）
 *   4. App           — 根组件（路由守卫 + 页面分发）
 */
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { AuthProvider } from './contexts/AuthContext'
import './index.css'
import { App } from './App'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <AuthProvider>
        <App />
      </AuthProvider>
    </BrowserRouter>
  </StrictMode>,
)
