import { biasedWeightedPick } from "./rng";
import { tierFromMultiplier, type WinTier } from "./winTiers";

export interface SlotSymbol {
  id: string;
  glyph: string;
  weight: number;
  pay3: number; // payout multiplier (of the per-line stake) for 3-in-a-row
}

export type Grid = string[][]; // 3 rows x 3 cols of symbol ids

export const PAYLINES: [number, number][][] = [
  [[0, 0], [0, 1], [0, 2]], // top row
  [[1, 0], [1, 1], [1, 2]], // middle row
  [[2, 0], [2, 1], [2, 2]], // bottom row
  [[0, 0], [1, 1], [2, 2]], // diagonal
  [[2, 0], [1, 1], [0, 2]], // anti-diagonal
];

export function spinGrid(symbols: SlotSymbol[], bias = 1): Grid {
  const weighted = symbols.map((s) => ({ value: s.id, weight: s.weight }));
  return [0, 1, 2].map(() => [0, 1, 2].map(() => biasedWeightedPick(weighted, bias)));
}

export interface LineResult {
  lineIndex: number;
  symbol: string;
  cells: [number, number][];
  payout: number;
}

export interface SpinResult {
  grid: Grid;
  bet: number;
  wins: LineResult[];
  payout: number;
  multiplier: number;
  tier: WinTier;
}

export function evaluateSpin(grid: Grid, bet: number, symbols: SlotSymbol[]): SpinResult {
  const byId = Object.fromEntries(symbols.map((s) => [s.id, s]));
  const betPerLine = bet / PAYLINES.length;
  const wins: LineResult[] = [];

  PAYLINES.forEach((cells, lineIndex) => {
    const cellSymbols = cells.map(([r, c]) => grid[r][c]);
    const nonWild = cellSymbols.find((s) => s !== "wild");
    const target = nonWild ?? "wild";
    const matches = cellSymbols.every((s) => s === target || s === "wild");
    if (matches) {
      const payout = byId[target].pay3 * betPerLine;
      wins.push({ lineIndex, symbol: target, cells, payout });
    }
  });

  const payout = wins.reduce((sum, w) => sum + w.payout, 0);
  const multiplier = payout / bet;

  return { grid, bet, wins, payout, multiplier, tier: tierFromMultiplier(multiplier) };
}

export function symbolGlyph(id: string, symbols: SlotSymbol[]): string {
  return symbols.find((s) => s.id === id)?.glyph ?? "❔";
}
