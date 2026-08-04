export interface Badge {
  id: string;
  label: string;
  earned: boolean;
}

export function computeBadges(stats: { level: number; biggestWin: number; totalWagered: number; streakCount: number }): Badge[] {
  return [
    { id: "starter", label: "Bienvenue", earned: true },
    { id: "level5", label: "Habitué (Niv. 5)", earned: stats.level >= 5 },
    { id: "level10", label: "VIP (Niv. 10)", earned: stats.level >= 10 },
    { id: "level20", label: "Légende (Niv. 20)", earned: stats.level >= 20 },
    { id: "bigwin", label: "Gros gain (1 000+)", earned: stats.biggestWin >= 1000 },
    { id: "hugewin", label: "Gain énorme (5 000+)", earned: stats.biggestWin >= 5000 },
    { id: "highroller", label: "High Roller (50k misés)", earned: stats.totalWagered >= 50000 },
    { id: "streak7", label: "Série de 7 jours", earned: stats.streakCount >= 7 },
  ];
}
