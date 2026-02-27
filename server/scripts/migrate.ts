import { readFile } from 'node:fs/promises'
import { resolve } from 'node:path'

import { pool } from '../src/db'

const run = async (): Promise<void> => {
  const migrationPath = resolve(process.cwd(), 'server/migrations/001_init.sql')
  const sql = await readFile(migrationPath, 'utf8')
  await pool.query(sql)
  await pool.end()
  console.log('Migration complete: 001_init.sql')
}

run().catch(async (error) => {
  console.error(error)
  await pool.end()
  process.exit(1)
})
