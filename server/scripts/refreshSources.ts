import { createHash } from 'node:crypto'

import { pool } from '../src/db'
import { addDays } from '../src/automation'
import { getLondonDateKey } from '../../shared/date'

const REFRESH_WINDOW_DAYS = 30

const hashText = (value: string): string => {
  return createHash('sha256').update(value).digest('hex')
}

const fetchSource = async (url: string): Promise<{ ok: boolean; hash: string | null }> => {
  try {
    const response = await fetch(url, { method: 'GET' })
    if (!response.ok) {
      return { ok: false, hash: null }
    }

    const body = await response.text()
    return { ok: true, hash: hashText(body.slice(0, 20000)) }
  } catch {
    return { ok: false, hash: null }
  }
}

const run = async (): Promise<void> => {
  const client = await pool.connect()
  const today = getLondonDateKey()
  const endDate = addDays(today, REFRESH_WINDOW_DAYS)

  let checkedCount = 0
  let staleCount = 0

  try {
    await client.query('BEGIN')

    const runResult = await client.query<{ id: number }>(
      `
        INSERT INTO source_refresh_runs(status, details)
        VALUES ('running', '{}'::jsonb)
        RETURNING id
      `,
    )
    const runId = runResult.rows[0].id

    const sourcesResult = await client.query<{
      source_id: number
      puzzle_id: number
      source_url: string
      source_hash: string | null
    }>(
      `
        SELECT ps.id AS source_id, ps.puzzle_id, ps.source_url, ps.source_hash
        FROM puzzle_sources ps
        JOIN puzzles p ON p.id = ps.puzzle_id
        WHERE p.puzzle_date BETWEEN $1::date AND $2::date
          AND p.status IN ('scheduled', 'published')
      `,
      [today, endDate],
    )

    for (const source of sourcesResult.rows) {
      const refreshed = await fetchSource(source.source_url)
      checkedCount += 1

      if (!refreshed.ok || !refreshed.hash) {
        staleCount += 1
        await client.query(
          `
            UPDATE puzzles
            SET publishable = FALSE,
                validation_errors = (
                  COALESCE(validation_errors, '[]'::jsonb) || to_jsonb('source fetch failed: ' || $1::text)
                )
            WHERE id = $2
          `,
          [source.source_url, source.puzzle_id],
        )
        continue
      }

      if (source.source_hash && source.source_hash !== refreshed.hash) {
        staleCount += 1
        await client.query(
          `
            UPDATE puzzles
            SET publishable = FALSE,
                validation_errors = (
                  COALESCE(validation_errors, '[]'::jsonb) || to_jsonb('source changed: ' || $1::text)
                )
            WHERE id = $2
          `,
          [source.source_url, source.puzzle_id],
        )
      }

      await client.query(
        `
          UPDATE puzzle_sources
          SET fetched_at = NOW(),
              verified_at = NOW(),
              source_hash = $1
          WHERE id = $2
        `,
        [refreshed.hash, source.source_id],
      )
    }

    await client.query(
      `
        UPDATE source_refresh_runs
        SET
          finished_at = NOW(),
          status = 'success',
          checked_count = $1,
          stale_count = $2,
          details = $3::jsonb
        WHERE id = $4
      `,
      [checkedCount, staleCount, JSON.stringify({ today, endDate }), runId],
    )

    await client.query('COMMIT')
    console.log(`Refreshed ${checkedCount} sources (${staleCount} flagged stale)`) 
  } catch (error) {
    await client.query('ROLLBACK')
    throw error
  } finally {
    client.release()
    await pool.end()
  }
}

run().catch((error) => {
  console.error(error)
  process.exit(1)
})
