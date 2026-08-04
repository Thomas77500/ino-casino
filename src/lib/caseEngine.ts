import { biasedWeightedPick, type Weighted } from "./rng";

export type ItemRarity = "commune" | "peuCommune" | "rare" | "legendaire" | "covert" | "rareSpeciale";

export const RARITY_ORDER: ItemRarity[] = ["commune", "peuCommune", "rare", "legendaire", "covert", "rareSpeciale"];

export const RARITY_LABEL: Record<ItemRarity, string> = {
  commune: "Commune",
  peuCommune: "Peu Commune",
  rare: "Rare",
  legendaire: "Légendaire",
  covert: "Covert",
  rareSpeciale: "Rare Spéciale",
};

export const RARITY_STYLE: Record<ItemRarity, { text: string; border: string; bg: string; glow: boolean }> = {
  commune: { text: "text-ice-200/70", border: "border-white/15", bg: "bg-white/5", glow: false },
  peuCommune: { text: "text-electric-400", border: "border-electric-500/50", bg: "bg-electric-500/10", glow: false },
  rare: { text: "text-fuchsia-400", border: "border-fuchsia-500/50", bg: "bg-fuchsia-500/10", glow: false },
  legendaire: { text: "text-pink-400", border: "border-pink-500/60", bg: "bg-pink-500/10", glow: true },
  covert: { text: "text-red-400", border: "border-red-500/60", bg: "bg-red-500/10", glow: true },
  rareSpeciale: { text: "text-gold-400", border: "border-gold-400", bg: "bg-gold-500/10", glow: true },
};

// Odds sum to 100. Item `multiplier` is applied to the case's price to get its credit value —
// tuned (see simulate_cases.mjs) so every case lands around ~86% RTP regardless of its price.
const ODDS: Record<ItemRarity, number> = {
  commune: 60,
  peuCommune: 26,
  rare: 10,
  legendaire: 3,
  covert: 0.8,
  rareSpeciale: 0.2,
};

export interface CaseItem {
  id: string;
  name: string;
  glyph: string;
  rarity: ItemRarity;
  multiplier: number;
}

// Shared across every case — only the price (and therefore each item's credit value) changes
// between cases, matching how real CS:GO-style case pools reuse the same skin across containers.
export const ITEM_POOL: CaseItem[] = [
  { id: "urbaine", name: "Éraflure Urbaine", glyph: "🔧", rarity: "commune", multiplier: 0.15 },
  { id: "basique", name: "Trame Basique", glyph: "⚙️", rarity: "commune", multiplier: 0.25 },
  { id: "sable", name: "Motif Sable", glyph: "🪨", rarity: "commune", multiplier: 0.35 },
  { id: "terne", name: "Vernis Terne", glyph: "🟤", rarity: "commune", multiplier: 0.45 },

  { id: "foret", name: "Camouflage Forêt", glyph: "🌲", rarity: "peuCommune", multiplier: 0.35 },
  { id: "vagues", name: "Vagues Bleues", glyph: "🌊", rarity: "peuCommune", multiplier: 0.47 },
  { id: "griffures", name: "Griffures Métal", glyph: "⚡", rarity: "peuCommune", multiplier: 0.58 },
  { id: "azur", name: "Motif Azur", glyph: "🔷", rarity: "peuCommune", multiplier: 0.70 },

  { id: "violette", name: "Flamme Violette", glyph: "🟣", rarity: "rare", multiplier: 0.9 },
  { id: "toxique", name: "Éclair Toxique", glyph: "☢️", rarity: "rare", multiplier: 1.4 },
  { id: "obsidienne", name: "Fracture Obsidienne", glyph: "⬛", rarity: "rare", multiplier: 2.0 },

  { id: "ecarlate", name: "Dragon Écarlate", glyph: "🐉", rarity: "legendaire", multiplier: 3 },
  { id: "cosmique", name: "Void Cosmique", glyph: "🌌", rarity: "legendaire", multiplier: 7 },

  { id: "phenix", name: "Phénix Ardent", glyph: "🔥", rarity: "covert", multiplier: 12 },
  { id: "eclipse", name: "Éclipse Royale", glyph: "👑", rarity: "covert", multiplier: 18 },

  { id: "lame", name: "Lame Céleste", glyph: "🗡️", rarity: "rareSpeciale", multiplier: 40 },
  { id: "griffe", name: "Griffe du Fondateur", glyph: "💫", rarity: "rareSpeciale", multiplier: 100 },
];

export interface CaseDef {
  id: string;
  name: string;
  price: number;
  accent: string;
}

export const CASES: CaseDef[] = [
  { id: "bronze", name: "Caisse Bronze", price: 500, accent: "from-amber-700 to-amber-900" },
  { id: "argent", name: "Caisse Argent", price: 2_500, accent: "from-ice-100 to-ice-200" },
  { id: "or", name: "Caisse Or", price: 10_000, accent: "from-gold-400 to-gold-500" },
  { id: "diamant", name: "Caisse Diamant", price: 40_000, accent: "from-electric-400 to-fuchsia-500" },
];

const RARITY_WEIGHTS: Weighted<ItemRarity>[] = RARITY_ORDER.map((r) => ({ value: r, weight: ODDS[r] }));

export interface DrawnItem extends CaseItem {
  value: number;
}

export function drawItem(casePrice: number, bias = 1): DrawnItem {
  const rarity = biasedWeightedPick(RARITY_WEIGHTS, bias);
  const pool = ITEM_POOL.filter((i) => i.rarity === rarity);
  const item = pool[Math.floor(Math.random() * pool.length)];
  return { ...item, value: Math.round(casePrice * item.multiplier) };
}

// Pure visual filler for the spinning reel — doesn't need to respect real odds.
export function randomDecoyItem(casePrice: number): DrawnItem {
  const item = ITEM_POOL[Math.floor(Math.random() * ITEM_POOL.length)];
  return { ...item, value: Math.round(casePrice * item.multiplier) };
}
