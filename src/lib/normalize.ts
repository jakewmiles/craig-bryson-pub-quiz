import { normalizeName } from '../../shared/normalize'
import type { Puzzle } from './types'

export { normalizeName }

export const isCorrectGuess = (
  guess: string,
  answer: Puzzle['answer'],
): boolean => {
  const normalizedGuess = normalizeName(guess)

  if (!normalizedGuess) {
    return false
  }

  const candidates = [answer.canonical, ...answer.aliases].map(normalizeName)
  return candidates.includes(normalizedGuess)
}
