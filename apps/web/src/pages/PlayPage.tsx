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
import { useI18n } from '@/lib/i18n'
import { useAuth } from '@/lib/auth'
import { Check, PartyPopper } from 'lucide-react'

export default function PlayPage() {
  const { code } = useParams()
  const navigate = useNavigate()
  const [nickname, setNickname] = React.useState('')
  const [participantId, setParticipantId] = React.useState<string | null>(null)
  const [joining, setJoining] = React.useState(false)
  const [hasAnswered, setHasAnswered] = React.useState(false)
  const [selectedTeamId, setSelectedTeamId] = React.useState<string | null>(null)
  const [lastAnswerIndex, setLastAnswerIndex] = React.useState<number | null>(null)
  const [copied, setCopied] = React.useState(false)
  const [lobbyExiting, setLobbyExiting] = React.useState(false)
  const [liveProgress, setLiveProgress] = React.useState(0)
  const [liveRemainingSec, setLiveRemainingSec] = React.useState(0)
  const reduceMotion = useReducedMotion()
  const { t } = useI18n()
  const { user } = useAuth()

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

  const answerResultQuery = useQuery({
    queryKey: ['answer', sessionId, participantId, session?.public_question?.question_id, session?.status],
    enabled:
      !!sessionId &&
      !!participantId &&
      !!session?.public_question?.question_id &&
      session?.status === 'results',
    queryFn: async () => {
      const { data, error } = await supabase
        .from('answers')
        .select('selected_index,is_correct,awarded_points')
        .eq('session_id', sessionId)
        .eq('participant_id', participantId)
        .eq('question_id', session?.public_question?.question_id)
        .maybeSingle()
      if (error) throw error
      return data
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
      toast.error(t('pick_team_first'))
      return
    }
    if (session?.team_max_members && selectedTeamId) {
      const count = participants.filter((p) => p.team_id === selectedTeamId).length
      if (count >= session.team_max_members) {
        toast.error(t('team_full'))
        return
      }
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

    const { data, error } = await supabase.rpc('join_team', {
      p_session_id: sessionId,
      p_nickname: nickname.trim(),
      p_team_id: selectedTeamId
    })
    setJoining(false)
    if (error || !data) {
      if (error?.message?.toLowerCase().includes('team_full')) {
        toast.error(t('team_full'))
        return
      }
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
    const qid = session?.public_question?.question_id
    if (!qid) return
    setHasAnswered(false)
    const stored = sessionId ? localStorage.getItem(`answer-${sessionId}-${qid}`) : null
    setLastAnswerIndex(stored ? Number(stored) : null)
  }, [sessionId, session?.public_question?.question_id])

  React.useEffect(() => {
    if (session?.status !== 'lobby') {
      setLobbyExiting(true)
      const t = window.setTimeout(() => setLobbyExiting(false), 240)
      return () => window.clearTimeout(t)
    }
    return undefined
  }, [session?.status])

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
    setLastAnswerIndex(index)
    if (sessionId && session.public_question?.question_id) {
      localStorage.setItem(`answer-${sessionId}-${session.public_question.question_id}`, String(index))
    }
  }

  const optionColors = [
    'from-purple-500/80 to-indigo-500/80',
    'from-sky-500/80 to-cyan-500/80',
    'from-emerald-500/80 to-lime-500/80',
    'from-orange-500/80 to-amber-500/80',
    'from-pink-500/80 to-fuchsia-500/80'
  ]

  type Phase = 'answering' | 'waiting' | 'results'
  const phase: Phase =
    session?.status === 'results' ? 'results' : hasAnswered ? 'waiting' : 'answering'

  const playfulHints = ['👀 maybe this?', 'hmm… looks right?', '👆 feels correct?']
  const hintIndex = React.useMemo(() => {
    if (!session?.public_question) return null
    return Math.random() > 0.65 ? Math.floor(Math.random() * session.public_question.options.length) : null
  }, [session?.public_question?.question_id])
  const hintText = React.useMemo(() => playfulHints[Math.floor(Math.random() * playfulHints.length)], [hintIndex])

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
    if (!session?.public_question || !session.question_started_at) {
      setLiveProgress(0)
      setLiveRemainingSec(0)
      return
    }
    let rafId = 0
    const durationMs = session.public_question.time_limit_sec * 1000
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
    session?.public_question?.question_id,
    session?.public_question?.time_limit_sec,
    session?.question_started_at,
    session?.paused_at,
    session?.pause_accumulated_ms
  ])

  const sortedParticipants = React.useMemo(() => {
    return [...participants].sort((a, b) => b.score - a.score)
  }, [participants])
  const podium = sortedParticipants.slice(0, 3)
  const totalPlayers = participants.length
  const userRank = participantId
    ? sortedParticipants.findIndex((p) => p.id === participantId) + 1
    : null
  const userScore = participantId
    ? sortedParticipants.find((p) => p.id === participantId)?.score ?? null
    : null
  const teamLeaderboard = React.useMemo(() => {
    if (!teamsQuery.data || teamsQuery.data.length === 0) return []
    return teamsQuery.data
      .map((team) => ({
        ...team,
        score: participants.filter((p) => p.team_id === team.id).reduce((sum, p) => sum + p.score, 0),
        members: participants.filter((p) => p.team_id === team.id).length
      }))
      .sort((a, b) => b.score - a.score)
  }, [teamsQuery.data, participants])
  const teamPodium = teamLeaderboard.slice(0, 3)

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
            <CardTitle>{t('loading_joining')}</CardTitle>
          </CardHeader>
          <CardContent>
            <LoadingDots label={t('loading_joining')} />
          </CardContent>
        </Card>
      </div>
    )
  }

  if (sessionQuery.isError) {
    return (
      <div className="mx-auto max-w-lg">
        <AlertBanner
          title={t('play_could_not_join')}
          description={t('play_could_not_join_desc')}
          variant="error"
        />
        <div className="mt-4">
          <Button variant="secondary" onClick={() => window.location.reload()}>
            {t('play_try_again')}
          </Button>
        </div>
      </div>
    )
  }

  if (!sessionQuery.data || !session) {
    return (
      <div className="mx-auto max-w-lg">
        <AlertBanner
          title={t('play_game_not_found')}
          description={t('play_game_not_found_desc')}
          variant="info"
        />
        <div className="mt-4">
          <Button variant="secondary" onClick={() => navigate('/join')}>
            {t('play_back_join')}
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
            <CardTitle>{t('play_choose_nickname')}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <Label htmlFor="nickname">{t('play_nickname')}</Label>
            <Input id="nickname" value={nickname} onChange={(e) => setNickname(e.target.value)} />
            {teamsQuery.data && teamsQuery.data.length > 0 && (
              <div className="space-y-2">
                <Label>{t('play_pick_team')}</Label>
                <div className="grid gap-2 sm:grid-cols-2">
                  {teamsQuery.data.map((team) => (
                    (() => {
                      const members = participants.filter((p) => p.team_id === team.id).length
                      const full = session?.team_max_members ? members >= session.team_max_members : false
                      return (
                    <button
                      key={team.id}
                      type="button"
                      className={`rounded-2xl border px-3 py-2 text-sm font-semibold text-white shadow ${
                        selectedTeamId === team.id ? 'glow-ring' : 'border-white/10'
                      } bg-gradient-to-br ${team.color} ${full ? 'opacity-50' : ''}`}
                      onClick={() => setSelectedTeamId(team.id)}
                      disabled={full}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span>{team.name}</span>
                        {session?.team_max_members ? (
                          <span className="text-xs text-white/80">
                            {members}/{session.team_max_members}
                          </span>
                        ) : null}
                      </div>
                    </button>
                      )
                    })()
                  ))}
                </div>
              </div>
            )}
            <Button className="w-full" onClick={submitNickname} disabled={joining}>
              {joining ? t('play_joining') : t('play_join')}
            </Button>
          </CardContent>
        </Card>
        </motion.div>
      )}

      {nickname && participantId && session.status === 'lobby' && (
        <motion.div
          initial={reduceMotion ? { opacity: 1, scale: 1 } : { opacity: 0, scale: 0.97 }}
          animate={{ opacity: lobbyExiting ? 0 : 1, scale: lobbyExiting ? 0.98 : 1 }}
          transition={{ duration: 0.25 }}
          className="relative"
        >
          <div className="pointer-events-none absolute -inset-10 rounded-[40px] bg-[radial-gradient(circle_at_top,rgba(99,102,241,0.18),transparent_60%)]" />
          <LobbyCard>
            <CardHeader className="space-y-2">
              <CardTitle className="text-2xl sm:text-3xl">{t('play_waiting')}</CardTitle>
              <p className="text-sm text-muted-foreground">{t('play_waiting_subtitle')}</p>
            </CardHeader>
            <CardContent className="space-y-4">
              <SessionCode
                code={session.code}
                copied={copied}
                onCopy={async () => {
                  await navigator.clipboard.writeText(session.code)
                  setCopied(true)
                  window.setTimeout(() => setCopied(false), 1200)
                }}
              />
              <PlayerBadge nickname={nickname} />
              <WaitingIndicator
                title={t('play_waiting_others')}
                subtitle={t('play_get_ready')}
              />
              <div className="flex flex-wrap gap-2">
                {participants.map((p) => (
                  <Badge key={p.id}>{p.nickname}</Badge>
                ))}
              </div>
            </CardContent>
          </LobbyCard>
        </motion.div>
      )}

      {nickname && participantId && session.status === 'question' && session.public_question && (
        <div className="relative">
          <motion.div
            aria-hidden
            className="pointer-events-none absolute -inset-8 rounded-[40px] bg-[radial-gradient(circle_at_top,rgba(99,102,241,0.12),transparent_60%)]"
            animate={reduceMotion ? { opacity: 0.6 } : { opacity: [0.5, 0.8, 0.5] }}
            transition={reduceMotion ? { duration: 0 } : { duration: 10, repeat: Infinity, ease: 'easeInOut' }}
          />
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
            <QuestionCard title={session.public_question.prompt} phase={phase}>
              <PlayerTimer
                remainingSec={liveRemainingSec}
                totalSec={session.public_question.time_limit_sec}
                progress={liveProgress}
                paused={!!session.paused_at}
                t={t}
              />
              <div className="grid gap-3">
                {session.public_question.options.map((opt, idx) => (
                  <AnswerOption
                    key={idx}
                    label={opt}
                    gradient={optionColors[idx % optionColors.length]}
                    selected={lastAnswerIndex === idx}
                    disabled={phase !== 'answering'}
                    faded={phase !== 'answering' && lastAnswerIndex !== idx}
                    onClick={() => submitAnswer(idx)}
                    showHint={hintIndex === idx && phase === 'answering'}
                    hintText={hintText}
                    reduceMotion={reduceMotion}
                  />
                ))}
              </div>
              {phase === 'waiting' && (
                <WaitingIndicator
                  title={t('play_answer_locked')}
                  subtitle={t('play_waiting_results')}
                />
              )}
            </QuestionCard>
          </motion.div>
        </div>
      )}

      {nickname && participantId && session.status === 'results' && (
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
          <ResultSummary
            answerData={answerResultQuery.data}
            lastAnswerIndex={lastAnswerIndex}
            correctIndex={session.public_question?.correct_index ?? null}
            options={session.public_question?.options ?? []}
            loading={answerResultQuery.isLoading}
            reduceMotion={reduceMotion}
          />
          <p className="mt-3 text-sm text-muted-foreground">{t('play_scores_update')}</p>
        </motion.div>
      )}

      {nickname && participantId && session.status === 'ended' && (
        <motion.div
          initial={reduceMotion ? { opacity: 1, scale: 1 } : { opacity: 0, scale: 0.96 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.4 }}
          className="relative"
        >
          <div className="pointer-events-none absolute -inset-10 rounded-[40px] bg-[radial-gradient(circle_at_top,rgba(99,102,241,0.2),transparent_60%)]" />
          <GameOverCard>
            <CardHeader className="space-y-2">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <PartyPopper className="h-4 w-4 text-amber-200" />
                {t('play_game_complete')}
              </div>
              <CardTitle className="text-2xl sm:text-3xl">{t('play_game_complete_title')}</CardTitle>
              <p className="text-sm text-muted-foreground">{t('play_thanks')}</p>
            </CardHeader>
            <CardContent className="space-y-4">
              <SessionSummary
                rank={userRank}
                score={userScore}
                totalPlayers={totalPlayers}
                fallback={t('play_summary_fallback')}
              />
              <GameOverActions
                onJoin={() => navigate('/join')}
                onDashboard={() => navigate('/dashboard')}
                onHost={() => navigate('/dashboard')}
                showHost={!!user}
              />
              <p className="text-xs text-muted-foreground">{t('play_more_sessions')}</p>
            </CardContent>
          </GameOverCard>
        </motion.div>
      )}
    </div>
  )
}

