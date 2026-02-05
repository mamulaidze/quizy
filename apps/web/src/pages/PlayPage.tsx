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

export default function PlayPage() {
  const { code } = useParams()
  const navigate = useNavigate()
  const [nickname, setNickname] = React.useState('')
  const [participantId, setParticipantId] = React.useState<string | null>(null)
  const [joining, setJoining] = React.useState(false)
  const [hasAnswered, setHasAnswered] = React.useState(false)
  const [selectedTeamId, setSelectedTeamId] = React.useState<string | null>(null)
  const reduceMotion = useReducedMotion()
  const { t } = useI18n()

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
  const podium = sortedParticipants.slice(0, 3)
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
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
        <Card className="glass-card rounded-3xl">
          <CardHeader>
            <CardTitle>{t('play_waiting')}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <p className="text-muted-foreground">{t('play_waiting_others')}</p>
            <div className="text-2xl font-bold tracking-widest sm:text-3xl">{session.code}</div>
            <div className="flex flex-wrap gap-2">
              {participants.map((p) => (
                <Badge key={p.id}>{p.nickname}</Badge>
              ))}
            </div>
            <LoadingDots label={t('play_get_ready')} />
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
            <CardTitle>{t('play_results')}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <p className="text-muted-foreground">{t('play_scores_update')}</p>
            {teamLeaderboard.length > 0 && (
              <div className="mt-6 space-y-3">
                <p className="text-sm text-muted-foreground">{t('host_team_leaderboard')}</p>
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
          </CardContent>
        </Card>
        </motion.div>
      )}

      {nickname && participantId && session.status === 'ended' && (
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
        <Card className="glass-card rounded-3xl">
          <CardHeader>
            <CardTitle>{t('play_game_over')}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-muted-foreground">{t('play_thanks')}</p>
            {teamLeaderboard.length > 0 && (
              <div className="mt-6 space-y-3">
                <p className="text-sm text-muted-foreground">{t('host_team_leaderboard')}</p>
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
            <Button variant="secondary" onClick={() => navigate('/join')}>
              {t('play_join_another')}
            </Button>
          </CardContent>
        </Card>
        </motion.div>
      )}
    </div>
  )
}
