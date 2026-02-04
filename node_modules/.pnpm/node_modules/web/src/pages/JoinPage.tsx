import { useForm } from 'react-hook-form'
import { z } from 'zod'
import { zodResolver } from '@hookform/resolvers/zod'
import { useNavigate } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

const schema = z.object({
  code: z.string().min(4).max(10),
  nickname: z.string().min(2).max(20)
})

type FormValues = z.infer<typeof schema>

export default function JoinPage() {
  const navigate = useNavigate()
  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { code: '', nickname: '' }
  })

  const onSubmit = (values: FormValues) => {
    const code = values.code.trim().toUpperCase()
    localStorage.setItem(`nickname-${code}`, values.nickname.trim())
    navigate(`/play/${code}`)
  }

  return (
    <div className="mx-auto max-w-lg">
      <Card>
        <CardHeader>
          <CardTitle>Join a live quiz</CardTitle>
        </CardHeader>
        <CardContent>
          <form className="space-y-4" onSubmit={form.handleSubmit(onSubmit)}>
            <div className="space-y-2">
              <Label htmlFor="code">Game code</Label>
              <Input id="code" placeholder="AB12CD" {...form.register('code')} />
              {form.formState.errors.code && (
                <p className="text-sm text-destructive">{form.formState.errors.code.message}</p>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="nickname">Nickname</Label>
              <Input id="nickname" placeholder="QuizHero" {...form.register('nickname')} />
              {form.formState.errors.nickname && (
                <p className="text-sm text-destructive">{form.formState.errors.nickname.message}</p>
              )}
            </div>
            <Button type="submit" className="w-full">
              Join game
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
