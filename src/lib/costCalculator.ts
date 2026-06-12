import type { WorkspaceCostConfig } from '@/hooks/useWorkspaceCostConfig'

interface CityRow {
  city: string
  orderCount: number
}

export function computeStructuredCosts(
  config: WorkspaceCostConfig,
  orderCount: number,
  cityRows: CityRow[],
): number {
  const hasCityData = cityRows.length > 0
  const hasCityRates =
    config.cod_fee_karachi > 0 ||
    config.cod_fee_lahore > 0 ||
    config.cod_fee_islamabad > 0 ||
    config.cod_fee_other > 0

  const codFees = hasCityData && hasCityRates
    ? cityRows.reduce((sum, row) => {
        const city = row.city.toLowerCase()
        const rate =
          city === 'karachi'   ? config.cod_fee_karachi :
          city === 'lahore'    ? config.cod_fee_lahore :
          city === 'islamabad' ? config.cod_fee_islamabad :
          config.cod_fee_other > 0 ? config.cod_fee_other :
          config.cod_fee_flat
        return sum + rate * row.orderCount
      }, 0)
    : config.cod_fee_flat * orderCount

  const packagingFees = config.packaging_cost * orderCount
  return codFees + packagingFees
}

export function computeBreakEvenROAS(
  config: WorkspaceCostConfig,
  aov: number,
  avgCogsPerOrder: number,
): number | null {
  const totalCost = config.cod_fee_flat + config.packaging_cost + avgCogsPerOrder
  if (totalCost >= aov || aov <= 0) return null
  return aov / (aov - totalCost)
}
