import { useState, useEffect } from 'react'
import { NavLink, useLocation } from 'react-router-dom'
import { PenLine, GitBranch, MessageSquare, BookOpen, Settings, LogOut, User } from 'lucide-react'
import { useAuth } from '../../contexts/AuthContext'

const navItems = [
  { to: '/rewrite', label: '论文写作', icon: PenLine },
  { to: '/er-diagram', label: '图表生成', icon: GitBranch },
  { to: '/reference', label: '参考文献', icon: BookOpen },
  { to: '/chat', label: '论文导师', icon: MessageSquare },
]

export default function Sidebar() {
  const { user, logout } = useAuth()
  const location = useLocation()
  const [modelInfo, setModelInfo] = useState<{ provider: string; model: string; available: boolean } | null>(null)

  useEffect(() => {
    fetch('/api/health')
      .then((r) => r.json())
      .then((data) => setModelInfo({
        provider: data.provider || '未配置',
        model: data.model || '',
        available: data.llm_available ?? false,
      }))
      .catch(() => setModelInfo(null))
  }, [location.pathname])  // refresh when route changes

  return (
    <aside className="w-60 bg-white border-r border-gray-200 flex-shrink-0 hidden md:flex flex-col">
      {/* Brand */}
      <div className="px-5 pt-6 pb-4">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-indigo-500 to-blue-600 flex items-center justify-center">
            <PenLine size={16} className="text-white" />
          </div>
          <div>
            <h1 className="text-base font-bold text-gray-900 leading-tight">智能学术写作</h1>
            <p className="text-[11px] text-gray-400">多 Agent 协作平台</p>
          </div>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-3 space-y-0.5">
        {navItems.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            className={({ isActive }) =>
              `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-150 ${
                isActive
                  ? 'bg-indigo-50 text-indigo-700 shadow-sm'
                  : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
              }`
            }
          >
            {({ isActive }) => (
              <>
                <item.icon size={18} className={isActive ? 'text-indigo-600' : 'text-gray-400'} />
                {item.label}
              </>
            )}
          </NavLink>
        ))}
      </nav>

      {/* Footer: user info + settings + logout */}
      <div className="p-3 border-t border-gray-100 space-y-2">
        {/* User info */}
        {user && (
          <div className="flex items-center gap-2 px-3 py-2">
            <User size={14} className="text-gray-400" />
            <span className="text-xs text-gray-600 truncate flex-1">{user.username}</span>
            {user.role === 'admin' && (
              <span className="text-[10px] px-1.5 py-0.5 bg-amber-100 text-amber-700 rounded font-medium">管理</span>
            )}
          </div>
        )}

        {/* Model status → settings */}
        <NavLink
          to="/settings"
          className={({ isActive }) =>
            `block px-3 py-2.5 rounded-lg transition-colors ${
              isActive
                ? 'bg-indigo-50 text-indigo-700'
                : 'bg-gray-50 hover:bg-gray-100'
            }`
          }
        >
          <div className="flex items-center gap-2">
            <span className={`w-2 h-2 rounded-full flex-shrink-0 ${modelInfo?.available ? 'bg-green-500' : 'bg-gray-300'}`} />
            <Settings size={14} className="text-gray-400" />
            <div className="min-w-0 flex-1">
              <p className="text-xs font-medium text-gray-700 truncate">
                {modelInfo ? `${modelInfo.provider}` : '加载中...'}
              </p>
              <p className="text-[10px] text-gray-400 truncate">{modelInfo?.model || '点击配置模型'}</p>
            </div>
          </div>
        </NavLink>

        {/* Logout */}
        <button
          onClick={logout}
          className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium text-gray-500 hover:bg-red-50 hover:text-red-600 transition-colors"
        >
          <LogOut size={16} />
          退出登录
        </button>
      </div>
    </aside>
  )
}
