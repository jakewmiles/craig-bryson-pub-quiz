export type GameProgress = {
  solvedAtClueIndex: number | null
  currentClueIndex: number
  attempts: boolean[]
}

export const TOTAL_CLUES = 6

export const getScoreForSolvedClue = (clueIndex: number): number => {
  return TOTAL_CLUES - clueIndex
}

export const getNextClueIndex = (currentClueIndex: number): number => {
  return Math.min(currentClueIndex + 1, TOTAL_CLUES - 1)
}

export const isGameOver = (progress: GameProgress): boolean => {
  if (progress.solvedAtClueIndex !== null) {
    return true
  }

  return (
    progress.currentClueIndex === TOTAL_CLUES - 1 &&
    progress.attempts.length >= TOTAL_CLUES
  )
}
