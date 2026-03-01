import { pool } from '../src/db'
import { getLondonDateKey } from '../../shared/date'

const parseTargetDate = (): string => {
  const arg = process.argv.find((value) => value.startsWith('--date='))
  if (!arg) {
    return getLondonDateKey()
  }

  return arg.slice('--date='.length)
}

const run = async (): Promise<void> => {
  const targetDate = parseTargetDate()
  const client = await pool.connect()

  let runId = 0

  try {
    await client.query('BEGIN')

    const runResult = await client.query<{ id: number }>(
      `
        INSERT INTO publish_runs(status, target_date, details)
        VALUES ('running', $1, '{}'::jsonb)
        RETURNING id
      `,
      [targetDate],
    )
    runId = runResult.rows[0].id

    const scheduled = await client.query<{ id: number }>(
      `
        SELECT id
        FROM puzzles
        WHERE puzzle_date = $1::date
          AND status = 'scheduled'
          AND publishable = TRUE
        ORDER BY quality_score DESC NULLS LAST
        LIMIT 1
      `,
      [targetDate],
    )

    let puzzleId = scheduled.rows[0]?.id

    if (!puzzleId) {
      const fallback = await client.query<{ id: number }>(
        `
          SELECT id
          FROM puzzles
          WHERE puzzle_date = $1::date
            AND status = 'draft'
            AND publishable = TRUE
          ORDER BY quality_score DESC NULLS LAST
          LIMIT 1
        `,
        [targetDate],
      )

      puzzleId = fallback.rows[0]?.id
    }

    if (!puzzleId) {
      await client.query(
        `
          UPDATE publish_runs
          SET finished_at = NOW(), status = 'failed', details = $1::jsonb
          WHERE id = $2
        `,
        [JSON.stringify({ reason: 'no publishable puzzle found' }), runId],
      )
      await client.query('COMMIT')
      console.log(`No publishable puzzle available for ${targetDate}`)
      return
    }

    await client.query(
      `
        UPDATE puzzles
        SET status = 'published',
            published_at = NOW()
        WHERE id = $1
      `,
      [puzzleId],
    )

    await client.query(
      `
        UPDATE publish_runs
        SET
          finished_at = NOW(),
          status = 'success',
          published_puzzle_id = $1,
          details = $2::jsonb
        WHERE id = $3
      `,
      [puzzleId, JSON.stringify({ targetDate }), runId],
    )

    await client.query('COMMIT')
    console.log(`Published puzzle ${puzzleId} for ${targetDate}`)
  } catch (error) {
    await client.query('ROLLBACK')

    if (runId) {
      await client.query(
        `
          UPDATE publish_runs
          SET finished_at = NOW(), status = 'failed', details = $1::jsonb
          WHERE id = $2
        `,
        [JSON.stringify({ error: error instanceof Error ? error.message : 'unknown' }), runId],
      )
    }

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
