import React from 'react'
import { useNavigate } from 'react-router-dom'
import { motion, useReducedMotion } from 'framer-motion'
import { Moon, Sun, X } from 'lucide-react'
import { useTheme } from '@/hooks/useTheme'

export function AuthLayout({
  title,
  subtitle,
  children
}: {
  title: string
  subtitle?: string
  children: React.ReactNode
}) {
  const { theme, setTheme } = useTheme()
  const navigate = useNavigate()
  const reduceMotion = useReducedMotion()

  return (
    <div className={`min-h-screen ${theme === 'dark' ? 'bg-mesh' : 'bg-mesh-light'} text-foreground`} data-theme={theme}>
      <div className={`pointer-events-none fixed inset-0 ${theme === 'dark' ? 'noise' : ''}`} />
      <div className="relative flex min-h-screen flex-col items-center justify-center px-5 pb-10 pt-[env(safe-area-inset-top)]">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(99,102,241,0.2),transparent_50%)]" />
        <motion.div
          initial={reduceMotion ? { opacity: 1 } : { opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={reduceMotion ? { duration: 0 } : { duration: 0.35, ease: 'easeOut' }}
          className="relative w-full max-w-md"
        >
          <div className="rounded-3xl border border-white/10 bg-white/5 shadow-[0_25px_60px_rgba(8,10,18,0.55)] backdrop-blur-xl">
            <div className="flex h-12 items-center justify-between border-b border-white/10 px-4">
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-white/10 text-xs font-semibold">QL</div>
              <span className="text-xs font-medium uppercase tracking-[0.28em] text-muted-foreground">{title}</span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-white/10 bg-white/5 transition hover:bg-white/10"
                  aria-label="Toggle theme"
                  onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
                >
                  {theme === 'dark' ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
                </button>
                <button
                  type="button"
                  className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-white/10 bg-white/5 transition hover:bg-white/10"
                  aria-label="Close auth"
                  onClick={() => navigate(-1)}
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            </div>
            <div className="px-6 pb-6 pt-6">
              <div className="space-y-2">
                <h1 className="text-2xl font-semibold">{title}</h1>
                {subtitle && <p className="text-sm text-muted-foreground">{subtitle}</p>}
              </div>
              <div className="mt-6">{children}</div>
            </div>
          </div>
        </motion.div>
      </div>
    </div>
  )
}
