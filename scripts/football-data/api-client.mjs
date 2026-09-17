const DEFAULT_TIMEOUT_MS = 20_000

function providerErrorMessages(errors) {
  if (!errors) return []
  if (Array.isArray(errors)) return errors.filter(Boolean).map(String)
  if (typeof errors === 'object') {
    return Object.entries(errors).map(([field, message]) => `${field}: ${message}`)
  }
  return [String(errors)]
}

function wait(milliseconds) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds))
}

export class ApiFootballError extends Error {
  constructor(message, { status = null, endpoint = '', providerErrors = [], cause } = {}) {
    super(message, { cause })
    this.name = 'ApiFootballError'
    this.status = status
    this.endpoint = endpoint
    this.providerErrors = providerErrors
  }
}

export function createApiFootballClient({
  apiKey,
  baseUrl,
  fetchImpl = globalThis.fetch,
  sleep = wait,
  timeoutMs = DEFAULT_TIMEOUT_MS,
  retryDelayMs = 1_000,
  logger = console,
} = {}) {
  if (!apiKey) throw new Error('API_FOOTBALL_KEY is required before making an API request.')
  if (!baseUrl) throw new Error('An API-Football base URL is required.')
  if (typeof fetchImpl !== 'function') throw new Error('A Fetch-compatible implementation is required.')

  let requestCount = 0
  let rateLimit = {}

  async function get(endpoint, parameters = {}) {
    const normalizedEndpoint = String(endpoint).replace(/^\/+/, '')
    const url = new URL(normalizedEndpoint, `${baseUrl.replace(/\/$/, '')}/`)

    for (const [key, value] of Object.entries(parameters)) {
      if (value !== undefined && value !== null && value !== '') {
        url.searchParams.set(key, String(value))
      }
    }

    const attempts = 2
    for (let attempt = 1; attempt <= attempts; attempt += 1) {
      const controller = new AbortController()
      const timeout = setTimeout(() => controller.abort(), timeoutMs)

      try {
        requestCount += 1
        const response = await fetchImpl(url, {
          headers: { 'x-apisports-key': apiKey },
          signal: controller.signal,
        })

        rateLimit = {
          remaining: response.headers.get('x-ratelimit-requests-remaining'),
          limit: response.headers.get('x-ratelimit-requests-limit'),
          minuteRemaining: response.headers.get('x-ratelimit-remaining'),
        }

        let body
        try {
          body = await response.json()
        } catch (cause) {
          throw new ApiFootballError(
            `API-Football returned non-JSON data for ${normalizedEndpoint}.`,
            { status: response.status, endpoint: normalizedEndpoint, cause },
          )
        }

        const errors = providerErrorMessages(body?.errors)
        if (!response.ok || errors.length > 0) {
          const message = errors.length > 0
            ? `API-Football rejected ${normalizedEndpoint}: ${errors.join('; ')}`
            : `API-Football returned HTTP ${response.status} for ${normalizedEndpoint}.`
          const error = new ApiFootballError(message, {
            status: response.status,
            endpoint: normalizedEndpoint,
            providerErrors: errors,
          })

          if ([499, 500].includes(response.status) && attempt < attempts) {
            logger.warn(`${message} Retrying once.`)
            await sleep(retryDelayMs)
            continue
          }
          throw error
        }

        if (!body || !Array.isArray(body.response)) {
          throw new ApiFootballError(
            `API-Football returned an invalid response wrapper for ${normalizedEndpoint}.`,
            { status: response.status, endpoint: normalizedEndpoint },
          )
        }

        return body
      } catch (error) {
        if (error instanceof ApiFootballError) {
          if ([499, 500].includes(error.status) && attempt < attempts) {
            logger.warn(`${error.message} Retrying once.`)
            await sleep(retryDelayMs)
            continue
          }
          throw error
        }
        if (attempt < attempts) {
          logger.warn(`API-Football request failed for ${normalizedEndpoint}. Retrying once.`)
          await sleep(retryDelayMs)
          continue
        }
        throw new ApiFootballError(
          `API-Football request failed for ${normalizedEndpoint}: ${error.message}`,
          { endpoint: normalizedEndpoint, cause: error },
        )
      } finally {
        clearTimeout(timeout)
      }
    }

    throw new ApiFootballError(`API-Football request failed for ${normalizedEndpoint}.`, {
      endpoint: normalizedEndpoint,
    })
  }

  async function getAll(endpoint, parameters = {}) {
    const items = []
    let page = 1
    let totalPages

    do {
      const body = await get(endpoint, { ...parameters, page })
      items.push(...body.response)
      page = Number(body.paging?.current || page) + 1
      totalPages = Number(body.paging?.total || 1)
    } while (page <= totalPages)

    return items
  }

  return {
    get,
    getAll,
    getRequestCount: () => requestCount,
    getRateLimit: () => ({ ...rateLimit }),
  }
}
