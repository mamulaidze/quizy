import React from 'react'
import { motion, useReducedMotion } from 'framer-motion'
import { useNavigate, useParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { QRCodeSVG } from 'qrcode.react'
import { QrCode } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Countdown } from '@/components/Countdown'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/lib/auth'
import { useSessionRealtime } from '@/hooks/useSessionRealtime'
import type { Question, Session, Team } from '@/types/db'
import { calculateScore } from '@/lib/scoring'
import { toast } from 'sonner'
import { LoadingDots } from '@/components/LoadingDots'
import { AlertBanner } from '@/components/AlertBanner'
import { SparkleBurst } from '@/components/SparkleBurst'
import { useI18n } from '@/lib/i18n'

export default function HostPage() {
  const { code } = useParams()
  const { user } = useAuth()
  const navigate = useNavigate()
  const reduceMotion = useReducedMotion()
  const [qrSize, setQrSize] = React.useState(180)
  const [qrOpen, setQrOpen] = React.useState(false)
  const { t } = useI18n()

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

  const teamsQuery = useQuery({
    queryKey: ['teams', sessionId],
    enabled: !!sessionId,
    queryFn: async () => {
      const { data, error } = await supabase.from('teams').select('*').eq('session_id', sessionId)
      if (error) throw error
      return data as Team[]
    }
  })

  const questions = questionsQuery.data ?? []
  const currentQuestion = session ? questions[session.current_question_idx] : undefined
  const teams = teamsQuery.data ?? []

  const prevRanksRef = React.useRef<Record<string, number>>({})
  const ranked = [...participants]
    .sort((a, b) => b.score - a.score)
    .map((p, idx) => ({ ...p, rank: idx + 1 }))
  const rankedWithDelta = React.useMemo(() => {
    const next = ranked.map((p) => {
      const prevRank = prevRanksRef.current[p.id]
      const delta = prevRank ? prevRank - p.rank : 0
      return { ...p, delta }
    })
    prevRanksRef.current = ranked.reduce<Record<string, number>>((acc, p) => {
      acc[p.id] = p.rank
      return acc
    }, {})
    return next
  }, [ranked])

  React.useEffect(() => {
    if (sessionQuery.data && sessionQuery.data.host_id !== user?.id) {
      toast.error('You do not own this session')
      navigate('/dashboard')
    }
  }, [sessionQuery.data, user, navigate])

  const getElapsedMs = () => {
    if (!session) return 0
    if (!session.question_started_at) return 0
    const start = new Date(session.question_started_at).getTime()
    const pauseAccum = session.pause_accumulated_ms ?? 0
    if (session.paused_at) {
      const pausedAt = new Date(session.paused_at).getTime()
      return Math.max(0, pausedAt - start - pauseAccum)
    }
    return Math.max(0, Date.now() - start - pauseAccum)
  }

  React.useEffect(() => {
    if (!session || !currentQuestion) return
    if (!currentQuestion || !session.question_started_at) return
    if (session.status !== 'question' || session.locked) return
    const elapsedMs = getElapsedMs()
    const remaining = Math.max(0, currentQuestion.time_limit_sec * 1000 - elapsedMs)
    if (remaining === 0) {
      showResults()
      return
    }
    const timer = window.setTimeout(() => showResults(), remaining)
    return () => window.clearTimeout(timer)
  }, [
    session,
    currentQuestion,
    session?.status,
    session?.locked,
    session?.question_started_at,
    session?.pause_accumulated_ms,
    session?.paused_at
  ])

  React.useEffect(() => {
    if (!session) return
    if (session.status !== 'results') return
    if (!session.auto_advance_sec || session.auto_advance_sec <= 0) return
    const timer = window.setTimeout(() => nextQuestion(), session.auto_advance_sec * 1000)
    return () => window.clearTimeout(timer)
  }, [session, session?.status, session?.auto_advance_sec, session?.current_question_idx])

  if (sessionQuery.isLoading || questionsQuery.isLoading) {
    return (
      <Card className="glass-card rounded-3xl">
        <CardHeader>
          <CardTitle>{t('loading_session')}</CardTitle>
        </CardHeader>
        <CardContent>
          <LoadingDots label={t('loading_sync')} />
        </CardContent>
      </Card>
    )
  }

  if (!sessionQuery.data || !session) {
    return (
      <div className="mx-auto max-w-lg">
        <AlertBanner title="Session not found" description="Return to dashboard to start a new session." variant="info" />
      </div>
    )
  }

  const startQuestion = async () => {
    if (!currentQuestion) return
    const { error } = await supabase
      .from('sessions')
      .update({
        status: 'question',
        question_started_at: new Date().toISOString(),
        paused_at: null,
        pause_accumulated_ms: 0,
        locked: false,
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

  const updateAutoAdvance = async (value: number) => {
    await supabase.from('sessions').update({ auto_advance_sec: value }).eq('id', session.id)
  }

  const showResults = async () => {
    if (!currentQuestion || !session.question_started_at) return
    const startedAt = new Date(session.question_started_at).getTime()
    const pauseAccum = session.pause_accumulated_ms ?? 0

    const updates = participants.map((participant) => {
      const participantAnswer = answers.find(
        (answer) => answer.participant_id === participant.id && answer.question_id === currentQuestion.id
      )
      if (!participantAnswer) {
        return { participantId: participant.id, scoreDelta: 0, answerId: null, awarded: 0, correct: false }
      }
      const elapsedMs = new Date(participantAnswer.created_at).getTime() - startedAt - pauseAccum
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

    await supabase
      .from('sessions')
      .update({
        status: 'results',
        public_question: {
          question_id: currentQuestion.id,
          prompt: currentQuestion.prompt,
          options: currentQuestion.options,
          time_limit_sec: currentQuestion.time_limit_sec,
          correct_index: currentQuestion.correct_index
        }
      })
      .eq('id', session.id)
  }

  const nextQuestion = async () => {
    const nextIdx = session.current_question_idx + 1
    if (nextIdx >= questions.length) {
      await endSession()
      return
    }
    await supabase
      .from('sessions')
      .update({
        current_question_idx: nextIdx,
        status: 'question',
        question_started_at: new Date().toISOString(),
        paused_at: null,
        pause_accumulated_ms: 0,
        locked: false,
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
    const sorted = [...participants].sort((a, b) => b.score - a.score)
    const resultsPayload = sorted.map((p, idx) => ({
      session_id: session.id,
      participant_id: p.id,
      score: p.score,
      rank: idx + 1
    }))
    if (resultsPayload.length > 0) {
      await supabase.from('session_results').insert(resultsPayload)
    }
    await supabase.from('sessions').update({ status: 'ended', ended_at: new Date().toISOString() }).eq('id', session.id)
  }

  const pauseTimer = async () => {
    if (!session.question_started_at || session.paused_at) return
    await supabase.from('sessions').update({ paused_at: new Date().toISOString(), locked: true }).eq('id', session.id)
  }

  const resumeTimer = async () => {
    if (!session.paused_at) return
    const pausedAt = new Date(session.paused_at).getTime()
    const additional = Date.now() - pausedAt
    await supabase
      .from('sessions')
      .update({
        paused_at: null,
        pause_accumulated_ms: (session.pause_accumulated_ms ?? 0) + additional,
        locked: false
      })
      .eq('id', session.id)
  }

  const toggleLock = async () => {
    await supabase.from('sessions').update({ locked: !session.locked }).eq('id', session.id)
  }

  const reopenQuestion = async () => {
    if (!currentQuestion) return
    await supabase
      .from('sessions')
      .update({
        status: 'question',
        locked: false,
        question_started_at: session.question_started_at ?? new Date().toISOString()
      })
      .eq('id', session.id)
  }

  const leaderboard = [...participants].sort((a, b) => b.score - a.score).slice(0, 10)
  const podium = ranked.slice(0, 3)
  const teamLeaderboard = teams
    .map((team) => ({
      ...team,
      score: participants.filter((p) => p.team_id === team.id).reduce((sum, p) => sum + p.score, 0),
      members: participants.filter((p) => p.team_id === team.id).length
    }))
    .sort((a, b) => b.score - a.score)
  const teamPodium = teamLeaderboard.slice(0, 3)

  const answerCounts = currentQuestion
    ? currentQuestion.options.map((_, idx) =>
        answers.filter((a) => a.question_id === currentQuestion.id && a.selected_index === idx).length
      )
    : []
  const totalAnswers = currentQuestion
    ? answers.filter((a) => a.question_id === currentQuestion.id).length
    : 0
  const timeEnded = currentQuestion ? getElapsedMs() >= currentQuestion.time_limit_sec * 1000 : false
  const averageResponseMs = currentQuestion
    ? (() => {
        const relevant = answers.filter((a) => a.question_id === currentQuestion.id)
        if (!session.question_started_at || relevant.length === 0) return null
        const start = new Date(session.question_started_at).getTime()
        const pauseAccum = session.pause_accumulated_ms ?? 0
        const sum = relevant.reduce((acc, a) => acc + (new Date(a.created_at).getTime() - start - pauseAccum), 0)
        return Math.max(0, Math.round(sum / relevant.length))
      })()
    : null

  const joinUrl =
    typeof window === 'undefined'
      ? ''
      : `${window.location.origin}/play/${session.code ?? code ?? ''}`
  const qrValue = joinUrl || `/play/${session.code ?? code ?? ''}`

  return (
    <>
    <div className="space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
          <h1 className="text-2xl font-semibold sm:text-3xl">{t('host_title')}</h1>
          <p className="text-muted-foreground">{t('host_code')}: {session.code}</p>
        </div>
        <Badge className="uppercase">{session.status}</Badge>
      </div>

      {session.status === 'lobby' && (
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
        <Card className="glass-card rounded-3xl">
          <CardHeader>
            <CardTitle>{t('host_lobby')}</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-6 md:grid-cols-[1.2fr,0.8fr]">
            <div className="space-y-3">
              <p className="text-muted-foreground">{t('host_share')}</p>
              <div className="text-3xl font-bold tracking-widest sm:text-4xl">{session.code}</div>
              <div className="flex flex-wrap gap-2">
                <Button onClick={startQuestion} disabled={participants.length === 0}>
                  {t('host_start_question')}
                </Button>
                <Button variant="destructive" onClick={endSession}>
                  {t('host_end_session')}
                </Button>
              </div>
              <div className="space-y-2">
                <p className="text-sm text-muted-foreground">{t('host_auto_advance')}</p>
                <input
                  type="number"
                  min={0}
                  max={30}
                  className="h-10 w-32 rounded-md border border-white/10 bg-white/5 px-3 text-sm"
                  value={session.auto_advance_sec}
                  onChange={(e) => updateAutoAdvance(Number(e.target.value))}
                />
                <p className="text-xs text-muted-foreground">{t('host_auto_advance_hint')}</p>
              </div>
              <div className="space-y-2">
                <p className="text-sm text-muted-foreground">{t('host_participants')}</p>
                <div className="flex flex-wrap gap-2">
                  {participants.map((p) => (
                    <Badge key={p.id}>{p.nickname}</Badge>
                  ))}
                </div>
              </div>
            </div>
            <div className="space-y-3 rounded-2xl border border-white/10 bg-white/5 p-4">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-full border border-white/10 bg-white/5">
                  <QrCode className="h-5 w-5 text-muted-foreground" />
                </div>
                <div>
                  <p className="text-sm font-medium">{t('host_qr')}</p>
                  <p className="text-xs text-muted-foreground">{t('host_qr_desc')}</p>
                </div>
              </div>
              <div className="flex flex-col items-center gap-3 rounded-2xl bg-white p-3">
                {qrValue ? (
                  <QRCodeSVG value={qrValue} size={180} />
                ) : (
                  <p className="text-xs text-muted-foreground">{t('loading_session')}</p>
                )}
              </div>
              <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
                <span>{joinUrl}</span>
                <Button size="sm" variant="secondary" onClick={() => setQrOpen(true)}>
                  {t('host_show_qr')}
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
        </motion.div>
      )}

      {session.status === 'question' && currentQuestion && (
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
        <Card className="glass-card rounded-3xl">
          <CardHeader>
            <CardTitle>{t('host_question')} {session.current_question_idx + 1}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <h2 className="text-xl font-semibold sm:text-2xl">{currentQuestion.prompt}</h2>
              <Countdown
                startAt={session.question_started_at}
                limitSec={currentQuestion.time_limit_sec}
                pausedAt={session.paused_at}
                pauseAccumMs={session.pause_accumulated_ms}
              />
              <div className="flex flex-wrap gap-3 text-sm text-muted-foreground">
                <span>
                  {t('host_answers')}: <strong className="text-foreground">{totalAnswers}</strong> / {participants.length}
                </span>
                <span>
                  {t('host_avg_response')}{' '}
                  <strong className="text-foreground">
                    {averageResponseMs === null ? '—' : `${Math.round(averageResponseMs / 100) / 10}s`}
                  </strong>
                </span>
              </div>
            </div>
            {participants.length === 0 && (
              <div className="rounded-2xl border border-white/10 bg-white/5 p-4 text-sm text-muted-foreground">
                {t('host_no_participants')}
              </div>
            )}
            <div className="grid gap-3 md:grid-cols-2">
              {currentQuestion.options.map((opt, idx) => (
                <Card
                  key={idx}
                  className={`glass-card rounded-2xl ${idx === currentQuestion.correct_index ? 'glow-ring' : ''}`}
                >
                  <CardContent className="p-4 text-base font-semibold">{opt}</CardContent>
                </Card>
              ))}
            </div>
            <div className="flex flex-wrap gap-2">
              <Button onClick={showResults} disabled={!timeEnded && totalAnswers === 0}>
                {t('host_show_results')}
              </Button>
              {session.paused_at ? (
                <Button variant="secondary" onClick={resumeTimer}>
                  {t('host_resume')}
                </Button>
              ) : (
                <Button variant="secondary" onClick={pauseTimer}>
                  {t('host_pause')}
                </Button>
              )}
              <Button variant="outline" onClick={toggleLock}>
                {session.locked ? t('host_unlock') : t('host_lock')}
              </Button>
              <Button variant="outline" onClick={reopenQuestion}>
                {t('host_reopen')}
              </Button>
              <Button variant="destructive" onClick={endSession}>
                {t('host_end_session')}
              </Button>
            </div>
          </CardContent>
        </Card>
        </motion.div>
      )}

      {session.status === 'results' && (
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
        <Card className="glass-card rounded-3xl">
          <CardHeader>
            <CardTitle>{t('host_results')}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <p className="text-muted-foreground">{t('host_correct')}</p>
              <div className="relative inline-flex items-center gap-3 rounded-2xl bg-emerald-500/20 px-4 py-2 text-lg font-semibold text-emerald-200">
                <SparkleBurst show={!reduceMotion} />
                {currentQuestion?.options[currentQuestion.correct_index] ?? 'N/A'}
              </div>
            </div>
            {currentQuestion && (
              <div className="space-y-2">
                <p className="text-sm text-muted-foreground">{t('host_answer_dist')}</p>
                <div className="space-y-2">
                  {answers.filter((a) => a.question_id === currentQuestion.id).length === 0 && (
                    <div className="rounded-2xl border border-white/10 bg-white/5 p-4 text-sm text-muted-foreground">
                      {t('host_no_answers')}
                    </div>
                  )}
                  {currentQuestion.options.map((opt, idx) => {
                    const count = answerCounts[idx] ?? 0
                    const total = Math.max(1, answers.filter((a) => a.question_id === currentQuestion.id).length)
                    const pct = Math.round((count / total) * 100)
                    return (
                      <div key={idx} className="space-y-1">
                        <div className="flex items-center justify-between text-sm">
                          <span>{opt}</span>
                          <span className="text-muted-foreground">{count} • {pct}%</span>
                        </div>
                        <div className="h-2 w-full rounded-full bg-muted/40">
                          <div className="h-2 rounded-full bg-primary" style={{ width: `${pct}%` }} />
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            )}
            <div>
              <p className="text-sm text-muted-foreground">{t('host_leaderboard')}</p>
              <motion.div layout className="space-y-2">
                {rankedWithDelta.slice(0, 10).map((p) => (
                  <motion.div
                    layout
                    key={p.id}
                    className={`flex items-center justify-between rounded-xl border border-white/10 p-3 ${
                      p.rank === 1 ? 'glow-ring' : ''
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
            </div>
            {teamLeaderboard.length > 0 && (
              <div>
              <p className="text-sm text-muted-foreground">{t('host_team_leaderboard')}</p>
                <div className="mt-3 grid items-end gap-4 sm:grid-cols-3">
                  {teamPodium[2] && (
                    <div className="order-1 flex flex-col items-center gap-2 rounded-2xl border border-orange-400/20 bg-orange-400/10 px-4 pb-4 pt-3 text-center">
                      <div className="text-xs uppercase tracking-[0.3em] text-orange-200">3rd</div>
                      <div className="text-base font-semibold">{teamPodium[2].name}</div>
                      <div className="text-xs text-muted-foreground">{teamPodium[2].score} pts</div>
                      <div className="h-12 w-full rounded-2xl bg-gradient-to-b from-orange-300/70 to-orange-500/50" />
                    </div>
                  )}
                  {teamPodium[0] && (
                    <div className="order-2 flex flex-col items-center gap-2 rounded-2xl border border-amber-400/30 bg-amber-400/10 px-4 pb-4 pt-3 text-center shadow-[0_0_20px_rgba(251,191,36,0.3)]">
                      <div className="text-xs uppercase tracking-[0.3em] text-amber-200">1st</div>
                      <div className="text-lg font-semibold">{teamPodium[0].name}</div>
                      <div className="text-xs text-amber-100/80">{teamPodium[0].score} pts</div>
                      <div className="h-16 w-full rounded-2xl bg-gradient-to-b from-amber-300/80 to-amber-500/60" />
                    </div>
                  )}
                  {teamPodium[1] && (
                    <div className="order-3 flex flex-col items-center gap-2 rounded-2xl border border-white/10 bg-white/5 px-4 pb-4 pt-3 text-center">
                      <div className="text-xs uppercase tracking-[0.3em] text-muted-foreground">2nd</div>
                      <div className="text-base font-semibold">{teamPodium[1].name}</div>
                      <div className="text-xs text-muted-foreground">{teamPodium[1].score} pts</div>
                      <div className="h-12 w-full rounded-2xl bg-gradient-to-b from-slate-300/70 to-slate-500/50" />
                    </div>
                  )}
                </div>
                <div className="mt-4 space-y-2">
                  {teamLeaderboard.map((team, idx) => (
                    <div key={team.id} className="flex items-center justify-between rounded-xl border border-white/10 p-3">
                      <span>
                        {idx + 1}. {team.name}
                      </span>
                      <span className="text-xs text-muted-foreground">
                        {team.members}
                        {session?.team_max_members ? `/${session.team_max_members}` : ''} members
                      </span>
                      <span className="font-semibold">{team.score}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
            <div className="flex flex-wrap gap-2">
              <Button onClick={nextQuestion}>{t('host_next_question')}</Button>
              <Button variant="destructive" onClick={endSession}>
                {t('host_end_session')}
              </Button>
            </div>
          </CardContent>
        </Card>
        </motion.div>
      )}

      {session.status === 'ended' && (
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
        <Card className="glass-card rounded-3xl">
          <CardHeader>
            <CardTitle>{t('host_session_ended')}</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground">{t('host_final')}</p>
            <div className="mt-6 grid items-end gap-4 sm:grid-cols-3">
              {podium[2] && (
                <div className="order-1 flex flex-col items-center gap-2 rounded-2xl border border-orange-400/20 bg-orange-400/10 px-4 pb-4 pt-3 text-center">
                  <div className="text-xs uppercase tracking-[0.3em] text-orange-200">3rd</div>
                  <div className="text-lg font-semibold">{podium[2].nickname}</div>
                  <div className="text-sm text-muted-foreground">{podium[2].score} pts</div>
                  <div className="h-16 w-full rounded-2xl bg-gradient-to-b from-orange-300/70 to-orange-500/50" />
                </div>
              )}
              {podium[0] && (
                <div className="order-2 flex flex-col items-center gap-2 rounded-2xl border border-amber-400/30 bg-amber-400/10 px-4 pb-4 pt-3 text-center shadow-[0_0_30px_rgba(251,191,36,0.35)]">
                  <div className="text-xs uppercase tracking-[0.3em] text-amber-200">1st</div>
                  <div className="text-xl font-semibold">{podium[0].nickname}</div>
                  <div className="text-sm text-amber-100/80">{podium[0].score} pts</div>
                  <div className="h-32 w-full rounded-2xl bg-gradient-to-b from-amber-300/80 to-amber-500/60" />
                </div>
              )}
              {podium[1] && (
                <div className="order-3 flex flex-col items-center gap-2 rounded-2xl border border-white/10 bg-white/5 px-4 pb-4 pt-3 text-center">
                  <div className="text-xs uppercase tracking-[0.3em] text-muted-foreground">2nd</div>
                  <div className="text-lg font-semibold">{podium[1].nickname}</div>
                  <div className="text-sm text-muted-foreground">{podium[1].score} pts</div>
                  <div className="h-24 w-full rounded-2xl bg-gradient-to-b from-slate-300/70 to-slate-500/50" />
                </div>
              )}
            </div>
            <div className="mt-6 space-y-2">
              {ranked.map((p) => (
                <div key={p.id} className="flex items-center justify-between rounded-xl border border-white/10 p-3">
                  <span>
                    {p.rank}. {p.nickname}
                  </span>
                  <span className="font-semibold">{p.score}</span>
                </div>
              ))}
            </div>
            {teamLeaderboard.length > 0 && (
              <div className="mt-6 space-y-3">
                <p className="text-sm text-muted-foreground">Team leaderboard</p>
                <div className="grid items-end gap-4 sm:grid-cols-3">
                  {teamPodium[2] && (
                    <div className="order-1 flex flex-col items-center gap-2 rounded-2xl border border-orange-400/20 bg-orange-400/10 px-4 pb-4 pt-3 text-center">
                      <div className="text-xs uppercase tracking-[0.3em] text-orange-200">3rd</div>
                      <div className="text-base font-semibold">{teamPodium[2].name}</div>
                      <div className="text-xs text-muted-foreground">{teamPodium[2].score} pts</div>
                      <div className="h-12 w-full rounded-2xl bg-gradient-to-b from-orange-300/70 to-orange-500/50" />
                    </div>
                  )}
                  {teamPodium[0] && (
                    <div className="order-2 flex flex-col items-center gap-2 rounded-2xl border border-amber-400/30 bg-amber-400/10 px-4 pb-4 pt-3 text-center shadow-[0_0_20px_rgba(251,191,36,0.3)]">
                      <div className="text-xs uppercase tracking-[0.3em] text-amber-200">1st</div>
                      <div className="text-lg font-semibold">{teamPodium[0].name}</div>
                      <div className="text-xs text-amber-100/80">{teamPodium[0].score} pts</div>
                      <div className="h-16 w-full rounded-2xl bg-gradient-to-b from-amber-300/80 to-amber-500/60" />
                    </div>
                  )}
                  {teamPodium[1] && (
                    <div className="order-3 flex flex-col items-center gap-2 rounded-2xl border border-white/10 bg-white/5 px-4 pb-4 pt-3 text-center">
                      <div className="text-xs uppercase tracking-[0.3em] text-muted-foreground">2nd</div>
                      <div className="text-base font-semibold">{teamPodium[1].name}</div>
                      <div className="text-xs text-muted-foreground">{teamPodium[1].score} pts</div>
                      <div className="h-12 w-full rounded-2xl bg-gradient-to-b from-slate-300/70 to-slate-500/50" />
                    </div>
                  )}
                </div>
                <div className="space-y-2">
                  {teamLeaderboard.map((team, idx) => (
                    <div key={team.id} className="flex items-center justify-between rounded-xl border border-white/10 p-3">
                      <span>
                        {idx + 1}. {team.name}
                      </span>
                      <span className="text-xs text-muted-foreground">
                        {team.members}
                        {session?.team_max_members ? `/${session.team_max_members}` : ''} members
                      </span>
                      <span className="font-semibold">{team.score}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
            <div className="mt-4">
              <Button onClick={() => navigate('/dashboard')}>{t('host_back_dashboard')}</Button>
            </div>
          </CardContent>
        </Card>
        </motion.div>
      )}
    </div>
    {qrOpen && (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-6">
        <div className="w-full max-w-lg rounded-3xl border border-white/10 bg-slate-950/90 p-6 shadow-2xl backdrop-blur">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">{t('host_join_code')}</p>
              <p className="text-xl font-semibold tracking-widest sm:text-2xl">{session.code}</p>
            </div>
            <Button variant="ghost" onClick={() => setQrOpen(false)}>
              {t('teams_close')}
            </Button>
          </div>
          <div className="mt-6 flex flex-col items-center gap-5">
            <div className="rounded-2xl bg-white p-4 shadow-[0_0_50px_rgba(0,0,0,0.5)]">
              <QRCodeSVG value={qrValue} size={qrSize} />
            </div>
            <div className="w-full space-y-2">
              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <span>{t('host_qr_size')}</span>
                <span>{qrSize}px</span>
              </div>
              <input
                type="range"
                min={140}
                max={360}
                step={10}
                value={qrSize}
                onChange={(event) => setQrSize(Number(event.target.value))}
                className="h-2 w-full cursor-pointer appearance-none rounded-full bg-white/10"
              />
              <p className="text-xs text-muted-foreground">{t('host_qr_hint')}</p>
            </div>
          </div>
        </div>
      </div>
    )}
    </>
  )
}
