import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'

import App from './App'

describe('App', () => {
  it('reveals next clue after an incorrect guess and scores a correct guess', async () => {
    const user = userEvent.setup()

    let attemptsUsed = 0
    let status: 'active' | 'solved' | 'failed' = 'active'
    let score: number | null = null

    const api = {
      fetchTodayPuzzle: async () => ({
        puzzleId: 1,
        puzzleDate: '2026-03-01',
        currentClueNumber: Math.min(attemptsUsed + 1, 6),
        unlockedClues: [
          { clueNumber: 1, clueText: 'clue 1' },
          ...(attemptsUsed >= 1 ? [{ clueNumber: 2, clueText: 'clue 2' }] : []),
        ],
        attemptsUsed,
        status,
      }),
      submitGuess: async (_puzzleId: number, guess: string) => {
        attemptsUsed += 1
        if (guess.toLowerCase() === 'rory delap') {
          status = 'solved'
          score = 5
          return {
            result: 'correct' as const,
            status,
            currentClueNumber: 2,
            attemptsUsed,
            score,
          }
        }

        return {
          result: 'incorrect' as const,
          status,
          currentClueNumber: 2,
          attemptsUsed,
          score,
        }
      },
      fetchResult: async () => ({
        status,
        answer: 'Rory Delap',
        legendWhy: 'Legend',
        score,
      }),
      fetchStats: async () => ({
        currentStreak: 1,
        maxStreak: 1,
        played: 1,
        won: status === 'solved' ? 1 : 0,
      }),
    }

    render(<App api={api} />)

    await waitFor(() => {
      expect(screen.getByText('Clue 1 of 6')).toBeInTheDocument()
    })

    await user.type(screen.getByLabelText('Your guess'), 'Wrong Name')
    await user.click(screen.getByRole('button', { name: 'Submit guess' }))

    await waitFor(() => {
      expect(screen.getByText('Clue 2 of 6')).toBeInTheDocument()
    })

    await user.type(screen.getByLabelText('Your guess'), 'Rory Delap')
    await user.click(screen.getByRole('button', { name: 'Submit guess' }))

    await waitFor(() => {
      expect(screen.getByText('Correct!')).toBeInTheDocument()
      expect(screen.getByText('Score: 5')).toBeInTheDocument()
    })
  })
})
