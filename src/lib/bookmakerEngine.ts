import { chance, randInt, pick } from "./rng";
import { CLUBS, type Club } from "./clubEngine";

// ============================================================================
// Bookmaker Clandestin — 100% fictif. Tu fixes les cotes d'un match entre deux clubs de l'Arc
// Président de Club (même univers, mêmes clubs inventés), un flot de parieurs simulés réagit à tes
// cotes, le match se joue, tu encaisses la différence entre les mises collectées et les gains à
// verser. Contrairement à la Table Clandestine, il n'y a pas d'autres VRAIS joueurs à la table ici —
// comme tous les autres jeux solo de ce casino, la "foule" de parieurs est un flux simulé, pas du
// PvP réel.
// ============================================================================

export const HOUSE_STAKE = 20_000; // capital risqué pour ouvrir le livre sur une manche

export type Outcome = "home" | "draw" | "away";
export const OUTCOMES: Outcome[] = ["home", "draw", "away"];
export const OUTCOME_LABEL: Record<Outcome, string> = { home: "Victoire Domicile", draw: "Match Nul", away: "Victoire Extérieur" };

export interface BookmakerMatch {
  home: Club;
  away: Club;
  fair: Record<Outcome, number>; // probabilités "vraies", somme à 1 — jamais montrées telles quelles au joueur
}

// Un écart de niveau entre les deux clubs (leur tier dans l'Arc Président de Club) penche le
// résultat "vrai" vers le favori, sans jamais l'écraser totalement — l'outsider garde toujours une
// vraie chance, et le nul reste plus probable quand les deux équipes se valent.
export function generateMatch(): BookmakerMatch {
  const pool = [...CLUBS];
  const home = pick(pool);
  let away = pick(pool);
  while (away.id === home.id) away = pick(pool);

  const diff = home.tier - away.tier; // -4..4
  const homeRaw = 0.36 + diff * 0.065;
  const drawRaw = 0.28 - Math.abs(diff) * 0.018;
  const homeP = Math.max(0.08, Math.min(0.8, homeRaw));
  const drawP = Math.max(0.08, Math.min(0.4, drawRaw));
  const awayP = Math.max(0.08, 1 - homeP - drawP);
  const total = homeP + drawP + awayP;
  return { home, away, fair: { home: homeP / total, draw: drawP / total, away: awayP / total } };
}

// Cote "juste" (équitable, marge nulle) pour une probabilité donnée — sert de repère central, le
// joueur ne peut s'en écarter que dans une fourchette raisonnable (voir clampOdds).
export function fairOdds(p: number): number {
  return Math.max(1.05, Math.round((1 / p) * 100) / 100);
}

export const MIN_ODDS_FACTOR = 0.65; // le joueur ne peut pas descendre sous 65% de la cote juste (trop radin, personne ne mise)
export const MAX_ODDS_FACTOR = 1.7; // ni dépasser 170% de la cote juste (trop généreux, ruineux si ça tombe)

export function clampOdds(fair: number, requested: number): number {
  return Math.round(Math.max(fair * MIN_ODDS_FACTOR, Math.min(fair * MAX_ODDS_FACTOR, requested)) * 100) / 100;
}

export function defaultOdds(match: BookmakerMatch): Record<Outcome, number> {
  return { home: fairOdds(match.fair.home), draw: fairOdds(match.fair.draw), away: fairOdds(match.fair.away) };
}

// La "foule" mise davantage sur un résultat dont la cote proposée dépasse sa juste valeur (bonne
// affaire perçue), pondéré par l'attrait intrinsèque du résultat (un favori attire du monde même à
// cote juste, un nul beaucoup moins).
function computeStakes(match: BookmakerMatch, odds: Record<Outcome, number>, poolSize: number): Record<Outcome, number> {
  const fair = defaultOdds(match);
  const attractiveness: Record<Outcome, number> = {
    home: match.fair.home * Math.max(0.15, odds.home / fair.home),
    draw: match.fair.draw * Math.max(0.15, odds.draw / fair.draw),
    away: match.fair.away * Math.max(0.15, odds.away / fair.away),
  };
  const total = attractiveness.home + attractiveness.draw + attractiveness.away;
  return {
    home: Math.round(poolSize * (attractiveness.home / total)),
    draw: Math.round(poolSize * (attractiveness.draw / total)),
    away: Math.round(poolSize * (attractiveness.away / total)),
  };
}

