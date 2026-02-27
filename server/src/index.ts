import Fastify from 'fastify'

import { pool } from './db'
import { getResult, getStats, getTodayState, submitGuess } from './gameService'
import type { GuessResponse, ResultResponse, StatsResponse, TodayResponse } from './types'

const app = Fastify({ logger: true })

app.addHook('onClose', async () => {
  await pool.end()
})

const getAnonToken = (value: string | undefined): string | null => {
  const token = value?.trim()
  if (!token) {
    return null
  }

  return token.slice(0, 128)
}

app.get('/api/health', async () => ({ ok: true }))

app.get<{ Reply: TodayResponse | { error: string } }>(
  '/api/puzzle/today',
  async (request, reply) => {
    const anonToken = getAnonToken(request.headers['x-anon-token'] as string | undefined)
    if (!anonToken) {
      return reply.status(400).send({ error: 'Missing x-anon-token header' })
    }

    const client = await pool.connect()
    try {
      const state = await getTodayState(client, anonToken)
      if (!state) {
        return reply.status(404).send({ error: 'No published puzzle found' })
      }

      return state
    } finally {
      client.release()
    }
  },
)

app.post<{
  Body: { puzzleId: number; guess: string }
  Reply: GuessResponse | { error: string }
}>('/api/puzzle/guess', async (request, reply) => {
  const anonToken = getAnonToken(request.headers['x-anon-token'] as string | undefined)
  if (!anonToken) {
    return reply.status(400).send({ error: 'Missing x-anon-token header' })
  }

  const { puzzleId, guess } = request.body
  if (!puzzleId || typeof puzzleId !== 'number' || typeof guess !== 'string') {
    return reply.status(400).send({ error: 'Invalid payload' })
  }

  const client = await pool.connect()
  try {
    const response = await submitGuess(client, anonToken, puzzleId, guess)
    return response
  } catch (error) {
    request.log.error(error)
    return reply.status(500).send({ error: 'Failed to submit guess' })
  } finally {
    client.release()
  }
})

app.get<{
  Querystring: { puzzleId?: string }
  Reply: ResultResponse | { error: string }
}>('/api/puzzle/result', async (request, reply) => {
  const anonToken = getAnonToken(request.headers['x-anon-token'] as string | undefined)
  if (!anonToken) {
    return reply.status(400).send({ error: 'Missing x-anon-token header' })
  }

  const rawPuzzleId = request.query.puzzleId
  const puzzleId = Number(rawPuzzleId)
  if (!rawPuzzleId || Number.isNaN(puzzleId)) {
    return reply.status(400).send({ error: 'Missing valid puzzleId' })
  }

  const client = await pool.connect()
  try {
    return await getResult(client, anonToken, puzzleId)
  } finally {
    client.release()
  }
})

app.get<{ Reply: StatsResponse | { error: string } }>(
  '/api/stats/me',
  async (request, reply) => {
    const anonToken = getAnonToken(request.headers['x-anon-token'] as string | undefined)
    if (!anonToken) {
      return reply.status(400).send({ error: 'Missing x-anon-token header' })
    }

    const client = await pool.connect()
    try {
      return await getStats(client, anonToken)
    } finally {
      client.release()
    }
  },
)

const start = async (): Promise<void> => {
  try {
    const port = Number(process.env.PORT ?? 3001)
    await app.listen({ port, host: '0.0.0.0' })
  } catch (error) {
    app.log.error(error)
    process.exit(1)
  }
}

void start()
