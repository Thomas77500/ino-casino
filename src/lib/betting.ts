import { currentSalon } from "./salons";

// Max single wager scales with balance (percentage set by the player's unlocked salon)
// so a bigger bankroll unlocks bigger bets, instead of one fixed chip ladder for everyone.
export function maxBetFor(credits: number, level: number): number {
  const pct = currentSalon(level).betCapPercent / 100;
  const scaled = Math.floor(credits * pct);
  return Math.min(credits, Math.max(Math.min(10, credits), scaled));
}

export function clampBet(value: number, credits: number, level: number): number {
  const max = maxBetFor(credits, level);
  if (max <= 0) return 0;
  return Math.min(max, Math.max(1, Math.round(value)));
}
