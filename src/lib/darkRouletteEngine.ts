import { biasedWeightedPick } from "./rng";

// Bonus ladder: min x20, then climbs in steps of 50 up to x500 — the rarer the bigger.
export const DARK_BONUS_MULTIPLIERS = [20, 50, 100, 150, 200, 250, 300, 350, 400, 450, 500];

const WEIGHTS = [30, 22, 16, 11, 8, 5, 3.5, 2, 1.5, 0.7, 0.3];

export const LUCKY_NUMBERS_PER_ROUND = 5;

export interface LuckyNumber {
  number: number;
  multiplier: number;
}

function rollMultiplier(bias: number): number {
  const options = DARK_BONUS_MULTIPLIERS.map((m, i) => ({ value: m, weight: WEIGHTS[i] }));
  return biasedWeightedPick(options, bias);
}

// Draws N distinct pockets (0-36) and strikes each with its own random bonus multiplier —
// like a lightning-round strike, resolved before the wheel spins so players can chase them.
export function drawLuckyNumbers(count = LUCKY_NUMBERS_PER_ROUND, bias = 1): LuckyNumber[] {
  const pool = Array.from({ length: 37 }, (_, i) => i);
  const picked: number[] = [];
  while (picked.length < count && pool.length > 0) {
    const idx = Math.floor(Math.random() * pool.length);
    picked.push(pool.splice(idx, 1)[0]);
  }
  return picked.map((number) => ({ number, multiplier: rollMultiplier(bias) }));
}
