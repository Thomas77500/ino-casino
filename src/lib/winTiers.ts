export type WinTier = "none" | "win" | "superWin" | "megaWin" | "gigaWin" | "maxWin";

export const TIER_LABEL: Record<WinTier, string> = {
  none: "",
  win: "WIN",
  superWin: "SUPER WIN",
  megaWin: "MEGA WIN",
  gigaWin: "GIGA WIN",
  maxWin: "MAX WIN",
};

// Tier is a function of payout relative to the stake, not the raw amount —
// so a 10-credit bet and a 10,000-credit bet get the same drama at the same multiplier.
export function tierFromMultiplier(multiplier: number): WinTier {
  if (multiplier <= 0) return "none";
  if (multiplier < 2) return "win";
  if (multiplier < 8) return "superWin";
  if (multiplier < 25) return "megaWin";
  if (multiplier < 80) return "gigaWin";
  return "maxWin";
}