function GameOverCard({ children }: { children: React.ReactNode }) {
  return (
    <Card className="glass-card relative rounded-3xl border border-white/10">
      <div className="pointer-events-none absolute inset-0 rounded-3xl bg-[radial-gradient(circle_at_top,rgba(255,255,255,0.12),transparent_60%)]" />
      {children}
    </Card>
  )
}

function SessionSummary({
  rank,
  score,
  totalPlayers,
  fallback
}: {
  rank: number | null
  score: number | null
  totalPlayers: number
  fallback: string
}) {
  const { t } = useI18n()
  if (!rank || score === null) {
    return (
      <div className="rounded-2xl border border-white/10 bg-white/5 p-4 text-sm text-muted-foreground">
        {fallback}
      </div>
    )
  }
  return (
    <div className="grid gap-3 sm:grid-cols-3">
      <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
        <p className="text-xs text-muted-foreground">{t('play_summary_rank')}</p>
        <p className="mt-2 text-2xl font-semibold">{rank}</p>
      </div>
      <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
        <p className="text-xs text-muted-foreground">{t('play_summary_score')}</p>
        <p className="mt-2 text-2xl font-semibold">{score}</p>
      </div>
      <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
        <p className="text-xs text-muted-foreground">{t('play_summary_players')}</p>
        <p className="mt-2 text-2xl font-semibold">{totalPlayers}</p>
      </div>
    </div>
  )
}

