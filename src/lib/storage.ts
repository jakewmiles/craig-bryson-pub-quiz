import type { StreakStats } from './types'

const STREAK_KEY = 'cbpq:streak'

const defaultStats: StreakStats = {
  current: 0,
  max: 0,
  lastCompletedDate: null,
}

const dateKeyMinusOne = (dateKey: string): string => {
  const [year, month, day] = dateKey.split('-').map(Number)
  const date = new Date(Date.UTC(year, month - 1, day))
  date.setUTCDate(date.getUTCDate() - 1)
  return date.toISOString().slice(0, 10)
}

const safeParse = (raw: string | null): StreakStats => {
  if (!raw) {
    return defaultStats
  }

  try {
    const parsed = JSON.parse(raw) as Partial<StreakStats>
    return {
      current: parsed.current ?? 0,
      max: parsed.max ?? 0,
      lastCompletedDate: parsed.lastCompletedDate ?? null,
    }
  } catch {
    return defaultStats
  }
}

export const getStreakStats = (): StreakStats => {
  if (typeof window === 'undefined') {
    return defaultStats
  }

  return safeParse(window.localStorage.getItem(STREAK_KEY))
}

export const completePuzzleForDate = (dateKey: string): StreakStats => {
  const currentStats = getStreakStats()

  if (currentStats.lastCompletedDate === dateKey) {
    return currentStats
  }

  const yesterdayKey = dateKeyMinusOne(dateKey)

  const nextCurrent =
    currentStats.lastCompletedDate === yesterdayKey ? currentStats.current + 1 : 1

  const nextStats: StreakStats = {
    current: nextCurrent,
    max: Math.max(currentStats.max, nextCurrent),
    lastCompletedDate: dateKey,
  }

  if (typeof window !== 'undefined') {
    window.localStorage.setItem(STREAK_KEY, JSON.stringify(nextStats))
  }

  return nextStats
}
