import React from 'react'
import { useForm, useFieldArray } from 'react-hook-form'
import { z } from 'zod'
import { zodResolver } from '@hookform/resolvers/zod'
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion'
import { Check, ChevronDown, ChevronUp, GripVertical, Plus, Timer, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/lib/auth'
import { toast } from 'sonner'
import type { Quiz, Question } from '@/types/db'
import { useDebounce } from '@/hooks/useDebounce'
import { useI18n } from '@/lib/i18n'

const questionSchema = z.object({
  id: z.string().optional(),
  prompt: z.string().min(1, 'Prompt required'),
  options: z.array(z.string().min(1)).min(2).max(4),
  correct_index: z.number().min(0),
  time_limit_sec: z.number().min(5).max(60)
})

const quizSchema = z.object({
  title: z.string().min(1, 'Title required'),
  description: z.string().optional(),
  questions: z.array(questionSchema).min(1, 'Add at least one question')
})

export type QuizFormValues = z.infer<typeof quizSchema>

export default function QuizEditor({
  quiz,
  questions,
  onCreated,
  headerTitle,
  headerSubtitle,
  badgeLabel
}: {
  quiz?: Quiz
  questions?: Question[]
  onCreated?: (quizId: string) => void
  headerTitle?: string
  headerSubtitle?: string
  badgeLabel?: string
}) {
  const { t } = useI18n()
  const { user } = useAuth()
  const reduceMotion = useReducedMotion()
  const form = useForm<QuizFormValues>({
    resolver: zodResolver(quizSchema),
    mode: 'onChange',
    defaultValues: {
      title: quiz?.title ?? '',
      description: quiz?.description ?? '',
      questions:
        questions?.map((q) => ({
          id: q.id,
          prompt: q.prompt,
          options: q.options,
          correct_index: q.correct_index,
          time_limit_sec: q.time_limit_sec
        })) ??
        [
          {
            prompt: '',
            options: ['', ''],
            correct_index: 0,
            time_limit_sec: 20
          }
        ]
    }
  })

  const debouncedValues = useDebounce(form.watch(), 800)
  const { fields, append, remove, update } = useFieldArray({
    control: form.control,
    name: 'questions'
  })

  React.useEffect(() => {
    if (!quiz?.id || !user) return
    const save = async () => {
      const values = debouncedValues
      const quizUpdate = await supabase
        .from('quizzes')
        .update({ title: values.title, description: values.description })
        .eq('id', quiz.id)
      if (quizUpdate.error) {
        toast.error(quizUpdate.error.message)
        return
      }

      for (let i = 0; i < values.questions.length; i += 1) {
        const q = values.questions[i]
        if (q.id) {
          await supabase
            .from('questions')
            .update({
              idx: i,
              prompt: q.prompt,
              options: q.options,
              correct_index: q.correct_index,
              time_limit_sec: q.time_limit_sec
            })
            .eq('id', q.id)
        } else {
          await supabase.from('questions').insert({
            quiz_id: quiz.id,
            idx: i,
            prompt: q.prompt,
            options: q.options,
            correct_index: q.correct_index,
            time_limit_sec: q.time_limit_sec
          })
        }
      }
    }
    save()
  }, [debouncedValues, quiz?.id, user])

  const onSubmit = async (values: QuizFormValues) => {
    if (!user) return
    if (!quiz?.id) {
      const { data, error } = await supabase
        .from('quizzes')
        .insert({
          owner_id: user.id,
          title: values.title,
          description: values.description
        })
        .select('*')
        .single()
      if (error || !data) {
        toast.error(error?.message ?? 'Failed to create quiz')
        return
      }

      const payload = values.questions.map((q, idx) => ({
        quiz_id: data.id,
        idx,
        prompt: q.prompt,
        options: q.options,
        correct_index: q.correct_index,
        time_limit_sec: q.time_limit_sec
      }))
      await supabase.from('questions').insert(payload)
      toast.success('Quiz created')
      onCreated?.(data.id)
    } else {
      toast.success('Changes saved')
    }
  }

  const values = form.watch()
  const totalQuestions = values.questions?.length ?? 0
  const totalSeconds = values.questions?.reduce((sum, q) => sum + (q.time_limit_sec || 0), 0) ?? 0
  const missingTitle = !values.title?.trim()
  const missingPrompt = values.questions?.some((q) => !q.prompt?.trim()) ?? true
  const missingOptions = values.questions?.some((q) => q.options?.some((opt) => !opt?.trim())) ?? true
  const isReady = !missingTitle && !missingPrompt && !missingOptions

  return (
    <div className="space-y-6">
      <QuizHeader
        title={headerTitle ?? t('quiz_create')}
        subtitle={headerSubtitle ?? t('quiz_build')}
        badgeLabel={badgeLabel ?? t('quiz_draft')}
        onSave={() => form.handleSubmit(onSubmit)()}
        savingDisabled={!form.formState.isValid || form.formState.isSubmitting}
        reduceMotion={reduceMotion}
      />

      <form className="relative" onSubmit={form.handleSubmit(onSubmit)}>
        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
          <div className="space-y-6">
            <QuizDetailsCard
              titleValue={values.title}
              descriptionValue={values.description ?? ''}
              onTitleChange={(value) => form.setValue('title', value, { shouldDirty: true, shouldValidate: true })}
              onDescriptionChange={(value) => form.setValue('description', value, { shouldDirty: true })}
              titleError={form.formState.errors.title?.message}
            />

            <QuestionEditor
              fields={fields}
              form={form}
              update={update}
              remove={remove}
              append={append}
              reduceMotion={reduceMotion}
            />

            <div className="flex flex-wrap items-center gap-3">
              <Button
                type="button"
                variant="secondary"
                className="rounded-2xl"
                onClick={() =>
                  append({
                    prompt: '',
                    options: ['', ''],
                    correct_index: 0,
                    time_limit_sec: 20
                  })
                }
              >
                <Plus className="mr-2 h-4 w-4" />
                {t('quiz_add_question')}
              </Button>
              <Button type="submit" className="rounded-2xl" disabled={!form.formState.isValid || form.formState.isSubmitting}>
                {form.formState.isSubmitting ? t('quiz_saving') : t('quiz_save')}
              </Button>
            </div>
          </div>

          <QuizSummarySidebar
            totalQuestions={totalQuestions}
            totalSeconds={totalSeconds}
            ready={isReady}
            isDirty={form.formState.isDirty}
          />
        </div>

        <div className="fixed bottom-6 right-6 hidden xl:flex">
          <Button
            type="submit"
            className="h-12 rounded-2xl px-8 shadow-[0_20px_40px_rgba(59,130,246,0.35)]"
            disabled={!form.formState.isValid || form.formState.isSubmitting}
          >
            {form.formState.isSubmitting ? t('quiz_saving') : t('quiz_save')}
          </Button>
        </div>
      </form>
    </div>
  )
}

function QuizHeader({
  title,
  subtitle,
  badgeLabel,
  onSave,
  savingDisabled,
  reduceMotion
}: {
  title: string
  subtitle: string
  badgeLabel: string
  onSave: () => void
  savingDisabled: boolean
  reduceMotion: boolean
}) {
  const { t } = useI18n()
  return (
    <div className="flex flex-col gap-4 rounded-3xl border border-white/15 bg-white/8 px-6 py-5 shadow-[0_20px_45px_rgba(8,10,18,0.45)] md:flex-row md:items-center md:justify-between">
      <div className="space-y-2">
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-semibold sm:text-3xl">{title}</h1>
          <span className="rounded-full border border-white/20 bg-white/15 px-3 py-1 text-xs uppercase tracking-[0.3em] text-white/70">
            {badgeLabel}
          </span>
        </div>
        <p className="text-sm text-muted-foreground">{subtitle}</p>
      </div>
      <motion.div whileTap={reduceMotion ? undefined : { scale: 0.98 }} className="flex items-center gap-3">
        <Button variant="secondary" className="rounded-2xl" onClick={onSave} disabled={savingDisabled}>
          {t('quiz_publish_later')}
        </Button>
        <Button className="rounded-2xl" onClick={onSave} disabled={savingDisabled}>
          {t('quiz_save')}
        </Button>
      </motion.div>
    </div>
  )
}

function QuizDetailsCard({
  titleValue,
  descriptionValue,
  onTitleChange,
  onDescriptionChange,
  titleError
}: {
  titleValue: string
  descriptionValue: string
  onTitleChange: (value: string) => void
  onDescriptionChange: (value: string) => void
  titleError?: string
}) {
  const { t } = useI18n()
  return (
    <div className="rounded-3xl border border-white/10 bg-gradient-to-br from-white/5 via-white/[0.03] to-transparent p-6 shadow-[0_18px_40px_rgba(8,10,18,0.45)]">
      <div className="mb-4 text-xs font-semibold uppercase tracking-[0.3em] text-white/70">{t('quiz_details')}</div>
      <div className="space-y-5">
        <div className="space-y-2">
          <Label htmlFor="title" className="text-sm text-white/80">
            {t('quiz_title')}
          </Label>
          <Input
            id="title"
            value={titleValue}
            onChange={(event) => onTitleChange(event.target.value)}
            placeholder={t('quiz_title_placeholder')}
            className="h-12 rounded-2xl border-white/10 bg-slate-950/50 text-lg font-semibold placeholder:text-white/40 focus-visible:ring-2 focus-visible:ring-primary/60"
          />
          {titleError && <p className="text-xs text-rose-200">{titleError}</p>}
        </div>
        <div className="space-y-2">
          <Label htmlFor="description" className="text-sm text-white/80">
            {t('quiz_description')}
          </Label>
          <Textarea
            id="description"
            value={descriptionValue}
            onChange={(event) => onDescriptionChange(event.target.value)}
            placeholder={t('quiz_description_placeholder')}
            className="min-h-[96px] rounded-2xl border-white/10 bg-slate-950/50 placeholder:text-white/40 focus-visible:ring-2 focus-visible:ring-primary/60"
          />
        </div>
      </div>
    </div>
  )
}

function QuestionEditor({
  fields,
  form,
  update,
  remove,
  append,
  reduceMotion
}: {
  fields: { id: string }[]
  form: ReturnType<typeof useForm<QuizFormValues>>
  update: (index: number, value: QuizFormValues['questions'][number]) => void
  remove: (index: number) => void
  append: (value: QuizFormValues['questions'][number]) => void
  reduceMotion: boolean
}) {
  const { t } = useI18n()
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">{t('quiz_questions')}</h2>
        <Button
          type="button"
          variant="ghost"
          className="rounded-2xl"
          onClick={() =>
            append({
              prompt: '',
              options: ['', ''],
              correct_index: 0,
              time_limit_sec: 20
            })
          }
        >
          <Plus className="mr-2 h-4 w-4" />
          {t('quiz_add_question')}
        </Button>
      </div>
      <AnimatePresence initial={false}>
        {fields.map((field, index) => (
          <motion.div
            key={field.id}
            initial={reduceMotion ? { opacity: 1 } : { opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={reduceMotion ? { opacity: 0 } : { opacity: 0, y: -10 }}
            transition={{ duration: 0.2 }}
          >
            <QuestionCard
              index={index}
              form={form}
              update={update}
              onRemove={() => remove(index)}
              reduceMotion={reduceMotion}
            />
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  )
}

function QuestionCard({
  index,
  form,
  update,
  onRemove,
  reduceMotion
}: {
  index: number
  form: ReturnType<typeof useForm<QuizFormValues>>
  update: (index: number, value: QuizFormValues['questions'][number]) => void
  onRemove: () => void
  reduceMotion: boolean
}) {
  const { t } = useI18n()
  const [open, setOpen] = React.useState(true)
  const prompt = form.watch(`questions.${index}.prompt` as const)
  const options = form.watch(`questions.${index}.options` as const)
  const correctIndex = form.watch(`questions.${index}.correct_index` as const)
  const timeLimit = form.watch(`questions.${index}.time_limit_sec` as const)

  return (
    <div className="rounded-3xl border border-white/10 bg-black/40 p-5 shadow-[0_18px_40px_rgba(8,10,18,0.45)]">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-full bg-white/10 text-sm font-semibold">
            {index + 1}
          </div>
          <div>
            <p className="text-sm font-semibold">
              {t('quiz_question')} {index + 1}
            </p>
            <p className="text-xs text-white/60">{t('quiz_question_help')}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <GripVertical className="h-4 w-4 text-muted-foreground" />
          <button
            type="button"
            className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-white/10 bg-white/5 transition hover:bg-white/10"
            aria-label={open ? 'Collapse question' : 'Expand question'}
            onClick={() => setOpen((prev) => !prev)}
          >
            {open ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
          </button>
        </div>
      </div>

      {open && (
        <div className="mt-5 space-y-5">
          <div className="space-y-2">
            <Label className="text-sm text-white/70">{t('quiz_prompt')}</Label>
            <Textarea
              value={prompt}
              onChange={(event) => form.setValue(`questions.${index}.prompt`, event.target.value, { shouldDirty: true })}
              placeholder={t('quiz_prompt_placeholder')}
              className="min-h-[96px] rounded-2xl border-white/10 bg-white/5 text-base focus-visible:ring-2 focus-visible:ring-primary/50"
            />
          </div>

          <div className="space-y-3">
            <Label className="text-sm text-white/70">{t('quiz_options')}</Label>
            <div className="space-y-2">
              {options.map((value, optionIndex) => (
                <OptionRow
                  key={`${index}-${optionIndex}`}
                  value={value}
                  index={optionIndex}
                  selected={correctIndex === optionIndex}
                  onChange={(next) =>
                    form.setValue(`questions.${index}.options.${optionIndex}` as const, next, {
                      shouldDirty: true
                    })
                  }
                  onSelect={() =>
                    update(index, {
                      ...form.getValues(`questions.${index}`),
                      correct_index: optionIndex
                    })
                  }
                  onRemove={
                    options.length > 2
                      ? () => {
                          const updated = options.filter((_, i) => i !== optionIndex)
                          form.setValue(`questions.${index}.options`, updated, { shouldDirty: true })
                          const currentCorrect = form.getValues(`questions.${index}.correct_index`)
                          if (currentCorrect >= updated.length) {
                            form.setValue(`questions.${index}.correct_index`, 0, { shouldDirty: true })
                          }
                        }
                      : undefined
                  }
                />
              ))}
              {options.length < 4 && (
                <Button
                  type="button"
                  variant="ghost"
                  className="h-9 rounded-2xl border border-white/10 bg-white/5 text-xs"
                  onClick={() => {
                    const updated = [...options, '']
                    form.setValue(`questions.${index}.options`, updated, { shouldDirty: true })
                  }}
                >
                  <Plus className="mr-2 h-3 w-3" />
                  {t('quiz_add_option')}
                </Button>
              )}
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-4">
            <div className="space-y-2">
              <Label className="text-sm text-white/70">{t('quiz_time_limit')}</Label>
              <div className="flex items-center gap-3 rounded-2xl border border-white/10 bg-white/5 px-3 py-2">
                <Timer className="h-4 w-4 text-muted-foreground" />
                <input
                  type="range"
                  min={5}
                  max={60}
                  value={timeLimit}
                  onChange={(event) =>
                    form.setValue(`questions.${index}.time_limit_sec`, Number(event.target.value), { shouldDirty: true })
                  }
                  className="w-40"
                />
                <span className="text-sm font-semibold">{timeLimit}s</span>
              </div>
            </div>
            <div className="ml-auto flex items-center">
              <Button type="button" variant="destructive" className="rounded-2xl" onClick={onRemove}>
                <Trash2 className="mr-2 h-4 w-4" />
                {t('quiz_delete_question')}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function OptionRow({
  value,
  index,
  selected,
  onChange,
  onSelect,
  onRemove
}: {
  value: string
  index: number
  selected: boolean
  onChange: (value: string) => void
  onSelect: () => void
  onRemove?: () => void
}) {
  const { t } = useI18n()
  return (
    <div
      className={`flex items-center gap-3 rounded-2xl border px-3 py-2 transition ${
        selected ? 'border-emerald-400/60 bg-emerald-400/12' : 'border-white/10 bg-white/5'
      }`}
    >
      <button
        type="button"
        aria-pressed={selected}
        className={`flex h-8 w-8 items-center justify-center rounded-full border transition ${
          selected ? 'border-emerald-400/80 bg-emerald-400/20 text-emerald-100' : 'border-white/10 bg-white/5 text-white/70'
        }`}
        onClick={onSelect}
      >
        {selected ? <Check className="h-4 w-4" /> : <span className="text-xs">{index + 1}</span>}
      </button>
      <Input
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={`${t('quiz_option')} ${index + 1}`}
        className="h-10 rounded-xl border-none bg-transparent focus-visible:ring-0"
      />
      {onRemove && (
        <button
          type="button"
          className="text-xs text-muted-foreground transition hover:text-foreground"
          onClick={onRemove}
        >
          {t('quiz_remove')}
        </button>
      )}
    </div>
  )
}

function QuizSummarySidebar({
  totalQuestions,
  totalSeconds,
  ready,
  isDirty
}: {
  totalQuestions: number
  totalSeconds: number
  ready: boolean
  isDirty: boolean
}) {
  const { t } = useI18n()
  return (
    <div className="space-y-4">
      <div className="rounded-3xl border border-white/10 bg-white/5 p-5 shadow-[0_18px_40px_rgba(8,10,18,0.35)]">
        <div className="text-xs font-semibold uppercase tracking-[0.3em] text-muted-foreground">{t('quiz_summary')}</div>
        <div className="mt-4 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">{t('quiz_total_questions')}</span>
            <span className="text-sm font-semibold">{totalQuestions}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">{t('quiz_est_duration')}</span>
            <span className="text-sm font-semibold">{Math.max(1, Math.round(totalSeconds / 60))} min</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">{t('quiz_status')}</span>
            <span className={`text-sm font-semibold ${ready ? 'text-emerald-200' : 'text-amber-200'}`}>
              {ready ? t('quiz_ready') : t('quiz_missing')}
            </span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">{t('quiz_changes')}</span>
            <span className={`text-sm font-semibold ${isDirty ? 'text-amber-200' : 'text-emerald-200'}`}>
              {isDirty ? t('quiz_unsaved') : t('quiz_saved')}
            </span>
          </div>
        </div>
      </div>
      <div className="rounded-3xl border border-white/10 bg-white/5 p-5 text-sm text-muted-foreground">
        {t('quiz_keep_short')}
      </div>
    </div>
  )
}