function GameOverActions({
  onJoin,
  onDashboard,
  onHost,
  showHost
}: {
  onJoin: () => void
  onDashboard: () => void
  onHost: () => void
  showHost: boolean
}) {
  const { t } = useI18n()
  return (
    <div className="flex flex-col gap-2 sm:flex-row">
      <Button className="w-full" onClick={onJoin}>
        {t('play_join_another')}
      </Button>
      <Button className="w-full" variant="secondary" onClick={onDashboard}>
        {t('play_go_dashboard')}
      </Button>
      {showHost && (
        <Button className="w-full" variant="outline" onClick={onHost}>
          {t('play_host_quiz')}
        </Button>
      )}
    </div>
  )
}

function QuestionCard({
  title,
  phase,
  children
}: {
  title: string
  phase: 'answering' | 'waiting' | 'results'
  children: React.ReactNode
}) {
  return (
    <Card className="glass-card rounded-3xl">
      <CardHeader>
        <CardTitle className="text-xl sm:text-2xl">{title}</CardTitle>
      </CardHeader>
      <CardContent className={`space-y-4 ${phase === 'waiting' ? 'opacity-90' : ''}`}>{children}</CardContent>
    </Card>
  )
}

function AnswerOption({
  label,
  gradient,
  selected,
  disabled,
  faded,
  onClick,
  showHint,
  hintText,
  reduceMotion
}: {
  label: string
  gradient: string
  selected: boolean
  disabled: boolean
  faded: boolean
  onClick: () => void
  showHint: boolean
  hintText: string
  reduceMotion: boolean
}) {
  return (
    <motion.button
      type="button"
      role="button"
      aria-pressed={selected}
      whileHover={reduceMotion ? {} : { scale: 1.02 }}
      whileTap={reduceMotion ? {} : { scale: 0.98 }}
      className={`answer-btn relative flex w-full items-center justify-between rounded-2xl bg-gradient-to-br ${gradient} px-5 py-4 text-left text-base font-semibold text-white shadow-lg transition ${
        disabled ? 'cursor-not-allowed' : ''
      } ${faded ? 'opacity-60' : ''} ${selected ? 'ring-2 ring-white/40' : ''}`}
      onClick={disabled ? undefined : onClick}
      disabled={disabled}
    >
      <span>{label}</span>
      {selected && (
        <span className="flex h-7 w-7 items-center justify-center rounded-full bg-white/20">
          <Check className="h-4 w-4" />
        </span>
      )}
      {showHint && (
        <span className="absolute right-4 top-2 text-sm text-white/90">{hintText}</span>
      )}
    </motion.button>
  )
}

