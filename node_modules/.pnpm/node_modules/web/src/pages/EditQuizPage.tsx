import { useParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import QuizEditor from '@/components/QuizEditor'
import { supabase } from '@/lib/supabase'
import type { Quiz, Question } from '@/types/db'
import { LoadingDots } from '@/components/LoadingDots'
import { useI18n } from '@/lib/i18n'

export default function EditQuizPage() {
  const { id } = useParams()
  const { t } = useI18n()

  const { data, isLoading } = useQuery({
    queryKey: ['quiz', id],
    queryFn: async () => {
      const quizRes = await supabase.from('quizzes').select('*').eq('id', id).single()
      const questionsRes = await supabase
        .from('questions')
        .select('*')
        .eq('quiz_id', id)
        .order('idx')
      if (quizRes.error) throw quizRes.error
      return {
        quiz: quizRes.data as Quiz,
        questions: (questionsRes.data ?? []) as Question[]
      }
    }
  })

  if (isLoading || !data) {
    return (
      <div className="rounded-3xl border border-white/10 bg-white/5 p-6">
        <LoadingDots label={t('loading_quizzes')} />
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-semibold sm:text-3xl">{t('quiz_edit')}</h1>
        <p className="text-muted-foreground">{t('quiz_autosaved')}</p>
      </div>
      <QuizEditor quiz={data.quiz} questions={data.questions} />
    </div>
  )
}
