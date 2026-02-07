import React from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Switch } from '@/components/ui/switch'
import { useAuth } from '@/lib/auth'
import { useTheme } from '@/hooks/useTheme'
import { supabase } from '@/lib/supabase'
import { useNavigate } from 'react-router-dom'
import { motion, useReducedMotion } from 'framer-motion'
import { useI18n } from '@/lib/i18n'
import { Copy, Globe, Mail, Moon, ShieldCheck, Sun, User } from 'lucide-react'

export default function SettingsPage() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const { t } = useI18n()
  const { language, setLanguage } = useAuth()
  const { theme, setTheme } = useTheme()
  const reduceMotion = useReducedMotion()
  const [confirmSignOut, setConfirmSignOut] = React.useState(false)

  const signOut = async () => {
    await supabase.auth.signOut()
    navigate('/')
  }

  return (
    <SettingsLayout>
      <motion.div
        initial={reduceMotion ? { opacity: 1 } : { opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="space-y-6"
      >
        <div className="space-y-2">
          <h1 className="text-3xl font-semibold">{t('settings_title')}</h1>
          <p className="text-muted-foreground">{t('settings_subtitle')}</p>
        </div>

        <SettingsSection icon={<User className="h-4 w-4" />} title={t('settings_account')}>
          <SettingsRow
            title={t('settings_email')}
            description={t('settings_email_desc')}
            action={
              <Button
                variant="secondary"
                size="sm"
                onClick={async () => {
                  if (!user?.email) return
                  await navigator.clipboard.writeText(user.email)
                }}
              >
                <Copy className="mr-2 h-4 w-4" />
                {t('settings_copy')}
              </Button>
            }
          >
            <div className="flex items-center gap-2 text-sm">
              <Mail className="h-4 w-4 text-muted-foreground" />
              <span className="font-medium">{user?.email}</span>
            </div>
          </SettingsRow>
          <div className="h-px bg-white/5" />
          <SettingsRow
            title={t('settings_username')}
            description={t('settings_username_desc')}
            action={<Button variant="ghost" size="sm" disabled>{t('settings_coming')}</Button>}
          >
            <div className="text-sm text-muted-foreground">{t('settings_placeholder')}</div>
          </SettingsRow>
        </SettingsSection>

        <SettingsSection icon={<Globe className="h-4 w-4" />} title={t('settings_preferences')}>
          <SettingsRow
            title={t('settings_theme')}
            description={t('settings_theme_desc')}
            action={
              <div className="flex items-center gap-2">
                <Button
                  variant={theme === 'light' ? 'secondary' : 'ghost'}
                  size="sm"
                  onClick={() => setTheme('light')}
                >
                  <Sun className="mr-2 h-4 w-4" />
                  {t('settings_theme_light')}
                </Button>
                <Button
                  variant={theme === 'dark' ? 'secondary' : 'ghost'}
                  size="sm"
                  onClick={() => setTheme('dark')}
                >
                  <Moon className="mr-2 h-4 w-4" />
                  {t('settings_theme_dark')}
                </Button>
              </div>
            }
          >
            <div className="text-sm text-muted-foreground">{t('settings_theme_auto')}</div>
          </SettingsRow>
          <div className="h-px bg-white/5" />
          <SettingsRow
            title={t('settings_language')}
            description={t('settings_language_desc')}
            action={
              <div className="flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs">
                <button
                  type="button"
                  className={`px-2 py-1 ${language === 'en' ? 'text-foreground' : 'text-muted-foreground'}`}
                  onClick={() => setLanguage('en')}
                >
                  EN
                </button>
                <span className="text-muted-foreground">|</span>
                <button
                  type="button"
                  className={`px-2 py-1 ${language === 'ka' ? 'text-foreground' : 'text-muted-foreground'}`}
                  onClick={() => setLanguage('ka')}
                >
                  KA
                </button>
              </div>
            }
          >
            <div className="text-sm text-muted-foreground">{t('settings_language_hint')}</div>
          </SettingsRow>
        </SettingsSection>

        <SettingsSection icon={<ShieldCheck className="h-4 w-4" />} title={t('settings_security')}>
          <SettingsRow
            title={t('settings_sign_out')}
            description={t('settings_sign_out_desc')}
            action={
              <div className="flex items-center gap-3">
                <Switch checked={confirmSignOut} onCheckedChange={setConfirmSignOut} />
                <Button
                  variant="destructive"
                  size="sm"
                  disabled={!confirmSignOut}
                  onClick={signOut}
                >
                  {t('nav_sign_out')}
                </Button>
              </div>
            }
          >
            <div className="text-sm text-muted-foreground">{t('settings_confirm')}</div>
          </SettingsRow>
        </SettingsSection>

        <p className="text-xs text-muted-foreground">{t('settings_footer')}</p>
      </motion.div>
    </SettingsLayout>
  )
}

function SettingsLayout({ children }: { children: React.ReactNode }) {
  return <div className="mx-auto max-w-3xl">{children}</div>
}

function SettingsSection({
  title,
  icon,
  children
}: {
  title: string
  icon: React.ReactNode
  children: React.ReactNode
}) {
  return (
    <Card className="glass-card rounded-3xl">
      <CardHeader className="flex flex-row items-center gap-3">
        <div className="flex h-9 w-9 items-center justify-center rounded-xl border border-white/10 bg-white/5 text-muted-foreground">
          {icon}
        </div>
        <CardTitle className="text-lg">{title}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-5">{children}</CardContent>
    </Card>
  )
}

function SettingsRow({
  title,
  description,
  action,
  children
}: {
  title: string
  description: string
  action?: React.ReactNode
  children: React.ReactNode
}) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-white/10 bg-white/5 p-4">
      <div className="space-y-2">
        <div className="text-sm font-medium">{title}</div>
        <p className="text-xs text-muted-foreground">{description}</p>
        {children}
      </div>
      {action}
    </div>
  )
}