function PlayerTimer({
  remainingSec,
  totalSec,
  progress,
  paused,
  t
}: {
  remainingSec: number
  totalSec: number
  progress: number
  paused: boolean
  t: (key: string) => string
}) {
  const remainingProgress = 1 - Math.max(0, Math.min(1, progress))
  const low = remainingProgress <= 0.2
  const mid = remainingProgress <= 0.5 && remainingProgress > 0.2
  const color = low ? 'text-rose-200' : mid ? 'text-amber-200' : 'text-emerald-200'
  return (
    <div className="space-y-2">
      <div className="flex items-end justify-between">
        <div className={`text-3xl font-semibold ${color}`} aria-live="polite">
          {Math.max(0, remainingSec)}s
        </div>
        <div className="text-xs text-muted-foreground">
          {paused ? t('host_timer_paused') : t('host_time_remaining')}
          <div className="text-[11px] text-muted-foreground">
            {t('host_time_of')} {totalSec}s
          </div>
        </div>
      </div>
      <div className="h-3 w-full rounded-full bg-white/10">
        <div
          className={`h-3 w-full rounded-full ${low ? 'bg-rose-400' : mid ? 'bg-amber-300' : 'bg-emerald-300'}`}
          style={{ transformOrigin: 'left center', transform: `scaleX(${remainingProgress})` }}
        />
      </div>
    </div>
  )
}

