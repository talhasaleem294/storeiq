import type { Order } from '@/types/app'

export type RtoRisk = 'low' | 'medium' | 'high'

export function computeRtoRiskScore(
  order: Order,
  cityRtoRates: Map<string, number>,
  priorCustomerIds: Set<string>,
): RtoRisk {
  let score = 0
  const hour = new Date(order.created_at).getHours()

  // City-level RTO rate
  const cityKey = (order as unknown as { city?: string }).city?.toLowerCase() ?? ''
  const cityRate = cityRtoRates.get(cityKey) ?? 0.3
  if (cityRate > 0.4) score += 3
  else if (cityRate > 0.25) score += 1

  // High-value COD
  if (order.revenue > 5000) score += 2

  // Late-night order (11pm–2am)
  if (hour >= 23 || hour <= 2) score += 2

  // COD order (status pending = COD)
  if (order.status === 'pending') score += 1

  // First-time customer
  if (order.customer_id && !priorCustomerIds.has(order.customer_id)) score += 1

  if (score >= 6) return 'high'
  if (score >= 3) return 'medium'
  return 'low'
}
