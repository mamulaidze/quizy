import React from 'react'
import { motion, useReducedMotion } from 'framer-motion'
import { useNavigate, useParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { supabase } from '@/lib/supabase'
import { useSessionRealtime } from '@/hooks/useSessionRealtime'
import type { Session, Team, Participant } from '@/types/db'
import { toast } from 'sonner'
import { LoadingDots } from '@/components/LoadingDots'
import { AlertBanner } from '@/components/AlertBanner'

export default function PlayPage() {
  const { code } = useParams()
  const navigate = useNavigate()
  const [nickname, setNickname] = React.useState('')
  const [participantId, setParticipantId] = React.useState<string | null>(null)
  const [joining, setJoining] = React.useState(false)
  const [hasAnswered, setHasAnswered] = React.useState(false)
  const [selectedTeamId, setSelectedTeamId] = React.useState<string | null>(null)
  const reduceMotion = useReducedMotion()

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

  const teamsQuery = useQuery({
    queryKey: ['teams', sessionId],
    enabled: !!sessionId,
    queryFn: async () => {
      const { data, error } = await supabase.from('teams').select('*').eq('session_id', sessionId)
      if (error) throw error
      return data as Team[]
    }
  })

  React.useEffect(() => {
    if (!sessionId || !code) return
    const storedNickname = localStorage.getItem(`nickname-${code}`)
    const storedParticipant = localStorage.getItem(`participant-${sessionId}`)
    const storedTeam = localStorage.getItem(`team-${sessionId}`)
    if (storedParticipant) {
      setParticipantId(storedParticipant)
    }
    if (storedTeam) {
      setSelectedTeamId(storedTeam)
    }
    if (storedNickname) {
      setNickname(storedNickname)
    }
  }, [sessionId, code])

  const joinSession = async () => {
    if (!sessionId || !nickname.trim() || participantId || joining) return
    if (teamsQuery.data?.length && !selectedTeamId) {
      toast.error('Pick a team first')
      return
    }
    setJoining(true)
    const existing = await supabase
      .from('participants')
      .select('*')
      .eq('session_id', sessionId)
      .ilike('nickname', nickname.trim())
      .limit(1)
    if (existing.data && existing.data.length > 0) {
      const found = existing.data[0] as Participant
      localStorage.setItem(`participant-${sessionId}`, found.id)
      setParticipantId(found.id)
      setJoining(false)
      return
    }

    const { data, error } = await supabase
      .from('participants')
      .insert({
        session_id: sessionId,
        nickname: nickname.trim(),
        score: 0,
        team_id: selectedTeamId
      })
      .select('*')
      .single()
    setJoining(false)
    if (error || !data) {
      if (error?.message?.toLowerCase().includes('participants_unique_nickname_idx')) {
        toast.error('Nickname already taken. Choose another.')
      } else {
        toast.error(error?.message ?? 'Unable to join session')
      }
      return
    }
    localStorage.setItem(`participant-${sessionId}`, data.id)
    if (selectedTeamId) {
      localStorage.setItem(`team-${sessionId}`, selectedTeamId)
    }
    setParticipantId(data.id)
  }

  React.useEffect(() => {
    setHasAnswered(false)
  }, [session?.current_question_idx, session?.status])

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

  const optionColors = [
    'from-purple-500/80 to-indigo-500/80',
    'from-sky-500/80 to-cyan-500/80',
    'from-emerald-500/80 to-lime-500/80',
    'from-orange-500/80 to-amber-500/80',
    'from-pink-500/80 to-fuchsia-500/80'
  ]

  const playfulHints = ['👀 maybe this?', 'hmm… looks right?', '👆 feels correct?']
  const hintIndex = React.useMemo(() => {
    if (!session?.public_question) return null
    return Math.random() > 0.65 ? Math.floor(Math.random() * session.public_question.options.length) : null
  }, [session?.public_question?.question_id])
  const hintText = React.useMemo(() => playfulHints[Math.floor(Math.random() * playfulHints.length)], [hintIndex])

  const sortedParticipants = React.useMemo(() => {
    return [...participants].sort((a, b) => b.score - a.score)
  }, [participants])

  const prevRanksRef = React.useRef<Record<string, number>>({})
  const rankedWithDelta = React.useMemo(() => {
    const next = sortedParticipants.map((p, idx) => {
      const rank = idx + 1
      const prevRank = prevRanksRef.current[p.id]
      const delta = prevRank ? prevRank - rank : 0
      return { ...p, rank, delta }
    })
    prevRanksRef.current = next.reduce<Record<string, number>>((acc, p) => {
      acc[p.id] = p.rank
      return acc
    }, {})
    return next
  }, [sortedParticipants])

  if (sessionQuery.isLoading) {
    return (
      <div className="mx-auto max-w-lg">
        <Card className="glass-card rounded-3xl">
          <CardHeader>
            <CardTitle>Getting things ready…</CardTitle>
          </CardHeader>
          <CardContent>
            <LoadingDots label="Joining session" />
          </CardContent>
        </Card>
      </div>
    )
  }

  if (sessionQuery.isError) {
    return (
      <div className="mx-auto max-w-lg">
        <AlertBanner
          title="Could not join"
          description="We hit an error loading this session. Please try again."
          variant="error"
        />
        <div className="mt-4">
          <Button variant="secondary" onClick={() => window.location.reload()}>
            Try again
          </Button>
        </div>
      </div>
    )
  }

  if (!sessionQuery.data || !session) {
    return (
      <div className="mx-auto max-w-lg">
        <AlertBanner
          title="Game not found"
          description="Double-check the code and try again."
          variant="info"
        />
        <div className="mt-4">
          <Button variant="secondary" onClick={() => navigate('/join')}>
            Back to join
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-lg space-y-4">
      {(!nickname || !participantId) && (
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
        <Card className="glass-card rounded-3xl">
          <CardHeader>
            <CardTitle>Choose a nickname</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <Label htmlFor="nickname">Nickname</Label>
            <Input id="nickname" value={nickname} onChange={(e) => setNickname(e.target.value)} />
            {teamsQuery.data && teamsQuery.data.length > 0 && (
              <div className="space-y-2">
                <Label>Pick a team</Label>
                <div className="grid gap-2 sm:grid-cols-2">
                  {teamsQuery.data.map((team) => (
                    <button
                      key={team.id}
                      type="button"
                      className={`rounded-2xl border px-3 py-2 text-sm font-semibold text-white shadow ${
                        selectedTeamId === team.id ? 'glow-ring' : 'border-white/10'
                      } bg-gradient-to-br ${team.color}`}
                      onClick={() => setSelectedTeamId(team.id)}
                    >
                      {team.name}
                    </button>
                  ))}
                </div>
              </div>
            )}
            <Button className="w-full" onClick={submitNickname} disabled={joining}>
              {joining ? 'Joining...' : 'Join lobby'}
            </Button>
          </CardContent>
        </Card>
        </motion.div>
      )}

      {nickname && participantId && session.status === 'lobby' && (
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
        <Card className="glass-card rounded-3xl">
          <CardHeader>
            <CardTitle>Waiting for host</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <p className="text-muted-foreground">Waiting for others 👀</p>
            <div className="text-3xl font-bold tracking-widest">{session.code}</div>
            <div className="flex flex-wrap gap-2">
              {participants.map((p) => (
                <Badge key={p.id}>{p.nickname}</Badge>
              ))}
            </div>
            <LoadingDots label="Get ready…" />
          </CardContent>
        </Card>
        </motion.div>
      )}

      {nickname && participantId && session.status === 'question' && session.public_question && (
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
        <Card className="glass-card rounded-3xl">
          <CardHeader>
            <CardTitle>{session.public_question.prompt}</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-3 pb-6">
            <div className="grid gap-3 md:static md:pb-0 sticky bottom-4 z-10 rounded-3xl border border-white/10 bg-black/30 p-3 backdrop-blur">
              {session.public_question.options.map((opt, idx) => {
                const gradient = optionColors[idx % optionColors.length]
                const showHint = hintIndex === idx
                return (
                  <motion.button
                    key={idx}
                    whileHover={reduceMotion ? {} : { scale: 1.03 }}
                    whileTap={reduceMotion ? {} : { scale: 0.97 }}
                    className={`answer-btn relative flex h-auto w-full items-center justify-start rounded-2xl bg-gradient-to-br ${gradient} px-5 py-4 text-left text-base font-semibold text-white shadow-lg ${
                      hasAnswered ? 'answer-locked' : ''
                    }`}
                    onClick={() => submitAnswer(idx)}
                    disabled={hasAnswered}
                  >
                    {opt}
                    {showHint && !hasAnswered && (
                      <span className="absolute right-4 top-3 text-sm text-white/90">{hintText}</span>
                    )}
                  </motion.button>
                )
              })}
            </div>
            {hasAnswered && (
              <p className="text-center text-sm text-muted-foreground">Nice choice 😎 Waiting for results…</p>
            )}
          </CardContent>
        </Card>
        </motion.div>
      )}

      {nickname && participantId && session.status === 'results' && (
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
        <Card className="glass-card rounded-3xl">
          <CardHeader>
            <CardTitle>Results</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <p className="text-muted-foreground">Scores update live after each question.</p>
            <motion.div layout className="space-y-2">
              {rankedWithDelta.slice(0, 10).map((p) => (
                <motion.div
                  layout
                  key={p.id}
                  className={`flex items-center justify-between rounded-xl border border-white/10 p-3 ${
                    p.id === participantId ? 'glow-ring' : ''
                  }`}
                >
                  <span>
                    {p.rank}. {p.nickname}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {p.delta > 0 ? `▲ +${p.delta}` : p.delta < 0 ? `▼ ${p.delta}` : '•'}
                  </span>
                  <span className="font-semibold">{p.score}</span>
                </motion.div>
              ))}
            </motion.div>
          </CardContent>
        </Card>
        </motion.div>
      )}

      {nickname && participantId && session.status === 'ended' && (
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
        <Card className="glass-card rounded-3xl">
          <CardHeader>
            <CardTitle>Game over</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-muted-foreground">Thanks for playing!</p>
            <div className="space-y-2">
              {[...participants]
                .sort((a, b) => b.score - a.score)
                .map((p, idx) => (
                  <div key={p.id} className={`flex items-center justify-between rounded-xl border border-white/10 p-3 ${p.id === participantId ? 'glow-ring' : ''}`}>
                    <span>
                      {idx + 1}. {p.nickname}
                    </span>
                    <span className="font-semibold">{p.score}</span>
                  </div>
                ))}
            </div>
            <Button variant="secondary" onClick={() => navigate('/join')}>
              Join another game
            </Button>
          </CardContent>
        </Card>
        </motion.div>
      )}
    </div>
  )
}
