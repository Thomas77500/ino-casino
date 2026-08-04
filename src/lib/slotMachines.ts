import type { SlotSymbol } from "./slotsEngine";

export type Volatility = "low" | "medium" | "high" | "extreme";

export interface SlotMachineConfig {
  id: string;
  name: string;
  theme: string;
  accent: string;
  volatility: Volatility;
  minLevel: number;
  symbols: SlotSymbol[];
}

export const VOLATILITY_LABEL: Record<Volatility, string> = {
  low: "Volatilité basse",
  medium: "Volatilité moyenne",
  high: "Volatilité haute",
  extreme: "Volatilité extrême",
};

export const SLOT_MACHINES: SlotMachineConfig[] = [
  {
    id: "golden-reels",
    name: "Golden Reels",
    theme: "Classique doré",
    accent: "from-gold-400 to-electric-400",
    volatility: "medium",
    minLevel: 1,
    symbols: [
      { id: "cherry", glyph: "🍒", weight: 30, pay3: 1.5 },
      { id: "lemon", glyph: "🍋", weight: 25, pay3: 2 },
      { id: "bell", glyph: "🔔", weight: 18, pay3: 3.5 },
      { id: "star", glyph: "⭐", weight: 12, pay3: 6 },
      { id: "diamond", glyph: "💎", weight: 8, pay3: 14 },
      { id: "seven", glyph: "7️⃣", weight: 5, pay3: 35 },
      { id: "wild", glyph: "🃏", weight: 2, pay3: 70 },
    ],
  },
  {
    id: "fruit-rush",
    name: "Fruit Rush",
    theme: "Fruits — gains fréquents",
    accent: "from-emerald-400 to-electric-400",
    volatility: "low",
    minLevel: 1,
    symbols: [
      { id: "grape", glyph: "🍇", weight: 34, pay3: 1.3 },
      { id: "cherry", glyph: "🍒", weight: 28, pay3: 1.6 },
      { id: "watermelon", glyph: "🍉", weight: 20, pay3: 2.2 },
      { id: "lemon", glyph: "🍋", weight: 14, pay3: 3 },
      { id: "bell", glyph: "🔔", weight: 8, pay3: 5 },
      { id: "star", glyph: "⭐", weight: 4, pay3: 10 },
      { id: "wild", glyph: "🃏", weight: 2, pay3: 20 },
    ],
  },
  {
    id: "ice-fortune",
    name: "Ice Fortune",
    theme: "Glace & diamants",
    accent: "from-electric-400 to-ice-100",
    volatility: "high",
    minLevel: 12,
    symbols: [
      { id: "snow", glyph: "❄️", weight: 28, pay3: 1.4 },
      { id: "moon", glyph: "🌙", weight: 22, pay3: 2 },
      { id: "gem", glyph: "🔷", weight: 16, pay3: 4 },
      { id: "crown", glyph: "👑", weight: 10, pay3: 8 },
      { id: "diamond", glyph: "💎", weight: 6, pay3: 20 },
      { id: "star", glyph: "🌟", weight: 3, pay3: 45 },
      { id: "wild", glyph: "🧊", weight: 1.5, pay3: 90 },
    ],
  },
  {
    id: "neon-sevens",
    name: "Neon Sevens",
    theme: "Rétro néon — haut risque",
    accent: "from-red-500 to-gold-400",
    volatility: "extreme",
    minLevel: 24,
    symbols: [
      { id: "bar", glyph: "🍫", weight: 32, pay3: 1.2 },
      { id: "bell", glyph: "🔔", weight: 24, pay3: 2 },
      { id: "grape", glyph: "🍇", weight: 16, pay3: 3.5 },
      { id: "star", glyph: "⭐", weight: 9, pay3: 9 },
      { id: "seven", glyph: "7️⃣", weight: 4, pay3: 40 },
      { id: "money", glyph: "💰", weight: 1.5, pay3: 110 },
      { id: "wild", glyph: "🎰", weight: 1, pay3: 180 },
    ],
  },
  {
    id: "diamond-vault",
    name: "Diamond Vault",
    theme: "Coffre-fort — le Graal des hauts rouleurs",
    accent: "from-electric-600 to-gold-400",
    volatility: "extreme",
    minLevel: 38,
    symbols: [
      { id: "key", glyph: "🗝️", weight: 30, pay3: 1.2 },
      { id: "lock", glyph: "🔒", weight: 24, pay3: 2 },
      { id: "coin", glyph: "🪙", weight: 17, pay3: 4 },
      { id: "gem", glyph: "💠", weight: 10, pay3: 10 },
      { id: "diamond", glyph: "💎", weight: 5, pay3: 30 },
      { id: "crown", glyph: "👑", weight: 2.5, pay3: 90 },
      { id: "wild", glyph: "🏆", weight: 1, pay3: 250 },
    ],
  },
];
