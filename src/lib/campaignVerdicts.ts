import type { AdsData } from '@/types/app'

export type CampaignVerdict = 'scale' | 'watch' | 'pause'

export function getCampaignVerdict(
  roas: number,
  spend: number,
  breakEvenROAS: number | null,
): CampaignVerdict {
  if (spend === 0) return 'watch'
  const be = breakEvenROAS ?? 1.0
  const goodThreshold = be * 1.1
  const watchLow = be * 0.9
  if (roas > goodThreshold) return 'scale'
  if (roas >= watchLow) return 'watch'
  return 'pause'
}

export function computeVerdictSummary(
  campaigns: AdsData[],
  breakEvenROAS: number | null,
): { scaleCount: number; watchCount: number; pauseCount: number } {
  let scaleCount = 0
  let watchCount = 0
  let pauseCount = 0
  for (const c of campaigns) {
    const v = getCampaignVerdict(c.roas, c.spend, breakEvenROAS)
    if (v === 'scale') scaleCount++
    else if (v === 'watch') watchCount++
    else pauseCount++
  }
  return { scaleCount, watchCount, pauseCount }
}
