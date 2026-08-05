import { weightedPick, biasedWeightedPick } from "./rng";

// ============================================================================
// Courses de chevaux — bet on one of 6 horses, payout = bet × its posted odds.
// Draw weight is 1/odds so every horse gives the same RTP regardless of which one you back
// (favourites win more often for a smaller payout, longshots rarely but big) — verified by
// simulation at ~85% RTP for any pick.
// ============================================================================
export interface Horse {
  id: string;
  name: string;
  glyph: string;
  odds: number;
}

export const HORSES: Horse[] = [
  { id: "eclair", name: "Éclair Noir", glyph: "🐎", odds: 2.8 },
  { id: "tornade", name: "Tornade Grise", glyph: "🐴", odds: 3.9 },
  { id: "furie", name: "Furie Rousse", glyph: "🐎", odds: 5.3 },
  { id: "ombre", name: "Ombre Blanche", glyph: "🐴", odds: 6.5 },
  { id: "vent", name: "Vent d'Est", glyph: "🐎", odds: 7.7 },
  { id: "comete", name: "Comète Dorée", glyph: "🐴", odds: 10.6 },
];

export function raceWinner(bias = 1): Horse {
  const weights = HORSES.map((h) => ({ value: h, weight: 1 / h.odds }));
  return biasedWeightedPick(weights, bias);
}

// ============================================================================
// Shared: draw `count` distinct numbers from 1..poolSize. Numbers in `favor` (the player's own
// picks) get relative weight `bias` against a baseline of 1 for every other number — at bias=1
// that's a plain uniform draw without replacement (matches the RTP tables below exactly); above
// 1 the player's own numbers are more likely to come up (generous), below 1 less likely.
// ============================================================================
function drawNumbers(poolSize: number, count: number, favor: number[], bias: number): number[] {
  const favorSet = new Set(favor);
  let pool = Array.from({ length: poolSize }, (_, i) => i + 1);
  const picked: number[] = [];
  for (let i = 0; i < count && pool.length > 0; i++) {
    const weights = pool.map((n) => ({ value: n, weight: favorSet.has(n) ? bias : 1 }));
    const chosen = weightedPick(weights);
    picked.push(chosen);
    pool = pool.filter((n) => n !== chosen);
  }
  return picked;
}

function countMatches(picks: number[], draw: number[]): number {
  const drawSet = new Set(draw);
  return picks.filter((n) => drawSet.has(n)).length;
}

// ============================================================================
// Loto — pick 5 numbers from 1-40. Tuned to ~89% RTP by simulation.
// ============================================================================
export const LOTO_POOL_SIZE = 40;
export const LOTO_PICK_COUNT = 5;
export const LOTO_TICKET_PRICE = 300;

const LOTO_PAYOUT: Record<number, number> = { 5: 10000, 4: 350, 3: 27, 2: 5.5 };

export interface LotoResult {
  draw: number[];
  matches: number;
  multiplier: number;
}

export function drawLoto(picks: number[], bias = 1): LotoResult {
  const draw = drawNumbers(LOTO_POOL_SIZE, LOTO_PICK_COUNT, picks, bias);
  const matches = countMatches(picks, draw);
  return { draw, matches, multiplier: LOTO_PAYOUT[matches] ?? 0 };
}

// ============================================================================
// Euromillions — pick 5 numbers from 1-50 + 2 stars from 1-12. Tuned to ~85% RTP by simulation.
// ============================================================================
export const EURO_MAIN_POOL = 50;
export const EURO_MAIN_COUNT = 5;
export const EURO_STAR_POOL = 12;
export const EURO_STAR_COUNT = 2;
export const EURO_TICKET_PRICE = 500;

function euroMultiplier(mainMatches: number, starMatches: number): number {
  if (mainMatches === 5 && starMatches === 2) return 50000;
  if (mainMatches === 5) return 4000;
  if (mainMatches === 4 && starMatches === 2) return 700;
  if (mainMatches === 4 || (mainMatches === 3 && starMatches === 2)) return 100;
  if (mainMatches === 3 || (mainMatches === 2 && starMatches === 2)) return 12;
  if (mainMatches === 2 && starMatches === 1) return 4.3;
  if (mainMatches === 2 && starMatches === 0) return 2.2;
  if (mainMatches === 1 && starMatches === 2) return 6;
  if (mainMatches === 1 && starMatches === 1) return 1.5;
  if (mainMatches === 1 && starMatches === 0) return 0.95;
  if (mainMatches === 0 && starMatches === 2) return 3;
  if (mainMatches === 0 && starMatches === 1) return 0.65;
  return 0;
}

export interface EuroResult {
  drawMain: number[];
  drawStars: number[];
  mainMatches: number;
  starMatches: number;
  multiplier: number;
}

export function drawEuromillions(mainPicks: number[], starPicks: number[], bias = 1): EuroResult {
  const drawMain = drawNumbers(EURO_MAIN_POOL, EURO_MAIN_COUNT, mainPicks, bias);
  const drawStars = drawNumbers(EURO_STAR_POOL, EURO_STAR_COUNT, starPicks, bias);
  const mainMatches = countMatches(mainPicks, drawMain);
  const starMatches = countMatches(starPicks, drawStars);
  return { drawMain, drawStars, mainMatches, starMatches, multiplier: euroMultiplier(mainMatches, starMatches) };
}

// ============================================================================
// Bar — drinking raises a local drunkenness meter (0-100, decays over time). It's a bonus/malus
// trade-off: a modest luck boost applied on top of the admin win-bias for every PMU bet, paid for
// with a purely cosmetic screen blur — never lets a player break the RTP tuning above, since the
// boost is capped at +25% and decays on its own.
// ============================================================================
export interface Drink {
  id: string;
  name: string;
  glyph: string;
  degree: number; // ABV%, flavor + drives how much the meter climbs
  price: number;
}

export const DRINKS: Drink[] = [
  { id: "biere", name: "Bière", glyph: "🍺", degree: 5, price: 40 },
  { id: "cidre", name: "Cidre", glyph: "🍏", degree: 4, price: 35 },
  { id: "vodka", name: "Vodka", glyph: "🥃", degree: 40, price: 120 },
  { id: "rhumcoco", name: "Rhum Coco", glyph: "🥥", degree: 35, price: 110 },
  { id: "whisky", name: "Whisky", glyph: "🧉", degree: 40, price: 125 },
  { id: "tequila", name: "Tequila", glyph: "🌵", degree: 38, price: 115 },
];

export const DRUNKENNESS_MAX = 100;
export const DRUNKENNESS_DECAY_PER_TICK = 1;

export function drunkennessGain(drink: Drink): number {
  return drink.degree * 1.5;
}

// The luck boost applied on top of the admin win-bias while drunk — capped at +25%.
export function drunkBiasMultiplier(drunkenness: number): number {
  return 1 + Math.min(drunkenness, DRUNKENNESS_MAX) / 400;
}

export interface DrunkTier {
  label: string;
  emoji: string;
}

export function drunkennessTier(drunkenness: number): DrunkTier {
  if (drunkenness < 20) return { label: "Sobre", emoji: "🙂" };
  if (drunkenness < 45) return { label: "Pompette", emoji: "😊" };
  if (drunkenness < 75) return { label: "Ivre", emoji: "🥴" };
  return { label: "Complètement bourré", emoji: "🤪" };
}
