import { pool } from '../src/db'
import {
  REQUIRED_FACT_TYPES,
  buildGeneratedClue,
  completeGenerationRun,
  ensureGenerationRun,
  getEraForDate,
  getPlayerUsageMap,
  getTargetDates,
  getThemeForDate,
  scorePlayerCandidate,
} from '../src/automation'

const parseArg = (name: string, defaultValue: number): number => {
  const prefix = `--${name}=`
  const rawArg = process.argv.find((arg) => arg.startsWith(prefix))
  if (!rawArg) {
    return defaultValue
  }

  const value = Number(rawArg.slice(prefix.length))
  return Number.isFinite(value) ? value : defaultValue
}

const run = async (): Promise<void> => {
  const bufferDays = parseArg('buffer-days', 30)
  const cooldownDays = parseArg('cooldown-days', 180)

  const client = await pool.connect()
  const runId = await ensureGenerationRun(client, bufferDays)
  let generatedCount = 0

  try {
    await client.query('BEGIN')

    const targetDates = await getTargetDates(client, bufferDays)
    const usageMap = await getPlayerUsageMap(client)
    const positionUsageResult = await client.query<{ position: string | null; usage_count: string }>(
      `
        SELECT pl.position, COUNT(*)::text AS usage_count
        FROM puzzles p
        JOIN players pl ON pl.id = p.player_id
        WHERE p.status IN ('scheduled', 'published')
          AND p.puzzle_date >= ($1::date - INTERVAL '30 days')
        GROUP BY pl.position
      `,
      [targetDates[0] ?? new Date().toISOString().slice(0, 10)],
    )
    const positionUsage = new Map<string, number>()
    for (const row of positionUsageResult.rows) {
      positionUsage.set(row.position ?? 'UNK', Number(row.usage_count))
    }

    for (const targetDate of targetDates) {
      const candidateResult = await client.query<{
        player_id: number
        canonical_name: string
        eligibility_score: number | null
        position: string | null
      }>(
        `
          SELECT p.id AS player_id, p.canonical_name, p.eligibility_score, p.position
          FROM players p
          WHERE p.retired = TRUE
          ORDER BY p.id ASC
        `,
      )

      const candidates = candidateResult.rows
        .map((row) => {
          const usage = usageMap.get(row.player_id) ?? { lastSeenDate: null, recentCount: 0 }
          const candidateScore = scorePlayerCandidate(
            row.eligibility_score ?? 70,
            usage.lastSeenDate,
            usage.recentCount,
            targetDate,
            cooldownDays,
          )

          return {
            playerId: row.player_id,
            canonicalName: row.canonical_name,
            position: row.position ?? 'UNK',
            candidateScore: candidateScore - (positionUsage.get(row.position ?? 'UNK') ?? 0) * 2,
          }
        })
        .filter((row) => row.candidateScore >= 0)
        .sort((a, b) => b.candidateScore - a.candidateScore)

      const selected = candidates[0]
      if (!selected) {
        continue
      }

      const factsResult = await client.query<{ fact_type: string; fact_value: string; source_url: string | null }>(
        `
          SELECT fact_type, fact_value, source_url
          FROM player_facts
          WHERE player_id = $1
        `,
        [selected.playerId],
      )

      const factMap = new Map(factsResult.rows.map((row) => [row.fact_type, row]))
      const hasAllFacts = REQUIRED_FACT_TYPES.every((factType) => factMap.has(factType))
      if (!hasAllFacts) {
        continue
      }

      const legend =
        factMap.get('dead_giveaway')?.fact_value ??
        `${selected.canonicalName} is a durable Championship stalwart with deep EFL roots.`

      const puzzleResult = await client.query<{ id: number }>(
        `
          INSERT INTO puzzles(
            puzzle_date,
            player_id,
            legend_why,
            status,
            theme_tag,
            era_bucket,
            difficulty_score,
            quality_score,
            publishable,
            validation_errors
          )
          VALUES ($1, $2, $3, 'draft', $4, $5, 55, 70, FALSE, '[]'::jsonb)
          ON CONFLICT (puzzle_date)
          DO UPDATE SET
            player_id = EXCLUDED.player_id,
            legend_why = EXCLUDED.legend_why,
            status = 'draft',
            theme_tag = EXCLUDED.theme_tag,
            era_bucket = EXCLUDED.era_bucket,
            difficulty_score = EXCLUDED.difficulty_score,
            quality_score = EXCLUDED.quality_score,
            publishable = FALSE,
            validation_errors = '[]'::jsonb
          RETURNING id
        `,
        [targetDate, selected.playerId, legend, getThemeForDate(targetDate), getEraForDate(targetDate)],
      )

      const puzzleId = puzzleResult.rows[0].id
      await client.query('DELETE FROM puzzle_clues WHERE puzzle_id = $1', [puzzleId])
      await client.query('DELETE FROM puzzle_sources WHERE puzzle_id = $1', [puzzleId])

      for (let index = 0; index < REQUIRED_FACT_TYPES.length; index += 1) {
        const clueType = REQUIRED_FACT_TYPES[index]
        const factRow = factMap.get(clueType)
        if (!factRow) {
          continue
        }

        await client.query(
          `
            INSERT INTO puzzle_clues(puzzle_id, clue_number, clue_text, clue_type)
            VALUES ($1, $2, $3, $4)
          `,
          [puzzleId, index + 1, buildGeneratedClue(clueType, factRow.fact_value), clueType],
        )

        if (factRow.source_url) {
          await client.query(
            `
              INSERT INTO puzzle_sources(puzzle_id, source_url, source_type, fetched_at)
              VALUES ($1, $2, 'generated', NOW())
              ON CONFLICT DO NOTHING
            `,
            [puzzleId, factRow.source_url],
          )
        }
      }

      usageMap.set(selected.playerId, {
        lastSeenDate: targetDate,
        recentCount: (usageMap.get(selected.playerId)?.recentCount ?? 0) + 1,
      })
      positionUsage.set(selected.position, (positionUsage.get(selected.position) ?? 0) + 1)
      generatedCount += 1
    }

    await completeGenerationRun(client, runId, 'success', generatedCount, {
      bufferDays,
      cooldownDays,
    })
    await client.query('COMMIT')
    console.log(`Generated ${generatedCount} draft puzzles`)
  } catch (error) {
    await client.query('ROLLBACK')
    await completeGenerationRun(client, runId, 'failed', generatedCount, {
      error: error instanceof Error ? error.message : 'unknown',
    })
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
