import React from 'react'
import { useForm } from 'react-hook-form'
import { motion, useReducedMotion } from 'framer-motion'
import { z } from 'zod'
import { zodResolver } from '@hookform/resolvers/zod'
import { useNavigate } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useI18n } from '@/lib/i18n'

const schema = z.object({
  code: z.string().min(4).max(10),
  nickname: z.string().min(2).max(20)
})

type FormValues = z.infer<typeof schema>

export default function JoinPage() {
  const navigate = useNavigate()
  const { t } = useI18n()
  const reduceMotion = useReducedMotion()
  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    mode: 'onChange',
    defaultValues: { code: '', nickname: '' }
  })

  const codeValue = form.watch('code')
  const nicknameValue = form.watch('nickname')
  const codeRef = React.useRef<HTMLInputElement | null>(null)

  React.useEffect(() => {
    if (codeRef.current) {
      codeRef.current.focus()
    }
  }, [])

  React.useEffect(() => {
    if (!codeValue) return
    const upper = codeValue.toUpperCase()
    if (upper !== codeValue) {
      form.setValue('code', upper, { shouldValidate: true })
    }
  }, [codeValue, form])

  const onSubmit = (values: FormValues) => {
    const code = values.code.trim().toUpperCase()
    localStorage.setItem(`nickname-${code}`, values.nickname.trim())
    navigate(`/play/${code}`)
  }

  return (
    <div className="relative flex min-h-[calc(100vh-3rem)] items-center justify-center px-4 py-10">
      <motion.div
        aria-hidden
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(99,102,241,0.22),transparent_60%)]"
        animate={reduceMotion ? { opacity: 0.7 } : { opacity: [0.45, 0.7, 0.45] }}
        transition={reduceMotion ? { duration: 0 } : { duration: 10, repeat: Infinity, ease: 'easeInOut' }}
      />
      <motion.div
        initial={reduceMotion ? { opacity: 1, scale: 1 } : { opacity: 0, y: 18, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={reduceMotion ? { duration: 0 } : { duration: 0.35, ease: 'easeOut' }}
        className="w-full max-w-lg"
      >
        <JoinGameCard>
          <CardHeader className="space-y-4">
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-2 rounded-full border border-emerald-400/30 bg-emerald-400/10 px-3 py-1 text-xs uppercase tracking-[0.25em] text-emerald-200">
                <span className="relative flex h-2 w-2">
                  <motion.span
                    className="absolute inline-flex h-full w-full rounded-full bg-emerald-400"
                    animate={reduceMotion ? { opacity: 1 } : { opacity: [0.5, 1, 0.5], scale: [1, 1.5, 1] }}
                    transition={{ duration: 2.2, repeat: Infinity }}
                  />
                </span>
                {t('join_live')}
              </div>
            </div>
            <div className="space-y-2">
              <CardTitle className="text-2xl sm:text-3xl">{t('join_title')}</CardTitle>
              <p className="text-sm text-muted-foreground">{t('join_subtitle')}</p>
            </div>
          </CardHeader>
          <CardContent>
            <form className="space-y-5" onSubmit={form.handleSubmit(onSubmit)}>
              <JoinCodeInput
                value={codeValue}
                error={form.formState.errors.code?.message}
                onChange={(value) => form.setValue('code', value, { shouldValidate: true })}
                inputRef={codeRef}
                reduceMotion={reduceMotion}
              />
              <NicknameInput
                value={nicknameValue}
                error={form.formState.errors.nickname?.message}
                onChange={(value) => form.setValue('nickname', value, { shouldValidate: true })}
                maxLength={20}
              />
              <Button
                type="submit"
                className="w-full shadow-[0_12px_30px_rgba(99,102,241,0.35)]"
                disabled={!form.formState.isValid}
              >
                {form.formState.isSubmitting ? t('join_joining') : t('join_cta')}
              </Button>
            </form>
            <div className="mt-4 flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
              <span>{t('join_trust_no_account')}</span>
              <span>{t('join_trust_phone')}</span>
            </div>
          </CardContent>
        </JoinGameCard>
      </motion.div>
    </div>
  )
}

function JoinGameCard({ children }: { children: React.ReactNode }) {
  return (
    <Card className="glass-card relative rounded-3xl border border-white/10">
      <div className="pointer-events-none absolute inset-0 rounded-3xl bg-[radial-gradient(circle_at_top,rgba(255,255,255,0.12),transparent_55%)]" />
      {children}
    </Card>
  )
}

function JoinCodeInput({
  value,
  error,
  onChange,
  inputRef,
  reduceMotion
}: {
  value: string
  error?: string
  onChange: (value: string) => void
  inputRef: React.RefObject<HTMLInputElement>
  reduceMotion: boolean
}) {
  const { t } = useI18n()
  const isValid = value.trim().length >= 4
  return (
    <div className="space-y-2">
      <Label htmlFor="code" className="text-sm text-muted-foreground">
        {t('join_code_label')}
      </Label>
      <motion.div
        animate={
          error && !reduceMotion
            ? { x: [0, -6, 6, -4, 4, 0] }
            : { x: 0 }
        }
        transition={{ duration: 0.35 }}
        className={`rounded-2xl border px-3 py-2 ${
          error ? 'border-rose-400/40 bg-rose-500/10' : isValid ? 'border-emerald-400/30 bg-emerald-500/10' : 'border-white/10 bg-white/5'
        }`}
      >
        <Input
          id="code"
          ref={inputRef}
          value={value}
          onChange={(event) => onChange(event.target.value.toUpperCase())}
          placeholder="AB12CD"
          className="h-12 border-none bg-transparent text-2xl font-semibold uppercase tracking-[0.2em] focus-visible:ring-0"
          inputMode="text"
        />
      </motion.div>
      <p className="text-xs text-muted-foreground">{t('join_code_hint')}</p>
      {error && <p className="text-xs text-rose-200">{error}</p>}
      {isValid && !error && <p className="text-xs text-emerald-200">{t('join_code_ok')}</p>}
    </div>
  )
}

function NicknameInput({
  value,
  error,
  onChange,
  maxLength
}: {
  value: string
  error?: string
  onChange: (value: string) => void
  maxLength: number
}) {
  const { t } = useI18n()
  return (
    <div className="space-y-2">
      <Label htmlFor="nickname" className="text-sm text-muted-foreground">
        {t('join_nickname_label')}
      </Label>
      <Input
        id="nickname"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder="QuizHero"
        maxLength={maxLength}
        className="h-12"
      />
      <div className="flex items-center justify-between text-xs text-muted-foreground">
        <span>{t('join_nickname_hint')}</span>
        <span>
          {value.length}/{maxLength}
        </span>
      </div>
      {error && <p className="text-xs text-rose-200">{error}</p>}
    </div>
  )
}
