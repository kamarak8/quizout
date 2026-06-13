'use client'

import { useEffect, useState, useRef } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { createClient } from '@/lib/supabase'
import { getMyPlayerId } from '@/lib/utils'
import { calculateSeasonTable, getGameweekCommentary } from '@/lib/season'
import { CATEGORIES } from '@/types'
import type { Room, Player, Question, Answer, SeasonRow } from '@/types'

const TOTAL_GAMES = 10

function MovementBadge({ movement }: { movement: number }) {
  if (movement > 0) return (
    <span className="text-green-400 text-xs font-bold w-8 text-center">▲{movement}</span>
  )
  if (movement < 0) return (
    <span className="text-red-400 text-xs font-bold w-8 text-center">▼{Math.abs(movement)}</span>
  )
  return <span className="text-white/30 text-xs font-bold w-8 text-center">—</span>
}

function FormGuide({ form }: { form: ('W' | 'L')[] }) {
  return (
    <div className="flex gap-0.5">
      {form.slice(-5).map((r, i) => (
        <span
          key={i}
          className={`text-xs font-bold px-1 py-0.5 rounded ${
            r === 'W'
              ? 'bg-green-500/30 text-green-300'
              : 'bg-red-500/30 text-red-300'
          }`}
        >
          {r}
        </span>
      ))}
    </div>
  )
}

function LeagueTable({ table, highlightRound }: { table: SeasonRow[]; highlightRound: number }) {
  return (
    <div className="space-y-1.5">
      {/* Header */}
      <div className="flex items-center gap-2 px-2 pb-1 border-b border-white/10">
        <span className="text-white/30 text-xs w-6">#</span>
        <span className="text-white/30 text-xs w-8"></span>
        <span className="text-white/30 text-xs flex-1">Player</span>
        <span className="text-white/30 text-xs w-6 text-center">P</span>
        <span className="text-white/30 text-xs w-6 text-center">W</span>
        <span className="text-white/30 text-xs w-6 text-center">L</span>
        <span className="text-white/30 text-xs w-8 text-center font-bold">PTS</span>
      </div>

      {table.map((row, i) => (
        <div
          key={row.player.id}
          className={`flex items-center gap-2 px-2 py-2.5 rounded-lg transition-all duration-500 ${
            i === 0
              ? 'bg-amber-400/10 border border-amber-400/30'
              : 'bg-white/5 border border-white/5'
          }`}
        >
          <span className={`text-sm font-bold w-6 text-center ${
            i === 0 ? 'text-amber-400' : 'text-white/50'
          }`}>
            {row.position}
          </span>
          <MovementBadge movement={row.movement} />
          <div className="flex-1 min-w-0">
            <p className={`text-sm font-medium truncate ${i === 0 ? 'text-white' : 'text-white/80'}`}>
              {row.player.name}
              {i === 0 && row.played > 0 && <span className="ml-1 text-amber-400">👑</span>}
            </p>
            {row.form.length > 0 && (
              <div className="mt-1">
                <FormGuide form={row.form} />
              </div>
            )}
          </div>
          <span className="text-white/50 text-xs w-6 text-center">{row.played}</span>
          <span className="text-green-400 text-xs w-6 text-center">{row.wins}</span>
          <span className="text-red-400 text-xs w-6 text-center">{row.losses}</span>
          <span className={`text-sm font-bold w-8 text-center ${
            i === 0 ? 'text-amber-400' : 'text-white'
          }`}>
            {row.points}
          </span>
        </div>
      ))}
    </div>
  )
}

