import type { PoolClient } from 'pg'

import { getLondonDateKey } from '../../shared/date'
import { normalizeName } from '../../shared/normalize'
import type { GameStatus, GuessResponse, ResultResponse, TodayResponse } from './types'

type PuzzleRow = {
  puzzle_id: number
  puzzle_date: string
  legend_why: string
  canonical_name: string
}

const TOTAL_CLUES = 6

const getStatus = (
  attempts: Array<{ clue_number: number; is_correct: boolean }>,
): GameStatus => {
  if (attempts.some((attempt) => attempt.is_correct)) {
    return 'solved'
  }

  if (attempts.length >= TOTAL_CLUES) {
    return 'failed'
  }

  return 'active'
}

const getCurrentClueNumber = (
  attempts: Array<{ clue_number: number; is_correct: boolean }>,
): number => {
  const status = getStatus(attempts)

  if (status === 'solved') {
    const solvedAttempt = attempts.find((attempt) => attempt.is_correct)
    return solvedAttempt?.clue_number ?? 1
  }

  if (status === 'failed') {
    return TOTAL_CLUES
  }

  return attempts.length + 1
}

const scoreForClue = (clueNumber: number): number => TOTAL_CLUES - clueNumber + 1

const dateKeyMinusOne = (dateKey: string): string => {
  const [year, month, day] = dateKey.split('-').map(Number)
  const date = new Date(Date.UTC(year, month - 1, day))
  date.setUTCDate(date.getUTCDate() - 1)
  return date.toISOString().slice(0, 10)
}

const upsertStreakOnCompletion = async (
  client: PoolClient,
  sessionId: number,
  dateKey: string,
): Promise<void> => {
  const existingResult = await client.query<{
    current_streak: number
    max_streak: number
    last_completed_date: string | null
  }>(
    'SELECT current_streak, max_streak, last_completed_date::text FROM streaks WHERE session_id = $1',
    [sessionId],
  )

  if (existingResult.rowCount === 0) {
    await client.query(
      'INSERT INTO streaks(session_id, current_streak, max_streak, last_completed_date) VALUES ($1, 1, 1, $2)',
      [sessionId, dateKey],
    )
    return
  }

  const streak = existingResult.rows[0]
  if (streak.last_completed_date === dateKey) {
    return
  }

  const yesterdayKey = dateKeyMinusOne(dateKey)
  const nextCurrent = streak.last_completed_date === yesterdayKey ? streak.current_streak + 1 : 1
  const nextMax = Math.max(streak.max_streak, nextCurrent)

  await client.query(
    'UPDATE streaks SET current_streak = $1, max_streak = $2, last_completed_date = $3, updated_at = NOW() WHERE session_id = $4',
    [nextCurrent, nextMax, dateKey, sessionId],
  )
}

export const getOrCreateSessionId = async (
  client: PoolClient,
  anonToken: string,
): Promise<number> => {
  const existing = await client.query<{ id: number }>(
    'SELECT id FROM sessions WHERE anon_token = $1',
    [anonToken],
  )

  if (existing.rowCount && existing.rows[0]) {
    return existing.rows[0].id
  }

  const inserted = await client.query<{ id: number }>(
    'INSERT INTO sessions(anon_token) VALUES ($1) RETURNING id',
    [anonToken],
  )

  return inserted.rows[0].id
}

export const getTodayPuzzle = async (client: PoolClient): Promise<PuzzleRow | null> => {
  const dateKey = getLondonDateKey()

  const exact = await client.query<PuzzleRow>(
    `
      SELECT p.id AS puzzle_id, p.puzzle_date::text AS puzzle_date, p.legend_why, pl.canonical_name
      FROM puzzles p
      JOIN players pl ON pl.id = p.player_id
      WHERE p.status = 'published' AND p.puzzle_date = $1
      LIMIT 1
    `,
    [dateKey],
  )

  if (exact.rowCount && exact.rows[0]) {
    return exact.rows[0]
  }

  const fallback = await client.query<PuzzleRow>(
    `
      SELECT p.id AS puzzle_id, p.puzzle_date::text AS puzzle_date, p.legend_why, pl.canonical_name
      FROM puzzles p
      JOIN players pl ON pl.id = p.player_id
      WHERE p.status = 'published'
      ORDER BY p.puzzle_date DESC
      LIMIT 1
    `,
  )

  return fallback.rows[0] ?? null
}

export const getTodayState = async (
  client: PoolClient,
  anonToken: string,
): Promise<TodayResponse | null> => {
  const puzzle = await getTodayPuzzle(client)
  if (!puzzle) {
    return null
  }

  const sessionId = await getOrCreateSessionId(client, anonToken)

  const attemptsResult = await client.query<{
    clue_number: number
    is_correct: boolean
  }>(
    'SELECT clue_number, is_correct FROM attempts WHERE session_id = $1 AND puzzle_id = $2 ORDER BY clue_number ASC',
    [sessionId, puzzle.puzzle_id],
  )

  const attempts = attemptsResult.rows
  const status = getStatus(attempts)
  const currentClueNumber = getCurrentClueNumber(attempts)

  const cluesResult = await client.query<{ clue_number: number; clue_text: string }>(
    `
      SELECT clue_number, clue_text
      FROM puzzle_clues
      WHERE puzzle_id = $1 AND clue_number <= $2
      ORDER BY clue_number ASC
    `,
    [puzzle.puzzle_id, currentClueNumber],
  )

  return {
    puzzleId: puzzle.puzzle_id,
    puzzleDate: puzzle.puzzle_date,
    currentClueNumber,
    unlockedClues: cluesResult.rows.map((row) => ({
      clueNumber: row.clue_number,
      clueText: row.clue_text,
    })),
    attemptsUsed: attempts.length,
    status,
  }
}

