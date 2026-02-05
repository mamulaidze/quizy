import { Navigate } from 'react-router-dom'
import { useAuth } from '@/lib/auth'
import { useI18n } from '@/lib/i18n'

export function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth()
  const { t } = useI18n()

  if (loading) {
    return <div className="py-12 text-center text-muted-foreground">{t('loading_session')}</div>
  }

  if (!user) {
    return <Navigate to="/auth/login" replace />
  }

  return <>{children}</>
}