function LobbyCard({ children }: { children: React.ReactNode }) {
  return (
    <Card className="glass-card relative rounded-3xl border border-white/10">
      <div className="pointer-events-none absolute inset-0 rounded-3xl bg-[radial-gradient(circle_at_top,rgba(255,255,255,0.12),transparent_60%)]" />
      {children}
    </Card>
  )
}

function SessionCode({
  code,
  copied,
  onCopy
}: {
  code: string
  copied: boolean
  onCopy: () => void
}) {
  const { t } = useI18n()
  return (
    <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
      <div className="flex items-center justify-between text-xs text-muted-foreground">
        <span>{t('play_session_code')}</span>
        <button type="button" className="text-xs text-foreground" onClick={onCopy}>
          {copied ? t('play_copied') : t('play_copy')}
        </button>
      </div>
      <div className="mt-2 text-3xl font-semibold tracking-[0.4em] text-foreground">{code}</div>
    </div>
  )
}

function PlayerBadge({ nickname }: { nickname: string }) {
  const { t } = useI18n()
  return (
    <div className="flex items-center gap-3 rounded-2xl border border-white/10 bg-white/5 p-4">
      <div className="flex h-10 w-10 items-center justify-center rounded-full border border-white/10 bg-white/10 text-sm font-semibold">
        {nickname.slice(0, 1).toUpperCase()}
      </div>
      <div>
        <p className="text-xs text-muted-foreground">{t('play_you_are')}</p>
        <p className="text-sm font-semibold">{nickname}</p>
      </div>
    </div>
  )
}

