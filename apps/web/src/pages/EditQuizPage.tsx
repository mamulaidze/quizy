import { useParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import QuizEditor from '@/components/QuizEditor'
import { supabase } from '@/lib/supabase'
import type { Quiz, Question } from '@/types/db'

export default function EditQuizPage() {
  const { id } = useParams()

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
    return <div className="text-muted-foreground">Loading quiz...</div>
  }

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-3xl font-semibold">Edit quiz</h1>
        <p className="text-muted-foreground">Changes are autosaved.</p>
      </div>
      <QuizEditor quiz={data.quiz} questions={data.questions} />
    </div>
  )
}
