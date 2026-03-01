import { readFile } from 'node:fs/promises'
import { resolve } from 'node:path'

import { pool } from '../src/db'

const run = async (): Promise<void> => {
  const migrationFiles = ['001_init.sql', '002_automation.sql']

  for (const fileName of migrationFiles) {
    const migrationPath = resolve(process.cwd(), 'server/migrations', fileName)
    const sql = await readFile(migrationPath, 'utf8')
    await pool.query(sql)
    console.log(`Applied migration: ${fileName}`)
  }

  await pool.end()
  console.log('Migrations complete')
}

run().catch(async (error) => {
  console.error(error)
  await pool.end()
  process.exit(1)
})
