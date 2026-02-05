import { cn } from '@/lib/utils'

export function AlertBanner({
  title,
  description,
  variant = 'info'
}: {
  title: string
  description?: string
  variant?: 'info' | 'error' | 'success'
}) {
  const styles = {
    info: 'border-sky-500/30 bg-sky-500/10 text-sky-200',
    error: 'border-rose-500/30 bg-rose-500/10 text-rose-200',
    success: 'border-emerald-500/30 bg-emerald-500/10 text-emerald-200'
  }

  return (
    <div className={cn('rounded-2xl border px-4 py-3 text-sm', styles[variant])}>
      <div className="font-semibold">{title}</div>
      {description && <div className="mt-1 text-sm opacity-90">{description}</div>}
    </div>
  )
}
