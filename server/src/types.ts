export type GameStatus = 'active' | 'solved' | 'failed'

export type TodayResponse = {
  puzzleId: number
  puzzleDate: string
  currentClueNumber: number
  unlockedClues: Array<{ clueNumber: number; clueText: string }>
  attemptsUsed: number
  status: GameStatus
}

export type GuessResponse = {
  result: 'correct' | 'incorrect'
  status: GameStatus
  currentClueNumber: number
  attemptsUsed: number
  score: number | null
}

export type ResultResponse = {
  status: GameStatus
  answer: string | null
  legendWhy: string | null
  score: number | null
}

export type StatsResponse = {
  currentStreak: number
  maxStreak: number
  played: number
  won: number
}
