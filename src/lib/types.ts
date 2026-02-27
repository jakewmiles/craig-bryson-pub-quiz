export type Puzzle = {
  id: number
  date: string
  answer: {
    canonical: string
    aliases: string[]
  }
  clues: string[]
  legendWhy: string
  sources: string[]
}

export type StreakStats = {
  current: number
  max: number
  lastCompletedDate: string | null
}
