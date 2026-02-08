import { logApi, logError } from '@/services/SystemMonitorService'

/**
 * Wraps fetch to log API calls to the System Console
 */
export function createApiInterceptor() {
  if (typeof window === 'undefined') return // Only run on client

  const originalFetch = window.fetch

  window.fetch = async function(...args) {
    const [input, init] = args
    const url = typeof input === 'string' 
      ? input 
      : input instanceof URL 
        ? input.toString() 
        : input.url
    const method = init?.method || 'GET'
    const startTime = Date.now()

    try {
      const response = await originalFetch.apply(this, args)
      const duration = Date.now() - startTime

      // Log API activity
      logApi(method, url, response.status, duration)

      // Log errors specifically
      if (!response.ok && response.status >= 400) {
        logError(
          `API Error: ${method} ${url} - ${response.status} ${response.statusText}`,
          'API',
          { status: response.status, statusText: response.statusText }
        )
      }

      return response
    } catch (error) {
      const duration = Date.now() - startTime
      logError(
        `Network Error: ${method} ${url}`,
        'API',
        { error: error instanceof Error ? error.message : String(error), duration }
      )
      throw error
    }
  }
}

// Initialize the interceptor
if (typeof window !== 'undefined') {
  createApiInterceptor()
}
