export function calculateScore(elapsedMs: number, limitSec: number) {
  const base = 1000
  const bonusMax = 500
  const limitMs = limitSec * 1000
  const clamped = Math.min(Math.max(elapsedMs, 0), limitMs)
  const bonus = Math.round(bonusMax * (1 - clamped / limitMs))
  return base + Math.max(0, bonus)
}
