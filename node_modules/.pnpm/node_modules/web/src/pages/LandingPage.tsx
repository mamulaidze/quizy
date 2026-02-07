import { Link } from 'react-router-dom'
import { motion, useReducedMotion } from 'framer-motion'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { useAuth } from '@/lib/auth'
import { useI18n } from '@/lib/i18n'

export default function LandingPage() {
  const { user } = useAuth()
  const { t } = useI18n()
  const reduceMotion = useReducedMotion()

  return (
    <HeroLayout>
      <div className="grid gap-10 md:grid-cols-[1.1fr,0.9fr]">
        <HeroContent reduceMotion={reduceMotion} />
        <HeroVisual reduceMotion={reduceMotion} />
      </div>
      <div className="mt-10 grid gap-3 md:grid-cols-3">
        {[
          t('landing_trust_fast'),
          t('landing_trust_phone'),
          t('landing_trust_setup')
        ].map((copy) => (
          <div key={copy} className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-muted-foreground">
            {copy}
          </div>
        ))}
      </div>
      <div className="mt-4 text-xs text-muted-foreground">{t('landing_trust_line')}</div>
    </HeroLayout>
  )
}

function HeroLayout({ children }: { children: React.ReactNode }) {
  const reduceMotion = useReducedMotion()
  return (
    <div className="relative overflow-hidden rounded-3xl border border-white/10 bg-white/5 p-6 md:p-12">
      <motion.div
        aria-hidden
        className="pointer-events-none absolute inset-0 opacity-70"
        animate={reduceMotion ? { opacity: 0.7 } : { opacity: [0.55, 0.8, 0.55] }}
        transition={reduceMotion ? { duration: 0 } : { duration: 12, repeat: Infinity, ease: 'easeInOut' }}
        style={{
          background:
            'radial-gradient(800px 400px at 10% 0%, rgba(99,102,241,0.18), transparent 60%), radial-gradient(700px 360px at 90% 20%, rgba(34,211,238,0.16), transparent 60%), radial-gradient(600px 300px at 50% 100%, rgba(244,114,182,0.12), transparent 65%)'
        }}
      />
      <div className="relative">{children}</div>
    </div>
  )
}

function HeroContent({ reduceMotion }: { reduceMotion: boolean }) {
  const { t } = useI18n()
  const contentVariants = {
    hidden: { opacity: 0, y: 14 },
    show: { opacity: 1, y: 0, transition: { duration: 0.5, ease: 'easeOut' } }
  }
  return (
    <motion.div
      className="space-y-6"
      initial="hidden"
      animate="show"
      variants={contentVariants}
    >
      <Badge className="inline-flex items-center gap-2 bg-white/10 text-foreground">
        <span className="relative flex h-2 w-2">
          <motion.span
            className="absolute inline-flex h-full w-full rounded-full bg-emerald-400"
            animate={reduceMotion ? { opacity: 1 } : { opacity: [0.6, 1, 0.6], scale: [1, 1.6, 1] }}
            transition={{ duration: 2.2, repeat: Infinity }}
          />
        </span>
        {t('landing_badge')}
      </Badge>
      <h1 className="text-4xl font-semibold leading-tight sm:text-5xl lg:text-6xl">
        <span className="block">{t('landing_headline_line1')}</span>
        <span className="block text-primary">{t('landing_headline_line2')}</span>
      </h1>
      <p className="max-w-xl text-base text-muted-foreground sm:text-lg">
        {t('landing_subtitle')}
      </p>
      <div className="flex flex-col gap-3 sm:flex-row">
        <Button asChild size="lg" className="shadow-[0_10px_30px_rgba(99,102,241,0.35)]">
          <Link to="/join">{t('landing_join')}</Link>
        </Button>
        <Button asChild variant="secondary" size="lg">
          <Link to="/dashboard">{t('landing_create')}</Link>
        </Button>
      </div>
      <p className="text-xs text-muted-foreground">{t('landing_microcopy')}</p>
    </motion.div>
  )
}

function HeroVisual({ reduceMotion }: { reduceMotion: boolean }) {
  const { user } = useAuth()
  const { t } = useI18n()
  const floatTransition = reduceMotion ? { duration: 0 } : { duration: 8, repeat: Infinity, ease: 'easeInOut' }
  const players = [
    { name: 'Maya', score: 820 },
    { name: 'Alex', score: 760 },
    { name: 'Nika', score: 710 },
    { name: 'Lia', score: 690 }
  ]
  return (
    <motion.div
      className="relative"
      initial={{ opacity: 0, y: 18 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay: 0.1 }}
    >
      <motion.div
        animate={reduceMotion ? { y: 0 } : { y: [0, -8, 0] }}
        transition={floatTransition}
        className="rounded-3xl border border-white/10 bg-white/5 p-6 shadow-[0_30px_80px_rgba(15,23,42,0.45)]"
      >
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs uppercase tracking-[0.3em] text-muted-foreground">{t('landing_live_card')}</p>
            <div className="mt-2 flex items-center gap-2 text-sm text-foreground">
              <span className="rounded-full border border-emerald-400/30 bg-emerald-400/10 px-2 py-0.5 text-[10px] uppercase tracking-[0.2em] text-emerald-200">
                Live
              </span>
              <span className="text-xs text-muted-foreground">{t('landing_join_code')}:</span>
              <span className="text-sm font-semibold">QZ7P9</span>
            </div>
          </div>
          {user ? (
            <Badge variant="secondary">{t('landing_dashboard')}</Badge>
          ) : (
            <Badge variant="secondary">{t('landing_get_started')}</Badge>
          )}
        </div>
        <div className="mt-5 space-y-3">
          {players.map((player, idx) => (
            <motion.div
              key={player.name}
              initial={reduceMotion ? false : { opacity: 0, y: 6 }}
              animate={reduceMotion ? { opacity: 1 } : { opacity: 1, y: 0 }}
              transition={{ delay: reduceMotion ? 0 : idx * 0.08 }}
              className="rounded-2xl bg-black/20 px-4 py-3"
            >
              <div className="flex items-center justify-between text-sm">
                <span className="font-medium">{player.name}</span>
                <span className="text-muted-foreground">{player.score}</span>
              </div>
              <motion.div
                className="mt-2 h-1.5 rounded-full bg-white/10"
              >
                <motion.div
                  className="h-1.5 rounded-full bg-primary"
                  animate={reduceMotion ? { width: `${60 + idx * 8}%` } : { width: ['35%', `${60 + idx * 8}%`, '45%'] }}
                  transition={{ duration: 10 + idx * 2, repeat: Infinity, ease: 'easeInOut' }}
                />
              </motion.div>
            </motion.div>
          ))}
        </div>
        <div className="mt-4 text-xs text-muted-foreground">{t('landing_live_hint')}</div>
      </motion.div>
    </motion.div>
  )
}
