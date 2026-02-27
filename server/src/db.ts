import 'dotenv/config'
import { Pool } from 'pg'

const connectionString =
  process.env.DATABASE_URL ??
  'postgres://postgres:postgres@localhost:5432/craig_bryson_pub_quiz'

export const pool = new Pool({ connectionString })
