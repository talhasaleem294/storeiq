import { USD_TO_PKR_RATE } from '@/lib/constants'

const CACHE_KEY = 'storeiq_usd_pkr_rate'
const CACHE_TTL_MS = 24 * 60 * 60 * 1000 // 24 hours

interface RateCache {
  rate: number
  fetchedAt: number
}

interface ExchangeRateResponse {
  result: string
  rates: Record<string, number>
}

export async function getUsdToPkrRate(): Promise<number> {
  try {
    const cached = localStorage.getItem(CACHE_KEY)
    if (cached) {
      const parsed = JSON.parse(cached) as RateCache
      if (Date.now() - parsed.fetchedAt < CACHE_TTL_MS) {
        return parsed.rate
      }
    }
  } catch {
    // corrupted cache — ignore and fetch fresh
  }

  try {
    const res = await fetch('https://open.er-api.com/v6/latest/USD')
    const data = (await res.json()) as ExchangeRateResponse
    const pkrRate = data.result === 'success' ? data.rates['PKR'] : undefined
    if (pkrRate) {
      localStorage.setItem(CACHE_KEY, JSON.stringify({ rate: pkrRate, fetchedAt: Date.now() }))
      return pkrRate
    }
  } catch {
    // network failure — fall through to hardcoded fallback
  }

  return USD_TO_PKR_RATE
}
