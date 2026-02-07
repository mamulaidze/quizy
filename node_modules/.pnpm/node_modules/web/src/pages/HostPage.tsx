import React from 'react'
import { motion, useReducedMotion } from 'framer-motion'
import { useNavigate, useParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { QRCodeCanvas } from 'qrcode.react'
import { BarChart3, Clock, Copy, Crown, QrCode, Sparkles, Trophy, Users } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
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
  const [copied, setCopied] = React.useState(false)
  const [copiedLink, setCopiedLink] = React.useState(false)
  const [confirmEnd, setConfirmEnd] = React.useState(false)
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

  const [liveProgress, setLiveProgress] = React.useState(0)
  const [liveRemainingSec, setLiveRemainingSec] = React.useState(0)

  React.useEffect(() => {
    if (!currentQuestion || !session?.question_started_at) {
      setLiveProgress(0)
      setLiveRemainingSec(0)
      return
    }
    let rafId = 0
    const durationMs = currentQuestion.time_limit_sec * 1000
    const tick = () => {
      const elapsed = getElapsedMs()
      const clamped = Math.min(durationMs, elapsed)
      const progress = durationMs > 0 ? clamped / durationMs : 0
      const remaining = Math.max(0, Math.ceil((durationMs - clamped) / 1000))
      setLiveProgress(progress)
      setLiveRemainingSec(remaining)
      rafId = requestAnimationFrame(tick)
    }
    rafId = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(rafId)
  }, [
    currentQuestion?.id,
    currentQuestion?.time_limit_sec,
    session?.question_started_at,
    session?.paused_at,
    session?.pause_accumulated_ms
  ])

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

  const handleEndSession = () => {
    if (!confirmEnd) {
      setConfirmEnd(true)
      window.setTimeout(() => setConfirmEnd(false), 2500)
      return
    }
    endSession()
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
  const totalPlayers = participants.length
  const totalQuestions = questions.length
  const averageScore =
    participants.length > 0 ? Math.round(participants.reduce((sum, p) => sum + p.score, 0) / participants.length) : 0
  const durationMs = session.ended_at
    ? new Date(session.ended_at).getTime() - new Date(session.created_at).getTime()
    : 0
  const durationMinutes = durationMs > 0 ? Math.max(1, Math.round(durationMs / 60000)) : 0
  const topFive = ranked.slice(0, 5)
  const winner = ranked[0]

  return (
    <>
    <div className="space-y-6">
        <HostHeader
          code={session.code}
          status={session.status}
          copied={copied}
          onCopy={async () => {
            await navigator.clipboard.writeText(session.code)
            setCopied(true)
            window.setTimeout(() => setCopied(false), 1200)
          }}
        />

      {session.status === 'lobby' && (
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
        <div className="grid gap-6 lg:grid-cols-[1.2fr,0.8fr]">
          <LobbyControls
            code={session.code}
            participants={participants}
            autoAdvance={session.auto_advance_sec}
            onAdvanceChange={updateAutoAdvance}
            onStart={startQuestion}
            onEnd={handleEndSession}
            confirmEnd={confirmEnd}
            t={t}
          />
          <SharingPanel
            joinUrl={joinUrl}
            qrValue={qrValue}
            copiedLink={copiedLink}
            onCopyLink={async () => {
              await navigator.clipboard.writeText(joinUrl)
              setCopiedLink(true)
              window.setTimeout(() => setCopiedLink(false), 1200)
            }}
            onExpand={() => setQrOpen(true)}
            t={t}
          />
        </div>
        </motion.div>
      )}

      {session.status === 'question' && currentQuestion && (
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
        <QuestionControls
          question={currentQuestion}
          questionIndex={session.current_question_idx}
          totalAnswers={totalAnswers}
          totalPlayers={participants.length}
          avgResponse={averageResponseMs}
          timeProgress={liveProgress}
          remainingSec={liveRemainingSec}
          totalSec={currentQuestion.time_limit_sec}
          startedAt={session.question_started_at}
          paused={!!session.paused_at}
          locked={session.locked}
          onShowResults={showResults}
          onPause={pauseTimer}
          onResume={resumeTimer}
          onToggleLock={toggleLock}
          onReopen={reopenQuestion}
          onEnd={handleEndSession}
          showResultsDisabled={!timeEnded && totalAnswers === 0}
          reduceMotion={reduceMotion}
          t={t}
        />
        </motion.div>
      )}

      {session.status === 'results' && (
        <div className="relative">
          <div className="pointer-events-none absolute -inset-8 rounded-[40px] bg-[radial-gradient(circle_at_top,rgba(15,23,42,0.5),transparent_65%)]" />
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
            <Card className="glass-card rounded-3xl">
              <CardHeader className="space-y-2">
                <ResultsHeader title={t('host_results')} subtitle={`${t('host_question')} ${session.current_question_idx + 1} complete`} />
                <CorrectAnswerCard answer={currentQuestion?.options[currentQuestion.correct_index] ?? 'N/A'} reduceMotion={reduceMotion} />
              </CardHeader>
              <CardContent className="space-y-6">
                <DistributionChart
                  options={currentQuestion?.options ?? []}
                  answerCounts={answerCounts}
                  totalAnswers={answers.filter((a) => a.question_id === currentQuestion?.id).length}
                  correctIndex={currentQuestion?.correct_index ?? 0}
                  reduceMotion={reduceMotion}
                  t={t}
                />
                <LeaderboardTable entries={rankedWithDelta.slice(0, 10)} t={t} />
                <ResultsActions onNext={nextQuestion} onEnd={handleEndSession} t={t} />
              </CardContent>
            </Card>
          </motion.div>
        </div>
      )}

      {session.status === 'ended' && (
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
        <div className="space-y-8">
          <SessionSummaryHeader
            code={session.code}
            onCopy={async () => {
              try {
                await navigator.clipboard.writeText(session.code)
                toast.success('Session code copied')
              } catch {
                toast.error('Unable to copy session code')
              }
            }}
          />
          <div className="grid gap-6 lg:grid-cols-[1.2fr,0.8fr]">
            <WinnerCard winner={winner} reduceMotion={reduceMotion} />
            <LeaderboardList entries={topFive} reduceMotion={reduceMotion} />
          </div>
          <SessionStats
            totalPlayers={totalPlayers}
            totalQuestions={totalQuestions}
            averageScore={averageScore}
            durationMinutes={durationMinutes}
            reduceMotion={reduceMotion}
          />
          <ActionBar
            onBack={() => navigate('/dashboard')}
            onView={() => toast('Full results view coming soon')}
            onExport={() => toast('Export coming soon')}
          />
        </div>
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
              <QRCodeCanvas value={qrValue} size={qrSize} fgColor="#0f172a" bgColor="#ffffff" />
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

function SessionSummaryHeader({ code, onCopy }: { code: string; onCopy: () => void }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-4 rounded-3xl border border-white/10 bg-white/5 p-6">
      <div className="space-y-2">
        <div className="flex items-center gap-3">
          <Badge className="relative overflow-hidden bg-rose-500/20 text-rose-200">
            <span className="relative z-10">ENDED</span>
            <span className="absolute inset-0 animate-pulse bg-rose-500/10" />
          </Badge>
          <div className="flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-muted-foreground">
            <span>Code</span>
            <button type="button" className="font-semibold text-foreground" onClick={onCopy}>
              {code}
            </button>
          </div>
        </div>
        <h1 className="text-3xl font-semibold sm:text-4xl">Session Complete</h1>
        <p className="text-muted-foreground">Great job hosting! Here&apos;s how the session ended.</p>
      </div>
      <div className="flex h-16 w-16 items-center justify-center rounded-2xl border border-white/10 bg-white/5">
        <Sparkles className="h-7 w-7 text-amber-200" />
      </div>
    </div>
  )
}

function HostHeader({
  code,
  status,
  copied,
  onCopy
}: {
  code: string
  status: Session['status']
  copied: boolean
  onCopy: () => void
}) {
  const { t } = useI18n()
  return (
    <div className="flex flex-wrap items-center justify-between gap-4 rounded-3xl border border-white/10 bg-white/5 p-5">
      <div className="space-y-1">
        <p className="text-sm text-muted-foreground">{t('host_control_subtitle')}</p>
        <h1 className="text-2xl font-semibold sm:text-3xl">{t('host_title')}</h1>
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm">
          <span className="text-muted-foreground">{t('host_code')}</span>
          <span className="font-semibold tracking-[0.2em]">{code}</span>
          <button type="button" className="text-xs text-muted-foreground" onClick={onCopy}>
            {copied ? t('host_copied') : t('host_copy')}
          </button>
        </div>
        <Badge className="uppercase">{status}</Badge>
      </div>
    </div>
  )
}

function LobbyControls({
  code,
  participants,
  autoAdvance,
  onAdvanceChange,
  onStart,
  onEnd,
  confirmEnd,
  t
}: {
  code: string
  participants: { id: string; nickname: string }[]
  autoAdvance: number
  onAdvanceChange: (value: number) => void
  onStart: () => void
  onEnd: () => void
  confirmEnd: boolean
  t: (key: string) => string
}) {
  return (
    <Card className="glass-card rounded-3xl">
      <CardHeader>
        <CardTitle>{t('host_lobby')}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
          <p className="text-xs text-muted-foreground">{t('host_join_code')}</p>
          <div className="mt-2 text-4xl font-semibold tracking-[0.35em]">{code}</div>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button onClick={onStart} disabled={participants.length === 0}>
            {t('host_start_first')}
          </Button>
          <Button variant="destructive" onClick={onEnd}>
            {confirmEnd ? t('host_confirm_end') : t('host_end_session')}
          </Button>
        </div>
        <div className="space-y-2">
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">{t('host_auto_advance')}</span>
            <span className="text-xs text-muted-foreground">{autoAdvance}s</span>
          </div>
          <input
            type="range"
            min={0}
            max={30}
            step={1}
            value={autoAdvance}
            onChange={(e) => onAdvanceChange(Number(e.target.value))}
            className="h-2 w-full cursor-pointer appearance-none rounded-full bg-white/10"
          />
          <p className="text-xs text-muted-foreground">{t('host_auto_advance_hint')}</p>
        </div>
        <div className="space-y-2">
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">{t('host_participants')}</span>
            <span className="text-xs text-muted-foreground">{participants.length} {t('host_players')}</span>
          </div>
          <div className="flex flex-wrap gap-2">
            {participants.map((p) => (
              <Badge key={p.id}>{p.nickname}</Badge>
            ))}
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

function SharingPanel({
  joinUrl,
  qrValue,
  copiedLink,
  onCopyLink,
  onExpand,
  t
}: {
  joinUrl: string
  qrValue: string
  copiedLink: boolean
  onCopyLink: () => void
  onExpand: () => void
  t: (key: string) => string
}) {
  return (
    <Card className="glass-card rounded-3xl">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <QrCode className="h-4 w-4 text-muted-foreground" />
          {t('host_qr')}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex flex-col items-center gap-3 rounded-2xl bg-white p-4">
          {qrValue ? (
            <QRCodeCanvas value={qrValue} size={200} fgColor="#0f172a" bgColor="#ffffff" />
          ) : (
            <p className="text-xs text-muted-foreground">{t('loading_session')}</p>
          )}
        </div>
        <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
          <span className="truncate">{joinUrl}</span>
          <div className="flex items-center gap-2">
            <Button size="sm" variant="secondary" onClick={onExpand}>
              {t('host_expand_qr')}
            </Button>
            <Button size="sm" variant="ghost" onClick={onCopyLink}>
              <Copy className="mr-2 h-4 w-4" />
              {copiedLink ? t('host_copied') : t('host_copy_link')}
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

function QuestionControls({
  question,
  questionIndex,
  totalAnswers,
  totalPlayers,
  avgResponse,
  timeProgress,
  remainingSec,
  totalSec,
  startedAt,
  paused,
  locked,
  onShowResults,
  onPause,
  onResume,
  onToggleLock,
  onReopen,
  onEnd,
  showResultsDisabled,
  reduceMotion,
  t
}: {
  question: Question
  questionIndex: number
  totalAnswers: number
  totalPlayers: number
  avgResponse: number | null
  timeProgress: number
  remainingSec: number
  totalSec: number
  startedAt: string | null
  paused: boolean
  locked: boolean
  onShowResults: () => void
  onPause: () => void
  onResume: () => void
  onToggleLock: () => void
  onReopen: () => void
  onEnd: () => void
  showResultsDisabled: boolean
  reduceMotion: boolean
  t: (key: string) => string
}) {
  return (
    <Card className="glass-card rounded-3xl">
      <CardHeader className="space-y-2">
        <CardTitle>{t('host_question')} {questionIndex + 1}</CardTitle>
        <h2 className="text-xl font-semibold sm:text-2xl">{question.prompt}</h2>
        <div className="space-y-3">
          <TimerDisplay
            remainingSec={remainingSec}
            totalSec={totalSec}
            paused={paused}
            t={t}
          />
          <TimerBar
            progress={timeProgress}
            remainingSec={remainingSec}
            paused={paused}
            resetKey={`${question.id}-${startedAt ?? 'idle'}`}
          />
        </div>
        <div className="flex flex-wrap gap-3 text-sm text-muted-foreground">
          <span>
            {t('host_answers')}: <strong className="text-foreground">{totalAnswers}</strong> / {totalPlayers}
          </span>
          <span>
            {t('host_avg_response')}{' '}
            <strong className="text-foreground">
              {avgResponse === null ? '—' : `${Math.round(avgResponse / 100) / 10}s`}
            </strong>
          </span>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-3 md:grid-cols-2">
          {question.options.map((opt, idx) => (
            <Card key={idx} className="rounded-2xl border border-white/10 bg-white/5">
              <CardContent className="p-4 text-base font-semibold">{opt}</CardContent>
            </Card>
          ))}
        </div>
        <div className="flex flex-wrap gap-2">
          <Button onClick={onShowResults} disabled={showResultsDisabled}>
            {t('host_show_results')}
          </Button>
          {paused ? (
            <Button variant="secondary" onClick={onResume}>
              {t('host_resume')}
            </Button>
          ) : (
            <Button variant="secondary" onClick={onPause}>
              {t('host_pause')}
            </Button>
          )}
          <Button variant="outline" onClick={onToggleLock}>
            {locked ? t('host_unlock') : t('host_lock')}
          </Button>
          <Button variant="outline" onClick={onReopen}>
            {t('host_reopen')}
          </Button>
          <Button variant="destructive" onClick={onEnd}>
            {t('host_end_session')}
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}

function TimerDisplay({
  remainingSec,
  totalSec,
  paused,
  t
}: {
  remainingSec: number
  totalSec: number
  paused: boolean
  t: (key: string) => string
}) {
  const low = remainingSec <= Math.max(1, Math.round(totalSec * 0.2))
  const mid = !low && remainingSec <= Math.round(totalSec * 0.5)
  const color = low ? 'text-rose-200' : mid ? 'text-amber-200' : 'text-emerald-200'
  return (
    <div className="flex flex-wrap items-end justify-between gap-3">
      <div className="flex items-center gap-3">
        <div className={`text-4xl font-semibold tracking-tight ${color}`} aria-live="polite">
          {Math.max(0, remainingSec)}s
        </div>
        <div className="text-xs text-muted-foreground">
          {paused ? t('host_timer_paused') : t('host_time_remaining')}
          <div className="text-[11px] text-muted-foreground">{t('host_time_of')} {totalSec}s</div>
        </div>
      </div>
      {paused && <span className="text-xs text-muted-foreground">{t('host_timer_hold')}</span>}
    </div>
  )
}

function TimerBar({
  progress,
  remainingSec,
  paused,
  resetKey
}: {
  progress: number
  remainingSec: number
  paused: boolean
  resetKey: string
}) {
  const safeProgress = Math.max(0, Math.min(1, progress))
  const remainingProgress = 1 - safeProgress
  const danger = remainingProgress <= 0.2
  const warn = remainingProgress <= 0.5 && remainingProgress > 0.2
  return (
    <div className="h-3 w-full rounded-full bg-white/10">
      <div
        key={resetKey}
        className={`h-3 w-full rounded-full ${danger ? 'bg-rose-400' : warn ? 'bg-amber-300' : 'bg-emerald-300'}`}
        style={{
          transformOrigin: 'left center',
          transform: `scaleX(${remainingProgress})`
        }}
      />
    </div>
  )
}

function ResultsHeader({ title, subtitle }: { title: string; subtitle: string }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div>
        <div className="text-sm text-muted-foreground">RESULTS</div>
        <CardTitle className="text-2xl">{title}</CardTitle>
        <p className="text-xs text-muted-foreground">{subtitle}</p>
      </div>
      <Badge className="uppercase">RESULTS</Badge>
    </div>
  )
}

function CorrectAnswerCard({
  answer,
  reduceMotion
}: {
  answer: string
  reduceMotion: boolean
}) {
  return (
    <motion.div
      initial={reduceMotion ? false : { opacity: 0, y: 8 }}
      animate={reduceMotion ? { opacity: 1 } : { opacity: 1, y: 0 }}
      transition={{ duration: 0.35 }}
      className="rounded-2xl border border-emerald-400/30 bg-emerald-500/10 p-4 text-center"
    >
      <p className="text-xs uppercase tracking-[0.2em] text-emerald-200">Correct answer</p>
      <div className="mt-2 text-3xl font-semibold text-emerald-100">{answer}</div>
    </motion.div>
  )
}

function DistributionChart({
  options,
  answerCounts,
  totalAnswers,
  correctIndex,
  reduceMotion,
  t
}: {
  options: string[]
  answerCounts: number[]
  totalAnswers: number
  correctIndex: number
  reduceMotion: boolean
  t: (key: string) => string
}) {
  return (
    <div className="space-y-3">
      <div className="text-sm text-muted-foreground">{t('host_answer_dist')}</div>
      {totalAnswers === 0 && (
        <div className="rounded-2xl border border-white/10 bg-white/5 p-4 text-sm text-muted-foreground">
          {t('host_no_answers')}
        </div>
      )}
      {options.map((opt, idx) => {
        const count = answerCounts[idx] ?? 0
        const pct = totalAnswers === 0 ? 0 : Math.round((count / totalAnswers) * 100)
        const isCorrect = idx === correctIndex
        return (
          <motion.div
            key={idx}
            initial={reduceMotion ? false : { opacity: 0, y: 6 }}
            animate={reduceMotion ? { opacity: 1 } : { opacity: 1, y: 0 }}
            transition={{ delay: reduceMotion ? 0 : idx * 0.05 }}
            className={`rounded-2xl border px-4 py-3 ${isCorrect ? 'border-emerald-400/30 bg-emerald-500/10' : 'border-white/10 bg-white/5'}`}
          >
            <div className="flex items-center justify-between text-sm">
              <span>{opt}</span>
              <span className="text-xs text-muted-foreground">{count} • {pct}%</span>
            </div>
            <div className="mt-2 h-3 w-full rounded-full bg-white/10">
              <motion.div
                className={`h-3 rounded-full ${isCorrect ? 'bg-emerald-300' : 'bg-primary'}`}
                initial={reduceMotion ? false : { width: 0 }}
                animate={{ width: `${pct}%` }}
                transition={{ duration: 0.4, ease: 'easeOut' }}
              />
            </div>
          </motion.div>
        )
      })}
    </div>
  )
}

function LeaderboardTable({
  entries,
  t
}: {
  entries: { id: string; nickname: string; score: number; rank: number }[]
  t: (key: string) => string
}) {
  return (
    <div className="space-y-3">
      <div className="text-sm text-muted-foreground">{t('host_leaderboard')}</div>
      {entries.length === 0 && <div className="text-sm text-muted-foreground">No leaderboard yet.</div>}
      <div className="space-y-2">
        {entries.map((p) => (
          <div
            key={p.id}
            className={`flex items-center justify-between rounded-2xl px-4 py-3 ${
              p.rank === 1 ? 'bg-white/10' : 'bg-white/5'
            }`}
          >
            <div className="flex items-center gap-3">
              <span className="text-xs text-muted-foreground">#{p.rank}</span>
              <span className="text-sm font-medium">{p.nickname}</span>
            </div>
            <span className="text-sm font-semibold">{p.score}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

function ResultsActions({ onNext, onEnd, t }: { onNext: () => void; onEnd: () => void; t: (key: string) => string }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-white/10 bg-white/5 p-4">
      <Button onClick={onNext}>{t('host_next_question')}</Button>
      <Button variant="destructive" onClick={onEnd}>
        {t('host_end_session')}
      </Button>
    </div>
  )
}

function WinnerCard({
  winner,
  reduceMotion
}: {
  winner?: { nickname: string; score: number }
  reduceMotion: boolean
}) {
  return (
    <motion.div
      initial={reduceMotion ? false : { opacity: 0, scale: 0.94 }}
      animate={reduceMotion ? { opacity: 1 } : { opacity: 1, scale: 1 }}
      transition={{ duration: 0.45 }}
      className="relative overflow-hidden rounded-3xl border border-amber-400/30 bg-white/5 p-6 shadow-[0_0_40px_rgba(251,191,36,0.18)]"
    >
      <div className="absolute -top-24 right-0 h-48 w-48 rounded-full bg-amber-400/10 blur-3xl" />
      <div className="flex items-center gap-3 text-sm text-amber-200">
        <Trophy className="h-5 w-5" />
        Winner
      </div>
      {winner ? (
        <div className="mt-4 space-y-2">
          <p className="text-3xl font-semibold">{winner.nickname}</p>
          <p className="text-sm text-muted-foreground">{winner.score} pts</p>
        </div>
      ) : (
        <div className="mt-4 space-y-2 text-muted-foreground">
          <p className="text-lg font-medium">No players this session</p>
          <p className="text-sm">Invite players next time to crown a winner.</p>
        </div>
      )}
    </motion.div>
  )
}

function LeaderboardList({
  entries,
  reduceMotion
}: {
  entries: { id: string; nickname: string; score: number; rank: number }[]
  reduceMotion: boolean
}) {
  return (
    <div className="rounded-3xl border border-white/10 bg-white/5 p-6">
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Crown className="h-4 w-4" />
        Top performers
      </div>
      <div className="mt-4 space-y-3">
        {entries.length === 0 && <p className="text-sm text-muted-foreground">No leaderboard yet.</p>}
        {entries.map((entry, idx) => {
          const accent =
            entry.rank === 1
              ? 'text-amber-200'
              : entry.rank === 2
                ? 'text-slate-200'
                : entry.rank === 3
                  ? 'text-orange-200'
                  : 'text-muted-foreground'
          return (
            <motion.div
              key={entry.id}
              initial={reduceMotion ? false : { opacity: 0, y: 6 }}
              animate={reduceMotion ? { opacity: 1 } : { opacity: 1, y: 0 }}
              transition={{ delay: reduceMotion ? 0 : idx * 0.06 }}
              className="flex items-center justify-between rounded-2xl bg-black/20 px-4 py-3"
            >
              <div className="flex items-center gap-3">
                <span className={`text-sm font-semibold ${accent}`}>#{entry.rank}</span>
                <span className="text-sm font-medium text-foreground">{entry.nickname}</span>
              </div>
              <span className="text-sm text-muted-foreground">{entry.score}</span>
            </motion.div>
          )
        })}
      </div>
    </div>
  )
}

function SessionStats({
  totalPlayers,
  totalQuestions,
  averageScore,
  durationMinutes,
  reduceMotion
}: {
  totalPlayers: number
  totalQuestions: number
  averageScore: number
  durationMinutes: number
  reduceMotion: boolean
}) {
  const stats = [
    { label: 'Total players', value: totalPlayers, icon: Users },
    { label: 'Total questions', value: totalQuestions, icon: BarChart3 },
    { label: 'Average score', value: averageScore, icon: Sparkles },
    { label: 'Session duration', value: durationMinutes, suffix: ' min', icon: Clock }
  ]
  return (
    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
      {stats.map((stat, idx) => {
        const animatedValue = useCountUp(stat.value, reduceMotion)
        return (
        <motion.div
          key={stat.label}
          initial={reduceMotion ? false : { opacity: 0, y: 6 }}
          animate={reduceMotion ? { opacity: 1 } : { opacity: 1, y: 0 }}
          transition={{ delay: reduceMotion ? 0 : idx * 0.05 }}
          className="rounded-2xl border border-white/10 bg-white/5 p-4"
        >
          <div className="flex items-center gap-3 text-sm text-muted-foreground">
            <stat.icon className="h-4 w-4" />
            {stat.label}
          </div>
          <div className="mt-3 text-2xl font-semibold text-foreground">
            {animatedValue}
            {'suffix' in stat && stat.suffix ? stat.suffix : ''}
          </div>
        </motion.div>
        )
      })}
    </div>
  )
}

function ActionBar({
  onBack,
  onView,
  onExport
}: {
  onBack: () => void
  onView: () => void
  onExport: () => void
}) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-white/10 bg-white/5 p-4">
      <Button onClick={onBack}>Back to dashboard</Button>
      <div className="flex flex-wrap gap-2">
        <Button variant="secondary" onClick={onView}>
          View full results
        </Button>
        <Button variant="outline" onClick={onExport}>
          Export results
        </Button>
      </div>
    </div>
  )
}

function useCountUp(value: number, reduceMotion: boolean) {
  const [display, setDisplay] = React.useState(value)

  React.useEffect(() => {
    if (reduceMotion) {
      setDisplay(value)
      return
    }
    let frameId = 0
    const start = performance.now()
    const duration = 800
    const from = display

    const tick = (now: number) => {
      const progress = Math.min(1, (now - start) / duration)
      const next = Math.round(from + (value - from) * progress)
      setDisplay(next)
      if (progress < 1) {
        frameId = requestAnimationFrame(tick)
      }
    }

    frameId = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(frameId)
  }, [value, reduceMotion])

  return display
}
