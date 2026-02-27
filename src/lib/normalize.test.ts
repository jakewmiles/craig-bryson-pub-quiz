import { describe, expect, it } from 'vitest'

import { normalizeName, isCorrectGuess } from './normalize'

describe('normalizeName', () => {
  it('normalizes casing, punctuation, and extra spaces', () => {
    expect(normalizeName("  Craig-Bryson  ")).toBe('craig bryson')
    expect(normalizeName("CRAIG  BRYSON")).toBe('craig bryson')
    expect(normalizeName("Craig.Bryson")).toBe('craig bryson')
  })

  it('folds accents', () => {
    expect(normalizeName('José   Enrique')).toBe('jose enrique')
  })
})

describe('isCorrectGuess', () => {
  it('matches canonical name and aliases', () => {
    const answer = {
      canonical: 'Matthew Phillips',
      aliases: ['Matt Phillips'],
    }

    expect(isCorrectGuess('matt phillips', answer)).toBe(true)
    expect(isCorrectGuess('Matthew Phillips', answer)).toBe(true)
    expect(isCorrectGuess('Phillips', answer)).toBe(false)
  })
})
