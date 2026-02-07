import { Link, NavLink, useLocation, useNavigate } from 'react-router-dom'
import React from 'react'
import { ChevronRight, DoorOpen, LayoutDashboard, LogOut, Menu, Moon, Settings, Sun, TicketCheck, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { useTheme } from '@/hooks/useTheme'
import { useAuth } from '@/lib/auth'
import { useI18n } from '@/lib/i18n'
import { supabase } from '@/lib/supabase'
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion'

export function AppShell({ children }: { children: React.ReactNode }) {
  const { theme, setTheme } = useTheme()
  const { user, language, setLanguage } = useAuth()
  const { t } = useI18n()
  const navigate = useNavigate()
  const location = useLocation()
  const [mobileOpen, setMobileOpen] = React.useState(false)
  const [scrolled, setScrolled] = React.useState(false)
  const reduceMotion = useReducedMotion()
  const [joinCode, setJoinCode] = React.useState('')
  const [joinNickname, setJoinNickname] = React.useState('')
  const isJoinRoute = location.pathname.startsWith('/join')
  const isAuthRoute = location.pathname.startsWith('/auth')
  const routeLabel =
    location.pathname.startsWith('/join')
      ? 'Join game'
      : location.pathname.startsWith('/dashboard')
        ? 'Dashboard'
        : location.pathname.startsWith('/settings')
          ? 'Settings'
          : 'QuizLive'

  React.useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 6)
    onScroll()
    window.addEventListener('scroll', onScroll)
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  const signOut = async () => {
    await supabase.auth.signOut()
    navigate('/')
  }

  const navClass = ({ isActive }: { isActive: boolean }) =>
    `relative text-sm transition ${isActive ? 'text-foreground' : 'text-muted-foreground hover:text-foreground'}`

  const navItems = [
    { to: '/join', label: t('nav_join'), icon: TicketCheck },
    { to: '/dashboard', label: t('nav_dashboard'), icon: LayoutDashboard },
    { to: '/settings', label: t('nav_settings'), icon: Settings }
  ]

  React.useEffect(() => {
    if (!mobileOpen) return
    const original = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = original
    }
  }, [mobileOpen])

  const handleJoinSubmit = (event: React.FormEvent) => {
    event.preventDefault()
    const code = joinCode.trim().toUpperCase()
    if (code.length < 4) return
    setMobileOpen(false)
    setJoinCode('')
    setJoinNickname('')
    navigate(`/play/${code}`)
  }

  if (isAuthRoute) {
    return <div className="min-h-screen">{children}</div>
  }

  return (
    <div
      className={`min-h-screen text-foreground ${theme === 'dark' ? 'bg-mesh' : 'bg-mesh-light'}`}
      data-theme={theme}
    >
      <div className={`pointer-events-none fixed inset-0 ${theme === 'dark' ? 'noise' : ''}`} />
      <header
        className={`sticky top-0 z-40 backdrop-blur transition ${
          scrolled
            ? 'border-b border-white/10 bg-background/80 shadow-[0_8px_30px_rgba(15,23,42,0.2)]'
            : 'border-b border-white/10 bg-background/50'
        }`}
      >
        <>
          <div className="mx-auto flex h-12 w-full max-w-6xl items-center justify-between px-4 pt-[env(safe-area-inset-top)] md:hidden">
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-white/10 text-xs font-semibold">
              QL
            </div>
            <span className="text-xs font-medium uppercase tracking-[0.28em] text-muted-foreground">{routeLabel}</span>
            <button
              type="button"
              className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-white/10 bg-white/5 transition hover:bg-white/10"
              aria-label="Toggle navigation"
              onClick={() => setMobileOpen((prev) => !prev)}
            >
              {mobileOpen ? <X className="h-4 w-4" /> : <Menu className="h-4 w-4" />}
            </button>
          </div>
          <div className="mx-auto hidden h-16 w-full max-w-6xl items-center justify-between px-4 md:flex">
            <Link to="/" className="text-lg font-bold tracking-tight">
              QuizLive
            </Link>
            <nav className="hidden items-center gap-6 text-sm md:flex">
              {navItems.map((item) => (
                <NavLink key={item.to} to={item.to} className={navClass}>
                  {({ isActive }) => (
                    <>
                      {item.label}
                      <span
                        className={`absolute -bottom-2 left-0 h-0.5 w-full origin-left rounded-full bg-primary transition ${
                          isActive ? 'scale-x-100' : 'scale-x-0'
                        }`}
                      />
                    </>
                  )}
                </NavLink>
              ))}
            </nav>
            <div className="flex items-center gap-2">
              <Button variant="ghost" size="sm" aria-label="Toggle theme" onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}>
                {theme === 'dark' ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
              </Button>
              {user && (
                <Button
                  variant="ghost"
                  size="sm"
                  aria-label="Toggle language"
                  className="hidden sm:inline-flex rounded-full border border-white/10 bg-white/5 px-3 text-xs"
                  onClick={() => setLanguage(language === 'en' ? 'ka' : 'en')}
                >
                  {language === 'en' ? 'EN' : 'KA'}
                </Button>
              )}
              {user ? (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="sm" className="hidden sm:inline-flex rounded-full border border-white/10 bg-white/5 text-xs">
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
        </>
        <MobileNavDrawer
          isOpen={mobileOpen}
          onClose={() => setMobileOpen(false)}
          navItems={navItems}
          activeRoute={location.pathname}
          theme={theme}
          onToggleTheme={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
          userEmail={user?.email ?? null}
          onSignOut={() => {
            setMobileOpen(false)
            signOut()
          }}
          onLogin={() => {
            setMobileOpen(false)
            navigate('/auth/login')
          }}
          reduceMotion={reduceMotion}
          joinCode={joinCode}
          setJoinCode={setJoinCode}
          joinNickname={joinNickname}
          setJoinNickname={setJoinNickname}
          onJoinSubmit={handleJoinSubmit}
        />
      </header>
      <main className="relative mx-auto w-full max-w-6xl px-4 py-8">{children}</main>
    </div>
  )
}

function MobileNavDrawer({
  isOpen,
  onClose,
  navItems,
  activeRoute,
  theme,
  onToggleTheme,
  userEmail,
  onSignOut,
  onLogin,
  reduceMotion,
  joinCode,
  setJoinCode,
  joinNickname,
  setJoinNickname,
  onJoinSubmit
}: {
  isOpen: boolean
  onClose: () => void
  navItems: { to: string; label: string; icon: React.ComponentType<{ className?: string }> }[]
  activeRoute: string
  theme: string
  onToggleTheme: () => void
  userEmail: string | null
  onSignOut: () => void
  onLogin: () => void
  reduceMotion: boolean
  joinCode: string
  setJoinCode: React.Dispatch<React.SetStateAction<string>>
  joinNickname: string
  setJoinNickname: React.Dispatch<React.SetStateAction<string>>
  onJoinSubmit: (event: React.FormEvent) => void
}) {
  const { t } = useI18n()
  const transition = reduceMotion ? { duration: 0 } : { duration: 0.24, ease: 'easeOut' }
  const contentRef = React.useRef<HTMLDivElement | null>(null)

  React.useEffect(() => {
    if (isOpen && contentRef.current) {
      contentRef.current.scrollTop = 0
    }
  }, [isOpen])

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div
            className="fixed inset-0 z-40 bg-slate-950/95 backdrop-blur md:hidden"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={transition}
            onClick={onClose}
            aria-hidden
          />
          <motion.aside
            className="fixed inset-y-0 right-0 z-50 flex h-[100dvh] w-full max-w-sm flex-col border-l border-white/10 bg-background/95 shadow-[0_30px_80px_rgba(8,10,18,0.6)] backdrop-blur-xl md:hidden"
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={transition}
            drag="x"
            dragConstraints={{ left: 0, right: 0 }}
            dragElastic={0.08}
            onDragEnd={(_, info) => {
              if (info.offset.x > 80) onClose()
            }}
            role="dialog"
            aria-modal="true"
            aria-label="Mobile navigation"
          >
            <DrawerHeader theme={theme} onToggleTheme={onToggleTheme} onClose={onClose} />
            <DrawerContent ref={contentRef}>
              <NavSection
                items={navItems}
                activeRoute={activeRoute}
                onItemClick={onClose}
                reduceMotion={reduceMotion}
              />
              <JoinLiveSection
                joinCode={joinCode}
                setJoinCode={setJoinCode}
                joinNickname={joinNickname}
                setJoinNickname={setJoinNickname}
                onSubmit={onJoinSubmit}
                reduceMotion={reduceMotion}
              />
              <AccountSection
                userEmail={userEmail}
                onSignOut={onSignOut}
                onLogin={onLogin}
                reduceMotion={reduceMotion}
              />
            </DrawerContent>
          </motion.aside>
        </>
      )}
    </AnimatePresence>
  )
}

