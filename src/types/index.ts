// ─── Database row types (mirror your Supabase tables) ───────────────────────

export type RoomStatus =
  | 'waiting'
  | 'questions'
  | 'reveal'
  | 'sudden_death'
  | 'results'
  | 'season_revealing'
  | 'finished'

export type GameMode = 'penalty_shootout' | 'ten_game_season'

export interface Room {
  id: string
  code: string
  host_id: string
  category: string
  status: RoomStatus
  game_mode: GameMode
  current_question_index: number
  current_season_reveal_round: number
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
  options: string[]
  correct_index: number
}

export interface Answer {
  id: string
  room_id: string
  player_id: string
  question_id: string
  question_index: number
  chosen_index: number
  created_at: string
}

// ─── Season mode types ────────────────────────────────────────────────────────

export interface SeasonRow {
  player: Player
  position: number
  previousPosition: number | null
  movement: number  // positive = moved up, negative = moved down, 0 = same
  played: number
  wins: number
  losses: number
  points: number
  form: ('W' | 'L')[]  // ordered by gameweek
}

// ─── Client-side state types ──────────────────────────────────────────────────

export interface GameState {
  room: Room
  players: Player[]
  questions: Question[]
  myPlayer: Player | null
}

export interface RevealSlot {
  player: Player
  question: Question
  answer: Answer | null
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

export const GAME_MODES = [
  {
    value: 'penalty_shootout' as GameMode,
    label: 'Penalty Shootout',
    description: '5 questions. Penalty-style reveal. Most goals wins.',
    icon: '⚽',
  },
  {
    value: 'ten_game_season' as GameMode,
    label: '10 Game Season',
    description: '10 questions. Watch the league table update gameweek by gameweek.',
    icon: '🏆',
  },
]
