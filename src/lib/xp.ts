// XP earned from any credit gain is a flat 10% of the payout — 1000 credits won = 100 XP,
// 500 = 50 XP, etc. One ratio everywhere instead of a different divisor per game.
export function xpForPayout(payout: number): number {
  return Math.round(payout / 10);
}
