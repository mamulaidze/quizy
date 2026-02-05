import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Link, useNavigate } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Switch } from '@/components/ui/switch'
import { supabase } from '@/lib/supabase'
import { generateCode } from '@/lib/code'
import { useAuth } from '@/lib/auth'
import { useI18n } from '@/lib/i18n'
import { toast } from 'sonner'
import type { Quiz } from '@/types/db'
import React from 'react'
import { motion } from 'framer-motion'
import { LoadingDots } from '@/components/LoadingDots'
import { EmptyState } from '@/components/EmptyState'

export default function DashboardPage() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const { t } = useI18n()
  const [search, setSearch] = React.useState('')
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

  const filtered = (data ?? []).filter((quiz) =>
    quiz.title.toLowerCase().includes(search.toLowerCase())
  )

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
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold sm:text-3xl">{t('dashboard_title')}</h1>
          <p className="text-muted-foreground">{t('dashboard_subtitle')}</p>
        </div>
        <Button asChild>
          <Link to="/quizzes/new">{t('dashboard_new_quiz')}</Link>
        </Button>
      </div>

      <div className="flex items-center gap-3">
        <Input
          placeholder={t('dashboard_search')}
          value={search}
          onChange={(event) => setSearch(event.target.value)}
        />
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
        <div className="grid gap-4 md:grid-cols-2">
          {filtered.map((quiz) => (
            <Card key={quiz.id} className="glass-card rounded-3xl">
              <CardHeader>
                <CardTitle>{quiz.title}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <p className="text-sm text-muted-foreground">{quiz.description ?? t('dashboard_no_desc')}</p>
                <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-4">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="text-sm font-medium">{t('teams_required')}</p>
                      <p className="text-xs text-muted-foreground">{t('teams_required_desc')}</p>
                    </div>
                    <Switch
                      checked={teamsRequiredByQuiz[quiz.id] ?? false}
                      onCheckedChange={async (checked) => {
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
                    />
                  </div>
                  {teamsRequiredByQuiz[quiz.id] && (
                    <div className="mt-3">
                      <Button size="sm" variant="secondary" onClick={() => setTeamSettingsQuizId(quiz.id)}>
                        {t('teams_edit')}
                      </Button>
                    </div>
                  )}
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button size="sm" onClick={() => startSession(quiz.id, teamsRequiredByQuiz[quiz.id] ?? false)}>
                    {t('dashboard_host')}
                  </Button>
                  <Button size="sm" variant="outline" asChild>
                    <Link to={`/quizzes/${quiz.id}/edit`}>{t('dashboard_edit')}</Link>
                  </Button>
                  <Button size="sm" variant="secondary" onClick={() => duplicateQuiz(quiz)}>
                    {t('dashboard_duplicate')}
                  </Button>
                  <Button size="sm" variant="destructive" onClick={() => deleteQuiz(quiz.id)}>
                    {t('dashboard_delete')}
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
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
