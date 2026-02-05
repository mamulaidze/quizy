import { Link, NavLink, useNavigate } from 'react-router-dom'
import React from 'react'
import { DoorOpen, LayoutDashboard, LogOut, Menu, Moon, Settings, Sun, TicketCheck, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { useTheme } from '@/hooks/useTheme'
import { useAuth } from '@/lib/auth'
import { useI18n } from '@/lib/i18n'
import { supabase } from '@/lib/supabase'
import { motion, AnimatePresence } from 'framer-motion'

export function AppShell({ children }: { children: React.ReactNode }) {
  const { theme, setTheme } = useTheme()
  const { user, language, setLanguage } = useAuth()
  const { t } = useI18n()
  const navigate = useNavigate()
  const [mobileOpen, setMobileOpen] = React.useState(false)

  const signOut = async () => {
    await supabase.auth.signOut()
    navigate('/')
  }

  return (
    <div
      className={`min-h-screen text-foreground ${theme === 'dark' ? 'bg-mesh' : 'bg-mesh-light'}`}
      data-theme={theme}
    >
      <div className={`pointer-events-none fixed inset-0 ${theme === 'dark' ? 'noise' : ''}`} />
      <header className="sticky top-0 z-40 border-b border-white/10 bg-background/40 backdrop-blur">
        <div className="mx-auto flex h-16 w-full max-w-6xl items-center justify-between px-4">
          <Link to="/" className="text-lg font-bold tracking-tight">
            QuizLive
          </Link>
          <nav className="hidden items-center gap-6 text-sm md:flex">
            <NavLink to="/join" className="text-muted-foreground hover:text-foreground">
              {t('nav_join')}
            </NavLink>
            <NavLink to="/dashboard" className="text-muted-foreground hover:text-foreground">
              {t('nav_dashboard')}
            </NavLink>
            <NavLink to="/settings" className="text-muted-foreground hover:text-foreground">
              {t('nav_settings')}
            </NavLink>
          </nav>
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="sm"
              className="md:hidden"
              aria-label="Toggle navigation"
              onClick={() => setMobileOpen((prev) => !prev)}
            >
              {mobileOpen ? <X className="h-4 w-4" /> : <Menu className="h-4 w-4" />}
            </Button>
            <Button
              variant="ghost"
              size="sm"
              aria-label="Toggle theme"
              onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
            >
              {theme === 'dark' ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
            </Button>
            {user && (
              <Button
                variant="ghost"
                size="sm"
                aria-label="Toggle language"
                onClick={() => setLanguage(language === 'en' ? 'ka' : 'en')}
              >
                {language === 'en' ? 'EN' : 'KA'}
              </Button>
            )}
            {user ? (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="sm" className="hidden sm:inline-flex">
                    {user.email}
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onClick={signOut}>
                    <LogOut className="mr-2 h-4 w-4" />
                    {t('nav_sign_out')}
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            ) : (
              <Button asChild size="sm">
                <Link to="/auth/login">{t('nav_login')}</Link>
              </Button>
            )}
          </div>
        </div>
        <AnimatePresence>
          {mobileOpen && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.25 }}
              className="border-t border-white/10 bg-gradient-to-b from-background/80 to-background/40 backdrop-blur md:hidden"
            >
              <div className="mx-auto w-full max-w-6xl px-4 py-5" onClick={() => setMobileOpen(false)}>
                <div className="rounded-2xl border border-white/10 bg-white/5 p-2" onClick={(e) => e.stopPropagation()}>
                  <NavLink
                    to="/join"
                    className="group flex items-center justify-between rounded-xl px-4 py-3 text-sm font-medium text-foreground transition hover:bg-white/5"
                    onClick={() => setMobileOpen(false)}
                  >
                    <span className="flex items-center gap-2">
                      <TicketCheck className="h-4 w-4 text-muted-foreground transition group-hover:text-foreground" />
                      {t('nav_join')}
                    </span>
                    <span className="text-xs text-muted-foreground transition group-hover:translate-x-0.5">→</span>
                  </NavLink>
                  <NavLink
                    to="/dashboard"
                    className="group flex items-center justify-between rounded-xl px-4 py-3 text-sm font-medium text-foreground transition hover:bg-white/5"
                    onClick={() => setMobileOpen(false)}
                  >
                    <span className="flex items-center gap-2">
                      <LayoutDashboard className="h-4 w-4 text-muted-foreground transition group-hover:text-foreground" />
                      {t('nav_dashboard')}
                    </span>
                    <span className="text-xs text-muted-foreground transition group-hover:translate-x-0.5">→</span>
                  </NavLink>
                  <NavLink
                    to="/settings"
                    className="group flex items-center justify-between rounded-xl px-4 py-3 text-sm font-medium text-foreground transition hover:bg-white/5"
                    onClick={() => setMobileOpen(false)}
                  >
                    <span className="flex items-center gap-2">
                      <Settings className="h-4 w-4 text-muted-foreground transition group-hover:text-foreground" />
                      {t('nav_settings')}
                    </span>
                    <span className="text-xs text-muted-foreground transition group-hover:translate-x-0.5">→</span>
                  </NavLink>
                </div>
                <div className="mt-3 rounded-2xl border border-white/10 bg-white/5 p-2" onClick={(e) => e.stopPropagation()}>
                  {user ? (
                    <button
                      type="button"
                      className="group flex w-full items-center justify-between rounded-xl px-4 py-3 text-left text-sm font-medium text-foreground transition hover:bg-white/5"
                      onClick={() => {
                        setMobileOpen(false)
                        signOut()
                      }}
                    >
                      <span className="flex items-center gap-2">
                        <DoorOpen className="h-4 w-4 text-muted-foreground transition group-hover:text-foreground" />
                        {t('nav_sign_out')}
                      </span>
                      <span className="text-xs text-muted-foreground transition group-hover:translate-x-0.5">↗</span>
                    </button>
                  ) : (
                    <NavLink
                      to="/auth/login"
                      className="group flex items-center justify-between rounded-xl px-4 py-3 text-sm font-medium text-foreground transition hover:bg-white/5"
                      onClick={() => setMobileOpen(false)}
                    >
                      <span className="flex items-center gap-2">
                        <LogOut className="h-4 w-4 text-muted-foreground transition group-hover:text-foreground" />
                        {t('nav_login')}
                      </span>
                      <span className="text-xs text-muted-foreground transition group-hover:translate-x-0.5">→</span>
                    </NavLink>
                  )}
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </header>
      <main className="relative mx-auto w-full max-w-6xl px-4 py-8">{children}</main>
    </div>
  )
}
