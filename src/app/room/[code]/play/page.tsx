'use client'

import { useEffect, useState, useCallback, useRef } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { createClient } from '@/lib/supabase'
import { getMyPlayerId } from '@/lib/utils'
import type { Room, Player, Question, Answer } from '@/types'
import { CATEGORIES } from '@/types'
import { playGoal, playMiss, playApproach, playWhistle, playWinner, playTick, preloadSounds } from '@/lib/sounds'

function GoalDot({ state }: { state: 'goal' | 'miss' | 'pending' }) {
  return (
    <span className={`goal-dot ${state}`}>
      {state === 'goal' ? '⚽' : state === 'miss' ? '✕' : '·'}
    </span>
  )
}

function Scoreboard({ players, answers, questions, revealedSlots }:
  { players: Player[]; answers: Answer[]; questions: Question[]; revealedSlots: Set<string> }) {
  return (
    <div className="space-y-2">
      {[...players].sort((a, b) => b.score - a.score).map(p => {
        const dots = Array.from({ length: Math.max(questions.length, 5) }, (_, qi) => {
          if (!revealedSlots.has(`${p.id}:${qi}`)) return 'pending' as const
          const ans = answers.find(a => a.player_id === p.id && a.question_index === qi)
          if (!ans) return 'miss' as const
          const q = questions[qi]
          return ans.chosen_index === q.correct_index ? 'goal' as const : 'miss' as const
        })
        const visibleScore = dots.filter(d => d === 'goal').length
        return (
          <div key={p.id} className="score-row">
            <span className="text-white text-sm font-medium truncate mr-3">{p.name}</span>
            <div className="flex items-center gap-1.5 shrink-0">
              {dots.map((d, i) => <GoalDot key={i} state={d} />)}
              <span className="ml-2 text-amber-400 font-bold text-sm">{visibleScore}</span>
            </div>
          </div>
        )
      })}
    </div>
  )
}

// ── Situational commentary picker ────────────────────────────────────────
const getSituationalLines = (
  player: Player,
  players: Player[],
  revealedSlots: Set<string>,
  answers: Answer[],
  questions: Question[],
  questionIdx: number
) => {
  const seed = player.id.charCodeAt(0) + questionIdx * 13
  const approachLine = APPROACH_LINES[seed % APPROACH_LINES.length](player.name)

  // Work out situation before this shot
  const playerGoals = Array.from({ length: questionIdx }, (_, i) => {
    if (!revealedSlots.has(`${player.id}:${i}`)) return false
    const ans = answers.find(a => a.player_id === player.id && a.question_index === i)
    return ans && questions[i] && ans.chosen_index === questions[i].correct_index
  }).filter(Boolean).length

  const otherStats = players
    .filter(p => p.id !== player.id)
    .map(p => {
      let goals = 0
      for (let i = 0; i < questionIdx; i++) {
        if (!revealedSlots.has(`${p.id}:${i}`)) continue
        const ans = answers.find(a => a.player_id === p.id && a.question_index === i)
        if (ans && questions[i] && ans.chosen_index === questions[i].correct_index) goals++
      }
      const remaining = 5 - questionIdx
      return { goals, maxPossible: goals + remaining }
    })

  const maxOtherMax = Math.max(...otherStats.map(s => s.maxPossible), 0)
  const maxOtherGoals = Math.max(...otherStats.map(s => s.goals), 0)
  const isLeading = playerGoals > maxOtherGoals
  const canWinNow = playerGoals + 1 > maxOtherMax // scoring would make them unbeatable
  const mustScoreToKeepUp = otherStats.some(s => s.goals > playerGoals + (5 - questionIdx - 1))

  let nervesLine: string
  if (canWinNow) {
    nervesLine = CLINCHING_LINES[seed % CLINCHING_LINES.length](player.name)
  } else if (mustScoreToKeepUp) {
    nervesLine = MUST_SCORE_LINES[seed % MUST_SCORE_LINES.length](player.name)
  } else {
    nervesLine = NERVES_LINES[seed % NERVES_LINES.length](player.name)
  }

  return { approachLine, nervesLine }
}



