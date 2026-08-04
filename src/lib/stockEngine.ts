export const STARTING_PRICE = 100;
export const TICK_MS = 500;
export const HISTORY_LENGTH = 80;
const VOLATILITY = 0.006; // ~0.6% standard deviation per tick

export const UNLOCK_TOTAL_WON = 100_000_000;

export type RoundDuration = 5 | 15 | 30;

// Longer commitment = more uncertainty for the player = bigger payout, same shape as the
// difficulty ladders in the other games — the price path itself decides the outcome, this
// table only sets what a correct call is worth.
export const DURATION_PAYOUT: Record<RoundDuration, number> = {
  5: 1.7,
  15: 1.9,
  30: 2.3,
};

// Cheap approximation of gaussian noise (sum of uniforms) — good enough for a visual price
// path, no need for a real Box-Muller transform here.
function gaussianNoise(): number {
  let sum = 0;
  for (let i = 0; i < 6; i++) sum += Math.random();
  return (sum - 3) / 3;
}

// `direction` is the player's active bet direction (1 = up, -1 = down, 0/undefined = no active
// bet) — the drift only nudges price while a round is live, proportional to admin bias, applied
// tick-by-tick as the path is generated (not retouched after the round resolves).
export function nextPrice(price: number, bias = 1, direction = 0): number {
  const drift = direction * (bias - 1) * VOLATILITY * 0.6;
  const change = gaussianNoise() * VOLATILITY + drift;
  return Math.max(1, price * (1 + change));
}
