import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Switch } from '@/components/ui/switch'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { supabase } from '@/lib/supabase'
import { generateCode } from '@/lib/code'
import { useAuth } from '@/lib/auth'
import { useI18n } from '@/lib/i18n'
import { toast } from 'sonner'
import type { Quiz } from '@/types/db'
import React from 'react'
import { motion, useReducedMotion } from 'framer-motion'
import { LoadingDots } from '@/components/LoadingDots'
import { EmptyState } from '@/components/EmptyState'
import { Calendar, Clock, MoreVertical, Plus, Search, Users } from 'lucide-react'

export default function DashboardPage() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const { t } = useI18n()
  const reduceMotion = useReducedMotion()
  const [search, setSearch] = React.useState('')
  const [filterTeamsOnly, setFilterTeamsOnly] = React.useState(false)
  const [deleteTarget, setDeleteTarget] = React.useState<Quiz | null>(null)
  const [teamsRequiredByQuiz, setTeamsRequiredByQuiz] = React.useState<Record<string, boolean>>({})
  const [teamConfigsByQuiz, setTeamConfigsByQuiz] = React.useState<
    Record<string, { name: string; color: string }[]>
  >({})
  const [teamMaxByQuiz, setTeamMaxByQuiz] = React.useState<Record<string, number>>({})
  const [teamCountByQuiz, setTeamCountByQuiz] = React.useState<Record<string, number>>({})
  const [teamSettingsQuizId, setTeamSettingsQuizId] = React.useState<string | null>(null)

  const colorPool = [
    'from-rose-500 to-red-500',
    'from-sky-500 to-blue-500',
    'from-emerald-500 to-lime-500',
    'from-violet-500 to-fuchsia-500',
    'from-amber-500 to-orange-500',
    'from-cyan-500 to-teal-500',
    'from-indigo-500 to-blue-600',
    'from-pink-500 to-rose-500',
    'from-lime-500 to-green-500',
    'from-orange-500 to-amber-500'
  ]

  const defaultTeams = [
    { name: 'Red Rockets', color: 'from-rose-500 to-red-500' },
    { name: 'Blue Blasters', color: 'from-sky-500 to-blue-500' },
    { name: 'Green Sparks', color: 'from-emerald-500 to-lime-500' },
    { name: 'Purple Pulse', color: 'from-violet-500 to-fuchsia-500' }
  ]

  const normalizeTeams = (teams: { name: string; color: string }[]) =>
    teams
      .map((team, idx) => ({
        name: team.name.trim() || `Team ${idx + 1}`,
        color: team.color.trim() || 'from-slate-500 to-slate-700'
      }))
      .filter((team) => team.name.length > 0)

  const shuffle = <T,>(arr: T[]) => {
    const copy = [...arr]
    for (let i = copy.length - 1; i > 0; i -= 1) {
      const j = Math.floor(Math.random() * (i + 1))
      ;[copy[i], copy[j]] = [copy[j], copy[i]]
    }
    return copy
  }

  const generateTeams = (count: number) => {
    const safeCount = Math.max(2, Math.min(count, colorPool.length))
    const colors = shuffle(colorPool).slice(0, safeCount)
    return colors.map((color, idx) => ({
      name: `Team ${idx + 1}`,
      color
    }))
  }

  const pickNextColor = (current: { name: string; color: string }[]) => {
    const used = new Set(current.map((team) => team.color))
    const available = colorPool.filter((color) => !used.has(color))
    if (available.length === 0) return colorPool[Math.floor(Math.random() * colorPool.length)]
    return available[Math.floor(Math.random() * available.length)]
  }

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

  const filtered = (data ?? []).filter((quiz) => {
    const matchesSearch = quiz.title.toLowerCase().includes(search.toLowerCase())
    const matchesTeams = filterTeamsOnly ? !!teamsRequiredByQuiz[quiz.id] : true
    return matchesSearch && matchesTeams
  })

  const questionsByQuizQuery = useQuery({
    queryKey: ['questions-per-quiz', data?.length ?? 0],
    enabled: !!data && data.length > 0,
    queryFn: async () => {
      const { data: questions, error } = await supabase.from('questions').select('quiz_id')
      if (error) throw error
      return (questions ?? []).reduce<Record<string, number>>((acc, q) => {
        acc[q.quiz_id] = (acc[q.quiz_id] ?? 0) + 1
        return acc
      }, {})
    }
  })

  const sessionsQuery = useQuery({
    queryKey: ['sessions-metrics', user?.id],
    enabled: !!user?.id,
    queryFn: async () => {
      const { data: sessions, error, count } = await supabase
        .from('sessions')
        .select('id,created_at', { count: 'exact' })
        .eq('host_id', user?.id)
      if (error) throw error
      return { sessions: sessions ?? [], count: count ?? 0 }
    }
  })

  const participantsQuery = useQuery({
    queryKey: ['participants-metrics', sessionsQuery.data?.sessions?.length ?? 0],
    enabled: !!sessionsQuery.data?.sessions?.length,
    queryFn: async () => {
      const sessionIds = sessionsQuery.data?.sessions.map((s) => s.id) ?? []
      if (sessionIds.length === 0) return { count: 0 }
      const { count, error } = await supabase
        .from('participants')
        .select('id', { count: 'exact' })
        .in('session_id', sessionIds)
      if (error) throw error
      return { count: count ?? 0 }
    }
  })

  React.useEffect(() => {
    if (!data) return
    const requiredMap: Record<string, boolean> = {}
    const configMap: Record<string, { name: string; color: string }[]> = {}
    const maxMap: Record<string, number> = {}
    const countMap: Record<string, number> = {}
    data.forEach((quiz) => {
      if (quiz.teams_config && quiz.teams_config.length > 0) {
        requiredMap[quiz.id] = true
        configMap[quiz.id] = quiz.teams_config
        countMap[quiz.id] = quiz.teams_config.length
      }
      if (quiz.team_max_members) {
        maxMap[quiz.id] = quiz.team_max_members
      }
    })
    setTeamsRequiredByQuiz((prev) => ({ ...prev, ...requiredMap }))
    setTeamConfigsByQuiz((prev) => ({ ...prev, ...configMap }))
    setTeamMaxByQuiz((prev) => ({ ...prev, ...maxMap }))
    setTeamCountByQuiz((prev) => ({ ...prev, ...countMap }))
  }, [data])

  const persistTeamSettings = async (
    quizId: string,
    payload: { teams_config?: { name: string; color: string }[] | null; team_max_members?: number | null }
  ) => {
    const normalizedPayload = {
      ...payload,
      teams_config: payload.teams_config ? normalizeTeams(payload.teams_config) : payload.teams_config
    }
    const { error } = await supabase.from('quizzes').update(normalizedPayload).eq('id', quizId)
    if (error) toast.error(error.message)
    await queryClient.invalidateQueries({ queryKey: ['quizzes'] })
  }

  const startSession = async (quizId: string, requireTeams: boolean) => {
    if (!user) return
    const code = generateCode()
    const maxMembers = teamMaxByQuiz[quizId] ?? 8
    const { data, error } = await supabase
      .from('sessions')
      .insert({
        quiz_id: quizId,
        host_id: user.id,
        code,
        status: 'lobby',
        current_question_idx: 0,
        question_started_at: null,
        public_question: null,
        locked: false,
        auto_advance_sec: 5,
        pause_accumulated_ms: 0,
        paused_at: null,
        team_max_members: requireTeams ? maxMembers : null
      })
      .select('*')
      .single()

    if (error || !data) {
      toast.error(error?.message ?? 'Failed to start session')
      return
    }
    if (requireTeams) {
      const config = teamConfigsByQuiz[quizId]
      const source = config && config.length > 0 ? config : defaultTeams
      const sanitized = normalizeTeams(source)
      if (sanitized.length < 2) {
        toast.error(t('teams_required_desc'))
        return
      }
      const teams = sanitized.map((team) => ({
        session_id: data.id,
        name: team.name.trim() || 'Team',
        color: team.color
      }))
      const { error: teamsError } = await supabase.from('teams').insert(teams)
      if (teamsError) {
        toast.error(teamsError.message)
        return
      }
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
    <motion.div
      initial={reduceMotion ? { opacity: 1 } : { opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      className="space-y-6"
    >
      <DashboardHeader
        title={t('dashboard_title')}
        subtitle={t('dashboard_subtitle')}
        onNew={() => navigate('/quizzes/new')}
        newLabel={t('dashboard_new_quiz')}
        importLabel={t('dashboard_import')}
      />
      <StatsRow
        totalQuizzes={data?.length ?? 0}
        totalSessions={sessionsQuery.data?.count ?? 0}
        totalPlayers={participantsQuery.data?.count ?? 0}
        lastActivity={
          sessionsQuery.data?.sessions?.[0]?.created_at ??
          data?.[0]?.created_at ??
          null
        }
        reduceMotion={reduceMotion}
        labels={{
          quizzes: t('dashboard_stat_quizzes'),
          sessions: t('dashboard_stat_sessions'),
          players: t('dashboard_stat_players'),
          last: t('dashboard_stat_last')
        }}
      />

      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder={t('dashboard_search')}
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            className="pl-9"
          />
        </div>
        <Button
          variant={filterTeamsOnly ? 'secondary' : 'ghost'}
          size="sm"
          onClick={() => setFilterTeamsOnly((prev) => !prev)}
        >
          {t('dashboard_filter_teams')}
        </Button>
      </div>

      {isLoading ? (
        <div className="rounded-3xl border border-white/10 bg-white/5 p-6">
          <LoadingDots label={t('dashboard_loading')} />
        </div>
      ) : filtered.length === 0 ? (
        <EmptyState
          title={t('dashboard_empty_title')}
          description={t('dashboard_empty_desc')}
          actionLabel={t('dashboard_empty_action')}
          onAction={() => navigate('/quizzes/new')}
        />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {filtered.map((quiz) => (
            <QuizCard
              key={quiz.id}
              quiz={quiz}
              questionsCount={(questionsByQuizQuery.data ?? {})[quiz.id] ?? 0}
              teamsRequired={teamsRequiredByQuiz[quiz.id] ?? false}
              onToggleTeams={async (checked) => {
                setTeamsRequiredByQuiz((prev) => ({ ...prev, [quiz.id]: checked }))
                if (!checked) {
                  setTeamConfigsByQuiz((prev) => ({ ...prev, [quiz.id]: [] }))
                  await persistTeamSettings(quiz.id, { teams_config: [], team_max_members: null })
                  setTeamSettingsQuizId(null)
                } else {
                  const requestedCount = teamCountByQuiz[quiz.id] ?? 4
                  const config = generateTeams(requestedCount)
                  setTeamConfigsByQuiz((prev) => ({ ...prev, [quiz.id]: config }))
                  await persistTeamSettings(quiz.id, {
                    teams_config: normalizeTeams(config),
                    team_max_members: teamMaxByQuiz[quiz.id] ?? 8
                  })
                  setTeamSettingsQuizId(quiz.id)
                }
              }}
              onEdit={() => navigate(`/quizzes/${quiz.id}/edit`)}
              onHost={() => startSession(quiz.id, teamsRequiredByQuiz[quiz.id] ?? false)}
              onDuplicate={() => duplicateQuiz(quiz)}
              onDelete={() => setDeleteTarget(quiz)}
              onTeamsSettings={() => setTeamSettingsQuizId(quiz.id)}
            />
          ))}
        </div>
      )}
      {deleteTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
          <div className="w-full max-w-md rounded-3xl border border-white/10 bg-slate-950/90 p-6 shadow-2xl backdrop-blur">
            <div className="space-y-2">
              <p className="text-lg font-semibold">{t('dashboard_delete_title')}</p>
              <p className="text-sm text-muted-foreground">
                {t('dashboard_delete_desc')} <span className="text-foreground">{deleteTarget.title}</span>
              </p>
            </div>
            <div className="mt-5 flex justify-end gap-2">
              <Button variant="ghost" onClick={() => setDeleteTarget(null)}>
                {t('dashboard_cancel')}
              </Button>
              <Button
                variant="destructive"
                onClick={async () => {
                  await deleteQuiz(deleteTarget.id)
                  setDeleteTarget(null)
                }}
              >
                {t('dashboard_confirm_delete')}
              </Button>
            </div>
          </div>
        </div>
      )}
      {teamSettingsQuizId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 sm:p-6">
          <div className="w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-3xl border border-white/10 bg-slate-950/90 p-5 shadow-2xl backdrop-blur sm:p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">{t('teams_title')}</p>
                <p className="text-lg font-semibold">
                  {(filtered.find((q) => q.id === teamSettingsQuizId)?.title ?? '').toString()}
                </p>
              </div>
              <Button variant="ghost" onClick={() => setTeamSettingsQuizId(null)}>
                {t('teams_close')}
              </Button>
            </div>
            <div className="mt-4 space-y-4">
              <div className="flex items-center gap-3">
                <div className="text-xs text-muted-foreground">{t('teams_number')}</div>
                <Input
                  type="number"
                  min={2}
                  max={colorPool.length}
                  value={teamCountByQuiz[teamSettingsQuizId] ?? (teamConfigsByQuiz[teamSettingsQuizId]?.length ?? 4)}
                  onChange={(event) =>
                    setTeamCountByQuiz((prev) => ({
                      ...prev,
                      [teamSettingsQuizId]: Number(event.target.value)
                    }))
                  }
                  className="h-9 w-24"
                />
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={() => {
                    const next = generateTeams(teamCountByQuiz[teamSettingsQuizId] ?? 4)
                    setTeamConfigsByQuiz((prev) => ({ ...prev, [teamSettingsQuizId]: next }))
                    persistTeamSettings(teamSettingsQuizId, { teams_config: next })
                  }}
                >
                  {t('teams_generate')}
                </Button>
              </div>
              <div className="flex items-center gap-3">
                <div className="text-xs text-muted-foreground">{t('teams_max_members')}</div>
                <Input
                  type="number"
                  min={2}
                  max={50}
                  value={teamMaxByQuiz[teamSettingsQuizId] ?? 8}
                  onChange={(event) =>
                    setTeamMaxByQuiz((prev) => ({
                      ...prev,
                      [teamSettingsQuizId]: Number(event.target.value)
                    }))
                  }
                  onBlur={() =>
                    persistTeamSettings(teamSettingsQuizId, { team_max_members: teamMaxByQuiz[teamSettingsQuizId] ?? 8 })
                  }
                  className="h-9 w-24"
                />
              </div>
              <div className="space-y-2">
                {(teamConfigsByQuiz[teamSettingsQuizId] ?? defaultTeams).map((team, idx) => (
                  <div key={idx} className="flex flex-wrap items-center gap-2">
                    <Input
                      value={team.name}
                      onChange={(event) => {
                        const next = [...(teamConfigsByQuiz[teamSettingsQuizId] ?? [])]
                        if (next.length === 0) next.push(...defaultTeams)
                        next[idx] = { ...next[idx], name: event.target.value }
                        setTeamConfigsByQuiz((prev) => ({ ...prev, [teamSettingsQuizId]: next }))
                      }}
                      onBlur={() =>
                        persistTeamSettings(teamSettingsQuizId, {
                          teams_config: teamConfigsByQuiz[teamSettingsQuizId] ?? []
                        })
                      }
                      className="h-9"
                    />
                    <div className="flex h-9 items-center gap-2 rounded-md border border-white/10 bg-white/5 px-3 text-xs text-muted-foreground">
                      <span className={`h-3 w-3 rounded-full bg-gradient-to-br ${team.color}`} />
                      <span>{team.color}</span>
                    </div>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => {
                        const current = teamConfigsByQuiz[teamSettingsQuizId] ?? defaultTeams
                        const next = current.filter((_, i) => i !== idx)
                        setTeamConfigsByQuiz((prev) => ({ ...prev, [teamSettingsQuizId]: next }))
                        persistTeamSettings(teamSettingsQuizId, { teams_config: next })
                      }}
                    >
                      {t('quiz_remove')}
                    </Button>
                  </div>
                ))}
                <div className="flex flex-wrap gap-2">
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={() => {
                      const current = teamConfigsByQuiz[teamSettingsQuizId] ?? defaultTeams
                      const next = [...current, { name: `Team ${current.length + 1}`, color: pickNextColor(current) }]
                      setTeamConfigsByQuiz((prev) => ({
                        ...prev,
                        [teamSettingsQuizId]: next
                      }))
                      persistTeamSettings(teamSettingsQuizId, { teams_config: next })
                    }}
                  >
                    {t('teams_add')}
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => {
                      setTeamConfigsByQuiz((prev) => ({ ...prev, [teamSettingsQuizId]: defaultTeams }))
                      persistTeamSettings(teamSettingsQuizId, { teams_config: defaultTeams })
                    }}
                  >
                    {t('teams_reset')}
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </motion.div>
  )
}