export const submitGuess = async (
  client: PoolClient,
  anonToken: string,
  puzzleId: number,
  guessRaw: string,
): Promise<GuessResponse> => {
  const sessionId = await getOrCreateSessionId(client, anonToken)

  const attemptsResult = await client.query<{
    clue_number: number
    is_correct: boolean
  }>(
    'SELECT clue_number, is_correct FROM attempts WHERE session_id = $1 AND puzzle_id = $2 ORDER BY clue_number ASC',
    [sessionId, puzzleId],
  )

  const attempts = attemptsResult.rows
  const currentStatus = getStatus(attempts)
  if (currentStatus !== 'active') {
    const solved = attempts.find((attempt) => attempt.is_correct)
    return {
      result: solved ? 'correct' : 'incorrect',
      status: currentStatus,
      currentClueNumber: getCurrentClueNumber(attempts),
      attemptsUsed: attempts.length,
      score: solved ? scoreForClue(solved.clue_number) : null,
    }
  }

  const currentClueNumber = attempts.length + 1

  const answerResult = await client.query<{
    canonical_name: string
    alias: string | null
  }>(
    `
      SELECT pl.canonical_name, pa.alias
      FROM puzzles p
      JOIN players pl ON pl.id = p.player_id
      LEFT JOIN player_aliases pa ON pa.player_id = pl.id
      WHERE p.id = $1
    `,
    [puzzleId],
  )

  if (answerResult.rowCount === 0) {
    throw new Error('Puzzle not found')
  }

  const canonical = answerResult.rows[0].canonical_name
  const aliases = answerResult.rows
    .map((row) => row.alias)
    .filter((alias): alias is string => Boolean(alias))

  const normalizedGuess = normalizeName(guessRaw)
  const accepted = [canonical, ...aliases].map(normalizeName)
  const isCorrect = accepted.includes(normalizedGuess)

  await client.query(
    `
      INSERT INTO attempts(session_id, puzzle_id, clue_number, guess_raw, guess_normalized, is_correct)
      VALUES ($1, $2, $3, $4, $5, $6)
    `,
    [sessionId, puzzleId, currentClueNumber, guessRaw, normalizedGuess, isCorrect],
  )

  const nextAttempts = [...attempts, { clue_number: currentClueNumber, is_correct: isCorrect }]
  const nextStatus = getStatus(nextAttempts)
  const score = isCorrect ? scoreForClue(currentClueNumber) : null

  if (nextStatus !== 'active') {
    const puzzleDateResult = await client.query<{ puzzle_date: string }>(
      'SELECT puzzle_date::text FROM puzzles WHERE id = $1',
      [puzzleId],
    )
    if (puzzleDateResult.rows[0]) {
      await upsertStreakOnCompletion(client, sessionId, puzzleDateResult.rows[0].puzzle_date)
    }
  }

  return {
    result: isCorrect ? 'correct' : 'incorrect',
    status: nextStatus,
    currentClueNumber:
      nextStatus === 'active' ? currentClueNumber + 1 : getCurrentClueNumber(nextAttempts),
    attemptsUsed: nextAttempts.length,
    score,
  }
}

export const getResult = async (
  client: PoolClient,
  anonToken: string,
  puzzleId: number,
): Promise<ResultResponse> => {
  const sessionId = await getOrCreateSessionId(client, anonToken)

  const attemptsResult = await client.query<{
    clue_number: number
    is_correct: boolean
  }>(
    'SELECT clue_number, is_correct FROM attempts WHERE session_id = $1 AND puzzle_id = $2 ORDER BY clue_number ASC',
    [sessionId, puzzleId],
  )

  const attempts = attemptsResult.rows
  const status = getStatus(attempts)

  if (status === 'active') {
    return {
      status,
      answer: null,
      legendWhy: null,
      score: null,
    }
  }

  const puzzleResult = await client.query<{
    canonical_name: string
    legend_why: string
  }>(
    `
      SELECT pl.canonical_name, p.legend_why
      FROM puzzles p
      JOIN players pl ON pl.id = p.player_id
      WHERE p.id = $1
      LIMIT 1
    `,
    [puzzleId],
  )

  const solved = attempts.find((attempt) => attempt.is_correct)
  return {
    status,
    answer: puzzleResult.rows[0]?.canonical_name ?? null,
    legendWhy: puzzleResult.rows[0]?.legend_why ?? null,
    score: solved ? scoreForClue(solved.clue_number) : null,
  }
}

export const getStats = async (
  client: PoolClient,
  anonToken: string,
): Promise<{ currentStreak: number; maxStreak: number; played: number; won: number }> => {
  const sessionId = await getOrCreateSessionId(client, anonToken)

  const streakResult = await client.query<{
    current_streak: number
    max_streak: number
  }>('SELECT current_streak, max_streak FROM streaks WHERE session_id = $1', [sessionId])

  const countsResult = await client.query<{ played: string; won: string }>(
    `
      WITH puzzle_outcomes AS (
        SELECT
          puzzle_id,
          BOOL_OR(is_correct) AS solved,
          COUNT(*) AS guesses
        FROM attempts
        WHERE session_id = $1
        GROUP BY puzzle_id
      )
      SELECT
        COUNT(*)::text AS played,
        COUNT(*) FILTER (WHERE solved)::text AS won
      FROM puzzle_outcomes
      WHERE solved OR guesses >= 6
    `,
    [sessionId],
  )

  return {
    currentStreak: streakResult.rows[0]?.current_streak ?? 0,
    maxStreak: streakResult.rows[0]?.max_streak ?? 0,
    played: Number(countsResult.rows[0]?.played ?? 0),
    won: Number(countsResult.rows[0]?.won ?? 0),
  }
}
