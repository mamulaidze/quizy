import React from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { QRCodeSVG } from 'qrcode.react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Countdown } from '@/components/Countdown'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/lib/auth'
import { useSessionRealtime } from '@/hooks/useSessionRealtime'
import type { Question, Session } from '@/types/db'
import { calculateScore } from '@/lib/scoring'
import { toast } from 'sonner'

export default function HostPage() {
  const { code } = useParams()
  const { user } = useAuth()
  const navigate = useNavigate()

  const sessionQuery = useQuery({
    queryKey: ['sessionByCode', code],
    queryFn: async () => {
      const { data, error } = await supabase.from('sessions').select('*').eq('code', code).single()
      if (error) throw error
      return data as Session
    }
  })

  const sessionId = sessionQuery.data?.id
  const { session, participants, answers } = useSessionRealtime(sessionId)

  const questionsQuery = useQuery({
    queryKey: ['questions', sessionQuery.data?.quiz_id],
    enabled: !!sessionQuery.data?.quiz_id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('questions')
        .select('*')
        .eq('quiz_id', sessionQuery.data?.quiz_id)
        .order('idx')
      if (error) throw error
      return data as Question[]
    }
  })

  React.useEffect(() => {
    if (sessionQuery.data && sessionQuery.data.host_id !== user?.id) {
      toast.error('You do not own this session')
      navigate('/dashboard')
    }
  }, [sessionQuery.data, user, navigate])

  if (sessionQuery.isLoading || questionsQuery.isLoading) {
    return <div className="text-muted-foreground">Loading session...</div>
  }

  if (!sessionQuery.data || !session) {
    return <div className="text-muted-foreground">Session not found.</div>
  }

  const questions = questionsQuery.data ?? []
  const currentQuestion = questions[session.current_question_idx]

  const startQuestion = async () => {
    if (!currentQuestion) return
    const { error } = await supabase
      .from('sessions')
      .update({
        status: 'question',
        question_started_at: new Date().toISOString(),
        public_question: {
          question_id: currentQuestion.id,
          prompt: currentQuestion.prompt,
          options: currentQuestion.options,
          time_limit_sec: currentQuestion.time_limit_sec
        }
      })
      .eq('id', session.id)
    if (error) toast.error(error.message)
  }

  const showResults = async () => {
    if (!currentQuestion || !session.question_started_at) return
    const startedAt = new Date(session.question_started_at).getTime()

    const updates = participants.map((participant) => {
      const participantAnswer = answers.find(
        (answer) => answer.participant_id === participant.id && answer.question_id === currentQuestion.id
      )
      if (!participantAnswer) {
        return { participantId: participant.id, scoreDelta: 0, answerId: null, awarded: 0, correct: false }
      }
      const elapsedMs = new Date(participantAnswer.created_at).getTime() - startedAt
      const isCorrect = participantAnswer.selected_index === currentQuestion.correct_index
      const awarded = isCorrect ? calculateScore(elapsedMs, currentQuestion.time_limit_sec) : 0
      return {
        participantId: participant.id,
        scoreDelta: awarded,
        answerId: participantAnswer.id,
        awarded,
        correct: isCorrect
      }
    })

    for (const update of updates) {
      if (update.answerId) {
        await supabase
          .from('answers')
          .update({ is_correct: update.correct, awarded_points: update.awarded })
          .eq('id', update.answerId)
      }
      await supabase
        .from('participants')
        .update({ score: (participants.find((p) => p.id === update.participantId)?.score ?? 0) + update.scoreDelta })
        .eq('id', update.participantId)
    }

    await supabase.from('sessions').update({ status: 'results' }).eq('id', session.id)
  }

  const nextQuestion = async () => {
    const nextIdx = session.current_question_idx + 1
    if (nextIdx >= questions.length) {
      await supabase.from('sessions').update({ status: 'ended' }).eq('id', session.id)
      return
    }
    await supabase
      .from('sessions')
      .update({
        current_question_idx: nextIdx,
        status: 'question',
        question_started_at: new Date().toISOString(),
        public_question: {
          question_id: questions[nextIdx].id,
          prompt: questions[nextIdx].prompt,
          options: questions[nextIdx].options,
          time_limit_sec: questions[nextIdx].time_limit_sec
        }
      })
      .eq('id', session.id)
  }

  const endSession = async () => {
    await supabase.from('sessions').update({ status: 'ended' }).eq('id', session.id)
  }

  const leaderboard = [...participants].sort((a, b) => b.score - a.score).slice(0, 10)

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-3xl font-semibold">Host control</h1>
          <p className="text-muted-foreground">Code: {session.code}</p>
        </div>
        <Badge className="uppercase">{session.status}</Badge>
      </div>

      {session.status === 'lobby' && (
        <Card>
          <CardHeader>
            <CardTitle>Lobby</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-6 md:grid-cols-[1.2fr,0.8fr]">
            <div className="space-y-3">
              <p className="text-muted-foreground">Share the join code or QR.</p>
              <div className="text-4xl font-bold tracking-widest">{session.code}</div>
              <div className="flex flex-wrap gap-2">
                <Button onClick={startQuestion} disabled={participants.length === 0}>
                  Start question
                </Button>
                <Button variant="destructive" onClick={endSession}>
                  End session
                </Button>
              </div>
              <div className="space-y-2">
                <p className="text-sm text-muted-foreground">Participants</p>
                <div className="flex flex-wrap gap-2">
                  {participants.map((p) => (
                    <Badge key={p.id}>{p.nickname}</Badge>
                  ))}
                </div>
              </div>
            </div>
            <div className="flex flex-col items-center gap-3 rounded-lg border p-4">
              <QRCodeSVG value={`${window.location.origin}/play/${session.code}`} />
              <span className="text-xs text-muted-foreground">Scan to join</span>
            </div>
          </CardContent>
        </Card>
      )}

      {session.status === 'question' && currentQuestion && (
        <Card>
          <CardHeader>
            <CardTitle>Question {session.current_question_idx + 1}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <h2 className="text-2xl font-semibold">{currentQuestion.prompt}</h2>
              <Countdown startAt={session.question_started_at} limitSec={currentQuestion.time_limit_sec} />
            </div>
            <div className="grid gap-3 md:grid-cols-2">
              {currentQuestion.options.map((opt, idx) => (
                <Card key={idx} className={idx === currentQuestion.correct_index ? 'border-primary' : ''}>
                  <CardContent className="p-4">{opt}</CardContent>
                </Card>
              ))}
            </div>
            <div className="flex flex-wrap gap-2">
              <Button onClick={showResults}>Show results</Button>
              <Button variant="destructive" onClick={endSession}>
                End session
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {session.status === 'results' && (
        <Card>
          <CardHeader>
            <CardTitle>Results</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <p className="text-muted-foreground">Correct answer</p>
              <p className="text-lg font-semibold">
                {currentQuestion?.options[currentQuestion.correct_index] ?? 'N/A'}
              </p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Leaderboard</p>
              <div className="space-y-2">
                {leaderboard.map((p, idx) => (
                  <div key={p.id} className="flex items-center justify-between rounded-md border p-3">
                    <span>
                      {idx + 1}. {p.nickname}
                    </span>
                    <span className="font-semibold">{p.score}</span>
                  </div>
                ))}
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button onClick={nextQuestion}>Next question</Button>
              <Button variant="destructive" onClick={endSession}>
                End session
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {session.status === 'ended' && (
        <Card>
          <CardHeader>
            <CardTitle>Session ended</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground">Thanks for hosting! Final leaderboard:</p>
            <div className="mt-4 space-y-2">
              {leaderboard.map((p, idx) => (
                <div key={p.id} className="flex items-center justify-between rounded-md border p-3">
                  <span>
                    {idx + 1}. {p.nickname}
                  </span>
                  <span className="font-semibold">{p.score}</span>
                </div>
              ))}
            </div>
            <div className="mt-4">
              <Button onClick={() => navigate('/dashboard')}>Back to dashboard</Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
