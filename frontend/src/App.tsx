import { useLocation } from 'react-router-dom'
import { useAuth } from './contexts/AuthContext'
import AppLayout from './components/Layout/AppLayout'
import RewritePage from './pages/RewritePage'
import ERDiagramPage from './pages/ERDiagramPage'
import ReferencePage from './pages/ReferencePage'
import SettingsPage from './pages/SettingsPage'
import ChatPage from './pages/ChatPage'
import LoginPage from './pages/LoginPage'
import LoadingSkeleton from './components/Shared/LoadingSkeleton'

function PageContent() {
  const path = useLocation().pathname

  return (
    <>
      <div hidden={path !== '/' && !path.startsWith('/rewrite')}>
        <RewritePage />
      </div>
      <div hidden={!path.startsWith('/er-diagram')}>
        <ERDiagramPage />
      </div>
      <div hidden={!path.startsWith('/reference')}>
        <ReferencePage />
      </div>
      <div hidden={!path.startsWith('/chat')}>
        <ChatPage />
      </div>
      <div hidden={!path.startsWith('/settings')}>
        <SettingsPage />
      </div>
    </>
  )
}

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

export default function App() {
  return <ProtectedRoutes />
}