function DashboardHeader({
  title,
  subtitle,
  onNew,
  newLabel,
  importLabel
}: {
  title: string
  subtitle: string
  onNew: () => void
  newLabel: string
  importLabel: string
}) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div>
        <h1 className="text-2xl font-semibold sm:text-3xl">{title}</h1>
        <p className="text-muted-foreground">{subtitle}</p>
      </div>
      <div className="flex flex-wrap gap-2">
        <Button variant="secondary" size="sm" disabled>
          {importLabel}
        </Button>
        <Button onClick={onNew}>
          <Plus className="mr-2 h-4 w-4" />
          {newLabel}
        </Button>
      </div>
    </div>
  )
}

function StatsRow({
  totalQuizzes,
  totalSessions,
  totalPlayers,
  lastActivity,
  reduceMotion,
  labels
}: {
  totalQuizzes: number
  totalSessions: number
  totalPlayers: number
  lastActivity: string | null
  reduceMotion: boolean
  labels: { quizzes: string; sessions: string; players: string; last: string }
}) {
  const stats = [
    { label: labels.quizzes, value: totalQuizzes, icon: Calendar },
    { label: labels.sessions, value: totalSessions, icon: Clock },
    { label: labels.players, value: totalPlayers, icon: Users }
  ]
  const last = lastActivity ? new Date(lastActivity).toLocaleDateString() : '—'
  return (
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
      {stats.map((stat, idx) => (
        <motion.div
          key={stat.label}
          initial={reduceMotion ? false : { opacity: 0, y: 6 }}
          animate={reduceMotion ? { opacity: 1 } : { opacity: 1, y: 0 }}
          transition={{ delay: reduceMotion ? 0 : idx * 0.05 }}
          className="rounded-2xl border border-white/10 bg-white/5 p-4"
        >
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <stat.icon className="h-4 w-4" />
            {stat.label}
          </div>
          <div className="mt-2 text-2xl font-semibold">{useCountUp(stat.value, reduceMotion)}</div>
        </motion.div>
      ))}
      <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <Clock className="h-4 w-4" />
          {labels.last}
        </div>
        <div className="mt-2 text-2xl font-semibold">{last}</div>
      </div>
    </div>
  )
}