// ── Early win detection ────────────────────────────────────────────────────
// Returns winning player if someone is mathematically unbeatable, else null
function checkForUnbeatableWinner(
  players: Player[],
  revealedSlots: Set<string>,
  answers: Answer[],
  questions: Question[],
  totalPenalties = 5
): Player | null {
  const stats = players.map(p => {
    let goals = 0
    let revealed = 0
    for (let qi = 0; qi < totalPenalties; qi++) {
      if (revealedSlots.has(`${p.id}:${qi}`)) {
        revealed++
        const ans = answers.find(a => a.player_id === p.id && a.question_index === qi)
        if (ans && questions[qi] && ans.chosen_index === questions[qi].correct_index) goals++
      }
    }
    const remaining = totalPenalties - revealed
    return { player: p, goals, remaining, maxPossible: goals + remaining }
  })

  // Find the player with the highest current goals
  const maxGoals = Math.max(...stats.map(s => s.goals))
  const leaders = stats.filter(s => s.goals === maxGoals)

  // Winner only if exactly one leader AND their current goals beat every
  // other player's maximum possible score
  if (leaders.length !== 1) return null
  const leader = leaders[0]
  const canBeCaught = stats
    .filter(s => s.player.id !== leader.player.id)
    .some(s => s.maxPossible >= leader.goals)

  return canBeCaught ? null : leader.player
}


// ── Commentary pools (module-level so they are stable references) ─────────
const APPROACH_LINES = [
  (name: string) => `${name} steps up to take the penalty…`,
  (name: string) => `${name} places the ball on the spot…`,
  (name: string) => `${name} takes a deep breath and walks back…`,
  (name: string) => `${name} stares down the goalkeeper…`,
  (name: string) => `All eyes on ${name}…`,
  (name: string) => `${name} picks their spot…`,
]
// Nerves lines are outcome-neutral — could score OR miss from any of these
const NERVES_LINES = [
  (name: string) => `${name} looks ice cold. Composure personified.`,
  (name: string) => `${name} looks nervous. Very nervous.`,
  (name: string) => `${name} shows no nerves whatsoever.`,
  (name: string) => `You can see the doubt in ${name}'s eyes…`,
  (name: string) => `Confidence written all over ${name}'s face.`,
  (name: string) => `${name} is sweating. Can they hold it together?`,
  (name: string) => `${name} steps up like they've done this a thousand times.`,
  (name: string) => `The pressure is getting to ${name}…`,
  (name: string) => `Cool as you like from ${name}.`,
  (name: string) => `${name} hesitates. Not a good sign.`,
]
// High-stakes lines for must-score moments
const MUST_SCORE_LINES = [
  (name: string) => `This is for the win — ${name} has to score here.`,
  (name: string) => `If ${name} misses, it could all be over.`,
  (name: string) => `Everything on the line for ${name}…`,
  (name: string) => `${name} has to keep their nerve right now.`,
  (name: string) => `Can ${name} hold it together when it matters most?`,
]
// Clinching lines — leader about to seal it
const CLINCHING_LINES = [
  (name: string) => `${name} can seal this right here.`,
  (name: string) => `Score this and ${name} wins it.`,
  (name: string) => `This could be the winning penalty…`,
  (name: string) => `One more for ${name} and it's all over.`,
  (name: string) => `The moment of truth for ${name}.`,
]

