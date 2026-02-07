import { useNavigate } from 'react-router-dom'
import QuizEditor from '@/components/QuizEditor'
import { useI18n } from '@/lib/i18n'

export default function NewQuizPage() {
  const navigate = useNavigate()
  const { t } = useI18n()
  return (
    <QuizEditor
      onCreated={() => navigate('/dashboard')}
      headerTitle={t('quiz_create')}
      headerSubtitle={t('quiz_build')}
      badgeLabel="Draft"
    />
  )
}
