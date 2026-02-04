import React from 'react'
import { supabase } from '@/lib/supabase'
import type { Answer, Participant, Session } from '@/types/db'

export type SessionRealtimeState = {
  session: Session | null
  participants: Participant[]
  answers: Answer[]
}

export function useSessionRealtime(sessionId?: string, options?: { includeAnswers?: boolean }) {
  const [state, setState] = React.useState<SessionRealtimeState>({
    session: null,
    participants: [],
    answers: []
  })

  React.useEffect(() => {
    if (!sessionId) return
    const includeAnswers = options?.includeAnswers ?? true

    let mounted = true

    const loadInitial = async () => {
      const [sessionRes, participantsRes, answersRes] = await Promise.all([
        supabase.from('sessions').select('*').eq('id', sessionId).single(),
        supabase.from('participants').select('*').eq('session_id', sessionId),
        includeAnswers ? supabase.from('answers').select('*').eq('session_id', sessionId) : Promise.resolve({ data: [] })
      ])

      if (!mounted) return
      setState({
        session: sessionRes.data ?? null,
        participants: participantsRes.data ?? [],
        answers: answersRes.data ?? []
      })
    }

    loadInitial()

    const channel = supabase
      .channel(`session-${sessionId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'sessions', filter: `id=eq.${sessionId}` },
        (payload) => {
          if (!mounted) return
          if (payload.eventType === 'DELETE') {
            setState((prev) => ({ ...prev, session: null }))
          } else {
            setState((prev) => ({ ...prev, session: payload.new as Session }))
          }
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'participants', filter: `session_id=eq.${sessionId}` },
        () => loadInitial()
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'answers', filter: `session_id=eq.${sessionId}` },
        () => (includeAnswers ? loadInitial() : undefined)
      )
      .subscribe()

    return () => {
      mounted = false
      supabase.removeChannel(channel)
    }
  }, [sessionId])

  return state
}
