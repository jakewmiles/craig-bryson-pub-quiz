export type GameStatus = 'active' | 'solved' | 'failed'

export type TodayPayload = {
  puzzleId: number
  puzzleDate: string
  currentClueNumber: number
  unlockedClues: Array<{ clueNumber: number; clueText: string }>
  attemptsUsed: number
  status: GameStatus
}

export type GuessPayload = {
  result: 'correct' | 'incorrect'
  status: GameStatus
  currentClueNumber: number
  attemptsUsed: number
  score: number | null
}

export type ResultPayload = {
  status: GameStatus
  answer: string | null
  legendWhy: string | null
  score: number | null
}

export type StatsPayload = {
  currentStreak: number
  maxStreak: number
  played: number
  won: number
}

const TOKEN_KEY = 'cbpq:anonToken'

const createToken = (): string => {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID()
  }

  return `cbpq-${Math.random().toString(36).slice(2)}`
}

export const getAnonToken = (): string => {
  const existing = window.localStorage.getItem(TOKEN_KEY)
  if (existing) {
    return existing
  }

  const token = createToken()
  window.localStorage.setItem(TOKEN_KEY, token)
  return token
}

const request = async <T>(
  path: string,
  options: RequestInit = {},
): Promise<T> => {
  const response = await fetch(path, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      'x-anon-token': getAnonToken(),
      ...(options.headers ?? {}),
    },
  })

  if (!response.ok) {
    const payload = (await response.json().catch(() => ({}))) as { error?: string }
    throw new Error(payload.error ?? `Request failed: ${response.status}`)
  }

  return (await response.json()) as T
}

export const fetchTodayPuzzle = (): Promise<TodayPayload> => {
  return request<TodayPayload>('/api/puzzle/today')
}

export const submitGuess = (puzzleId: number, guess: string): Promise<GuessPayload> => {
  return request<GuessPayload>('/api/puzzle/guess', {
    method: 'POST',
    body: JSON.stringify({ puzzleId, guess }),
  })
}

export const fetchResult = (puzzleId: number): Promise<ResultPayload> => {
  return request<ResultPayload>(`/api/puzzle/result?puzzleId=${puzzleId}`)
}

export const fetchStats = (): Promise<StatsPayload> => {
  return request<StatsPayload>('/api/stats/me')
}
