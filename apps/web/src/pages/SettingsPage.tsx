import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { useAuth } from '@/lib/auth'
import { supabase } from '@/lib/supabase'
import { useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { useI18n } from '@/lib/i18n'

export default function SettingsPage() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const { t } = useI18n()

  const signOut = async () => {
    await supabase.auth.signOut()
    navigate('/')
  }

  return (
    <div className="mx-auto max-w-xl">
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
      <Card className="glass-card rounded-3xl">
        <CardHeader>
          <CardTitle>{t('settings_title')}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <p className="text-sm text-muted-foreground">{t('settings_email')}</p>
            <p className="text-lg font-semibold">{user?.email}</p>
          </div>
          <Button variant="destructive" onClick={signOut}>
            {t('nav_sign_out')}
          </Button>
        </CardContent>
      </Card>
      </motion.div>
    </div>
  )
}
