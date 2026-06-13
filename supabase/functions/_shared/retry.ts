/**
 * Wraps fetch() with exponential-backoff retry on 429 rate-limit responses.
 * Non-429 errors are returned immediately so the caller can handle them.
 */
export async function fetchWithRetry(
  url: string,
  opts: RequestInit,
  maxRetries = 3,
): Promise<Response> {
  let delay = 1000
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    const res = await fetch(url, opts)
    if (res.status !== 429 || attempt === maxRetries) return res
    const retryAfterSec = parseInt(res.headers.get('Retry-After') ?? String(delay / 1000), 10)
    console.warn(`[fetchWithRetry] 429 received — waiting ${String(retryAfterSec)}s (attempt ${String(attempt + 1)}/${String(maxRetries)})`)
    await new Promise((r) => setTimeout(r, retryAfterSec * 1000))
    delay *= 2
  }
  // Unreachable but satisfies TypeScript
  throw new Error('fetchWithRetry: max retries exceeded')
}
