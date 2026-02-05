import { useNavigate } from 'react-router-dom'
import QuizEditor from '@/components/QuizEditor'
import { useI18n } from '@/lib/i18n'

export default function NewQuizPage() {
  const navigate = useNavigate()
  const { t } = useI18n()
  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-semibold sm:text-3xl">{t('quiz_create')}</h1>
        <p className="text-muted-foreground">{t('quiz_build')}</p>
      </div>
      <QuizEditor onCreated={() => navigate('/dashboard')} />
    </div>
  )
}
