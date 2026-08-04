import { chance } from "./rng";

function clamp01(n: number): number {
  return Math.min(0.95, Math.max(0.05, n));
}

export type RiskLevel = "low" | "medium" | "high" | "extreme";

export const ROWS = 12;
export const BUCKETS = ROWS + 1;

export const RISK_LABEL: Record<RiskLevel, string> = {
  low: "Risque faible",
  medium: "Risque moyen",
  high: "Risque élevé",
  extreme: "Risque extrême",
};

// Symmetric payout curve per risk level — edges pay big (rare), center pays little (common).
export const BUCKET_MULTIPLIERS: Record<RiskLevel, number[]> = {
  low: [5.6, 2.1, 1.4, 1.1, 1.0, 0.8, 0.5, 0.8, 1.0, 1.1, 1.4, 2.1, 5.6],
  medium: [15, 5, 2, 1.3, 0.8, 0.5, 0.3, 0.5, 0.8, 1.3, 2, 5, 15],
  high: [45, 12, 4, 1.5, 0.5, 0.3, 0.15, 0.3, 0.5, 1.5, 4, 12, 45],
  extreme: [1000, 130, 26, 6, 1.5, 0.3, 0.1, 0.3, 1.5, 6, 26, 130, 1000],
};

export interface DropResult {
  path: number[]; // 1 = bounced right, 0 = bounced left, one entry per row
  bucket: number; // 0..ROWS
  multiplier: number;
}

// Each row is normally a fair 50/50 bounce. Biasing every row slightly toward one side pushes
// the final bucket toward an edge more often when generous (bias>1) — the payout curve is
// symmetric, so which edge doesn't matter, only how often the ball ends up near one.
export function dropBall(risk: RiskLevel, bias = 1): DropResult {
  const rowChance = clamp01(0.5 + (bias - 1) * 0.15);
  const path: number[] = [];
  let bucket = 0;
  for (let i = 0; i < ROWS; i++) {
    const right = chance(rowChance) ? 1 : 0;
    path.push(right);
    bucket += right;
  }
  return { path, bucket, multiplier: BUCKET_MULTIPLIERS[risk][bucket] };
}
