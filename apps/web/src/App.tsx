import { Routes, Route } from 'react-router-dom'
import { AuthProvider } from '@/lib/auth'
import { AppShell } from '@/components/AppShell'
import { ProtectedRoute } from '@/components/ProtectedRoute'
import LandingPage from '@/pages/LandingPage'
import JoinPage from '@/pages/JoinPage'
import PlayPage from '@/pages/PlayPage'
import LoginPage from '@/pages/auth/LoginPage'
import RegisterPage from '@/pages/auth/RegisterPage'
import ForgotPage from '@/pages/auth/ForgotPage'
import DashboardPage from '@/pages/DashboardPage'
import NewQuizPage from '@/pages/NewQuizPage'
import EditQuizPage from '@/pages/EditQuizPage'
import HostPage from '@/pages/HostPage'
import SettingsPage from '@/pages/SettingsPage'

export default function App() {
  return (
    <AuthProvider>
      <AppShell>
        <Routes>
          <Route path="/" element={<LandingPage />} />
          <Route path="/join" element={<JoinPage />} />
          <Route path="/play/:code" element={<PlayPage />} />
          <Route path="/auth/login" element={<LoginPage />} />
          <Route path="/auth/register" element={<RegisterPage />} />
          <Route path="/auth/forgot" element={<ForgotPage />} />
          <Route
            path="/dashboard"
            element={
              <ProtectedRoute>
                <DashboardPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/quizzes/new"
            element={
              <ProtectedRoute>
                <NewQuizPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/quizzes/:id/edit"
            element={
              <ProtectedRoute>
                <EditQuizPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/host/:code"
            element={
              <ProtectedRoute>
                <HostPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/settings"
            element={
              <ProtectedRoute>
                <SettingsPage />
              </ProtectedRoute>
            }
          />
        </Routes>
      </AppShell>
    </AuthProvider>
  )
}
