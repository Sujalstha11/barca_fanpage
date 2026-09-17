import assert from 'node:assert/strict'
import test from 'node:test'

import { ApiFootballError, createApiFootballClient } from '../scripts/football-data/api-client.mjs'

function jsonResponse(body, status = 200, headers = {}) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json', ...headers },
  })
}

function wrapper(response, paging = { current: 1, total: 1 }, errors = []) {
  return { get: '', parameters: [], errors, results: response.length, paging, response }
}

test('API client sends the private key in a header and parses the response wrapper', async () => {
  let requestedUrl
  let requestedKey
  const client = createApiFootballClient({
    apiKey: 'test-secret',
    baseUrl: 'https://example.test',
    fetchImpl: async (url, options) => {
      requestedUrl = url
      requestedKey = options.headers['x-apisports-key']
      return jsonResponse(wrapper([{ id: 529 }]), 200, {
        'x-ratelimit-requests-remaining': '99',
      })
    },
  })

  const body = await client.get('/teams', { id: 529 })
  assert.deepEqual(body.response, [{ id: 529 }])
  assert.equal(requestedUrl.toString(), 'https://example.test/teams?id=529')
  assert.equal(requestedKey, 'test-secret')
  assert.equal(client.getRequestCount(), 1)
  assert.equal(client.getRateLimit().remaining, '99')
})

test('API client follows all pagination pages', async () => {
  const pages = []
  const client = createApiFootballClient({
    apiKey: 'test-secret',
    baseUrl: 'https://example.test',
    fetchImpl: async (url) => {
      const page = Number(url.searchParams.get('page'))
      pages.push(page)
      return jsonResponse(wrapper([page], { current: page, total: 3 }))
    },
  })

  assert.deepEqual(await client.getAll('players', { team: 529 }), [1, 2, 3])
  assert.deepEqual(pages, [1, 2, 3])
})

test('API client retries a transient server response once', async () => {
  let calls = 0
  const warnings = []
  const client = createApiFootballClient({
    apiKey: 'test-secret',
    baseUrl: 'https://example.test',
    retryDelayMs: 0,
    sleep: async () => {},
    logger: { warn: (message) => warnings.push(message) },
    fetchImpl: async () => {
      calls += 1
      if (calls === 1) return jsonResponse(wrapper([], undefined, []), 500)
      return jsonResponse(wrapper([{ ok: true }]))
    },
  })

  const body = await client.get('fixtures')
  assert.deepEqual(body.response, [{ ok: true }])
  assert.equal(calls, 2)
  assert.equal(warnings.length, 1)
})

test('API client stops on quota errors and exposes provider errors', async () => {
  let calls = 0
  const client = createApiFootballClient({
    apiKey: 'test-secret',
    baseUrl: 'https://example.test',
    fetchImpl: async () => {
      calls += 1
      return jsonResponse(wrapper([], undefined, { rateLimit: 'Too many requests' }), 429)
    },
  })

  await assert.rejects(
    client.get('fixtures'),
    (error) => error instanceof ApiFootballError
      && error.status === 429
      && error.message.includes('Too many requests'),
  )
  assert.equal(calls, 1)
})
