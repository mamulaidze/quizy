import React from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { supabase } from '@/lib/supabase'
import { useSessionRealtime } from '@/hooks/useSessionRealtime'
import type { Session } from '@/types/db'
import { toast } from 'sonner'

export default function PlayPage() {
  const { code } = useParams()
  const navigate = useNavigate()
  const [nickname, setNickname] = React.useState('')
  const [participantId, setParticipantId] = React.useState<string | null>(null)
  const [joining, setJoining] = React.useState(false)
  const [hasAnswered, setHasAnswered] = React.useState(false)

  const sessionQuery = useQuery({
    queryKey: ['session', code],
    queryFn: async () => {
      const { data, error } = await supabase.from('sessions').select('*').eq('code', code).single()
      if (error) throw error
      return data as Session
    }
  })

  const sessionId = sessionQuery.data?.id
  const { session, participants } = useSessionRealtime(sessionId, { includeAnswers: false })

  React.useEffect(() => {
    if (!sessionId || !code) return
    const storedNickname = localStorage.getItem(`nickname-${code}`)
    const storedParticipant = localStorage.getItem(`participant-${sessionId}`)
    if (storedParticipant) {
      setParticipantId(storedParticipant)
    }
    if (storedNickname) {
      setNickname(storedNickname)
    }
  }, [sessionId, code])

  const joinSession = async () => {
    if (!sessionId || !nickname.trim() || participantId || joining) return
    setJoining(true)
    const { data, error } = await supabase
      .from('participants')
      .insert({ session_id: sessionId, nickname: nickname.trim(), score: 0 })
      .select('*')
      .single()
    setJoining(false)
    if (error || !data) {
      toast.error(error?.message ?? 'Unable to join session')
      return
    }
    localStorage.setItem(`participant-${sessionId}`, data.id)
    setParticipantId(data.id)
  }

  React.useEffect(() => {
    setHasAnswered(false)
  }, [session?.current_question_idx, session?.status])

  if (sessionQuery.isLoading) {
    return <div className="text-muted-foreground">Loading session...</div>
  }

  if (!sessionQuery.data || !session) {
    return <div className="text-muted-foreground">Game not found.</div>
  }

  const submitNickname = async () => {
    if (nickname.trim().length < 2) return
    const trimmed = nickname.trim()
    localStorage.setItem(`nickname-${code}`, trimmed)
    setNickname(trimmed)
    await joinSession()
  }

  const submitAnswer = async (index: number) => {
    if (!session.public_question?.question_id || !participantId || hasAnswered) return
    const { error } = await supabase.from('answers').insert({
      session_id: session.id,
      participant_id: participantId,
      question_id: session.public_question.question_id,
      selected_index: index,
      is_correct: false,
      awarded_points: 0
    })
    if (error) {
      toast.error(error.message)
      return
    }
    setHasAnswered(true)
  }

  return (
    <div className="mx-auto max-w-lg space-y-4">
      {(!nickname || !participantId) && (
        <Card>
          <CardHeader>
            <CardTitle>Choose a nickname</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <Label htmlFor="nickname">Nickname</Label>
            <Input id="nickname" value={nickname} onChange={(e) => setNickname(e.target.value)} />
            <Button className="w-full" onClick={submitNickname} disabled={joining}>
              {joining ? 'Joining...' : 'Join lobby'}
            </Button>
          </CardContent>
        </Card>
      )}

      {nickname && participantId && session.status === 'lobby' && (
        <Card>
          <CardHeader>
            <CardTitle>Waiting for host</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <p className="text-muted-foreground">Share this code with friends.</p>
            <div className="text-3xl font-bold tracking-widest">{session.code}</div>
            <div className="flex flex-wrap gap-2">
              {participants.map((p) => (
                <Badge key={p.id}>{p.nickname}</Badge>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {nickname && participantId && session.status === 'question' && session.public_question && (
        <Card>
          <CardHeader>
            <CardTitle>{session.public_question.prompt}</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-3">
            {session.public_question.options.map((opt, idx) => (
              <Button
                key={idx}
                size="xl"
                variant={hasAnswered ? 'outline' : 'default'}
                className="h-auto justify-start py-4"
                onClick={() => submitAnswer(idx)}
                disabled={hasAnswered}
              >
                {opt}
              </Button>
            ))}
            {hasAnswered && (
              <p className="text-center text-sm text-muted-foreground">Answer submitted. Waiting for results.</p>
            )}
          </CardContent>
        </Card>
      )}

      {nickname && participantId && session.status === 'results' && (
        <Card>
          <CardHeader>
            <CardTitle>Results</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <p className="text-muted-foreground">Scores update live after each question.</p>
            <div className="space-y-2">
              {[...participants]
                .sort((a, b) => b.score - a.score)
                .slice(0, 10)
                .map((p, idx) => (
                  <div key={p.id} className="flex items-center justify-between rounded-md border p-3">
                    <span>
                      {idx + 1}. {p.nickname}
                    </span>
                    <span className="font-semibold">{p.score}</span>
                  </div>
                ))}
            </div>
          </CardContent>
        </Card>
      )}

      {nickname && participantId && session.status === 'ended' && (
        <Card>
          <CardHeader>
            <CardTitle>Game over</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-muted-foreground">Thanks for playing!</p>
            <Button variant="secondary" onClick={() => navigate('/join')}>
              Join another game
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
