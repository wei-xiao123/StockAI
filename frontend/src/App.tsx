import { useEffect, useState } from 'react'
import { Navigate, Route, Routes } from 'react-router-dom'

import { AppShell } from './components/layout/app-shell'
import { fetchSession, logoutSession } from './lib/api'
import { AnalysisPage } from './pages/analysis-page'
import { HistoryPage } from './pages/history-page'
import { LoginPage } from './pages/login-page'
import type { SessionResponse } from './types/api'

function App() {
  const [session, setSession] = useState<SessionResponse | null>(null)
  const [bootstrapping, setBootstrapping] = useState(true)

  useEffect(() => {
    let cancelled = false

    async function bootstrap() {
      try {
        const remoteSession = await fetchSession()
        if (!cancelled) {
          setSession(remoteSession)
        }
      } catch {
        if (!cancelled) {
          setSession(null)
        }
      } finally {
        if (!cancelled) {
          setBootstrapping(false)
        }
      }
    }

    void bootstrap()

    return () => {
      cancelled = true
    }
  }, [])

  async function handleLogout() {
    try {
      await logoutSession()
    } finally {
      window.localStorage.removeItem('stockai:last-symbol')
      window.localStorage.removeItem('stockai:last-analysis')
      setSession(null)
    }
  }

  function handleLogin(nextSession: SessionResponse) {
    setSession(nextSession)
    setBootstrapping(false)
  }

  if (bootstrapping) {
    return null
  }

  if (!session) {
    return <LoginPage onLogin={handleLogin} />
  }

  return (
    <Routes>
      <Route element={<AppShell onLogout={handleLogout} />}>
        <Route index element={<AnalysisPage />} />
        <Route path="/history" element={<HistoryPage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  )
}

export default App
