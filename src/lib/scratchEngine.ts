import { weightedPick, chance, biasedWeightedPick, biasedChance } from "./rng";

export interface ScratchSymbol {
  id: string;
  glyph: string;
  weight: number;
  multiplier: number;
}

export const SCRATCH_SYMBOLS: ScratchSymbol[] = [
  { id: "cherry", glyph: "🍒", weight: 34, multiplier: 2 },
  { id: "clover", glyph: "🍀", weight: 26, multiplier: 3 },
  { id: "bell", glyph: "🔔", weight: 18, multiplier: 6 },
  { id: "gem", glyph: "💎", weight: 12, multiplier: 12 },
  { id: "star", glyph: "⭐", weight: 7, multiplier: 30 },
  { id: "crown", glyph: "👑", weight: 3, multiplier: 120 },
];

export const CARD_SIZE = 9;

// Most cards should lose — the previous version rolled 9 independent weighted symbols,
// and with only 6 symbol types that made a 3-of-a-kind land almost every single time.
// Rolling the outcome first and building the grid to match gives exact control over odds.
const LOSE_CHANCE = 0.58;
const LINE_CHANCE_WHEN_WINNING = 0.35;

const LINES: number[][] = [
  [0, 1, 2], [3, 4, 5], [6, 7, 8], // rows
  [0, 3, 6], [1, 4, 7], [2, 5, 8], // columns
  [0, 4, 8], [2, 4, 6], // diagonals
];

export type ScratchPattern = "none" | "triple" | "line";

export interface ScratchResult {
  cells: string[];
  winningSymbol: string | null;
  pattern: ScratchPattern;
  multiplier: number;
}

const SYMBOL_WEIGHTS = SCRATCH_SYMBOLS.map((s) => ({ value: s.id, weight: s.weight }));

function fillerSymbol(exclude: string): string {
  return weightedPick(SYMBOL_WEIGHTS.filter((s) => s.value !== exclude));
}

// Tiny grid, so rejection sampling for "no 3-of-a-kind anywhere" always resolves fast.
function generateLosingGrid(): string[] {
  while (true) {
    const cells = Array.from({ length: CARD_SIZE }, () => weightedPick(SYMBOL_WEIGHTS));
    const counts = new Map<string, number>();
    cells.forEach((id) => counts.set(id, (counts.get(id) ?? 0) + 1));
    if (![...counts.values()].some((c) => c >= 3)) return cells;
  }
}

function randomScatteredTriple(): number[] {
  const positions = [...Array(CARD_SIZE).keys()];
  let picked: number[];
  do {
    picked = [...positions].sort(() => Math.random() - 0.5).slice(0, 3).sort((a, b) => a - b);
  } while (LINES.some((line) => line.every((p) => picked.includes(p))));
  return picked;
}

export function generateCard(bias = 1): ScratchResult {
  if (biasedChance(LOSE_CHANCE, bias, true)) {
    return { cells: generateLosingGrid(), winningSymbol: null, pattern: "none", multiplier: 0 };
  }

  const symbol = SCRATCH_SYMBOLS.find((s) => s.id === biasedWeightedPick(SYMBOL_WEIGHTS, bias))!;
  const isLine = chance(LINE_CHANCE_WHEN_WINNING);
  const winPositions = isLine ? LINES[Math.floor(Math.random() * LINES.length)] : randomScatteredTriple();

  let cells: string[];
  do {
    cells = Array(CARD_SIZE).fill("");
    winPositions.forEach((p) => (cells[p] = symbol.id));
    for (let i = 0; i < CARD_SIZE; i++) {
      if (!cells[i]) cells[i] = fillerSymbol(symbol.id);
    }
    // Guard against filler cells accidentally forming a second, unintended triple.
  } while (SCRATCH_SYMBOLS.some((s) => s.id !== symbol.id && cells.filter((c) => c === s.id).length >= 3));

  const pattern: ScratchPattern = isLine ? "line" : "triple";
  const multiplier = pattern === "line" ? Math.round(symbol.multiplier * 1.5 * 10) / 10 : symbol.multiplier;

  return { cells, winningSymbol: symbol.id, pattern, multiplier };
}

export function symbolGlyph(id: string): string {
  return SCRATCH_SYMBOLS.find((s) => s.id === id)?.glyph ?? "❔";
}
