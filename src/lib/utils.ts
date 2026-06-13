// Generate a human-friendly 6-character room code (no ambiguous chars)
const CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'

export function generateRoomCode(): string {
  return Array.from({ length: 6 }, () =>
    CHARS[Math.floor(Math.random() * CHARS.length)]
  ).join('')
}

// Merge Tailwind classes safely
import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

// Store the player's own ID in sessionStorage so they survive page refreshes
export function saveMyPlayerId(playerId: string) {
  if (typeof window !== 'undefined') {
    sessionStorage.setItem('quizout_player_id', playerId)
  }
}

export function getMyPlayerId(): string | null {
  if (typeof window !== 'undefined') {
    return sessionStorage.getItem('quizout_player_id')
  }
  return null
}

// Build the shareable join URL for a room
export function getRoomJoinUrl(code: string): string {
  if (typeof window !== 'undefined') {
    return `${window.location.origin}/room/${code}`
  }
  return `/room/${code}`
}

// Check if every player has answered a given question
export function allPlayersAnswered(
  playerIds: string[],
  answers: { player_id: string; question_index: number }[],
  questionIndex: number
): boolean {
  const answeredIds = answers
    .filter(a => a.question_index === questionIndex)
    .map(a => a.player_id)
  return playerIds.every(id => answeredIds.includes(id))
}
