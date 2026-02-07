import { useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { z } from 'zod'
import { zodResolver } from '@hookform/resolvers/zod'
import { Link, useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { supabase } from '@/lib/supabase'
import { toast } from 'sonner'
import { useI18n } from '@/lib/i18n'
import { useAuth } from '@/lib/auth'

const schema = z.object({
  email: z.string().email(),
  password: z.string().min(6)
})

type FormValues = z.infer<typeof schema>

export default function LoginPage() {
  const navigate = useNavigate()
  const { t } = useI18n()
  const { user, loading } = useAuth()
  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { email: '', password: '' }
  })

  useEffect(() => {
    if (!loading && user) {
      navigate('/dashboard', { replace: true })
    }
  }, [loading, user, navigate])

  const onSubmit = async (values: FormValues) => {
    const { error } = await supabase.auth.signInWithPassword({
      email: values.email,
      password: values.password
    })
    if (error) {
      toast.error(error.message)
      return
    }
    toast.success('Welcome back!')
    navigate('/dashboard')
  }

  return (
    <div className="mx-auto max-w-md">
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
      <Card className="glass-card rounded-3xl">
        <CardHeader>
          <CardTitle>{t('auth_sign_in')}</CardTitle>
        </CardHeader>
        <CardContent>
          <form className="space-y-4" onSubmit={form.handleSubmit(onSubmit)}>
            <div className="space-y-2">
              <Label htmlFor="email">{t('auth_email')}</Label>
              <Input id="email" type="email" {...form.register('email')} />
              {form.formState.errors.email && (
                <p className="text-sm text-destructive">{form.formState.errors.email.message}</p>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">{t('auth_password')}</Label>
              <Input id="password" type="password" {...form.register('password')} />
              {form.formState.errors.password && (
                <p className="text-sm text-destructive">{form.formState.errors.password.message}</p>
              )}
            </div>
            <Button type="submit" className="w-full">
              {t('auth_sign_in')}
            </Button>
          </form>
          <div className="mt-4 flex items-center justify-between text-sm">
            <Link to="/auth/register" className="text-primary">
              {t('auth_no_account')}
            </Link>
            <Link to="/auth/forgot" className="text-muted-foreground">
              {t('auth_forgot')}
            </Link>
          </div>
        </CardContent>
      </Card>
      </motion.div>
    </div>
  )
}
