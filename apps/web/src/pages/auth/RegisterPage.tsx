import React from 'react'
import { useForm } from 'react-hook-form'
import { z } from 'zod'
import { zodResolver } from '@hookform/resolvers/zod'
import { Link, useNavigate } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { supabase } from '@/lib/supabase'
import { toast } from 'sonner'
import { useI18n } from '@/lib/i18n'
import { AuthLayout } from '@/components/auth/AuthLayout'
import { Eye, EyeOff } from 'lucide-react'
import { AuthField } from '@/components/auth/AuthField'

const schema = z.object({
  email: z.string().email(),
  password: z.string().min(6)
})

type FormValues = z.infer<typeof schema>

export default function RegisterPage() {
  const navigate = useNavigate()
  const { t } = useI18n()
  const [showPassword, setShowPassword] = React.useState(false)
  const [errorMessage, setErrorMessage] = React.useState<string | null>(null)
  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    mode: 'onChange',
    defaultValues: { email: '', password: '' }
  })

  const onSubmit = async (values: FormValues) => {
    setErrorMessage(null)
    const { error } = await supabase.auth.signUp({
      email: values.email,
      password: values.password
    })
    if (error) {
      setErrorMessage(error.message)
      toast.error(error.message)
      return
    }
    toast.success('Account created. Check your email to confirm.')
    navigate('/dashboard')
  }

  return (
    <AuthLayout title={t('auth_create')} subtitle="Create your account and go live in minutes.">
      <form className="space-y-5" onSubmit={form.handleSubmit(onSubmit)}>
        <AuthField id="email" label={t('auth_email')} error={form.formState.errors.email?.message}>
          <Input
            id="email"
            type="email"
            autoComplete="email"
            className="h-12 rounded-2xl border-white/10 bg-white/5 focus-visible:ring-2 focus-visible:ring-primary/50"
            {...form.register('email')}
          />
        </AuthField>
        <AuthField id="password" label={t('auth_password')} error={form.formState.errors.password?.message}>
          <div className="relative">
            <Input
              id="password"
              type={showPassword ? 'text' : 'password'}
              autoComplete="new-password"
              className="h-12 rounded-2xl border-white/10 bg-white/5 pr-12 focus-visible:ring-2 focus-visible:ring-primary/50"
              {...form.register('password')}
            />
            <button
              type="button"
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground transition hover:text-foreground"
              aria-label={showPassword ? 'Hide password' : 'Show password'}
              onClick={() => setShowPassword((prev) => !prev)}
            >
              {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          </div>
        </AuthField>
        {errorMessage && (
          <p className="rounded-2xl border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-xs text-rose-100" aria-live="polite">
            {errorMessage}
          </p>
        )}
        <Button type="submit" className="h-12 w-full rounded-2xl" disabled={!form.formState.isValid || form.formState.isSubmitting}>
          {form.formState.isSubmitting ? 'Creating account…' : t('auth_create')}
        </Button>
      </form>
      <div className="mt-5 text-center text-sm text-muted-foreground">
        <Link to="/auth/login" className="text-primary transition hover:text-primary/80">
          {t('auth_already')}
        </Link>
      </div>
    </AuthLayout>
  )
}
