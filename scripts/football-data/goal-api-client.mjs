const DEFAULT_BASE_URL = 'https://api.goal-api.com/v1'
const DEFAULT_TIMEOUT_MS = 20_000
const DEFAULT_PAGE_LIMIT = 500
const DEFAULT_MAX_PAGINATION_PAGES = 1_000

function wait(milliseconds) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds))
}

function readHeader(headers, name) {
  return typeof headers?.get === 'function' ? headers.get(name) : null
}

function errorDetails(body) {
  const providerError = body?.error ?? body?.errors

  if (typeof providerError === 'string') {
    return { message: providerError, code: body?.code ?? null, category: body?.category ?? null }
  }

  if (Array.isArray(providerError)) {
    return {
      message: providerError
        .map((entry) => typeof entry === 'string' ? entry : entry?.message)
        .filter(Boolean)
        .join('; '),
      code: body?.code ?? null,
      category: body?.category ?? null,
    }
  }

  return {
    message: providerError?.message ?? body?.message ?? null,
    code: providerError?.code ?? body?.code ?? null,
    category: providerError?.category ?? providerError?.type ?? body?.category ?? null,
  }
}

function describeProviderError(details) {
  const labels = []
  if (details.code) labels.push(`code ${details.code}`)
  if (details.category) labels.push(`category ${details.category}`)
  return labels.length > 0 ? ` (${labels.join(', ')})` : ''
}

function isServerError(status) {
  return Number.isInteger(status) && status >= 500 && status <= 599
}

function normalizeOffset(value) {
  const offset = Number(value ?? 0)
  return Number.isInteger(offset) && offset >= 0 ? offset : 0
}

export class GoalApiError extends Error {
  constructor(message, {
    status = null,
    code = null,
    category = null,
    endpoint = '',
    cause,
  } = {}) {
    super(message, { cause })
    this.name = 'GoalApiError'
    this.status = status
    this.code = code
    this.category = category
    this.endpoint = endpoint
  }
}

