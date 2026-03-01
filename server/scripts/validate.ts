import { pool } from '../src/db'

const qualityFromSignals = (sourceCount: number, clueCount: number, duplicatePenalty: number): number => {
  let score = 60
  score += Math.min(sourceCount, 4) * 8
  score += clueCount === 6 ? 10 : 0
  score -= duplicatePenalty
  return Math.max(0, Math.min(100, score))
}

const signature = (value: string): string => {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 80)
}

const run = async (): Promise<void> => {
  const client = await pool.connect()
  let validatedCount = 0

  try {
    await client.query('BEGIN')

    const puzzleResult = await client.query<{
      id: number
      puzzle_date: string
      player_id: number
      status: string
    }>(
      `
        SELECT id, puzzle_date::text, player_id, status
        FROM puzzles
        WHERE status IN ('draft', 'scheduled')
        ORDER BY puzzle_date ASC
      `,
    )

    for (const puzzle of puzzleResult.rows) {
      const errors: string[] = []

      const cluesResult = await client.query<{ clue_number: number; clue_text: string }>(
        `
          SELECT clue_number, clue_text
          FROM puzzle_clues
          WHERE puzzle_id = $1
          ORDER BY clue_number ASC
        `,
        [puzzle.id],
      )

      if (cluesResult.rows.length !== 6) {
        errors.push('Puzzle must contain exactly 6 clues')
      }

      for (let index = 0; index < cluesResult.rows.length; index += 1) {
        if (cluesResult.rows[index].clue_number !== index + 1) {
          errors.push('Clue numbering must be 1 through 6')
          break
        }
      }

      const clueSignatures = cluesResult.rows.map((row) => signature(row.clue_text))
      for (const clueSignature of clueSignatures) {
        const duplicateClueResult = await client.query<{ duplicate_count: string }>(
          `
            SELECT COUNT(*)::text AS duplicate_count
            FROM puzzle_clues pc
            JOIN puzzles p ON p.id = pc.puzzle_id
            WHERE p.id <> $1
              AND p.puzzle_date >= ($2::date - INTERVAL '30 days')
              AND p.status IN ('scheduled', 'published')
              AND LEFT(REGEXP_REPLACE(LOWER(pc.clue_text), '[^a-z0-9\\s]', ' ', 'g'), 80) = $3
          `,
          [puzzle.id, puzzle.puzzle_date, clueSignature],
        )

        if (Number(duplicateClueResult.rows[0]?.duplicate_count ?? 0) > 0) {
          errors.push('Near-duplicate clue wording detected in rolling 30 day window')
          break
        }
      }

      const sourcesResult = await client.query<{ source_url: string }>(
        'SELECT source_url FROM puzzle_sources WHERE puzzle_id = $1',
        [puzzle.id],
      )

      if (sourcesResult.rows.length === 0) {
        errors.push('At least one source is required')
      }

      const cooldownCheck = await client.query<{ duplicate_count: string }>(
        `
          SELECT COUNT(*)::text AS duplicate_count
          FROM puzzles p
          WHERE p.player_id = $1
            AND p.id <> $2
            AND p.puzzle_date >= ($3::date - INTERVAL '180 days')
            AND p.status IN ('scheduled', 'published')
        `,
        [puzzle.player_id, puzzle.id, puzzle.puzzle_date],
      )

      const duplicateCount = Number(cooldownCheck.rows[0]?.duplicate_count ?? 0)
      if (duplicateCount > 0) {
        errors.push('Player appears inside 180 day cooldown window')
      }

      const qualityScore = qualityFromSignals(
        sourcesResult.rows.length,
        cluesResult.rows.length,
        duplicateCount * 12,
      )

      const difficultyScore = Math.max(
        25,
        Math.min(90, 50 + Math.floor((cluesResult.rows[1]?.clue_text.length ?? 0) / 8)),
      )

      await client.query(
        `
          UPDATE puzzles
          SET
            publishable = $1,
            validation_errors = $2::jsonb,
            quality_score = $3,
            difficulty_score = $4
          WHERE id = $5
        `,
        [errors.length === 0, JSON.stringify(errors), qualityScore, difficultyScore, puzzle.id],
      )

      validatedCount += 1
    }

    await client.query('COMMIT')
    console.log(`Validated ${validatedCount} puzzles`)
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
