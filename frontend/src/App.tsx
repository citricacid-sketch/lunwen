import { useLocation } from 'react-router-dom'
import { useAuth } from './contexts/AuthContext'
import AppLayout from './components/Layout/AppLayout'
import RewritePage from './components/Rewrite/RewritePage'
import ERDiagramPage from './components/ERDiagram/ERDiagramPage'
import ReferencePage from './components/Reference/ReferencePage'
import SettingsPage from './components/Settings/SettingsPage'
import ChatPage from './components/Chat/ChatPage'
import LoginPage from './components/Auth/LoginPage'
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
