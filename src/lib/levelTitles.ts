export interface LevelTier {
  title: string;
  minLevel: number;
}

export const MAX_LEVEL = 1000;

const TIERS: LevelTier[] = [
  { title: "Novice", minLevel: 1 },
  { title: "Habitué", minLevel: 5 },
  { title: "Confirmé", minLevel: 10 },
  { title: "Expert", minLevel: 15 },
  { title: "Maître Casino", minLevel: 20 },
  { title: "Légende", minLevel: 30 },
  { title: "Icône Ino", minLevel: 40 },
  { title: "Mythique", minLevel: 50 },
  { title: "Niveau Max", minLevel: MAX_LEVEL },
];

export function levelTitle(level: number): string {
  let current = TIERS[0].title;
  for (const tier of TIERS) {
    if (level >= tier.minLevel) current = tier.title;
    else break;
  }
  return current;
}

export function nextLevelTier(level: number): LevelTier | null {
  return TIERS.find((t) => t.minLevel > level) ?? null;
}

export function isMaxLevel(level: number): boolean {
  return level >= MAX_LEVEL;
}

// "1000" once capped, "Niveau Max" everywhere levels are displayed as a number.
export function displayLevel(level: number): string {
  return isMaxLevel(level) ? "MAX" : String(level);
}
