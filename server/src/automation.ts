import type { PoolClient } from 'pg'

import { getLondonDateKey } from '../../shared/date'

export const REQUIRED_FACT_TYPES = [
  'origin',
  'career_path',
  'teammates',
  'manager',
  'defining_stat',
  'dead_giveaway',
] as const

const THEMES = [
  'Midfield Monday',
  'Target Man Tuesday',
  'Wildcard Wednesday',
  'Throwback Thursday',
  'Hard Mode Friday',
  'Stalwart Saturday',
  'Sunday Nostalgia',
]

const ERA_BUCKETS = ['2004-2009', '2010-2014', '2015-2019', '2020+']

const dayDiff = (fromDate: string, toDate: string): number => {
  const from = new Date(`${fromDate}T00:00:00Z`).getTime()
  const to = new Date(`${toDate}T00:00:00Z`).getTime()
  return Math.floor((to - from) / (24 * 60 * 60 * 1000))
}

export const addDays = (dateKey: string, days: number): string => {
  const date = new Date(`${dateKey}T00:00:00Z`)
  date.setUTCDate(date.getUTCDate() + days)
  return date.toISOString().slice(0, 10)
}

export const getThemeForDate = (dateKey: string): string => {
  const date = new Date(`${dateKey}T00:00:00Z`)
  const day = date.getUTCDay()
  return THEMES[(day + 6) % 7]
}

export const getEraForDate = (dateKey: string): string => {
  const baseDate = '2026-01-01'
  const diff = dayDiff(baseDate, dateKey)
  const index = ((diff % ERA_BUCKETS.length) + ERA_BUCKETS.length) % ERA_BUCKETS.length
  return ERA_BUCKETS[index]
}

export const buildGeneratedClue = (
  clueType: (typeof REQUIRED_FACT_TYPES)[number],
  fact: string,
): string => {
  const trimmed = fact.trim().replace(/\.$/, '')

  switch (clueType) {
    case 'origin':
      return `My route into the EFL started with this chapter: ${trimmed}.`
    case 'career_path':
      return `My Championship journey includes these clubs: ${trimmed}.`
    case 'teammates':
      return `I shared dressing rooms with names like ${trimmed}.`
    case 'manager':
      return `One manager tied closely to my story is ${trimmed}.`
    case 'defining_stat':
      return `A defining part of my profile is this: ${trimmed}.`
    case 'dead_giveaway':
      return `Dead giveaway: ${trimmed}.`
    default:
      return `${trimmed}.`
  }
}

export const ensureGenerationRun = async (
  client: PoolClient,
  requestedBufferDays: number,
): Promise<number> => {
  const result = await client.query<{ id: number }>(
    `
      INSERT INTO generation_runs(status, requested_buffer_days, details)
      VALUES ('running', $1, '{}'::jsonb)
      RETURNING id
    `,
    [requestedBufferDays],
  )

  return result.rows[0].id
}

export const completeGenerationRun = async (
  client: PoolClient,
  runId: number,
  status: 'success' | 'failed',
  generatedCount: number,
  details: Record<string, unknown>,
): Promise<void> => {
  await client.query(
    `
      UPDATE generation_runs
      SET finished_at = NOW(), status = $1, generated_count = $2, details = $3::jsonb
      WHERE id = $4
    `,
    [status, generatedCount, JSON.stringify(details), runId],
  )
}

export const getTargetDates = async (
  client: PoolClient,
  bufferDays: number,
): Promise<string[]> => {
  const today = getLondonDateKey()

  const occupiedResult = await client.query<{ puzzle_date: string }>(
    `
      SELECT puzzle_date::text
      FROM puzzles
      WHERE status IN ('scheduled', 'published')
        AND puzzle_date BETWEEN $1::date AND $2::date
    `,
    [today, addDays(today, bufferDays)],
  )

  const occupied = new Set(occupiedResult.rows.map((row) => row.puzzle_date))
  const dates: string[] = []

  for (let i = 0; i <= bufferDays; i += 1) {
    const dateKey = addDays(today, i)
    if (!occupied.has(dateKey)) {
      dates.push(dateKey)
    }
  }

  return dates
}

export const getPlayerUsageMap = async (
  client: PoolClient,
): Promise<Map<number, { lastSeenDate: string | null; recentCount: number }>> => {
  const usageResult = await client.query<{
    player_id: number
    last_seen_date: string | null
    recent_count: string
  }>(
    `
      SELECT
        p.player_id,
        MAX(p.puzzle_date)::text AS last_seen_date,
        COUNT(*) FILTER (WHERE p.puzzle_date >= ($1::date - INTERVAL '30 days'))::text AS recent_count
      FROM puzzles p
      WHERE p.status IN ('scheduled', 'published')
      GROUP BY p.player_id
    `,
    [getLondonDateKey()],
  )

  const usageMap = new Map<number, { lastSeenDate: string | null; recentCount: number }>()
  for (const row of usageResult.rows) {
    usageMap.set(row.player_id, {
      lastSeenDate: row.last_seen_date,
      recentCount: Number(row.recent_count),
    })
  }

  return usageMap
}

export const scorePlayerCandidate = (
  baseEligibility: number,
  lastSeenDate: string | null,
  recentCount: number,
  targetDate: string,
  cooldownDays: number,
): number => {
  let score = baseEligibility

  if (lastSeenDate) {
    const daysSinceSeen = dayDiff(lastSeenDate, targetDate)
    if (daysSinceSeen < cooldownDays) {
      return -1
    }

    score += Math.min(daysSinceSeen, 365) / 10
  }

  score -= recentCount * 7
  return score
}
