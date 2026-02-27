import { useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import './App.css'

import {
  fetchResult,
  fetchStats,
  fetchTodayPuzzle,
  submitGuess,
  type GuessPayload,
  type ResultPayload,
  type StatsPayload,
  type TodayPayload,
} from './lib/api'
import { buildShareText } from './lib/share'

type AppProps = {
  api?: {
    fetchTodayPuzzle: () => Promise<TodayPayload>
    submitGuess: (puzzleId: number, guess: string) => Promise<GuessPayload>
    fetchResult: (puzzleId: number) => Promise<ResultPayload>
    fetchStats: () => Promise<StatsPayload>
  }
}

const defaultApi = {
  fetchTodayPuzzle,
  submitGuess,
  fetchResult,
  fetchStats,
}

function App({ api = defaultApi }: AppProps) {
  const [today, setToday] = useState<TodayPayload | null>(null)
  const [result, setResult] = useState<ResultPayload | null>(null)
  const [stats, setStats] = useState<StatsPayload | null>(null)
  const [guess, setGuess] = useState('')
  const [message, setMessage] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const load = async () => {
      try {
        const [todayPayload, statsPayload] = await Promise.all([
          api.fetchTodayPuzzle(),
          api.fetchStats(),
        ])
        setToday(todayPayload)
        setStats(statsPayload)

        if (todayPayload.status !== 'active') {
          const resultPayload = await api.fetchResult(todayPayload.puzzleId)
          setResult(resultPayload)
        }
      } catch (loadError) {
        setError(loadError instanceof Error ? loadError.message : 'Failed to load puzzle')
      } finally {
        setLoading(false)
      }
    }

    void load()
  }, [api])

  const onSubmit = async (event: FormEvent) => {
    event.preventDefault()

    if (!today || today.status !== 'active') {
      return
    }

    try {
      const guessResponse = await api.submitGuess(today.puzzleId, guess)
      setGuess('')
      setMessage(
        guessResponse.result === 'incorrect' ? 'Not quite. Next clue unlocked.' : '',
      )

      const refreshedToday = await api.fetchTodayPuzzle()
      setToday(refreshedToday)

      if (guessResponse.status !== 'active') {
        const [resultPayload, statsPayload] = await Promise.all([
          api.fetchResult(today.puzzleId),
          api.fetchStats(),
        ])
        setResult(resultPayload)
        setStats(statsPayload)
      }
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : 'Failed to submit guess')
    }
  }

  const onCopyShare = async () => {
    if (!today) {
      return
    }

    const shareText = buildShareText({
      puzzleId: today.puzzleId,
      status: today.status,
      attemptsUsed: today.attemptsUsed,
      score: result?.score ?? null,
      streak: stats?.currentStreak ?? 0,
    })

    if (typeof navigator !== 'undefined' && navigator.clipboard) {
      await navigator.clipboard.writeText(shareText)
      setMessage('Share text copied.')
    }
  }

  if (loading) {
    return (
      <main className="app-shell">
        <h1>Craig Bryson Pub Quiz</h1>
        <p>Loading today&apos;s puzzle...</p>
      </main>
    )
  }

  if (error) {
    return (
      <main className="app-shell">
        <h1>Craig Bryson Pub Quiz</h1>
        <p>{error}</p>
      </main>
    )
  }

  if (!today) {
    return (
      <main className="app-shell">
        <h1>Craig Bryson Pub Quiz</h1>
        <p>No puzzles are available yet.</p>
      </main>
    )
  }

  const isTerminal = today.status !== 'active'
  const solved = today.status === 'solved'
  const failed = today.status === 'failed'

  return (
    <main className="app-shell">
      <h1>Craig Bryson Pub Quiz</h1>
      <p className="subtitle">Daily Championship Stalwart Challenge</p>

      <section className="panel">
        <p className="meta">
          Puzzle #{today.puzzleId} · {today.puzzleDate}
        </p>
        <p className="meta">Current streak: {stats?.currentStreak ?? 0}</p>

        {today.unlockedClues.map((clue) => (
          <article key={clue.clueNumber} className="clue-card">
            <h2>Clue {clue.clueNumber} of 6</h2>
            <p>{clue.clueText}</p>
          </article>
        ))}

        {!isTerminal ? (
          <form onSubmit={onSubmit} className="guess-form">
            <label htmlFor="guess">Your guess</label>
            <input
              id="guess"
              type="text"
              value={guess}
              onChange={(event) => setGuess(event.target.value)}
              required
            />
            <button type="submit">Submit guess</button>
          </form>
        ) : (
          <section className="result-panel">
            {solved ? <h2>Correct!</h2> : <h2>Unlucky!</h2>}
            <p>Answer: {result?.answer ?? 'Hidden'}</p>
            {solved ? <p>Score: {result?.score ?? 'X'}</p> : <p>Score: X/6</p>}
            <p>{result?.legendWhy ?? ''}</p>
            <button type="button" onClick={onCopyShare}>
              Copy share text
            </button>
          </section>
        )}

        {message ? <p className="status-message">{message}</p> : null}
        {failed ? <p className="status-message">No guesses remaining.</p> : null}
      </section>
    </main>
  )
}

export default App