function WaitingIndicator({ title, subtitle }: { title: string; subtitle: string }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/5 p-4 text-sm">
      <p className="text-foreground">{title}</p>
      <div className="mt-2 flex items-center gap-2 text-muted-foreground">
        <span>{subtitle}</span>
        <span className="flex gap-1">
          <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-primary" />
          <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-primary delay-150" />
          <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-primary delay-300" />
        </span>
      </div>
    </div>
  )
}

function ResultSummary({
  answerData,
  lastAnswerIndex,
  correctIndex,
  options,
  loading,
  reduceMotion
}: {
  answerData: { selected_index: number; is_correct: boolean; awarded_points: number } | null | undefined
  lastAnswerIndex: number | null
  correctIndex: number | null
  options: string[]
  loading: boolean
  reduceMotion: boolean
}) {
  const { t } = useI18n()
  const isCorrect =
    answerData?.is_correct ?? (correctIndex !== null && lastAnswerIndex === correctIndex)
  const points = answerData?.awarded_points ?? 0
  const pointsDisplay = useCountUp(points, reduceMotion)
  return (
    <Card className="glass-card rounded-3xl">
      <CardHeader>
        <CardTitle>{t('play_results')}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <motion.div
          initial={reduceMotion ? false : { opacity: 0, y: 6 }}
          animate={reduceMotion ? { opacity: 1 } : { opacity: 1, y: 0 }}
          className={`rounded-2xl border p-4 text-sm ${
            isCorrect ? 'border-emerald-400/40 bg-emerald-500/10' : 'border-rose-400/30 bg-rose-500/10'
          }`}
        >
          {loading ? (
            <p className="text-muted-foreground">{t('loading_session')}</p>
          ) : (
            <div className="space-y-1">
              <p className={isCorrect ? 'text-emerald-200' : 'text-rose-200'}>
                {isCorrect ? t('play_result_correct') : t('play_result_wrong')}
              </p>
              <p className="text-muted-foreground">
                {t('play_answer_points')} {pointsDisplay}
              </p>
            </div>
          )}
        </motion.div>
        {options.length > 0 && correctIndex !== null && (
          <div className="space-y-2">
            {options.map((opt, idx) => {
              const isChosen = lastAnswerIndex === idx
              const isRight = correctIndex === idx
              const stateClass = isRight
                ? 'border-emerald-400/40 bg-emerald-500/15 text-emerald-100'
                : isChosen
                  ? 'border-rose-400/30 bg-rose-500/10 text-rose-100'
                  : 'border-white/10 bg-white/5 text-foreground/80'
              return (
                <div key={idx} className={`rounded-2xl border px-4 py-3 text-sm ${stateClass}`}>
                  {opt}
                </div>
              )
            })}
          </div>
        )}
        {!options.length && <p className="text-sm text-muted-foreground">{t('play_no_answer')}</p>}
      </CardContent>
    </Card>
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
    const duration = 600
    const from = display
    const tick = (now: number) => {
      const progress = Math.min(1, (now - start) / duration)
      setDisplay(Math.round(from + (value - from) * progress))
      if (progress < 1) frameId = requestAnimationFrame(tick)
    }
    frameId = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(frameId)
  }, [value, reduceMotion])
  return display
}
