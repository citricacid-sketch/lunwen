import { NavLink, useLocation } from 'react-router-dom'
import Sidebar from './Sidebar'
import { Toaster } from 'react-hot-toast'
import { PenLine, GitBranch, MessageSquare, BookOpen } from 'lucide-react'
import type { ReactNode } from 'react'

const mobileNav = [
  { to: '/rewrite', label: '写作', icon: PenLine },
  { to: '/reference', label: '文献', icon: BookOpen },
  { to: '/chat', label: '导师', icon: MessageSquare },
  { to: '/er-diagram', label: '图表', icon: GitBranch },
]

export default function AppLayout({ children }: { children: ReactNode }) {
  const location = useLocation()

  return (
    <div className="flex h-screen bg-gray-50">
      <Sidebar />

      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Main content */}
        <main className="flex-1 overflow-auto">
          {children}
        </main>

        {/* Mobile bottom nav */}
        <nav className="md:hidden flex items-center justify-around bg-white border-t border-gray-200 px-2 pb-safe">
          {mobileNav.map((item) => {
            const isActive = location.pathname.startsWith(item.to)
            return (
              <NavLink
                key={item.to}
                to={item.to}
                className={`flex flex-col items-center gap-0.5 py-2 px-4 rounded-lg transition-colors ${
                  isActive ? 'text-indigo-600' : 'text-gray-400 hover:text-gray-600'
                }`}
              >
                <item.icon size={20} />
                <span className="text-[10px] font-medium">{item.label}</span>
              </NavLink>
            )
          })}
        </nav>
      </div>

      <Toaster position="top-center" />
    </div>
  )
}
