import React from 'react'
import { useForm, useFieldArray } from 'react-hook-form'
import { z } from 'zod'
import { zodResolver } from '@hookform/resolvers/zod'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
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
  onCreated
}: {
  quiz?: Quiz
  questions?: Question[]
  onCreated?: (quizId: string) => void
}) {
  const { t } = useI18n()
  const { user } = useAuth()
  const form = useForm<QuizFormValues>({
    resolver: zodResolver(quizSchema),
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

  return (
    <form className="space-y-6" onSubmit={form.handleSubmit(onSubmit)}>
      <Card>
        <CardHeader>
          <CardTitle>{t('quiz_details')}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="title">{t('quiz_title')}</Label>
            <Input id="title" {...form.register('title')} />
            {form.formState.errors.title && (
              <p className="text-sm text-destructive">{form.formState.errors.title.message}</p>
            )}
          </div>
          <div className="space-y-2">
            <Label htmlFor="description">{t('quiz_description')}</Label>
            <Textarea id="description" {...form.register('description')} />
          </div>
        </CardContent>
      </Card>

      {fields.map((field, index) => (
        <Card key={field.id}>
          <CardHeader>
            <CardTitle>{t('quiz_question')} {index + 1}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>{t('quiz_prompt')}</Label>
              <Textarea {...form.register(`questions.${index}.prompt` as const)} />
            </div>
            <div className="space-y-2">
              <Label>{t('quiz_options')}</Label>
              <div className="space-y-2">
                {form.watch(`questions.${index}.options`).map((_, optionIndex) => (
                  <div key={optionIndex} className="flex gap-2">
                    <Input {...form.register(`questions.${index}.options.${optionIndex}` as const)} />
                    <Button
                      type="button"
                      variant={form.watch(`questions.${index}.correct_index`) === optionIndex ? 'default' : 'outline'}
                      onClick={() =>
                        update(index, {
                          ...form.getValues(`questions.${index}`),
                          correct_index: optionIndex
                        })
                      }
                    >
                      {t('quiz_correct')}
                    </Button>
                    {form.watch(`questions.${index}.options`).length > 2 && (
                      <Button
                        type="button"
                        variant="ghost"
                        onClick={() => {
                          const options = form.getValues(`questions.${index}.options`).filter((_, i) => i !== optionIndex)
                          form.setValue(`questions.${index}.options`, options, { shouldDirty: true })
                          const currentCorrect = form.getValues(`questions.${index}.correct_index`)
                          if (currentCorrect >= options.length) {
                            form.setValue(`questions.${index}.correct_index`, 0, { shouldDirty: true })
                          }
                        }}
                      >
                        {t('quiz_remove')}
                      </Button>
                    )}
                  </div>
                ))}
                {form.watch(`questions.${index}.options`).length < 4 && (
                  <Button
                    type="button"
                    variant="secondary"
                    onClick={() => {
                      const options = [...form.getValues(`questions.${index}.options`), '']
                      form.setValue(`questions.${index}.options`, options, { shouldDirty: true })
                    }}
                  >
                    {t('quiz_add_option')}
                  </Button>
                )}
              </div>
            </div>
            <div className="flex flex-wrap gap-4">
              <div className="space-y-2">
                <Label>{t('quiz_time_limit')}</Label>
                <Input
                  type="number"
                  min={5}
                  max={60}
                  {...form.register(`questions.${index}.time_limit_sec` as const, { valueAsNumber: true })}
                />
              </div>
              <div className="flex items-end">
                <Button type="button" variant="destructive" onClick={() => remove(index)}>
                  {t('quiz_delete_question')}
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      ))}

      <div className="flex flex-wrap gap-3">
        <Button
          type="button"
          variant="secondary"
          onClick={() =>
            append({
              prompt: '',
              options: ['', ''],
              correct_index: 0,
              time_limit_sec: 20
            })
          }
        >
          {t('quiz_add_question')}
        </Button>
        <Button type="submit">{t('quiz_save')}</Button>
      </div>
    </form>
  )
}
