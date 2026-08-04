import { biasedChance } from "./rng";

// How fast the multiplier climbs — doubles roughly every GROWTH_PERIOD_MS.
const GROWTH_PERIOD_MS = 2500;

// 3% instant-crash rounds bake in the house edge; otherwise draw from a heavy-tailed
// distribution so big multipliers are rare but possible — the classic crash-game shape.
export function rollCrashPoint(bias = 1): number {
  if (biasedChance(0.03, bias, true)) return 1.0;
  const r = Math.random();
  const raw = (0.97 * bias) / (1 - r);
  return Math.max(1.01, Math.round(raw * 100) / 100);
}

export function multiplierAt(elapsedMs: number): number {
  return Math.pow(2, elapsedMs / GROWTH_PERIOD_MS);
}

export function timeForMultiplier(multiplier: number): number {
  return GROWTH_PERIOD_MS * Math.log2(multiplier);
}
