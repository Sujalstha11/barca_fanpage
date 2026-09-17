import assert from 'node:assert/strict'
import test from 'node:test'

import { GoalApiError, createGoalApiClient } from '../scripts/football-data/goal-api-client.mjs'

function jsonResponse(body, status = 200, headers = {}) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json', ...headers },
  })
}

function wrapper(data, pagination = null) {
  return { success: true, data, pagination }
}

test('GOAL API client validates its API key', () => {
  assert.throws(
    () => createGoalApiClient({ apiKey: '  ' }),
    /GOAL_API_KEY is required/,
  )
})

test('GOAL API client uses the official base URL, bearer auth, and query parameters', async () => {
  let requestedUrl
  let authorization
  const client = createGoalApiClient({
    apiKey: ' test-secret ',
    fetchImpl: async (url, options) => {
      requestedUrl = url
      authorization = options.headers.Authorization
      return jsonResponse(wrapper([{ id: 302 }]), 200, {
        'x-ratelimit-limit': '1000',
        'x-ratelimit-remaining': '998',
        'x-ratelimit-reset': '3600',
      })
    },
  })

  const body = await client.get('/leagues', { season: 2026, unused: null })

  assert.deepEqual(body.data, [{ id: 302 }])
  assert.equal(requestedUrl.toString(), 'https://api.goal-api.com/v1/leagues?season=2026')
  assert.equal(authorization, 'Bearer test-secret')
  assert.equal(client.getRequestCount(), 1)
  assert.deepEqual(client.getRateLimit(), {
    limit: '1000',
    remaining: '998',
    reset: '3600',
    retryAfter: null,
  })
})

test('GOAL API client handles 204 and empty successful bodies safely', async () => {
  const responses = [
    new Response(null, { status: 204 }),
    new Response('', { status: 200 }),
  ]
  const client = createGoalApiClient({
    apiKey: 'test-secret',
    fetchImpl: async () => responses.shift(),
  })

  assert.deepEqual(await client.get('teams/1/results'), wrapper([]))
  assert.deepEqual(await client.get('teams/1/upcoming'), wrapper([]))
})

test('GOAL API client follows offset pagination with a conservative 50-item limit', async () => {
  const requests = []
  const client = createGoalApiClient({
    apiKey: 'test-secret',
    baseUrl: 'https://example.test/api',
    fetchImpl: async (url) => {
      const offset = Number(url.searchParams.get('offset'))
      requests.push({
        offset,
        limit: Number(url.searchParams.get('limit')),
        team: url.searchParams.get('team'),
      })
      return offset === 0
        ? jsonResponse(wrapper(['first'], { total: 51, limit: 50, offset: 0, hasMore: true }))
        : jsonResponse(wrapper(['last'], { total: 51, limit: 50, offset: 50, hasMore: false }))
    },
  })

  assert.deepEqual(await client.getAll('/fixtures', { team: 529, limit: 10 }), ['first', 'last'])
  assert.deepEqual(requests, [
    { offset: 0, limit: 50, team: '529' },
    { offset: 50, limit: 50, team: '529' },
  ])
})

test('GOAL API client guards against pagination that cannot make progress', async () => {
  const client = createGoalApiClient({
    apiKey: 'test-secret',
    baseUrl: 'https://example.test',
    fetchImpl: async () => jsonResponse(wrapper([], {
      total: 2,
      limit: 50,
      offset: 0,
      hasMore: true,
    })),
  })

  await assert.rejects(
    client.getAll('fixtures'),
    (error) => error instanceof GoalApiError && error.category === 'pagination',
  )
})

test('GOAL API client retries a transient 5xx response once', async () => {
  let calls = 0
  const warnings = []
  const client = createGoalApiClient({
    apiKey: 'test-secret',
    baseUrl: 'https://example.test',
    retryDelayMs: 0,
    sleep: async () => {},
    logger: { warn: (message) => warnings.push(message) },
    fetchImpl: async () => {
      calls += 1
      if (calls === 1) return jsonResponse({
        success: false,
        error: { message: 'Service unavailable', code: 'UPSTREAM', category: 'server' },
      }, 503)
      return jsonResponse(wrapper([{ ok: true }]))
    },
  })

  assert.deepEqual((await client.get('fixtures')).data, [{ ok: true }])
  assert.equal(calls, 2)
  assert.equal(warnings.length, 1)
  assert.equal(client.getRequestCount(), 2)
})

test('GOAL API client retries a network failure once', async () => {
  let calls = 0
  const client = createGoalApiClient({
    apiKey: 'test-secret',
    baseUrl: 'https://example.test',
    retryDelayMs: 0,
    sleep: async () => {},
    logger: { warn: () => {} },
    fetchImpl: async () => {
      calls += 1
      if (calls === 1) throw new TypeError('socket closed')
      return jsonResponse(wrapper([]))
    },
  })

  await client.get('fixtures')
  assert.equal(calls, 2)
})

test('GOAL API client never retries 4xx and exposes provider details', async () => {
  let calls = 0
  const client = createGoalApiClient({
    apiKey: 'test-secret',
    baseUrl: 'https://example.test',
    fetchImpl: async () => {
      calls += 1
      return jsonResponse({
        success: false,
        error: {
          message: 'Invalid API key',
          code: 'INVALID_KEY',
          category: 'authentication',
        },
      }, 401)
    },
  })

  await assert.rejects(
    client.get('fixtures'),
    (error) => error instanceof GoalApiError
      && error.status === 401
      && error.code === 'INVALID_KEY'
      && error.category === 'authentication'
      && error.message.includes('Invalid API key'),
  )
  assert.equal(calls, 1)
})

test('GOAL API client includes field-level validation details in errors', async () => {
  const client = createGoalApiClient({
    apiKey: 'test-secret',
    baseUrl: 'https://example.test',
    fetchImpl: async () => jsonResponse({
      success: false,
      error: 'Validation failed',
      code: 'VALIDATION_ERROR',
      details: [{ path: 'limit', msg: 'Must be less than or equal to 50' }],
    }, 400),
  })

  await assert.rejects(
    client.get('teams'),
    (error) => error instanceof GoalApiError
      && error.code === 'VALIDATION_ERROR'
      && error.message.includes('limit: Must be less than or equal to 50'),
  )
})

test('GOAL API client reports invalid JSON without retrying a 4xx response', async () => {
  let calls = 0
  const client = createGoalApiClient({
    apiKey: 'test-secret',
    baseUrl: 'https://example.test',
    fetchImpl: async () => {
      calls += 1
      return new Response('<html>denied</html>', { status: 403 })
    },
  })

  await assert.rejects(
    client.get('fixtures'),
    (error) => error instanceof GoalApiError
      && error.status === 403
      && error.category === 'invalid_response',
  )
  assert.equal(calls, 1)
})
