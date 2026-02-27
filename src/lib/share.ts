type ShareTextArgs = {
  puzzleId: number
  status: 'active' | 'solved' | 'failed'
  attemptsUsed: number
  score: number | null
  streak: number
}

const buildResultRow = (
  status: 'active' | 'solved' | 'failed',
  attemptsUsed: number,
  score: number | null,
): string => {
  if (status === 'failed') {
    return '🟥🟥🟥🟥🟥🟥'
  }

  const solvedAtClueIndex = score ? 6 - score : null

  const cells = []
  for (let i = 0; i < 6; i += 1) {
    if (solvedAtClueIndex === i) {
      cells.push('🟩')
    } else if (i < attemptsUsed) {
      cells.push('🟨')
    } else {
      cells.push('⬜')
    }
  }

  return cells.join('')
}

export const buildShareText = ({
  puzzleId,
  status,
  attemptsUsed,
  score,
  streak,
}: ShareTextArgs): string => {
  const scoreDisplay = status === 'solved' && score !== null ? String(score) : 'X'

  return [
    `Craig Bryson Pub Quiz #${puzzleId}`,
    `Score: ${scoreDisplay}/6`,
    buildResultRow(status, attemptsUsed, score),
    `Streak: ${streak}`,
  ].join('\n')
}
