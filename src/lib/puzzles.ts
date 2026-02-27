import type { Puzzle } from './types'

export const getPuzzleForDate = (
  dateKey: string,
  puzzles: Puzzle[],
): Puzzle | null => {
  const exact = puzzles.find((puzzle) => puzzle.date === dateKey)

  if (exact) {
    return exact
  }

  if (puzzles.length === 0) {
    return null
  }

  return [...puzzles].sort((a, b) => a.date.localeCompare(b.date)).at(-1) ?? null
}
