'use client'

import { useEffect, useState, useCallback } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { createClient } from '@/lib/supabase'
import { getMyPlayerId, getRoomJoinUrl } from '@/lib/utils'
import { CATEGORIES, GAME_MODES } from '@/types'
import type { Room, Player } from '@/types'

export default function LobbyPage() {
  const router = useRouter()
  const params = useParams()
  const code = (params.code as string).toUpperCase()

  const [room, setRoom] = useState<Room | null>(null)
  const [players, setPlayers] = useState<Player[]>([])
  const [myPlayer, setMyPlayer] = useState<Player | null>(null)
  const [category, setCategory] = useState('')
  const [copied, setCopied] = useState(false)
  const [starting, setStarting] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    const myId = getMyPlayerId()
    if (!myId) { router.push('/'); return }
    const supabase = createClient()

    async function load() {
      const { data: roomData } = await supabase
        .from('rooms').select('*').eq('code', code).single()
      if (!roomData) { router.push('/'); return }
      setRoom(roomData)
      setCategory(roomData.category || '')
      setStarting(false)
      setError('')

      const { data: playersData } = await supabase
        .from('players').select('*').eq('room_id', roomData.id).order('created_at')
      if (playersData) {
        setPlayers(playersData)
        setMyPlayer(playersData.find(p => p.id === myId) ?? null)
      }
    }

    load()

    const channel = supabase
      .channel(`lobby:${code}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'rooms', filter: `code=eq.${code}` },
        payload => {
          const updated = payload.new as Room
          setRoom(updated)
          setCategory(updated.category || '')
          setStarting(false)
          if (updated.status === 'questions') {
            router.push(`/room/${code}/play`)
          }
          if (updated.status === 'season_revealing') {
            router.push(`/room/${code}/season`)
          }
        }
      )
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'players' },
        payload => {
          const newPlayer = payload.new as Player
          setPlayers(prev =>
            prev.some(p => p.id === newPlayer.id) ? prev : [...prev, newPlayer]
          )
        }
      )
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [code, router])

  const copyLink = useCallback(() => {
    navigator.clipboard.writeText(getRoomJoinUrl(code))
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }, [code])

  async function handleStart() {
    if (!category) { setError('Pick a category first'); return }
    if (players.length < 2) { setError('You need at least 2 players to start'); return }
    if (!room) return
    setStarting(true)
    setError('')

    const supabase = createClient()
    const { error: err } = await supabase
      .from('rooms')
      .update({ status: 'questions', category, current_question_index: 0 })
      .eq('id', room.id)

    if (err) {
      setError('Could not start game. Try again.')
      setStarting(false)
    }
  }

  const isHost = myPlayer?.is_host ?? false
  const gameModeLabel = GAME_MODES.find(gm => gm.value === room?.game_mode)?.label ?? ''
  const gameModeIcon = GAME_MODES.find(gm => gm.value === room?.game_mode)?.icon ?? '⚽'

  if (!room) {
    return (
      <main className="min-h-screen flex items-center justify-center">
        <div className="text-white/40 text-sm animate-pulse">Loading room…</div>
      </main>
    )
  }

  return (
    <main className="min-h-screen flex flex-col items-center justify-start px-4 py-10">
      <div className="text-center mb-8">
        <p className="text-green-300/50 text-xs uppercase tracking-widest mb-1">Room code</p>
        <h1 className="font-display text-6xl text-white tracking-widest">{code}</h1>
        <div className="flex items-center justify-center gap-2 mt-2">
          <span>{gameModeIcon}</span>
          <span className="text-white/50 text-xs uppercase tracking-widest">{gameModeLabel}</span>
        </div>
        <button
          onClick={copyLink}
          className="mt-3 text-xs text-amber-400 hover:text-amber-300 underline underline-offset-2 transition-colors"
        >
          {copied ? '✓ Copied!' : 'Copy invite link'}
        </button>
      </div>

      <div className="w-full max-w-sm space-y-4">
        <div className="card p-5">
          <h2 className="text-xs uppercase tracking-widest text-green-300/60 mb-3">
            Players — {players.length} in room
          </h2>
          <div className="space-y-2">
            {players.map(p => (
              <div key={p.id} className="score-row">
                <span className="text-white text-sm">{p.name}</span>
                {p.is_host && (
                  <span className="text-xs text-amber-400 bg-amber-400/10 px-2 py-0.5 rounded-full">
                    Host
                  </span>
                )}
              </div>
            ))}
            {players.length === 0 && (
              <p className="text-white/30 text-sm text-center py-4">Waiting for players…</p>
            )}
          </div>
        </div>

        {isHost && (
          <div className="card p-5">
            <h2 className="text-xs uppercase tracking-widest text-green-300/60 mb-3">
              Choose category
            </h2>
            <div className="space-y-2">
              {CATEGORIES.map(cat => (
                <button
                  key={cat.value}
                  onClick={() => setCategory(cat.value)}
                  className={`w-full text-left px-4 py-3 rounded-xl border text-sm transition-all
                    ${category === cat.value
                      ? 'border-amber-400 bg-amber-400/15 text-amber-100'
                      : 'border-white/20 bg-white/5 text-white/70 hover:border-white/40 hover:text-white'
                    }`}
                >
                  {cat.label}
                </button>
              ))}
            </div>
          </div>
        )}

        {!isHost && room.category && (
          <div className="card p-4 text-center">
            <p className="text-white/50 text-xs uppercase tracking-widest mb-1">Category</p>
            <p className="text-white font-semibold">
              {CATEGORIES.find(c => c.value === room.category)?.label ?? room.category}
            </p>
          </div>
        )}

        {error && (
          <p className="text-red-400 text-sm text-center bg-red-500/10 border border-red-500/30 rounded-lg px-4 py-2">
            {error}
          </p>
        )}

        {isHost ? (
          <button
            onClick={handleStart}
            disabled={starting || !category || players.length < 2}
            className="w-full bg-amber-500 hover:bg-amber-400 disabled:opacity-40
                       text-pitch-dark font-semibold py-4 rounded-xl
                       transition-all duration-200 font-display text-2xl tracking-widest
                       active:scale-95"
          >
            {starting ? 'STARTING…' : room.game_mode === 'ten_game_season' ? 'KICK OFF 🏆' : 'KICK OFF ⚽'}
          </button>
        ) : (
          <div className="card p-4 text-center animate-pulse">
            <p className="text-white/50 text-sm">Waiting for the host to start…</p>
          </div>
        )}
      </div>
    </main>
  )
}