export default function SeasonPage() {
  const router = useRouter()
  const params = useParams()
  const code = (params.code as string).toUpperCase()

  const [room, setRoom] = useState<Room | null>(null)
  const [players, setPlayers] = useState<Player[]>([])
  const [questions, setQuestions] = useState<Question[]>([])
  const [answers, setAnswers] = useState<Answer[]>([])
  const [myPlayer, setMyPlayer] = useState<Player | null>(null)
  const [table, setTable] = useState<SeasonRow[]>([])
  const [prevTable, setPrevTable] = useState<SeasonRow[]>([])
  const [commentary, setCommentary] = useState<string[]>([])
  const [commentaryIdx, setCommentaryIdx] = useState(0)
  const commentaryTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const [isAdvancing, setIsAdvancing] = useState(false)
  const [showChampion, setShowChampion] = useState(false)

  const myId = getMyPlayerId()

  useEffect(() => {
    if (!myId) { router.push('/'); return }
    const supabase = createClient()

    async function load() {
      const { data: roomData } = await supabase
        .from('rooms').select('*').eq('code', code).single()
      if (!roomData) { router.push('/'); return }
      setRoom(roomData)

      const { data: playersData } = await supabase
        .from('players').select('*').eq('room_id', roomData.id).order('created_at')
      if (playersData) {
        setPlayers(playersData)
        setMyPlayer(playersData.find(p => p.id === myId) ?? null)
      }

      const { data: questionsData } = await supabase
        .from('questions')
        .select('*')
        .eq('category', roomData.category)
        .limit(TOTAL_GAMES)
      if (questionsData) setQuestions(questionsData)

      const { data: answersData } = await supabase
        .from('answers').select('*').eq('room_id', roomData.id)
      if (answersData) setAnswers(answersData)

      // Build initial table from current reveal round
      const initialTable = calculateSeasonTable(
        playersData ?? [],
        answersData ?? [],
        questionsData ?? [],
        roomData.current_season_reveal_round,
        []
      )
      setTable(initialTable)

      if (roomData.status === 'finished') setShowChampion(true)
    }

    load()

    const channel = supabase
      .channel(`season:${code}`)
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'rooms', filter: `code=eq.${code}` },
        payload => {
          const updated = payload.new as Room
          setRoom(updated)
          if (updated.status === 'finished') {
            setTimeout(() => setShowChampion(true), 2000)
          }
        }
      )
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'players' },
        payload => {
          const p = payload.new as Player
          setPlayers(prev => prev.map(x => x.id === p.id ? p : x))
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
      if (commentaryTimer.current) clearTimeout(commentaryTimer.current)
    }
  }, [code, myId, router])

  // Rebuild table whenever reveal round changes
  useEffect(() => {
    if (!room || questions.length === 0) return
    const round = room.current_season_reveal_round
    const newTable = calculateSeasonTable(players, answers, questions, round, prevTable)

    if (round > 0) {
      const lines = getGameweekCommentary(newTable, round, TOTAL_GAMES)
      setCommentary(lines)
      setCommentaryIdx(0)
      // Cycle through commentary lines
      lines.forEach((_, i) => {
        commentaryTimer.current = setTimeout(() => setCommentaryIdx(i), i * 2000)
      })
    }

    setPrevTable(table)
    setTable(newTable)
    setIsAdvancing(false)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [room?.current_season_reveal_round])

  async function handleReveal() {
    if (!room || !myPlayer?.is_host || isAdvancing) return
    setIsAdvancing(true)
    const supabase = createClient()
    const nextRound = room.current_season_reveal_round + 1

    if (nextRound > TOTAL_GAMES) {
      // All revealed — end the season
      await supabase.from('rooms')
        .update({ status: 'finished' })
        .eq('id', room.id)
    } else {
      await supabase.from('rooms')
        .update({ current_season_reveal_round: nextRound })
        .eq('id', room.id)
    }
  }

  async function handlePlayAgain() {
    if (!room || !myPlayer?.is_host) return
    const supabase = createClient()
    await supabase.from('answers').delete().eq('room_id', room.id)
    for (const p of players) {
      await supabase.from('players').update({ score: 0 }).eq('id', p.id)
    }
    await supabase.from('rooms').update({
      status: 'waiting',
      category: '',
      current_question_index: 0,
      current_season_reveal_round: 0,
    }).eq('id', room.id)
    router.push(`/room/${code}`)
  }

  if (!room || questions.length === 0) {
    return (
      <main className="min-h-screen flex items-center justify-center">
        <div className="text-white/40 text-sm animate-pulse">Loading season…</div>
      </main>
    )
  }

  const round = room.current_season_reveal_round
  const isHost = myPlayer?.is_host ?? false
  const isFinished = room.status === 'finished'
  const categoryLabel = CATEGORIES.find(c => c.value === room.category)?.label ?? room.category
  const champion = table[0]?.player

  // ── CHAMPION SCREEN ───────────────────────────────────────────────────────
  if (showChampion && isFinished) {
    const iWon = champion?.id === myId
    return (
      <main className="min-h-screen flex flex-col items-center justify-center px-4 py-10">
        <div className="w-full max-w-sm space-y-5 text-center">
          <div className="text-6xl">🏆</div>
          <h2 className="font-display text-5xl text-amber-400 tracking-widest">
            CHAMPIONS!
          </h2>
          <p className="text-white text-xl font-semibold">
            {iWon ? 'You win the 10 Game Season!' : `${champion?.name} wins the 10 Game Season!`}
          </p>
          <p className="text-white/40 text-sm italic">
            After 10 games, {champion?.name} finishes top of the table.
          </p>

          <div className="card p-5 text-left">
            <h3 className="text-xs uppercase tracking-widest text-green-300/60 mb-3">Final Table</h3>
            <LeagueTable table={table} highlightRound={TOTAL_GAMES} />
          </div>

          <div className="space-y-3">
            {isHost ? (
              <button onClick={handlePlayAgain}
                className="w-full bg-amber-500 hover:bg-amber-400 active:scale-95
                           text-pitch-dark font-semibold py-4 rounded-xl
                           transition-all duration-200 font-display text-2xl tracking-widest">
                PLAY AGAIN 🏆
              </button>
            ) : (
              <div className="card p-4 text-center">
                <p className="text-amber-400 text-sm animate-pulse">⚽ Waiting for host to start a rematch…</p>
              </div>
            )}
            <button onClick={() => router.push('/')}
              className="w-full bg-white/10 hover:bg-white/20 active:scale-95
                         text-white font-semibold py-3 rounded-xl border border-white/20
                         transition-all duration-200 font-display text-xl tracking-widest">
              GO HOME
            </button>
          </div>
        </div>
      </main>
    )
  }

  // ── SEASON REVEAL SCREEN ──────────────────────────────────────────────────
  return (
    <main className="min-h-screen flex flex-col items-center px-4 py-10">
      <div className="w-full max-w-sm flex flex-col gap-4">

        {/* Header */}
        <div className="text-center">
          <p className="text-green-300/50 text-xs uppercase tracking-widest">{categoryLabel}</p>
          <h2 className="font-display text-4xl text-white tracking-widest mt-1">
            {round === 0 ? 'THE SEASON' : `GAME ${round} OF ${TOTAL_GAMES}`}
          </h2>
          {round > 0 && round < TOTAL_GAMES && (
            <p className="text-white/30 text-xs mt-1">
              {TOTAL_GAMES - round} game{TOTAL_GAMES - round !== 1 ? 's' : ''} remaining
            </p>
          )}
        </div>

        {/* Commentary card */}
        <div className="card p-5 min-h-[80px] flex flex-col justify-center">
          {round === 0 ? (
            <div className="text-center space-y-1">
              <p className="text-white font-semibold">The season is about to begin.</p>
              <p className="text-white/40 text-sm">Every player starts on 0 points.</p>
            </div>
          ) : commentary.length > 0 ? (
            <div className="text-center">
              <p className="text-white text-base leading-relaxed font-medium transition-all duration-500">
                {commentary[commentaryIdx] ?? commentary[0]}
              </p>
            </div>
          ) : (
            <p className="text-white/30 text-sm text-center animate-pulse">Calculating results…</p>
          )}
        </div>

        {/* League table */}
        <div className="card p-5">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-xs uppercase tracking-widest text-green-300/60">League Table</h3>
            {round > 0 && (
              <span className="text-xs text-white/30">After GW{round}</span>
            )}
          </div>
          <LeagueTable table={table} highlightRound={round} />
        </div>

        {/* Host controls / waiting */}
        {!isFinished && (
          isHost ? (
            <button
              onClick={handleReveal}
              disabled={isAdvancing}
              className="w-full bg-amber-500 hover:bg-amber-400 active:scale-95 disabled:opacity-50
                         text-pitch-dark font-semibold py-4 rounded-xl
                         transition-all duration-200 font-display text-xl tracking-widest"
            >
              {isAdvancing ? 'REVEALING…' :
                round === 0 ? 'START SEASON REVEAL 🏆' :
                round >= TOTAL_GAMES ? 'SHOW CHAMPION 🏆' :
                `REVEAL GAME ${round + 1} →`}
            </button>
          ) : (
            <div className="card p-4 text-center animate-pulse">
              <p className="text-white/50 text-sm">Waiting for host to reveal next game…</p>
            </div>
          )
        )}

        {isFinished && !showChampion && (
          <div className="card p-4 text-center animate-pulse">
            <p className="text-amber-400 text-sm">🏆 The final whistle has blown…</p>
          </div>
        )}
      </div>
    </main>
  )
}