export interface BookResult {
  outcome: Outcome;
  stakes: Record<Outcome, number>;
  totalCollected: number;
  payout: number;
  profit: number;
}

// Le résultat du match ne dépend jamais des cotes que tu as fixées (comme dans la vraie vie, le
// bookmaker n'influence pas le score) — seulement des forces respectives des deux clubs et, comme
// partout ailleurs dans ce casino, du curseur admin "Probabilité de gain". Même idiome que
// rouletteEngine.spinWheel : on échantillonne des candidats et, selon bias, on garde le plus (ou le
// moins) favorable à la maison — ici "favorable" veut dire "le moins cher à payer".
export function runBook(match: BookmakerMatch, odds: Record<Outcome, number>, poolSize: number, bias = 1): BookResult {
  const stakes = computeStakes(match, odds, poolSize);
  const payoutFor = (o: Outcome) => stakes[o] * odds[o];

  let outcome = weightedOutcome(match.fair);
  if (bias !== 1 && chance(Math.min(0.9, Math.abs(bias - 1) * 0.6))) {
    const scored = OUTCOMES.map((o) => ({ o, payout: payoutFor(o) }));
    outcome = bias > 1
      ? scored.reduce((a, b) => (b.payout < a.payout ? b : a)).o
      : scored.reduce((a, b) => (b.payout > a.payout ? b : a)).o;
  }

  const totalCollected = stakes.home + stakes.draw + stakes.away;
  const payout = Math.round(payoutFor(outcome));
  return { outcome, stakes, totalCollected, payout, profit: totalCollected - payout };
}

function weightedOutcome(fair: Record<Outcome, number>): Outcome {
  const roll = Math.random();
  if (roll < fair.home) return "home";
  if (roll < fair.home + fair.draw) return "draw";
  return "away";
}

export function randomPoolSize(): number {
  return randInt(15000, 60000);
}

// ============================================================================
// Mauvais payeurs — une part des mises perdantes a été prise "à l'ardoise" plutôt qu'en cash. Un
// coup sur cinq environ, l'un de ces parieurs ne paie pas — au joueur de choisir d'encaisser la
// perte ou de tenter de la récupérer, avec un petit risque en contrepartie.
// ============================================================================

const BAD_PAYER_LINES = [
  "Un parieur régulier prétend avoir \"tout perdu dans un autre pari\" ce soir-là.",
  "Le type au bar du coin jure qu'il te paiera \"la semaine prochaine, promis\".",
  "Une habituée a changé de numéro de téléphone du jour au lendemain.",
];

export interface BadPayerEvent {
  happened: boolean;
  amountAtRisk: number;
  narrative: string;
}

export function rollBadPayer(totalCollected: number): BadPayerEvent {
  if (totalCollected > 0 && chance(0.22)) {
    const amountAtRisk = Math.round(totalCollected * (0.08 + Math.random() * 0.22));
    return { happened: true, amountAtRisk, narrative: pick(BAD_PAYER_LINES) };
  }
  return { happened: false, amountAtRisk: 0, narrative: "" };
}

export interface CollectResult {
  recovered: number;
  narrative: string;
  success: boolean;
}

const COLLECT_SUCCESS_LINES = [
  "Un rappel ferme mais poli suffit — l'argent arrive le soir même.",
  "Ta réputation seule fait le travail, il paie rubis sur l'ongle.",
];
const COLLECT_FAIL_LINES = [
  "Il jure ses grands dieux qu'il n'a plus un centime. Difficile d'insister davantage.",
  "Le rappel tourne mal — il évite désormais ton book, et le dit autour de lui.",
];

export function attemptCollect(amountAtRisk: number, bias = 1): CollectResult {
  const success = chance(Math.min(0.9, Math.max(0.15, 0.55 * bias)));
  if (success) {
    return { recovered: amountAtRisk, narrative: pick(COLLECT_SUCCESS_LINES), success: true };
  }
  return { recovered: 0, narrative: pick(COLLECT_FAIL_LINES), success: false };
}
