import React from 'react'
import { useForm } from 'react-hook-form'
import { z } from 'zod'
import { zodResolver } from '@hookform/resolvers/zod'
import { Link } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { supabase } from '@/lib/supabase'
import { toast } from 'sonner'
import { useI18n } from '@/lib/i18n'
import { AuthLayout } from '@/components/auth/AuthLayout'
import { AuthField } from '@/components/auth/AuthField'

const schema = z.object({
  email: z.string().email()
})

type FormValues = z.infer<typeof schema>

export default function ForgotPage() {
  const { t } = useI18n()
  const [errorMessage, setErrorMessage] = React.useState<string | null>(null)
  const [successMessage, setSuccessMessage] = React.useState<string | null>(null)
  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    mode: 'onChange',
    defaultValues: { email: '' }
  })

  const onSubmit = async (values: FormValues) => {
    setErrorMessage(null)
    setSuccessMessage(null)
    const { error } = await supabase.auth.resetPasswordForEmail(values.email)
    if (error) {
      setErrorMessage(error.message)
      toast.error(error.message)
      return
    }
    toast.success('Password reset email sent')
    setSuccessMessage('Password reset email sent. Check your inbox.')
  }

  return (
    <AuthLayout title={t('auth_reset')} subtitle="We’ll send a reset link to your email.">
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
        {errorMessage && (
          <p className="rounded-2xl border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-xs text-rose-100" aria-live="polite">
            {errorMessage}
          </p>
        )}
        {successMessage && (
          <p className="rounded-2xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-xs text-emerald-100" aria-live="polite">
            {successMessage}
          </p>
        )}
        <Button type="submit" className="h-12 w-full rounded-2xl" disabled={!form.formState.isValid || form.formState.isSubmitting}>
          {form.formState.isSubmitting ? 'Sending…' : t('auth_send_reset')}
        </Button>
      </form>
      <div className="mt-5 text-center text-sm text-muted-foreground">
        <Link to="/auth/login" className="text-primary transition hover:text-primary/80">
          {t('auth_back_login')}
        </Link>
      </div>
    </AuthLayout>
  )
}
