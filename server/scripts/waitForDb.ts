import 'dotenv/config'
import { Pool } from 'pg'

const connectionString =
  process.env.DATABASE_URL ??
  'postgres://postgres:postgres@localhost:5433/craig_bryson_pub_quiz'

const describeConnection = (urlString: string): string => {
  try {
    const url = new URL(urlString)
    const database = url.pathname.replace(/^\//, '')
    return `${url.hostname}:${url.port || '5432'}/${database}`
  } catch {
    return urlString
  }
}

const sleep = (ms: number): Promise<void> =>
  new Promise((resolve) => {
    setTimeout(resolve, ms)
  })

const run = async (): Promise<void> => {
  const maxAttempts = 90
  let lastErrorMessage = 'unknown connection error'

  console.log(`Waiting for database at ${describeConnection(connectionString)}...`)

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    const pool = new Pool({ connectionString })

    try {
      await pool.query('SELECT 1')
      await pool.end()
      console.log('Database is ready')
      return
    } catch (error) {
      lastErrorMessage = error instanceof Error ? error.message : String(error)
      await pool.end()
      if (attempt === maxAttempts) {
        throw new Error(
          `Database did not become ready in time for ${describeConnection(connectionString)}. Last error: ${lastErrorMessage}`,
        )
      }

      if (attempt % 10 === 0) {
        console.log(`Still waiting (attempt ${attempt}/${maxAttempts}): ${lastErrorMessage}`)
      }

      await sleep(1000)
    }
  }
}

run().catch((error) => {
  console.error(error)
  process.exit(1)
})
