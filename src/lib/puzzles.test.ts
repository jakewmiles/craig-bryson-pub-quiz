import { describe, expect, it } from 'vitest'

import type { Puzzle } from './types'
import { getPuzzleForDate } from './puzzles'

const samplePuzzles: Puzzle[] = [
  {
    id: 1,
    date: '2026-03-01',
    answer: {
      canonical: 'Player One',
      aliases: ['P One'],
    },
    clues: ['1', '2', '3', '4', '5', '6'],
    legendWhy: 'Test',
    sources: ['https://example.com/one'],
  },
  {
    id: 2,
    date: '2026-03-02',
    answer: {
      canonical: 'Player Two',
      aliases: [],
    },
    clues: ['1', '2', '3', '4', '5', '6'],
    legendWhy: 'Test',
    sources: ['https://example.com/two'],
  },
]

describe('getPuzzleForDate', () => {
  it('returns matching puzzle for provided date key', () => {
    const puzzle = getPuzzleForDate('2026-03-02', samplePuzzles)
    expect(puzzle?.id).toBe(2)
  })

  it('falls back to latest puzzle when no exact date exists', () => {
    const puzzle = getPuzzleForDate('2026-04-01', samplePuzzles)
    expect(puzzle?.id).toBe(2)
  })
})