export default function PlayPage() {
  const router = useRouter()
  const params = useParams()
  const code = (params.code as string).toUpperCase()

  const [room, setRoom] = useState<Room | null>(null)
  const [players, setPlayers] = useState<Player[]>([])
  // mainQuestions = the 5 used in the main game
  // sdQuestions = separate pool for sudden death
  const [mainQuestions, setMainQuestions] = useState<Question[]>([])
  const [sdQuestions, setSdQuestions] = useState<Question[]>([])
  const [answers, setAnswers] = useState<Answer[]>([])
  const [sdAnswers, setSdAnswers] = useState<Answer[]>([])
  const [myPlayer, setMyPlayer] = useState<Player | null>(null)
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null)
  const [submitted, setSubmitted] = useState(false)
  const [revealUpTo, setRevealUpTo] = useState(0)
  const [revealingPlayer, setRevealingPlayer] = useState(0)
  const [isRevealing, setIsRevealing] = useState(false)
  // Track which individual player+question slots have been revealed for the scoreboard
  const [revealedSlots, setRevealedSlots] = useState<Set<string>>(new Set())
  // Commentary stages for the reveal animation
  type RevealStage =
    | { phase: 'approach'; playerName: string; line: string }
    | { phase: 'nerves';   playerName: string; line: string }
    | { phase: 'shot';     playerName: string; result: 'goal' | 'miss' }
    | { phase: 'breakdown'; playerName: string; result: 'goal' | 'miss'; question: string; correctAnswer: string; chosenAnswer: string }
    | null
  const [revealStage, setRevealStage] = useState<RevealStage>(null)
  const revealTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const roomRef = useRef<Room | null>(null)
  const playersRef = useRef<Player[]>([])
  const answersRef = useRef<Answer[]>([])
  const mainQRef = useRef<Question[]>([])
  const sdQRef = useRef<Question[]>([])
  const myPlayerRef = useRef<Player | null>(null)
  const advancingRef = useRef(false)
  const sdAnswersRef = useRef<Answer[]>([])
  const isSuddenDeathRef = useRef(false)
  const myId = getMyPlayerId()

  useEffect(() => { roomRef.current = room }, [room])
  useEffect(() => { playersRef.current = players }, [players])
  useEffect(() => { answersRef.current = answers }, [answers])
  useEffect(() => { mainQRef.current = mainQuestions }, [mainQuestions])
  useEffect(() => { sdQRef.current = sdQuestions }, [sdQuestions])
  useEffect(() => { myPlayerRef.current = myPlayer }, [myPlayer])
  useEffect(() => { sdAnswersRef.current = sdAnswers }, [sdAnswers])

  const [earlyWinner, setEarlyWinner] = useState<Player | null>(null)

  // ── Advance logic ─────────────────────────────────────────────────────────
  const checkAndAdvance = useCallback(async () => {
    const room = roomRef.current
    const players = playersRef.current
    const mainQuestions = mainQRef.current
    const sdQuestions = sdQRef.current
    const myPlayer = myPlayerRef.current

    if (!room || !myPlayer?.is_host || advancingRef.current) return
    if (room.status !== 'questions' && room.status !== 'sudden_death') return

    const qi = room.current_question_index
    const supabase = createClient()

    // Always fetch fresh answers from DB to avoid race conditions
    const { data: freshAnswers } = await supabase
      .from('answers')
      .select('*')
      .eq('room_id', room.id)
      .eq('question_index', qi)

    if (!freshAnswers) return
    const answeredIds = freshAnswers.map(a => a.player_id)
    const allAnswered = players.every(p => answeredIds.includes(p.id))
    if (!allAnswered) return
    if (advancingRef.current) return
    advancingRef.current = true

    if (room.status === 'sudden_death') {
      const safeQi = sdQuestions.length > 0 ? qi % sdQuestions.length : 0
      const q = sdQuestions[safeQi]
      if (!q) { advancingRef.current = false; return }

      const rightAnswers = freshAnswers.filter(a => a.chosen_index === q.correct_index)
      const wrongAnswers = freshAnswers.filter(a => a.chosen_index !== q.correct_index)

      if (rightAnswers.length === 1 && wrongAnswers.length > 0) {
        const winner = players.find(p => p.id === rightAnswers[0].player_id)
        if (winner) {
          await supabase.from('players').update({ score: winner.score + 1 }).eq('id', winner.id)
        }
        await supabase.from('rooms').update({ status: 'results' }).eq('id', room.id)
      } else {
        await supabase.from('answers').delete().eq('room_id', room.id)
        await supabase.from('rooms')
          .update({ current_question_index: qi + 1 })
          .eq('id', room.id)
      }
      advancingRef.current = false
      return
    }

    // Main game
    const { data: allAnswers } = await supabase
      .from('answers')
      .select('*')
      .eq('room_id', room.id)
    if (!allAnswers) { advancingRef.current = false; return }

    const nextIdx = qi + 1
    if (nextIdx >= mainQuestions.length) {
      for (const player of players) {
        let score = 0
        for (let i = 0; i < mainQuestions.length; i++) {
          const ans = allAnswers.find(a => a.player_id === player.id && a.question_index === i)
          if (ans && ans.chosen_index === mainQuestions[i].correct_index) score++
        }
        await supabase.from('players').update({ score }).eq('id', player.id)
      }
      await supabase.from('rooms').update({ status: 'reveal' }).eq('id', room.id)
    } else {
      await supabase.from('rooms')
        .update({ current_question_index: nextIdx })
        .eq('id', room.id)
    }
    // Reset immediately — the room UPDATE event will fire on this client too,
    // and we clear it there as well for belt-and-braces
    advancingRef.current = false
  }, [])

  // Preload sounds as soon as page mounts
  useEffect(() => { preloadSounds() }, [])

  // ── Initial load ──────────────────────────────────────────────────────────
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

      // Load 15 questions — first 5 for main game, next 10 for sudden death
      const { data: allQ } = await supabase
        .from('questions')
        .select('*')
        .eq('category', roomData.category)
        .limit(15)
      if (allQ) {
        setMainQuestions(allQ.slice(0, 5))
        setSdQuestions(allQ.slice(5))
      }

      const { data: answersData } = await supabase
        .from('answers').select('*').eq('room_id', roomData.id)
      if (answersData) {
        setAnswers(answersData)
        const myAnswer = answersData.find(
          a => a.player_id === myId && a.question_index === roomData.current_question_index
        )
        if (myAnswer) { setSubmitted(true); setSelectedIndex(myAnswer.chosen_index) }
      }
    }

    load()

    const channel = supabase
      .channel(`play:${code}`)
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'rooms', filter: `code=eq.${code}` },
        payload => {
          const updated = payload.new as Room
          const prev = roomRef.current
          // Reset advancing flag whenever question index changes so next question is never blocked
          if (prev && updated.current_question_index !== prev.current_question_index) {
            advancingRef.current = false
          }
          setRoom(updated)
          // When sudden death starts OR advances to next question, clear local SD answer state
          if (updated.status === 'sudden_death') {
            const prev = roomRef.current
            const isNewSuddenDeath = prev?.status !== 'sudden_death'
            const isNextQuestion = prev?.status === 'sudden_death' && updated.current_question_index !== prev.current_question_index
            if (isNewSuddenDeath || isNextQuestion) {
              setSdAnswers([])
              sdAnswersRef.current = []
              setSubmitted(false)
              setSelectedIndex(null)
              advancingRef.current = false
            }
            isSuddenDeathRef.current = true
            if (isNewSuddenDeath) setAnswers([])
          }
          if (updated.status === 'results' || updated.status === 'reveal') {
            isSuddenDeathRef.current = false
          }
          // Host triggered Play Again — send everyone back to the lobby
          if (updated.status === 'waiting') {
            router.push(`/room/${code}`)
          }
        }
      )
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'answers' },
        payload => {
          const newAnswer = payload.new as Answer
          if (isSuddenDeathRef.current) {
            setSdAnswers(prev => {
              if (prev.some(x => x.id === newAnswer.id)) return prev
              const updated = [...prev, newAnswer]
              checkAndAdvance()
              return updated
            })
          } else {
            setAnswers(prev => {
              if (prev.some(x => x.id === newAnswer.id)) return prev
              const updated = [...prev, newAnswer]
              checkAndAdvance()
              return updated
            })
          }
        }
      )
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'players' },
        payload => {
          const updated = payload.new as Player
          setPlayers(prev => prev.map(p => p.id === updated.id ? updated : p))
          if (updated.id === myId) setMyPlayer(updated)
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
      if (revealTimer.current) clearTimeout(revealTimer.current)
    }
  }, [code, myId, router, checkAndAdvance])

  // ── Reset submission when question changes ────────────────────────────────
  useEffect(() => {
    if (!room || !myId) return
    const myAnswer = answersRef.current.find(
      a => a.player_id === myId && a.question_index === room.current_question_index
    )
    if (myAnswer) { setSubmitted(true); setSelectedIndex(myAnswer.chosen_index) }
    else { setSubmitted(false); setSelectedIndex(null) }
  }, [room?.current_question_index, room?.status, myId, room])

  // ── Reveal animation ──────────────────────────────────────────────────────
  const runRevealAnimation = useCallback((questionIdx: number, playerIdx: number) => {
    const players = playersRef.current
    const questions = mainQRef.current
    const answers = answersRef.current

    if (questionIdx >= questions.length) return

    if (playerIdx >= players.length) {
      // All players revealed for this question — check early win before moving on
      setRevealUpTo(questionIdx + 1)
      revealTimer.current = setTimeout(() => runRevealAnimation(questionIdx + 1, 0), 1400)
      return
    }

    setRevealingPlayer(playerIdx)
    const player = players[playerIdx]
    const q = questions[questionIdx]
    const ans = answers.find(a => a.player_id === player.id && a.question_index === questionIdx)
    const isGoal = ans ? ans.chosen_index === q.correct_index : false
    const chosenAnswer = ans !== undefined && ans.chosen_index >= 0
      ? q.options[ans.chosen_index] : 'No answer'

    // Get current revealedSlots snapshot for situational commentary
    // (before this shot is revealed)
    const currentSlots = new Set(Array.from({ length: questionIdx }, (_, i) =>
      players.map(p => `${p.id}:${i}`)
    ).flat().concat(
      players.slice(0, playerIdx).map(p => `${p.id}:${questionIdx}`)
    ))

    const { approachLine, nervesLine } = getSituationalLines(
      player, players, currentSlots, answers, questions, questionIdx
    )

    // Stage 1: Approach
    setRevealStage({ phase: 'approach', playerName: player.name, line: approachLine })
    playApproach()

    revealTimer.current = setTimeout(() => {
      // Stage 2: Nerves
      setRevealStage({ phase: 'nerves', playerName: player.name, line: nervesLine })

      revealTimer.current = setTimeout(() => {
        // Stage 3: The shot result + scoreboard dot
        setRevealStage({ phase: 'shot', playerName: player.name, result: isGoal ? 'goal' : 'miss' })
        if (isGoal) playGoal(); else playMiss()

        // Add dot and check for early win
        setRevealedSlots(prev => {
          const next = new Set(prev).add(`${player.id}:${questionIdx}`)

          // Check unbeatable winner after this dot
          const winner = checkForUnbeatableWinner(players, next, answers, questions, 5)
          if (winner) {
            // Delay slightly so the shot result is seen first
            setTimeout(() => setEarlyWinner(winner), 2000)
          }

          return next
        })

        revealTimer.current = setTimeout(() => {
          // Stage 4: Question breakdown
          setRevealStage({
            phase: 'breakdown',
            playerName: player.name,
            result: isGoal ? 'goal' : 'miss',
            question: q.question,
            correctAnswer: q.options[q.correct_index],
            chosenAnswer,
          })

          revealTimer.current = setTimeout(() => {
            setRevealStage(null)
            // Check earlyWinner before continuing — if set, stop the sequence
            setEarlyWinner(prev => {
              if (prev) return prev // stop here, earlyWinner UI will take over
              revealTimer.current = setTimeout(
                () => runRevealAnimation(questionIdx, playerIdx + 1), 500
              )
              return null
            })
          }, 2500)
        }, 1800)
      }, 1500)
    }, 1500)
  }, [])

  // Play winner fanfare when results screen appears
  useEffect(() => {
    if (room?.status === 'results') playWinner()
  }, [room?.status])

  useEffect(() => {
    if (room?.status !== 'reveal') return
    if (isRevealing) return
    setIsRevealing(true)
    setRevealUpTo(0)
    setRevealingPlayer(0)
    setRevealedSlots(new Set())
    setRevealStage(null)
    playWhistle()
    setTimeout(() => runRevealAnimation(0, 0), 800)
  }, [room?.status, isRevealing, runRevealAnimation])

  // ── Submit answer ────────────────────────────────────────────────────────
  async function handleAnswer(idx: number) {
    if (submitted || !room || !myPlayer) return
    setSelectedIndex(idx)
    setSubmitted(true)
    playTick()
    // Preload sounds on first interaction so they are ready for the reveal
    preloadSounds()
    const supabase = createClient()
    const questions = room.status === 'sudden_death' ? sdQuestions : mainQuestions
    const qIndex = room.status === 'sudden_death' && questions.length > 0
      ? room.current_question_index % questions.length
      : room.current_question_index
    const q = questions[qIndex]
    if (!q) return
    await supabase.from('answers').insert({
      room_id: room.id,
      player_id: myPlayer.id,
      question_id: q.id,
      question_index: room.current_question_index,
      chosen_index: idx,
    })
  }

  // ── Host: finish reveal ───────────────────────────────────────────────────
  async function handleFinishReveal() {
    if (!room || !myPlayer?.is_host) return
    const supabase = createClient()
    const maxScore = Math.max(...players.map(p => p.score))
    const topPlayers = players.filter(p => p.score === maxScore)
    if (topPlayers.length > 1) {
      // Clear answers so sudden death can use fresh indices
      await supabase.from('answers').delete().eq('room_id', room.id)
      setAnswers([])
      await supabase.from('rooms')
        .update({ status: 'sudden_death', current_question_index: 0 })
        .eq('id', room.id)
    } else {
      await supabase.from('rooms').update({ status: 'results' }).eq('id', room.id)
    }
  }

  // ── Play again: reset room for a rematch ─────────────────────────────────
  async function handlePlayAgain() {
    if (!room || !myPlayer?.is_host) return
    const supabase = createClient()
    // Delete all answers for this room
    await supabase.from('answers').delete().eq('room_id', room.id)
    // Reset all player scores
    for (const player of players) {
      await supabase.from('players').update({ score: 0 }).eq('id', player.id)
    }
    // Reset room back to waiting so host can pick a new category
    await supabase.from('rooms').update({
      status: 'waiting',
      category: '',
      current_question_index: 0,
    }).eq('id', room.id)
    router.push(`/room/${code}`)
  }

  // ─── Render ───────────────────────────────────────────────────────────────

  if (!room || mainQuestions.length === 0) {
    return (
      <main className="min-h-screen flex items-center justify-center">
        <div className="text-white/40 text-sm animate-pulse">Loading game…</div>
      </main>
    )
  }

  const status = room.status
  const qi = room.current_question_index
  const isSuddenDeath = status === 'sudden_death'
  const activeQuestions = isSuddenDeath ? sdQuestions : mainQuestions
  const safeQi = isSuddenDeath && sdQuestions.length > 0 ? qi % sdQuestions.length : qi
  const currentQuestion = activeQuestions[safeQi]
  const isHost = myPlayer?.is_host ?? false
  const answeredCount = answers.filter(a => a.question_index === qi).length
  const categoryLabel = CATEGORIES.find(c => c.value === room.category)?.label ?? room.category

  // ── QUESTIONS phase ───────────────────────────────────────────────────────
  if (status === 'questions') {
    return (
      <main className="min-h-screen flex flex-col items-center px-4 py-10">
        <div className="w-full max-w-sm space-y-5">
          <div className="flex items-center justify-between">
            <span className="text-xs text-green-300/50 uppercase tracking-widest">{categoryLabel}</span>
            <span className="text-xs text-white/40">Question {qi + 1} / {mainQuestions.length}</span>
          </div>
          <div className="h-1 bg-white/10 rounded-full overflow-hidden">
            <div className="h-full bg-amber-400 transition-all duration-700"
              style={{ width: `${((qi + 1) / mainQuestions.length) * 100}%` }} />
          </div>
          <div className="card p-5">
            <p className="text-white text-base leading-relaxed text-center">{currentQuestion?.question}</p>
          </div>
          <div className="space-y-3">
            {currentQuestion?.options.map((opt, i) => (
              <button key={i} onClick={() => handleAnswer(i)} disabled={submitted}
                className={`answer-btn ${submitted && selectedIndex === i ? 'selected' : ''} ${submitted ? 'cursor-not-allowed' : ''}`}>
                <span className="text-xs text-white/40 mr-2">{String.fromCharCode(65 + i)}.</span>
                {opt}
              </button>
            ))}
          </div>
          {submitted && (
            <div className="card p-4 text-center">
              <p className="text-white/60 text-sm">Answer locked ⚽ — waiting for others…</p>
              <p className="text-white/30 text-xs mt-1">{answeredCount} / {players.length} answered</p>
            </div>
          )}
        </div>
      </main>
    )
  }

  // ── REVEAL phase ──────────────────────────────────────────────────────────
  if (status === 'reveal') {
    const isDone = revealUpTo >= mainQuestions.length && !revealStage && !earlyWinner
    const maxScore = Math.max(...players.map(p => p.score))
    const isTied = players.filter(p => p.score === maxScore).length > 1

    return (
      <main className="min-h-screen flex flex-col items-center px-4 py-10">
        <div className="w-full max-w-sm flex flex-col gap-4">
          <h2 className="font-display text-4xl text-white text-center tracking-widest">PENALTY SHOOTOUT</h2>

          {/* ── Commentary card (top, changes) ── */}
          {earlyWinner ? (
            <div className="card p-6 text-center border-amber-400/60 bg-amber-500/10 animate-bounce-in">
              <div className="text-5xl mb-3">🏆</div>
              <p className="font-display text-4xl tracking-widest text-amber-400">
                GAME OVER!
              </p>
              <p className="text-white font-semibold mt-2">{earlyWinner.name} wins!</p>
              <p className="text-white/50 text-sm mt-3 italic">
                That seals it. No need for the remaining penalties.
              </p>
            </div>
          ) : revealStage ? (
            <div className={`card p-6 animate-slide-up ${
              revealStage.phase === 'shot' || revealStage.phase === 'breakdown'
                ? revealStage.result === 'goal'
                  ? 'border-green-400/60 bg-green-500/10'
                  : 'border-red-400/60 bg-red-500/10'
                : 'border-white/20'
            }`}>
              {/* Stage 1 & 2: Commentary */}
              {(revealStage.phase === 'approach' || revealStage.phase === 'nerves') && (
                <div className="text-center space-y-3 py-2">
                  <div className="text-4xl">
                    {revealStage.phase === 'approach' ? '🎙️' : '👀'}
                  </div>
                  <p className="text-white text-lg leading-relaxed font-medium">
                    {revealStage.line}
                  </p>
                  <p className="text-white/30 text-xs uppercase tracking-widest animate-pulse">
                    {revealStage.phase === 'approach' ? 'The run up…' : 'The moment of truth…'}
                  </p>
                </div>
              )}
              {/* Stage 3: Shot result */}
              {revealStage.phase === 'shot' && (
                <div className="text-center space-y-2 py-2">
                  <div className="text-6xl animate-bounce-in">
                    {revealStage.result === 'goal' ? '⚽' : '🧤'}
                  </div>
                  <p className="font-display text-5xl tracking-widest text-white">
                    {revealStage.result === 'goal' ? 'GOAL!' : 'SAVED!'}
                  </p>
                  <p className="text-white/50 text-sm">
                    {revealStage.result === 'goal'
                      ? `${revealStage.playerName} scores!`
                      : `${revealStage.playerName} missed!`}
                  </p>
                </div>
              )}
              {/* Stage 4: Breakdown */}
              {revealStage.phase === 'breakdown' && (
                <div className="space-y-4">
                  <div className="text-center">
                    <span className="text-2xl">{revealStage.result === 'goal' ? '⚽' : '🧤'}</span>
                    <p className="text-white/60 text-sm mt-1">{revealStage.playerName}</p>
                  </div>
                  <div className="border-t border-white/10 pt-3 space-y-2">
                    <p className="text-white/70 text-xs leading-relaxed text-center italic">
                      "{revealStage.question}"
                    </p>
                    <div className="space-y-1.5 pt-1">
                      <div className="flex items-start gap-2 bg-green-500/10 rounded-lg px-3 py-2">
                        <span className="text-green-400 text-xs shrink-0 font-bold">✓</span>
                        <span className="text-green-300 text-xs">{revealStage.correctAnswer}</span>
                      </div>
                      {revealStage.result === 'miss' && (
                        <div className="flex items-start gap-2 bg-red-500/10 rounded-lg px-3 py-2">
                          <span className="text-red-400 text-xs shrink-0 font-bold">✗</span>
                          <span className="text-red-300 text-xs">{revealStage.playerName}: {revealStage.chosenAnswer}</span>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="card p-4 text-center">
              <p className="text-white/30 text-sm animate-pulse">
                {revealUpTo < mainQuestions.length ? 'Next up…' : 'All done!'}
              </p>
            </div>
          )}

          {/* ── Scoreboard (always here, always visible) ── */}
          <div className="card p-5">
            <h3 className="text-xs uppercase tracking-widest text-green-300/60 mb-3">Scoreboard</h3>
            <Scoreboard players={players} answers={answers} questions={mainQuestions} revealedSlots={revealedSlots} />
          </div>

          {/* ── Action buttons ── */}
          {earlyWinner && isHost && (
            <button onClick={handleFinishReveal}
              className="w-full bg-amber-500 hover:bg-amber-400 active:scale-95
                         text-pitch-dark font-semibold py-4 rounded-xl
                         transition-all duration-200 font-display text-2xl tracking-widest">
              SEE RESULTS →
            </button>
          )}

          {isDone && (
            isHost ? (
              <button onClick={handleFinishReveal}
                className="w-full bg-amber-500 hover:bg-amber-400 active:scale-95
                           text-pitch-dark font-semibold py-4 rounded-xl
                           transition-all duration-200 font-display text-2xl tracking-widest">
                {isTied ? 'SUDDEN DEATH ⚡' : 'SEE RESULTS →'}
              </button>
            ) : (
              <div className="card p-4 text-center">
                {isTied
                  ? <p className="text-amber-400 font-display text-xl tracking-widest animate-pulse">⚡ IT'S A TIE — SUDDEN DEATH INCOMING!</p>
                  : <p className="text-white/50 text-sm animate-pulse">Waiting for host…</p>
                }
              </div>
            )
          )}
        </div>
      </main>
    )
  }

  // ── SUDDEN DEATH phase ────────────────────────────────────────────────────
  if (status === 'sudden_death') {
    const tiedPlayers = players.filter(p => p.score === Math.max(...players.map(x => x.score)))
    return (
      <main className="min-h-screen flex flex-col items-center px-4 py-10">
        <div className="w-full max-w-sm space-y-5">
          <div className="text-center card p-5 border-amber-400/40">
            <div className="text-4xl mb-2">⚡</div>
            <h2 className="font-display text-4xl text-amber-400 tracking-widest">SUDDEN DEATH</h2>
            <p className="text-white/60 text-sm mt-2">{tiedPlayers.map(p => p.name).join(' vs ')} are tied!</p>
            <p className="text-white/40 text-xs mt-1">First correct answer wins</p>
          </div>
          {currentQuestion ? (
            <>
              <div className="card p-5">
                <p className="text-white text-base leading-relaxed text-center">{currentQuestion.question}</p>
              </div>
              <div className="space-y-3">
                {currentQuestion.options.map((opt, i) => (
                  <button key={i} onClick={() => handleAnswer(i)} disabled={submitted}
                    className={`answer-btn ${submitted && selectedIndex === i ? 'selected' : ''}`}>
                    <span className="text-xs text-white/40 mr-2">{String.fromCharCode(65 + i)}.</span>
                    {opt}
                  </button>
                ))}
              </div>
              {submitted && (
                <div className="card p-4 text-center">
                  <p className="text-white/60 text-sm">Waiting for result…</p>
                </div>
              )}
            </>
          ) : (
            <div className="card p-4 text-center">
              <p className="text-white/40 text-sm">Loading question…</p>
            </div>
          )}
        </div>
      </main>
    )
  }

  // ── RESULTS phase ─────────────────────────────────────────────────────────
  if (status === 'results') {
    const sorted = [...players].sort((a, b) => b.score - a.score)
    const winner = sorted[0]
    const iWon = winner?.id === myId
    return (
      <main className="min-h-screen flex flex-col items-center justify-center px-4 py-10">
        <div className="w-full max-w-sm space-y-5 text-center">
          <div className="text-6xl">{iWon ? '🏆' : '⚽'}</div>
          <h2 className="font-display text-5xl text-white tracking-widest">
            {iWon ? 'YOU WIN!' : `${winner?.name} WINS!`}
          </h2>
          <div className="card p-5 text-left">
            <h3 className="text-xs uppercase tracking-widest text-green-300/60 mb-3">Final scores</h3>
            <div className="space-y-2">
              {sorted.map((p, i) => (
                <div key={p.id} className="score-row">
                  <div className="flex items-center gap-2">
                    <span className="text-white/30 text-xs w-4">{i + 1}</span>
                    <span className="text-white text-sm">{p.name}</span>
                    {i === 0 && <span className="text-xs">🏆</span>}
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    {Array.from({ length: 5 }, (_, qi) => {
                      const ans = answers.find(a => a.player_id === p.id && a.question_index === qi)
                      if (!ans) return <GoalDot key={qi} state="miss" />
                      return <GoalDot key={qi} state={ans.chosen_index === mainQuestions[qi]?.correct_index ? 'goal' : 'miss'} />
                    })}
                    <span className="ml-2 text-amber-400 font-bold">{p.score}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
          <div className="space-y-3">
            {isHost ? (
              <button onClick={handlePlayAgain}
                className="w-full bg-amber-500 hover:bg-amber-400 active:scale-95
                           text-pitch-dark font-semibold py-4 rounded-xl
                           transition-all duration-200 font-display text-2xl tracking-widest">
                PLAY AGAIN ⚽
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

  return null
}
