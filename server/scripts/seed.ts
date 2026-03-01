import { pool } from '../src/db'
import { puzzles } from '../../src/data/puzzles'
import { normalizeName } from '../../shared/normalize'

const CLUE_TYPES = [
  'origin',
  'career_path',
  'teammates',
  'manager',
  'defining_stat',
  'dead_giveaway',
] as const

const inferPosition = (name: string): string => {
  const goalkeeperNames = new Set(['Scott Carson', 'Lee Camp'])
  const defenderNames = new Set(['Chris Gunter', 'Peter Ramage'])
  const strikerNames = new Set([
    'David Nugent',
    'Ross McCormack',
    'Danny Graham',
    'Jonathan Walters',
    'Marvin Sordell',
  ])

  if (goalkeeperNames.has(name)) {
    return 'GK'
  }

  if (defenderNames.has(name)) {
    return 'DEF'
  }

  if (strikerNames.has(name)) {
    return 'FWD'
  }

  return 'MID'
}

const inferEraBucket = (dateKey: string): string => {
  const year = Number(dateKey.slice(0, 4))

  if (year <= 2009) {
    return '2004-2009'
  }

  if (year <= 2014) {
    return '2010-2014'
  }

  if (year <= 2019) {
    return '2015-2019'
  }

  return '2020+'
}

const upsertPuzzle = async (): Promise<void> => {
  const client = await pool.connect()

  try {
    await client.query('BEGIN')

    for (const puzzle of puzzles) {
      if (puzzle.clues.length !== 6) {
        throw new Error(`Puzzle ${puzzle.id} does not have exactly 6 clues`)
      }

      const playerResult = await client.query<{ id: number }>(
        `
          INSERT INTO players(canonical_name, position, retired, eligibility_score)
          VALUES ($1, $2, TRUE, 90)
          ON CONFLICT (canonical_name)
          DO UPDATE SET position = EXCLUDED.position
          RETURNING id
        `,
        [puzzle.answer.canonical, inferPosition(puzzle.answer.canonical)],
      )

      const playerId = playerResult.rows[0].id

      for (const alias of puzzle.answer.aliases) {
        await client.query(
          `
            INSERT INTO player_aliases(player_id, alias, normalized_alias)
            VALUES ($1, $2, $3)
            ON CONFLICT (player_id, normalized_alias)
            DO UPDATE SET alias = EXCLUDED.alias
          `,
          [playerId, alias, normalizeName(alias)],
        )
      }

      for (let index = 0; index < puzzle.clues.length; index += 1) {
        await client.query(
          `
            INSERT INTO player_facts(player_id, fact_type, fact_value, source_url, source_type)
            VALUES ($1, $2, $3, $4, 'seed')
            ON CONFLICT (player_id, fact_type)
            DO UPDATE SET fact_value = EXCLUDED.fact_value, source_url = EXCLUDED.source_url
          `,
          [playerId, CLUE_TYPES[index], puzzle.clues[index], puzzle.sources[0] ?? null],
        )
      }

      const puzzleResult = await client.query<{ id: number }>(
        `
          INSERT INTO puzzles(
            puzzle_date,
            player_id,
            legend_why,
            status,
            difficulty_score,
            quality_score,
            theme_tag,
            era_bucket,
            publishable,
            validation_errors,
            published_at
          )
          VALUES (
            $1,
            $2,
            $3,
            'published',
            60,
            85,
            'seeded',
            $4,
            TRUE,
            '[]'::jsonb,
            NOW()
          )
          ON CONFLICT (puzzle_date)
          DO UPDATE SET
            player_id = EXCLUDED.player_id,
            legend_why = EXCLUDED.legend_why,
            status = EXCLUDED.status,
            difficulty_score = EXCLUDED.difficulty_score,
            quality_score = EXCLUDED.quality_score,
            theme_tag = EXCLUDED.theme_tag,
            era_bucket = EXCLUDED.era_bucket,
            publishable = EXCLUDED.publishable,
            validation_errors = EXCLUDED.validation_errors,
            published_at = EXCLUDED.published_at
          RETURNING id
        `,
        [puzzle.date, playerId, puzzle.legendWhy, inferEraBucket(puzzle.date)],
      )

      const puzzleId = puzzleResult.rows[0].id
      await client.query('DELETE FROM puzzle_clues WHERE puzzle_id = $1', [puzzleId])
      await client.query('DELETE FROM puzzle_sources WHERE puzzle_id = $1', [puzzleId])

      for (let index = 0; index < puzzle.clues.length; index += 1) {
        const clueNumber = index + 1
        await client.query(
          `
            INSERT INTO puzzle_clues(puzzle_id, clue_number, clue_text, clue_type)
            VALUES ($1, $2, $3, $4)
          `,
          [puzzleId, clueNumber, puzzle.clues[index], CLUE_TYPES[index]],
        )
      }

      for (const source of puzzle.sources) {
        await client.query(
          `
            INSERT INTO puzzle_sources(puzzle_id, source_url, source_type, fetched_at, verified_at)
            VALUES ($1, $2, 'seed', NOW(), NOW())
          `,
          [puzzleId, source],
        )
      }

      await client.query('UPDATE players SET last_seen_in_quiz = $1 WHERE id = $2', [
        puzzle.date,
        playerId,
      ])
    }

    await client.query('COMMIT')
    console.log(`Upserted ${puzzles.length} seed puzzles`)
  } catch (error) {
    await client.query('ROLLBACK')
    throw error
  } finally {
    client.release()
    await pool.end()
  }
}

upsertPuzzle().catch((error) => {
  console.error(error)
  process.exit(1)
})
