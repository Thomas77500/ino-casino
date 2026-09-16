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

// ============================================================================
// Réputation — persistée localement (bookmakerStore.ts), jamais remise à zéro entre les sessions.
// Elle grandit avec les livres profitables et grimpe plus vite si tu gères bien tes réguliers ;
// chaque palier débloque un capital de mise (houseStake) et une taille de foule (poolMax) bien plus
// gros que le précédent — le tout premier soir dans l'arrière-salle d'un bar n'a rien à voir avec
// diriger le plus gros livre clandestin de la ville.
// ============================================================================

export interface ReputationTier {
  min: number;
  label: string;
  houseStake: number;
  poolMax: number;
}

export const REP_TIERS: ReputationTier[] = [
  { min: 0, label: "Bookmaker de Quartier", houseStake: 20_000, poolMax: 60_000 },
  { min: 40, label: "Bookmaker Reconnu", houseStake: 60_000, poolMax: 160_000 },
  { min: 100, label: "Bookmaker de la Ville", houseStake: 150_000, poolMax: 420_000 },
  { min: 220, label: "Bookmaker Régional", houseStake: 350_000, poolMax: 950_000 },
  { min: 450, label: "Parrain des Paris Clandestins", houseStake: 800_000, poolMax: 2_200_000 },
];

export function tierForReputation(reputation: number): ReputationTier {
  return [...REP_TIERS].reverse().find((t) => reputation >= t.min) ?? REP_TIERS[0];
}

// Points de réputation gagnés/perdus après un livre — profitable et gros fait grandir vite,
// perdant fait reculer, jamais sous 0.
export function reputationDelta(profit: number, houseStake: number): number {
  if (profit >= 0) return Math.max(1, Math.round((profit / houseStake) * 6));
  return -Math.max(2, Math.round((Math.abs(profit) / houseStake) * 8));
}

// ============================================================================
// Réguliers — une poignée de parieurs récurrents, nommés, avec leur propre fidélité (trust,
// 0-100, persisté par bookmakerStore.ts). Un régulier de confiance mise plus gros et paie plus
// fiablement ; un régulier méfiant mise petit et lâche plus souvent l'ardoise. Chaque manche en met
// un sous le feu des projecteurs — c'est lui qui apparaît nommément dans le récit, pas un inconnu
// anonyme à chaque fois.
// ============================================================================

export interface Regular {
  id: string;
  name: string;
  glyph: string;
  personality: string;
}

export const REGULARS: Regular[] = [
  { id: "momo", name: "Momo \"Les Bonnes Cotes\"", glyph: "🎩", personality: "un habitué du café du coin, jamais avare d'un pari risqué" },
  { id: "sylvie", name: "Sylvie du Pressing", glyph: "👛", personality: "prudente, mais fidèle quand la confiance est là" },
  { id: "kevin", name: "Kevin \"Le Flambeur\"", glyph: "💸", personality: "mise systématiquement plus qu'il ne devrait" },
  { id: "denise", name: "Denise, 68 Ans, Increvable", glyph: "🧓", personality: "suit les paris depuis trente ans, ne rate jamais un rendez-vous" },
  { id: "yanis", name: "Yanis le Barman", glyph: "🍺", personality: "prend les paris de tout le quartier pour lui-même" },
  { id: "corinne", name: "Corinne de la Compta", glyph: "📎", personality: "calcule tout, ne mise que sur du \"sûr\"" },
  { id: "doudou", name: "Doudou du Marché", glyph: "🧢", personality: "toujours partant, toujours fauché avant le week-end" },
  { id: "isabelle", name: "Isabelle, la Nouvelle", glyph: "🆕", personality: "arrivée récemment, encore méfiante" },
];

export function pickFeaturedRegular(): Regular {
  return pick(REGULARS);
}

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

// `trust` (0-100, du régulier mis en avant ce soir-là) gonfle légèrement la foule : un régulier de
// confiance ramène ses propres contacts, un régulier méfiant reste discret.
export function randomPoolSize(poolMax: number, trust = 50): number {
  const trustFactor = 0.8 + (trust / 100) * 0.4;
  return Math.round(randInt(Math.round(poolMax * 0.25), poolMax) * trustFactor);
}

// ============================================================================
// Mauvais payeurs — une part des mises perdantes a été prise "à l'ardoise" plutôt qu'en cash. La
// probabilité dépend directement de la confiance du régulier mis en avant ce soir-là : un régulier
// fiable lâche rarement l'ardoise, un régulier méfiant beaucoup plus souvent.
// ============================================================================

function badPayerLine(regular: Regular): string {
  const lines = [
    `${regular.name} prétend avoir "tout perdu dans un autre pari" ce soir-là.`,
    `${regular.name} jure te payer "la semaine prochaine, promis".`,
    `${regular.name} a curieusement changé de numéro de téléphone du jour au lendemain.`,
  ];
  return pick(lines);
}

export interface BadPayerEvent {
  happened: boolean;
  amountAtRisk: number;
  narrative: string;
  regular: Regular;
}

export function rollBadPayer(totalCollected: number, regular: Regular, trust: number): BadPayerEvent {
  const badPayerChance = Math.max(0.05, Math.min(0.45, 0.32 - (trust / 100) * 0.27));
  if (totalCollected > 0 && chance(badPayerChance)) {
    const amountAtRisk = Math.round(totalCollected * (0.08 + Math.random() * 0.22));
    return { happened: true, amountAtRisk, narrative: badPayerLine(regular), regular };
  }
  return { happened: false, amountAtRisk: 0, narrative: "", regular };
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

// Un régulier déjà digne de confiance cède plus facilement à un rappel ; un régulier déjà méfiant
// se braque davantage.
export function attemptCollect(amountAtRisk: number, trust: number, bias = 1): CollectResult {
  const successChance = 0.35 + (trust / 100) * 0.4;
  const success = chance(Math.min(0.92, Math.max(0.12, successChance * bias)));
  if (success) {
    return { recovered: amountAtRisk, narrative: pick(COLLECT_SUCCESS_LINES), success: true };
  }
  return { recovered: 0, narrative: pick(COLLECT_FAIL_LINES), success: false };
}
