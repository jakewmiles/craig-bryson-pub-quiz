import 'dotenv/config'
import { Pool } from 'pg'

const connectionString =
  process.env.DATABASE_URL ??
  'postgres://postgres:postgres@localhost:5432/craig_bryson_pub_quiz'

const sleep = (ms: number): Promise<void> =>
  new Promise((resolve) => {
    setTimeout(resolve, ms)
  })

const run = async (): Promise<void> => {
  const maxAttempts = 30

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    const pool = new Pool({ connectionString })

    try {
      await pool.query('SELECT 1')
      await pool.end()
      console.log('Database is ready')
      return
    } catch {
      await pool.end()
      if (attempt === maxAttempts) {
        throw new Error('Database did not become ready in time')
      }

      await sleep(1000)
    }
  }
}

run().catch((error) => {
  console.error(error)
  process.exit(1)
})
