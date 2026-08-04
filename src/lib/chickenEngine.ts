import { biasedChance } from "./rng";

export type Difficulty = "easy" | "medium" | "hard" | "extreme";

export const STEPS = 10;
const HOUSE_EDGE = 0.96;

export const SURVIVAL_PROB: Record<Difficulty, number> = {
  easy: 0.92,
  medium: 0.85,
  hard: 0.75,
  extreme: 0.6,
};

export const DIFFICULTY_LABEL: Record<Difficulty, string> = {
  easy: "Facile",
  medium: "Moyen",
  hard: "Difficile",
  extreme: "Extrême",
};

// Fair odds (1 / cumulative survival probability) shaved by a house edge —
// same shape as a real crash-style ladder, just deterministic per difficulty.
export function buildMultiplierTable(difficulty: Difficulty): number[] {
  const p = SURVIVAL_PROB[difficulty];
  const table: number[] = [];
  for (let step = 1; step <= STEPS; step++) {
    const cumulative = Math.pow(p, step);
    table.push(Math.round((HOUSE_EDGE / cumulative) * 100) / 100);
  }
  return table;
}

export function rollStepSurvives(difficulty: Difficulty, bias = 1): boolean {
  return biasedChance(SURVIVAL_PROB[difficulty], bias);
}
