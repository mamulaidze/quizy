import React from 'react'
import { Label } from '@/components/ui/label'

export function AuthField({
  id,
  label,
  error,
  children
}: {
  id: string
  label: string
  error?: string
  children: React.ReactNode
}) {
  return (
    <div className="space-y-2">
      <Label htmlFor={id} className="text-sm text-muted-foreground">
        {label}
      </Label>
      {children}
      {error && <p className="text-xs text-rose-200">{error}</p>}
    </div>
  )
}
