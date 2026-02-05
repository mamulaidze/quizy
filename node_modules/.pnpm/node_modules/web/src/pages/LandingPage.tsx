import { Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { useAuth } from '@/lib/auth'
import { useI18n } from '@/lib/i18n'

export default function LandingPage() {
  const { user } = useAuth()
  const { t } = useI18n()

  return (
    <div className="hero-gradient rounded-3xl border border-white/10 p-6 md:p-12">
      <div className="grid gap-8 md:grid-cols-[1.2fr,0.8fr]">
        <motion.div
          className="space-y-6"
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
        >
          <Badge>{t('landing_tagline')}</Badge>
          <h1 className="text-3xl font-semibold leading-tight sm:text-4xl lg:text-5xl">
            {t('landing_title')}
          </h1>
          <p className="text-muted-foreground">
            {t('landing_subtitle')}
          </p>
          <div className="flex flex-wrap gap-3">
            <Button asChild size="lg">
              <Link to="/join">{t('landing_join')}</Link>
            </Button>
            <Button asChild variant="outline" size="lg">
              <Link to="/dashboard">{t('landing_create')}</Link>
            </Button>
          </div>
        </motion.div>
        <motion.div
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.1 }}
        >
        <Card className="glass-card rounded-3xl">
          <CardContent className="space-y-4 p-6">
            <div className="space-y-2">
              <p className="text-sm text-muted-foreground">{t('landing_how')}</p>
              <h2 className="text-xl font-semibold sm:text-2xl">{t('landing_how_title')}</h2>
            </div>
            <ul className="space-y-3 text-sm text-muted-foreground">
              <li>{t('landing_step1')}</li>
              <li>{t('landing_step2')}</li>
              <li>{t('landing_step3')}</li>
            </ul>
            {user ? (
              <Button asChild variant="secondary" className="w-full">
                <Link to="/dashboard">{t('landing_dashboard')}</Link>
              </Button>
            ) : (
              <Button asChild variant="secondary" className="w-full">
                <Link to="/auth/register">{t('landing_get_started')}</Link>
              </Button>
            )}
          </CardContent>
        </Card>
        </motion.div>
      </div>
    </div>
  )
}
