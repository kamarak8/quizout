// ─── Database row types (mirror your Supabase tables) ───────────────────────

export type RoomStatus =
  | 'waiting'
  | 'questions'
  | 'reveal'
  | 'sudden_death'
  | 'results'

export interface Room {
  id: string
  code: string
  host_id: string
  category: string
  status: RoomStatus
  current_question_index: number
  created_at: string
}

export interface Player {
  id: string
  room_id: string
  name: string
  is_host: boolean
  score: number
  created_at: string
}

export interface Question {
  id: string
  category: string
  question: string
  options: string[]        // array of 4 option strings
  correct_index: number   // 0-3
}

export interface Answer {
  id: string
  room_id: string
  player_id: string
  question_id: string
  question_index: number
  chosen_index: number    // -1 means no answer submitted (timed out)
  created_at: string
}

// ─── Client-side state types ─────────────────────────────────────────────────

export interface GameState {
  room: Room
  players: Player[]
  questions: Question[]   // only populated during game (correct_index hidden until reveal)
  myPlayer: Player | null
}

// Reveal: one slot per player per question
export interface RevealSlot {
  player: Player
  question: Question
  answer: Answer | null   // null = didn't answer
  isGoal: boolean
}

// ─── Category options ─────────────────────────────────────────────────────────

export const CATEGORIES = [
  { value: 'premier_league',  label: 'Premier League' },
  { value: 'world_cup',       label: 'World Cup' },
  { value: 'champions_league',label: 'Champions League' },
  { value: 'legends',         label: 'Football Legends' },
  { value: 'mixed',           label: 'Mixed Bag' },
] as const

export type Category = typeof CATEGORIES[number]['value']
