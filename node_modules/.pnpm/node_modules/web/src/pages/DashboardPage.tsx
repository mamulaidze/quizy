import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Link, useNavigate } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { supabase } from '@/lib/supabase'
import { generateCode } from '@/lib/code'
import { useAuth } from '@/lib/auth'
import { toast } from 'sonner'
import type { Quiz } from '@/types/db'
import React from 'react'

export default function DashboardPage() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [search, setSearch] = React.useState('')

  const { data, isLoading } = useQuery({
    queryKey: ['quizzes'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('quizzes')
        .select('*')
        .order('created_at', { ascending: false })
      if (error) throw error
      return data as Quiz[]
    }
  })

  const filtered = (data ?? []).filter((quiz) =>
    quiz.title.toLowerCase().includes(search.toLowerCase())
  )

  const startSession = async (quizId: string) => {
    if (!user) return
    const code = generateCode()
    const { data, error } = await supabase
      .from('sessions')
      .insert({
        quiz_id: quizId,
        host_id: user.id,
        code,
        status: 'lobby',
        current_question_idx: 0,
        question_started_at: null,
        public_question: null
      })
      .select('*')
      .single()

    if (error || !data) {
      toast.error(error?.message ?? 'Failed to start session')
      return
    }
    navigate(`/host/${data.code}`)
  }

  const duplicateQuiz = async (quiz: Quiz) => {
    if (!user) return
    const { data: newQuiz, error } = await supabase
      .from('quizzes')
      .insert({
        owner_id: user.id,
        title: `${quiz.title} (Copy)`,
        description: quiz.description,
        cover_url: quiz.cover_url
      })
      .select('*')
      .single()
    if (error || !newQuiz) {
      toast.error(error?.message ?? 'Failed to duplicate quiz')
      return
    }

    const { data: questions } = await supabase
      .from('questions')
      .select('*')
      .eq('quiz_id', quiz.id)

    if (questions && questions.length > 0) {
      const copied = questions.map((q) => ({
        quiz_id: newQuiz.id,
        idx: q.idx,
        prompt: q.prompt,
        options: q.options,
        correct_index: q.correct_index,
        time_limit_sec: q.time_limit_sec
      }))
      await supabase.from('questions').insert(copied)
    }

    await queryClient.invalidateQueries({ queryKey: ['quizzes'] })
    toast.success('Quiz duplicated')
  }

  const deleteQuiz = async (quizId: string) => {
    const { error } = await supabase.from('quizzes').delete().eq('id', quizId)
    if (error) {
      toast.error(error.message)
      return
    }
    await queryClient.invalidateQueries({ queryKey: ['quizzes'] })
    toast.success('Quiz deleted')
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-3xl font-semibold">Your quizzes</h1>
          <p className="text-muted-foreground">Create and host live games.</p>
        </div>
        <Button asChild>
          <Link to="/quizzes/new">New quiz</Link>
        </Button>
      </div>

      <div className="flex items-center gap-3">
        <Input
          placeholder="Search quizzes"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
        />
      </div>

      {isLoading ? (
        <div className="text-muted-foreground">Loading...</div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {filtered.map((quiz) => (
            <Card key={quiz.id}>
              <CardHeader>
                <CardTitle>{quiz.title}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <p className="text-sm text-muted-foreground">{quiz.description ?? 'No description'}</p>
                <div className="flex flex-wrap gap-2">
                  <Button size="sm" onClick={() => startSession(quiz.id)}>
                    Host session
                  </Button>
                  <Button size="sm" variant="outline" asChild>
                    <Link to={`/quizzes/${quiz.id}/edit`}>Edit</Link>
                  </Button>
                  <Button size="sm" variant="secondary" onClick={() => duplicateQuiz(quiz)}>
                    Duplicate
                  </Button>
                  <Button size="sm" variant="destructive" onClick={() => deleteQuiz(quiz.id)}>
                    Delete
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
