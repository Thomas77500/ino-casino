export const GRID_SIZE = 25; // 5x5 vault

export type RiskLevel = "faible" | "moyen" | "eleve";

export const ALARM_COUNTS: Record<RiskLevel, number> = {
  faible: 3,
  moyen: 5,
  eleve: 8,
};

export const RISK_LABEL: Record<RiskLevel, string> = {
  faible: "Risque faible",
  moyen: "Risque moyen",
  eleve: "Risque élevé",
};

const HOUSE_EDGE = 0.96;

// Fair hypergeometric odds for "k safe picks in a row out of N tiles with A alarms" — same
// house-edge-shaved approach as the Chicken Road ladder, just grid-shaped instead of linear.
export function buildHeistMultiplier(risk: RiskLevel, picks: number): number {
  const alarms = ALARM_COUNTS[risk];
  const safe = GRID_SIZE - alarms;
  let fairMultiplier = 1;
  for (let i = 0; i < picks; i++) {
    fairMultiplier *= (GRID_SIZE - i) / (safe - i);
  }
  return Math.round(fairMultiplier * HOUSE_EDGE * 100) / 100;
}

export function safeTileCount(risk: RiskLevel): number {
  return GRID_SIZE - ALARM_COUNTS[risk];
}

// true = alarm tile. The displayed payout table (buildHeistMultiplier) always uses the nominal
// alarm count for `risk` — this draws with an *effective* count nudged by `bias`, so the shown
// odds and the real odds intentionally diverge when an admin dials this away from 1.
export function drawGrid(risk: RiskLevel, bias = 1): boolean[] {
  const nominal = ALARM_COUNTS[risk];
  const alarms = Math.min(GRID_SIZE - 1, Math.max(1, Math.round(nominal / bias)));
  const cells = Array(GRID_SIZE).fill(false);
  const indices = [...Array(GRID_SIZE).keys()];
  for (let i = 0; i < alarms; i++) {
    const idx = Math.floor(Math.random() * indices.length);
    cells[indices[idx]] = true;
    indices.splice(idx, 1);
  }
  return cells;
}
