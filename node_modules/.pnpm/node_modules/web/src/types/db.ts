export type Quiz = {
  id: string
  owner_id: string
  title: string
  description: string | null
  cover_url: string | null
  created_at: string
}

export type Question = {
  id: string
  quiz_id: string
  idx: number
  prompt: string
  options: string[]
  correct_index: number
  time_limit_sec: number
  created_at: string
}

export type Session = {
  id: string
  quiz_id: string
  host_id: string
  code: string
  status: 'lobby' | 'question' | 'results' | 'ended'
  current_question_idx: number
  question_started_at: string | null
  public_question: PublicQuestion | null
  created_at: string
}

export type PublicQuestion = {
  question_id: string
  prompt: string
  options: string[]
  time_limit_sec: number
}

export type Participant = {
  id: string
  session_id: string
  nickname: string
  score: number
  created_at: string
}

export type Answer = {
  id: string
  session_id: string
  participant_id: string
  question_id: string
  selected_index: number
  is_correct: boolean
  awarded_points: number
  created_at: string
}
