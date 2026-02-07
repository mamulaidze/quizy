import React from 'react'
import { Session, User } from '@supabase/supabase-js'
import { supabase } from './supabase'

type AuthState = {
  session: Session | null
  user: User | null
  loading: boolean
  language: 'en' | 'ka'
  setLanguage: (language: 'en' | 'ka') => Promise<void>
}

const AuthContext = React.createContext<AuthState>({
  session: null,
  user: null,
  loading: true,
  language: 'en',
  setLanguage: async () => {}
})

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = React.useState<AuthState>({
    session: null,
    user: null,
    loading: true,
    language: 'en',
    setLanguage: async () => {}
  })

  React.useEffect(() => {
    let isMounted = true
    const getStoredLanguage = () => {
      if (typeof window === 'undefined') return 'en' as const
      const stored = window.localStorage.getItem('language')
      return stored === 'ka' ? 'ka' : 'en'
    }
    const loadProfile = async (user: User | null) => {
      if (!user) {
        return getStoredLanguage()
      }
      const { data: profile } = await supabase
        .from('profiles')
        .select('language')
        .eq('id', user.id)
        .maybeSingle()
      if (!profile) {
        await supabase.from('profiles').insert({ id: user.id, language: 'en' })
        return 'en' as const
      }
      return (profile.language === 'ka' ? 'ka' : 'en') as const
    }

    const setLanguage = async (language: 'en' | 'ka') => {
      setState((prev) => ({ ...prev, language }))
      if (typeof window !== 'undefined') {
        window.localStorage.setItem('language', language)
      }
      const { data } = await supabase.auth.getUser()
      if (!data.user) return
      await supabase.from('profiles').update({ language }).eq('id', data.user.id)
    }

    supabase.auth.getSession().then(async ({ data }) => {
      if (!isMounted) return
      const language = await loadProfile(data.session?.user ?? null)
      setState({
        session: data.session,
        user: data.session?.user ?? null,
        loading: false,
        language,
        setLanguage
      })
    })

    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      ;(async () => {
        const language = await loadProfile(session?.user ?? null)
        setState({
          session,
          user: session?.user ?? null,
          loading: false,
          language,
          setLanguage
        })
      })()
    })

    return () => {
      isMounted = false
      listener.subscription.unsubscribe()
    }
  }, [])

  return <AuthContext.Provider value={state}>{children}</AuthContext.Provider>
}

export function useAuth() {
  return React.useContext(AuthContext)
}
