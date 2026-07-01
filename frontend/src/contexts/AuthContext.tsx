/**
 * contexts/AuthContext.tsx — 认证上下文
 *
 * 提供全局认证状态管理，是整个应用的权限基础。
 *
 * === 认证流程 ===
 *   1. 应用启动 → AuthProvider 挂载
 *   2. 从 localStorage 读取 token（useLocalStorageState 自动完成）
 *   3. 无 token → isLoading=false, isAuthenticated=false → 显示登录页
 *   4. 有 token → 调用 /api/auth/me 验证有效性
 *      - 成功 → isAuthenticated=true, 存储 user 信息
 *      - 失败 → 清除 token, isAuthenticated=false
 *   5. 登录 → login(token, user) → 保存 token 到 localStorage + 设置 user
 *   6. 登出 → logout() → 清除 token + user
 *
 * === 使用 ===
 *   const { token, user, isAuthenticated, isLoading, login, logout } = useAuth()
 *
 * === 依赖 ===
 *   ahooks useLocalStorageState: 自动管理 token 的 localStorage 读写
 */
import { createContext, useContext, useState, useCallback, useEffect, type ReactNode } from 'react'
import { useLocalStorageState } from 'ahooks'
import type { User } from '../types'

interface AuthContextType {
  token: string | null
  user: User | null
  isAuthenticated: boolean    // 派生值：!!token && !!user
  isLoading: boolean          // 正在验证 token
  login: (token: string, user: User) => void
  logout: () => void
}

const AuthContext = createContext<AuthContextType | null>(null)

const TOKEN_KEY = 'lunwen_token'

export function AuthProvider({ children }: { children: ReactNode }) {
  // useLocalStorageState 管理 token：
  //   - 初始值从 localStorage 同步读取
  //   - setToken 时自动写入 localStorage
  //   - setToken(null) 时自动删除 localStorage key
  const [token, setToken] = useLocalStorageState<string | null>(TOKEN_KEY, {
    defaultValue: null,
  })
  const [user, setUser] = useState<User | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  // 组件挂载时验证已有 token 的有效性
  useEffect(() => {
    if (!token) {
      setIsLoading(false)
      return
    }
    fetch('/api/auth/me', {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((res) => (res.ok ? res.json() : Promise.reject()))
      .then((user: User) => {
        setUser(user)
        setIsLoading(false)
      })
      .catch(() => {
        // token 无效或网络错误 → 清除 token
        setToken(null)
        setIsLoading(false)
      })
  }, []) // 仅在挂载时执行一次

  /** 登录：保存 token 并设置用户信息 */
  const login = useCallback(
    (newToken: string, newUser: User) => {
      setToken(newToken)
      setUser(newUser)
    },
    [setToken],
  )

  /** 登出：清除 token 和用户信息 */
  const logout = useCallback(() => {
    setToken(null)
    setUser(null)
  }, [setToken])

  // 认证状态是派生值，无需单独存储
  const isAuthenticated = !!token && !!user

  return (
    <AuthContext.Provider value={{ token, user, isAuthenticated, isLoading, login, logout }}>
      {children}
    </AuthContext.Provider>
  )
}

/** 获取认证上下文的 Hook，必须在 AuthProvider 内部使用 */
export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
