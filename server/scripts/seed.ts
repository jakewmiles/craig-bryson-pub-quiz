import { pool } from '../src/db'
import { puzzles } from '../../src/data/puzzles'
import { normalizeName } from '../../shared/normalize'

const run = async (): Promise<void> => {
  const client = await pool.connect()

  try {
    await client.query('BEGIN')

    await client.query('DELETE FROM attempts')
    await client.query('DELETE FROM streaks')
    await client.query('DELETE FROM sessions')
    await client.query('DELETE FROM puzzle_sources')
    await client.query('DELETE FROM puzzle_clues')
    await client.query('DELETE FROM puzzles')
    await client.query('DELETE FROM player_aliases')
    await client.query('DELETE FROM players')

    for (const puzzle of puzzles) {
      if (puzzle.clues.length !== 6) {
        throw new Error(`Puzzle ${puzzle.id} does not have exactly 6 clues`)
      }

      const playerResult = await client.query<{ id: number }>(
        'INSERT INTO players(canonical_name) VALUES ($1) RETURNING id',
        [puzzle.answer.canonical],
      )
      const playerId = playerResult.rows[0].id

      for (const alias of puzzle.answer.aliases) {
        await client.query(
          'INSERT INTO player_aliases(player_id, alias, normalized_alias) VALUES ($1, $2, $3)',
          [playerId, alias, normalizeName(alias)],
        )
      }

      const puzzleResult = await client.query<{ id: number }>(
        `
          INSERT INTO puzzles(puzzle_date, player_id, legend_why, status)
          VALUES ($1, $2, $3, 'published')
          RETURNING id
        `,
        [puzzle.date, playerId, puzzle.legendWhy],
      )

      const puzzleId = puzzleResult.rows[0].id
      for (let index = 0; index < puzzle.clues.length; index += 1) {
        const clueNumber = index + 1
        await client.query(
          `
            INSERT INTO puzzle_clues(puzzle_id, clue_number, clue_text, clue_type)
            VALUES ($1, $2, $3, $4)
          `,
          [puzzleId, clueNumber, puzzle.clues[index], `clue_${clueNumber}`],
        )
      }

      for (const source of puzzle.sources) {
        await client.query(
          'INSERT INTO puzzle_sources(puzzle_id, source_url) VALUES ($1, $2)',
          [puzzleId, source],
        )
      }
    }

    await client.query('COMMIT')
    console.log(`Seeded ${puzzles.length} puzzles`)
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
