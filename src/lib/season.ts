import type { Player, Answer, Question, SeasonRow } from '@/types'

// ─── Calculate season table for a given number of revealed gameweeks ──────────

export function calculateSeasonTable(
  players: Player[],
  answers: Answer[],
  questions: Question[],
  revealedGameweeks: number,
  previousTable: SeasonRow[] = []
): SeasonRow[] {
  if (revealedGameweeks === 0) {
    // Pre-reveal: everyone on 0, ordered by join time
    return players.map((player, i) => ({
      player,
      position: i + 1,
      previousPosition: null,
      movement: 0,
      played: 0,
      wins: 0,
      losses: 0,
      points: 0,
      form: [],
    }))
  }

  // Build stats for each player up to revealedGameweeks
  const stats = players.map(player => {
    const form: ('W' | 'L')[] = []
    let wins = 0

    for (let gi = 0; gi < revealedGameweeks; gi++) {
      const ans = answers.find(
        a => a.player_id === player.id && a.question_index === gi
      )
      const q = questions[gi]
      if (ans && q && ans.chosen_index === q.correct_index) {
        wins++
        form.push('W')
      } else {
        form.push('L')
      }
    }

    const played = revealedGameweeks
    const losses = played - wins
    const points = wins * 3

    return { player, played, wins, losses, points, form }
  })

  // Sort: points desc → wins desc → previous position → join order
  const prevPositionMap = new Map(
    previousTable.map(row => [row.player.id, row.position])
  )
  const joinOrderMap = new Map(
    players.map((p, i) => [p.id, i])
  )

  stats.sort((a, b) => {
    if (b.points !== a.points) return b.points - a.points
    if (b.wins !== a.wins) return b.wins - a.wins
    // Tiebreak: previous position (lower = higher = better)
    const aPrev = prevPositionMap.get(a.player.id) ?? 999
    const bPrev = prevPositionMap.get(b.player.id) ?? 999
    if (aPrev !== bPrev) return aPrev - bPrev
    // Final fallback: join order
    return (joinOrderMap.get(a.player.id) ?? 0) - (joinOrderMap.get(b.player.id) ?? 0)
  })

  return stats.map((s, i) => {
    const newPosition = i + 1
    const prevPos = prevPositionMap.get(s.player.id) ?? null
    const movement = prevPos !== null ? prevPos - newPosition : 0 // positive = moved up

    return {
      player: s.player,
      position: newPosition,
      previousPosition: prevPos,
      movement,
      played: s.played,
      wins: s.wins,
      losses: s.losses,
      points: s.points,
      form: s.form,
    }
  })
}

// ─── Generate dramatic commentary for each gameweek reveal ───────────────────

export function getGameweekCommentary(
  table: SeasonRow[],
  gameweek: number,
  totalGameweeks: number
): string[] {
  const lines: string[] = []
  const remaining = totalGameweeks - gameweek

  lines.push(`Game ${gameweek} of ${totalGameweeks} results are in.`)

  // Leaders and movers
  const leader = table[0]
  const bigMover = [...table].sort((a, b) => Math.abs(b.movement) - Math.abs(a.movement))[0]

  if (leader.movement > 0) {
    lines.push(`${leader.player.name} climbs to the top of the table!`)
  } else if (leader.movement === 0 && gameweek > 1) {
    lines.push(`${leader.player.name} holds firm at the summit.`)
  }

  if (bigMover.movement >= 2) {
    lines.push(`${bigMover.player.name} rockets up ${bigMover.movement} places!`)
  } else if (bigMover.movement <= -2) {
    lines.push(`${bigMover.player.name} drops ${Math.abs(bigMover.movement)} places.`)
  }

  // Tension lines
  if (remaining === 0) {
    lines.push('The final whistle has gone.')
  } else if (remaining === 1) {
    lines.push('Everything to play for. One game remaining.')
  } else if (remaining === 2) {
    lines.push('Two games to go. Anyone can still win this.')
  } else if (remaining <= 4) {
    lines.push(`${remaining} games left. The pressure is building.`)
  }

  return lines
}
