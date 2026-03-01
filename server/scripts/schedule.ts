import { pool } from '../src/db'
import { addDays } from '../src/automation'
import { getLondonDateKey } from '../../shared/date'

const parseArg = (name: string, defaultValue: number): number => {
  const prefix = `--${name}=`
  const arg = process.argv.find((value) => value.startsWith(prefix))
  if (!arg) {
    return defaultValue
  }

  const parsed = Number(arg.slice(prefix.length))
  return Number.isFinite(parsed) ? parsed : defaultValue
}

const run = async (): Promise<void> => {
  const windowDays = parseArg('window-days', 30)
  const today = getLondonDateKey()
  const endDate = addDays(today, windowDays)

  const client = await pool.connect()
  let scheduledCount = 0

  try {
    await client.query('BEGIN')

    const scheduledResult = await client.query<{ id: number }>(
      `
        UPDATE puzzles
        SET status = 'scheduled'
        WHERE status = 'draft'
          AND publishable = TRUE
          AND puzzle_date BETWEEN $1::date AND $2::date
        RETURNING id
      `,
      [today, endDate],
    )

    scheduledCount = scheduledResult.rowCount ?? 0
    await client.query('COMMIT')
    console.log(`Scheduled ${scheduledCount} puzzles`)
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