function QuizCard({
  quiz,
  questionsCount,
  teamsRequired,
  onToggleTeams,
  onEdit,
  onHost,
  onDuplicate,
  onDelete,
  onTeamsSettings
}: {
  quiz: Quiz
  questionsCount: number
  teamsRequired: boolean
  onToggleTeams: (checked: boolean) => void
  onEdit: () => void
  onHost: () => void
  onDuplicate: () => void
  onDelete: () => void
  onTeamsSettings: () => void
}) {
  const { t } = useI18n()
  return (
    <motion.div whileHover={{ y: -4 }} transition={{ duration: 0.2 }}>
      <Card className="glass-card rounded-2xl border border-white/10">
        <CardHeader>
          <CardTitle className="text-lg">{quiz.title}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">{quiz.description ?? t('dashboard_no_desc')}</p>
          <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
            <span>
              {questionsCount} {t('dashboard_meta_questions')}
            </span>
            <span>•</span>
            <span>{new Date(quiz.created_at).toLocaleDateString()}</span>
          </div>
          <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-sm font-medium">{t('teams_required')}</p>
                <p className="text-xs text-muted-foreground">{t('teams_required_desc')}</p>
              </div>
              <Switch checked={teamsRequired} onCheckedChange={onToggleTeams} />
            </div>
            {teamsRequired && (
              <div className="mt-3">
                <Button size="sm" variant="secondary" onClick={onTeamsSettings}>
                  {t('teams_edit')}
                </Button>
              </div>
            )}
          </div>
          <QuizActions onHost={onHost} onEdit={onEdit} onDuplicate={onDuplicate} onDelete={onDelete} />
        </CardContent>
      </Card>
    </motion.div>
  )
}

function QuizActions({
  onHost,
  onEdit,
  onDuplicate,
  onDelete
}: {
  onHost: () => void
  onEdit: () => void
  onDuplicate: () => void
  onDelete: () => void
}) {
  const { t } = useI18n()
  return (
    <div className="flex flex-wrap items-center gap-2">
      <Button size="sm" onClick={onHost}>
        {t('dashboard_host')}
      </Button>
      <Button size="sm" variant="outline" onClick={onEdit}>
        {t('dashboard_edit')}
      </Button>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button size="sm" variant="ghost" aria-label="More actions">
            <MoreVertical className="h-4 w-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem onClick={onDuplicate}>{t('dashboard_duplicate')}</DropdownMenuItem>
          <DropdownMenuItem onClick={onDelete}>{t('dashboard_delete')}</DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
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
    const duration = 700
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
