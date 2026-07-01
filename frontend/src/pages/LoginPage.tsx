/**
 * pages/LoginPage.tsx — 登录/注册页面
 *
 * 支持两种模式切换：
 *   - 登录：用户名 + 密码
 *   - 注册：用户名 + 密码 + 邮箱（选填）
 *
 * 使用 ahooks 的 useRequest 管理异步请求状态（loading/error），
 * 使用 useBoolean 管理注册模式切换。
 *
 * 登录成功后通过 useAuth().login() 更新全局认证状态，
 * 然后调用 onSuccess 回调通知父组件（App.tsx）跳转。
 */
import { useState, type FormEvent } from 'react'
import { useRequest, useBoolean } from 'ahooks'
import { useAuth } from '../contexts/AuthContext'
import { AuthApi } from '../services/api'

interface Props {
  onSuccess: () => void
}

export function LoginPage({ onSuccess }: Props) {
  const { login } = useAuth()
  const [isRegister, { toggle: toggleMode }] = useBoolean(false)
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [email, setEmail] = useState('')

  // useRequest 管理异步登录/注册请求
  // manual: true — 不自动执行，由 handleSubmit 手动触发
  // 根据 isRegister 决定调用 login 还是 register
  const { loading, error, run: doSubmit } = useRequest(
    async () => {
      if (isRegister) {
        return AuthApi.register(username, password, email || undefined)
      }
      return AuthApi.login(username, password)
    },
    {
      manual: true,
      onSuccess: (result) => {
        // 将后端返回的 token 和用户信息注入全局认证上下文
        login(result.token, {
          user_id: result.user_id,
          username: result.username,
          email: null,
          role: result.role,
        })
        onSuccess()
      },
    },
  )

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault()
    doSubmit()
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="w-full max-w-md">
        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-8">
          {/* Header */}
          <div className="text-center mb-8">
            <h1 className="text-2xl font-bold text-gray-900">智能学术写作平台</h1>
            <p className="text-sm text-gray-500 mt-2">
              {isRegister ? '创建账号开始使用' : '登录你的账号'}
            </p>
          </div>

          {/* 错误提示 — useRequest 的 error 是 Error 对象，取 .message 显示 */}
          {error && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
              {error.message}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">用户名</label>
              <input
                type="text"
                value={username}
                onChange={e => setUsername(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none"
                required
                minLength={2}
                maxLength={50}
              />
            </div>

            {isRegister && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">邮箱（选填）</label>
                <input
                  type="email"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none"
                />
              </div>
            )}

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">密码</label>
              <input
                type="password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none"
                required
                minLength={6}
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-2.5 bg-indigo-600 text-white rounded-lg font-medium text-sm hover:bg-indigo-700 disabled:opacity-50 transition-colors"
            >
              {loading ? '处理中...' : isRegister ? '注册' : '登录'}
            </button>
          </form>

          {/* 模式切换 — useBoolean 的 toggle() 在 true/false 间切换 */}
          <div className="mt-4 text-center">
            <button
              onClick={toggleMode}
              className="text-sm text-indigo-600 hover:text-indigo-800"
            >
              {isRegister ? '已有账号？去登录' : '没有账号？去注册'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