const DrawerContent = React.forwardRef<HTMLDivElement, { children: React.ReactNode }>(function DrawerContent(
  { children },
  ref
) {
  return (
    <div ref={ref} className="flex-1 overflow-y-auto px-5 pb-6 pt-5">
      <div className="flex flex-col gap-6">{children}</div>
    </div>
  )
})

function DrawerHeader({
  theme,
  onToggleTheme,
  onClose
}: {
  theme: string
  onToggleTheme: () => void
  onClose: () => void
}) {
  return (
    <div className="sticky top-0 z-10 flex items-center justify-between border-b border-white/10 bg-background/90 px-5 pb-4 pt-5 backdrop-blur-xl">
      <div className="flex items-center gap-2">
        <div className="flex h-9 w-9 items-center justify-center rounded-full bg-white/5 text-sm font-semibold">
          QL
        </div>
        <div>
          <p className="text-sm font-semibold">QuizLive</p>
          <p className="text-xs text-muted-foreground">Live play, fast access</p>
        </div>
      </div>
      <div className="flex items-center gap-2">
        <button
          type="button"
          className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-white/10 bg-white/5 transition hover:bg-white/10"
          aria-label="Toggle theme"
          onClick={onToggleTheme}
        >
          {theme === 'dark' ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
        </button>
        <button
          type="button"
          className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-white/10 bg-white/5 transition hover:bg-white/10"
          aria-label="Close navigation"
          onClick={onClose}
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  )
}

function NavSection({
  items,
  activeRoute,
  onItemClick,
  reduceMotion
}: {
  items: { to: string; label: string; icon: React.ComponentType<{ className?: string }> }[]
  activeRoute: string
  onItemClick: () => void
  reduceMotion: boolean
}) {
  return (
    <div className="relative z-10 space-y-3">
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold uppercase tracking-[0.3em] text-muted-foreground">Navigation</span>
      </div>
      {items.map((item) => (
        <NavItem
          key={item.to}
          to={item.to}
          label={item.label}
          icon={item.icon}
          isActive={activeRoute === item.to}
          isPrimary={item.to === '/join'}
          onClick={onItemClick}
          reduceMotion={reduceMotion}
        />
      ))}
      <div className="border-t border-white/10 pt-2" />
    </div>
  )
}

function NavItem({
  to,
  label,
  icon: Icon,
  isActive,
  isPrimary,
  onClick,
  reduceMotion
}: {
  to: string
  label: string
  icon: React.ComponentType<{ className?: string }>
  isActive: boolean
  isPrimary?: boolean
  onClick: () => void
  reduceMotion: boolean
}) {
  return (
    <NavLink to={to} onClick={onClick} className="block">
      <motion.div
        whileTap={reduceMotion ? undefined : { scale: 0.98 }}
        className={`flex items-center justify-between rounded-2xl border px-4 py-3 text-sm font-semibold transition ${
          isPrimary
            ? 'border-primary/40 bg-primary/15 text-foreground shadow-[0_12px_26px_rgba(59,130,246,0.25)]'
            : isActive
              ? 'border-white/20 bg-white/10 text-foreground'
              : 'border-white/10 bg-white/5 text-muted-foreground hover:text-foreground'
        }`}
      >
        <span className="flex items-center gap-3">
          <span
            className={`flex h-9 w-9 items-center justify-center rounded-xl border text-foreground ${
              isPrimary ? 'border-primary/40 bg-primary/20' : 'border-white/10 bg-white/5'
            }`}
          >
            <Icon className="h-4 w-4" />
          </span>
          {label}
        </span>
        <ChevronRight className="h-4 w-4 text-muted-foreground" />
      </motion.div>
    </NavLink>
  )
}

function JoinLiveSection({
  joinCode,
  setJoinCode,
  joinNickname,
  setJoinNickname,
  onSubmit,
  reduceMotion
}: {
  joinCode: string
  setJoinCode: React.Dispatch<React.SetStateAction<string>>
  joinNickname: string
  setJoinNickname: React.Dispatch<React.SetStateAction<string>>
  onSubmit: (event: React.FormEvent) => void
  reduceMotion: boolean
}) {
  const { t } = useI18n()
  const isValid = joinCode.trim().length >= 4
  return (
    <div className="relative z-0 rounded-3xl border border-white/10 bg-gradient-to-br from-white/10 via-white/5 to-white/0 p-4 shadow-[0_20px_40px_rgba(8,10,18,0.45)]">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 rounded-full border border-emerald-400/30 bg-emerald-400/10 px-3 py-1 text-[10px] uppercase tracking-[0.35em] text-emerald-200">
          <span className="relative flex h-2 w-2">
            <motion.span
              className="absolute inline-flex h-full w-full rounded-full bg-emerald-400"
              animate={reduceMotion ? { opacity: 1 } : { opacity: [0.5, 1, 0.5], scale: [1, 1.6, 1] }}
              transition={reduceMotion ? { duration: 0 } : { duration: 2.2, repeat: Infinity }}
            />
          </span>
          {t('join_live')}
        </div>
        <span className="text-xs text-muted-foreground">Ready in seconds</span>
      </div>
      <div className="mt-3 space-y-1">
        <p className="text-lg font-semibold">{t('join_title')}</p>
        <p className="text-xs text-muted-foreground">{t('join_helper')}</p>
      </div>
      <form className="mt-4 space-y-3" onSubmit={onSubmit}>
        <Input
          value={joinCode}
          onChange={(event) => setJoinCode(event.target.value.toUpperCase())}
          placeholder="AB12CD"
          className="h-12 rounded-2xl border-white/10 bg-white/5 text-base font-semibold uppercase tracking-[0.2em] focus-visible:ring-2 focus-visible:ring-primary/40"
          aria-label={t('join_code_label')}
          inputMode="text"
        />
        <Input
          value={joinNickname}
          onChange={(event) => setJoinNickname(event.target.value)}
          placeholder="QuizHero"
          className="h-12 rounded-2xl border-white/10 bg-white/5 text-base"
          aria-label={t('join_nickname_label')}
        />
        <motion.button
          type="submit"
          whileTap={reduceMotion ? undefined : { scale: 0.98 }}
          className="inline-flex h-11 w-full items-center justify-center rounded-2xl bg-primary text-sm font-semibold text-primary-foreground shadow-[0_12px_30px_rgba(59,130,246,0.35)] transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-60"
          disabled={!isValid}
        >
          {t('join_cta')}
        </motion.button>
      </form>
    </div>
  )
}

function AccountSection({
  userEmail,
  onSignOut,
  onLogin,
  reduceMotion
}: {
  userEmail: string | null
  onSignOut: () => void
  onLogin: () => void
  reduceMotion: boolean
}) {
  const { t } = useI18n()
  return (
    <div className="space-y-3 rounded-3xl border border-white/10 bg-white/5 p-4">
      {userEmail ? (
        <>
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs text-muted-foreground">Signed in as</span>
            <span className="rounded-full border border-white/10 bg-white/10 px-3 py-1 text-xs font-medium text-foreground">
              {userEmail}
            </span>
          </div>
          <motion.button
            type="button"
            whileTap={reduceMotion ? undefined : { scale: 0.98 }}
            className="flex w-full items-center justify-between rounded-2xl border border-rose-500/20 bg-rose-500/10 px-4 py-3 text-sm font-medium text-rose-100 transition hover:bg-rose-500/15"
            onClick={onSignOut}
          >
            <span className="flex items-center gap-2">
              <DoorOpen className="h-4 w-4" />
              {t('nav_sign_out')}
            </span>
            <ChevronRight className="h-4 w-4" />
          </motion.button>
        </>
      ) : (
        <motion.button
          type="button"
          whileTap={reduceMotion ? undefined : { scale: 0.98 }}
          className="flex w-full items-center justify-between rounded-2xl border border-white/10 bg-white/10 px-4 py-3 text-sm font-medium text-foreground transition hover:bg-white/15"
          onClick={onLogin}
        >
          <span className="flex items-center gap-2">
            <LogOut className="h-4 w-4" />
            {t('nav_login')}
          </span>
          <ChevronRight className="h-4 w-4" />
        </motion.button>
      )}
    </div>
  )
}

