import { useForm } from 'react-hook-form'
import { z } from 'zod'
import { zodResolver } from '@hookform/resolvers/zod'
import { Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { supabase } from '@/lib/supabase'
import { toast } from 'sonner'

const schema = z.object({
  email: z.string().email()
})

type FormValues = z.infer<typeof schema>

export default function ForgotPage() {
  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { email: '' }
  })

  const onSubmit = async (values: FormValues) => {
    const { error } = await supabase.auth.resetPasswordForEmail(values.email)
    if (error) {
      toast.error(error.message)
      return
    }
    toast.success('Password reset email sent')
  }

  return (
    <div className="mx-auto max-w-md">
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
      <Card className="glass-card rounded-3xl">
        <CardHeader>
          <CardTitle>Reset password</CardTitle>
        </CardHeader>
        <CardContent>
          <form className="space-y-4" onSubmit={form.handleSubmit(onSubmit)}>
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input id="email" type="email" {...form.register('email')} />
              {form.formState.errors.email && (
                <p className="text-sm text-destructive">{form.formState.errors.email.message}</p>
              )}
            </div>
            <Button type="submit" className="w-full">
              Send reset link
            </Button>
          </form>
          <div className="mt-4 text-sm">
            <Link to="/auth/login" className="text-primary">
              Back to login
            </Link>
          </div>
        </CardContent>
      </Card>
      </motion.div>
    </div>
  )
}
