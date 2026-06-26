import { createContext, useContext, useState, useCallback, useEffect, type ReactNode } from 'react'

interface User {
  user_id: number
  username: string
  email: string | null
  role: string
}

interface AuthState {
  token: string | null
  user: User | null
  isAuthenticated: boolean
  isLoading: boolean
}

interface AuthContextType extends AuthState {
  login: (token: string, user: User) => void
  logout: () => void
}

const AuthContext = createContext<AuthContextType | null>(null)

const TOKEN_KEY = 'lunwen_token'

export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AuthState>({
    token: localStorage.getItem(TOKEN_KEY),
    user: null,
    isAuthenticated: false,
    isLoading: true,
  })

  // Verify token on mount
  useEffect(() => {
    const token = localStorage.getItem(TOKEN_KEY)
    if (!token) {
      setState(prev => ({ ...prev, isLoading: false }))
      return
    }
    fetch('/api/auth/me', {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then(res => res.ok ? res.json() : Promise.reject())
      .then((user: User) => {
        setState({ token, user, isAuthenticated: true, isLoading: false })
      })
      .catch(() => {
        localStorage.removeItem(TOKEN_KEY)
        setState({ token: null, user: null, isAuthenticated: false, isLoading: false })
      })
  }, [])

  const login = useCallback((token: string, user: User) => {
    localStorage.setItem(TOKEN_KEY, token)
    setState({ token, user, isAuthenticated: true, isLoading: false })
  }, [])

  const logout = useCallback(() => {
    localStorage.removeItem(TOKEN_KEY)
    setState({ token: null, user: null, isAuthenticated: false, isLoading: false })
  }, [])

  return (
    <AuthContext.Provider value={{ ...state, login, logout }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
