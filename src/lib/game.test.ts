import { describe, expect, it } from 'vitest'

import {
  getScoreForSolvedClue,
  getNextClueIndex,
  isGameOver,
  type GameProgress,
} from './game'

describe('game scoring', () => {
  it('scores solved clues from 6 down to 1', () => {
    expect(getScoreForSolvedClue(0)).toBe(6)
    expect(getScoreForSolvedClue(2)).toBe(4)
    expect(getScoreForSolvedClue(5)).toBe(1)
  })
})

describe('clue progression', () => {
  it('advances to next clue after wrong guess', () => {
    expect(getNextClueIndex(0)).toBe(1)
    expect(getNextClueIndex(4)).toBe(5)
    expect(getNextClueIndex(5)).toBe(5)
  })
})

describe('game over state', () => {
  it('ends when solved', () => {
    const progress: GameProgress = {
      solvedAtClueIndex: 3,
      currentClueIndex: 3,
      attempts: [false, false, false, true],
    }

    expect(isGameOver(progress)).toBe(true)
  })

  it('ends when all clues used', () => {
    const progress: GameProgress = {
      solvedAtClueIndex: null,
      currentClueIndex: 5,
      attempts: [false, false, false, false, false, false],
    }

    expect(isGameOver(progress)).toBe(true)
  })
})