export function createGoalApiClient({
  apiKey,
  baseUrl = DEFAULT_BASE_URL,
  fetchImpl = globalThis.fetch,
  sleep = wait,
  timeoutMs = DEFAULT_TIMEOUT_MS,
  retryDelayMs = 1_000,
  maxPaginationPages = DEFAULT_MAX_PAGINATION_PAGES,
  logger = console,
} = {}) {
  if (typeof apiKey !== 'string' || !apiKey.trim()) {
    throw new Error('GOAL_API_KEY is required before making a GOAL API request.')
  }
  if (typeof baseUrl !== 'string' || !baseUrl.trim()) {
    throw new Error('A GOAL API base URL is required.')
  }
  if (typeof fetchImpl !== 'function') throw new Error('A Fetch-compatible implementation is required.')
  if (!Number.isInteger(maxPaginationPages) || maxPaginationPages < 1) {
    throw new Error('maxPaginationPages must be a positive integer.')
  }

  const normalizedApiKey = apiKey.trim()
  const normalizedBaseUrl = `${baseUrl.trim().replace(/\/$/, '')}/`
  let requestCount = 0
  let rateLimit = {}

  async function get(endpoint, parameters = {}) {
    const normalizedEndpoint = String(endpoint).replace(/^\/+/, '')
    const url = new URL(normalizedEndpoint, normalizedBaseUrl)

    for (const [key, value] of Object.entries(parameters)) {
      if (value === undefined || value === null || value === '') continue
      if (Array.isArray(value)) {
        for (const item of value) url.searchParams.append(key, String(item))
      } else {
        url.searchParams.set(key, String(value))
      }
    }

    for (let attempt = 1; attempt <= 2; attempt += 1) {
      const controller = new AbortController()
      const timeout = setTimeout(() => controller.abort(), timeoutMs)

      try {
        requestCount += 1
        const response = await fetchImpl(url, {
          headers: { Authorization: `Bearer ${normalizedApiKey}` },
          signal: controller.signal,
        })

        rateLimit = {
          limit: readHeader(response.headers, 'x-ratelimit-limit'),
          remaining: readHeader(response.headers, 'x-ratelimit-remaining'),
          reset: readHeader(response.headers, 'x-ratelimit-reset'),
          retryAfter: readHeader(response.headers, 'retry-after'),
        }

        if (response.status === 204) {
          return { success: true, data: [], pagination: null }
        }

        const responseText = await response.text()
        let body
        if (!responseText.trim()) {
          if (response.ok) return { success: true, data: [], pagination: null }
          body = null
        } else {
          try {
            body = JSON.parse(responseText)
          } catch (cause) {
            throw new GoalApiError(
              `GOAL API returned non-JSON data for ${normalizedEndpoint}.`,
              { status: response.status, category: 'invalid_response', endpoint: normalizedEndpoint, cause },
            )
          }
        }

        const details = errorDetails(body)
        if (!response.ok || body?.success === false) {
          const reason = details.message || `HTTP ${response.status}`
          throw new GoalApiError(
            `GOAL API rejected ${normalizedEndpoint}: ${reason}${describeProviderError(details)}.`,
            {
              status: response.status,
              code: details.code,
              category: details.category,
              endpoint: normalizedEndpoint,
            },
          )
        }

        if (!body || typeof body !== 'object' || Array.isArray(body)
          || body.success !== true || !Object.hasOwn(body, 'data')) {
          throw new GoalApiError(
            `GOAL API returned an invalid response wrapper for ${normalizedEndpoint}.`,
            { status: response.status, category: 'invalid_response', endpoint: normalizedEndpoint },
          )
        }

        return { ...body, pagination: body.pagination ?? null }
      } catch (error) {
        const retryable = error instanceof GoalApiError
          ? isServerError(error.status)
          : true

        if (retryable && attempt < 2) {
          logger.warn(`GOAL API request failed for ${normalizedEndpoint}. Retrying once.`)
          await sleep(retryDelayMs)
          continue
        }

        if (error instanceof GoalApiError) throw error

        const timedOut = controller.signal.aborted
        throw new GoalApiError(
          timedOut
            ? `GOAL API request timed out for ${normalizedEndpoint}.`
            : `GOAL API request failed for ${normalizedEndpoint}: ${error.message}`,
          {
            endpoint: normalizedEndpoint,
            category: timedOut ? 'timeout' : 'network',
            cause: error,
          },
        )
      } finally {
        clearTimeout(timeout)
      }
    }

    throw new GoalApiError(`GOAL API request failed for ${normalizedEndpoint}.`, {
      endpoint: normalizedEndpoint,
    })
  }

  async function getAll(endpoint, parameters = {}) {
    const items = []
    const seenOffsets = new Set()
    let offset = normalizeOffset(parameters.offset)

    for (let page = 1; page <= maxPaginationPages; page += 1) {
      if (seenOffsets.has(offset)) {
        throw new GoalApiError(`GOAL API pagination repeated offset ${offset} for ${endpoint}.`, {
          endpoint: String(endpoint),
          category: 'pagination',
        })
      }
      seenOffsets.add(offset)

      const body = await get(endpoint, {
        ...parameters,
        limit: DEFAULT_PAGE_LIMIT,
        offset,
      })

      if (!Array.isArray(body.data)) {
        throw new GoalApiError(`GOAL API returned non-list data while paginating ${endpoint}.`, {
          endpoint: String(endpoint),
          category: 'invalid_response',
        })
      }

      items.push(...body.data)
      const pagination = body.pagination ?? {}
      const total = Number(pagination.total)
      const responseOffset = normalizeOffset(pagination.offset ?? offset)
      const responseLimit = Number(pagination.limit)
      const step = Number.isInteger(responseLimit) && responseLimit > 0
        ? responseLimit
        : DEFAULT_PAGE_LIMIT
      const explicitHasMore = pagination.hasMore ?? pagination.has_more
      const hasMore = typeof explicitHasMore === 'boolean'
        ? explicitHasMore
        : Number.isFinite(total)
          ? responseOffset + body.data.length < total
          : body.data.length === DEFAULT_PAGE_LIMIT

      if (!hasMore) return items
      if (body.data.length === 0) {
        throw new GoalApiError(`GOAL API pagination made no progress for ${endpoint}.`, {
          endpoint: String(endpoint),
          category: 'pagination',
        })
      }

      const nextOffset = responseOffset + step
      if (nextOffset <= offset) {
        throw new GoalApiError(`GOAL API pagination returned a non-advancing offset for ${endpoint}.`, {
          endpoint: String(endpoint),
          category: 'pagination',
        })
      }
      offset = nextOffset
    }

    throw new GoalApiError(
      `GOAL API pagination exceeded ${maxPaginationPages} pages for ${endpoint}.`,
      { endpoint: String(endpoint), category: 'pagination' },
    )
  }

  return {
    get,
    getAll,
    getRequestCount: () => requestCount,
    getRateLimit: () => ({ ...rateLimit }),
  }
}
