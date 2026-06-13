'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase'
import { generateRoomCode, saveMyPlayerId } from '@/lib/utils'

export default function HomePage() {
  const router = useRouter()
  const [name, setName] = useState('')
  const [joinCode, setJoinCode] = useState('')
  const [mode, setMode] = useState<'home' | 'join' | 'create'>('home')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  // ── Create a new room ──────────────────────────────────────────────────────
  async function handleCreate() {
    if (!name.trim()) { setError('Enter your name first'); return }
    setLoading(true)
    setError('')
    const supabase = createClient()

    const code = generateRoomCode()

    // 1. Insert room (host_id is a placeholder uuid we'll fill after player is created)
    const { data: room, error: roomErr } = await supabase
      .from('rooms')
      .insert({ code, host_id: '00000000-0000-0000-0000-000000000000', category: '' })
      .select()
      .single()

    if (roomErr || !room) {
      setError('Could not create room. Please try again.')
      setLoading(false)
      return
    }

    // 2. Insert host player
    const { data: player, error: playerErr } = await supabase
      .from('players')
      .insert({ room_id: room.id, name: name.trim(), is_host: true })
      .select()
      .single()

    if (playerErr || !player) {
      setError('Could not create player. Please try again.')
      setLoading(false)
      return
    }

    // 3. Update room with real host_id
    await supabase.from('rooms').update({ host_id: player.id }).eq('id', room.id)

    saveMyPlayerId(player.id)
    router.push(`/room/${code}`)
  }

  // ── Join an existing room ──────────────────────────────────────────────────
  async function handleJoin() {
    if (!name.trim()) { setError('Enter your name first'); return }
    if (!joinCode.trim()) { setError('Enter the room code'); return }
    setLoading(true)
    setError('')
    const supabase = createClient()

    const upperCode = joinCode.trim().toUpperCase()

    // Find room
    const { data: room, error: roomErr } = await supabase
      .from('rooms')
      .select('*')
      .eq('code', upperCode)
      .single()

    if (roomErr || !room) {
      setError('Room not found. Check the code and try again.')
      setLoading(false)
      return
    }

    if (room.status !== 'waiting') {
      setError('That game has already started.')
      setLoading(false)
      return
    }

    // Add player
    const { data: player, error: playerErr } = await supabase
      .from('players')
      .insert({ room_id: room.id, name: name.trim(), is_host: false })
      .select()
      .single()

    if (playerErr || !player) {
      setError('Could not join room. Please try again.')
      setLoading(false)
      return
    }

    saveMyPlayerId(player.id)
    router.push(`/room/${upperCode}`)
  }

  return (
    <main className="min-h-screen flex flex-col items-center justify-center px-4 py-12">

      {/* Logo */}
      <div className="mb-10 text-center">
        <div className="text-7xl mb-3">⚽</div>
        <h1 className="font-display text-6xl text-white tracking-widest">QUIZOUT</h1>
        <p className="text-green-300/70 mt-2 text-sm tracking-wide uppercase">
          Penalty shootout football trivia
        </p>
      </div>

      {/* Card */}
      <div className="card w-full max-w-sm p-6 space-y-4">

        {error && (
          <p className="text-red-400 text-sm text-center bg-red-500/10 border border-red-500/30 rounded-lg px-4 py-2">
            {error}
          </p>
        )}

        {/* Name input — always visible */}
        <div>
          <label className="text-xs uppercase tracking-widest text-green-300/60 mb-1 block">
            Your name
          </label>
          <input
            type="text"
            value={name}
            onChange={e => setName(e.target.value)}
            placeholder="e.g. Gary Lineker"
            maxLength={20}
            className="w-full bg-white/10 border border-white/20 rounded-xl px-4 py-3
                       text-white placeholder-white/30 focus:outline-none focus:border-amber-400
                       transition-colors"
          />
        </div>

        {/* Mode: home → show two buttons */}
        {mode === 'home' && (
          <div className="space-y-3 pt-2">
            <button
              onClick={() => setMode('create')}
              className="w-full bg-amber-500 hover:bg-amber-400 active:scale-95
                         text-pitch-dark font-semibold py-3 rounded-xl
                         transition-all duration-200 font-display text-xl tracking-widest"
            >
              CREATE ROOM
            </button>
            <button
              onClick={() => setMode('join')}
              className="w-full bg-white/10 hover:bg-white/20 active:scale-95
                         text-white font-semibold py-3 rounded-xl border border-white/20
                         transition-all duration-200 font-display text-xl tracking-widest"
            >
              JOIN ROOM
            </button>
          </div>
        )}

        {/* Mode: join */}
        {mode === 'join' && (
          <div className="space-y-3 pt-2">
            <div>
              <label className="text-xs uppercase tracking-widest text-green-300/60 mb-1 block">
                Room code
              </label>
              <input
                type="text"
                value={joinCode}
                onChange={e => setJoinCode(e.target.value.toUpperCase())}
                placeholder="e.g. XQ4K7R"
                maxLength={6}
                className="w-full bg-white/10 border border-white/20 rounded-xl px-4 py-3
                           text-white placeholder-white/30 focus:outline-none focus:border-amber-400
                           transition-colors font-mono text-lg tracking-widest text-center"
              />
            </div>
            <button
              onClick={handleJoin}
              disabled={loading}
              className="w-full bg-amber-500 hover:bg-amber-400 active:scale-95 disabled:opacity-50
                         text-pitch-dark font-semibold py-3 rounded-xl
                         transition-all duration-200 font-display text-xl tracking-widest"
            >
              {loading ? 'JOINING…' : 'JOIN GAME'}
            </button>
            <button
              onClick={() => { setMode('home'); setError('') }}
              className="w-full text-white/40 hover:text-white/70 text-sm transition-colors"
            >
              ← Back
            </button>
          </div>
        )}

        {/* Mode: create — confirm screen */}
        {mode === 'create' && (
          <div className="space-y-3 pt-2">
            <button
              onClick={handleCreate}
              disabled={loading}
              className="w-full bg-amber-500 hover:bg-amber-400 active:scale-95 disabled:opacity-50
                         text-pitch-dark font-semibold py-3 rounded-xl
                         transition-all duration-200 font-display text-xl tracking-widest"
            >
              {loading ? 'CREATING…' : 'START A ROOM'}
            </button>
            <button
              onClick={() => { setMode('home'); setError('') }}
              className="w-full text-white/40 hover:text-white/70 text-sm transition-colors"
            >
              ← Back
            </button>
          </div>
        )}
      </div>

      <p className="mt-8 text-white/20 text-xs text-center">
        Share the room code with friends to play together
      </p>
    </main>
  )
}
