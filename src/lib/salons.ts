export interface Salon {
  id: string;
  name: string;
  minLevel: number;
  betCapPercent: number;
  description: string;
}

export const SALONS: Salon[] = [
  { id: "classic", name: "Salle Classique", minLevel: 1, betCapPercent: 10, description: "Table ouverte à tous les joueurs." },
  { id: "silver", name: "Salon Argent", minLevel: 8, betCapPercent: 15, description: "Mises plus élevées, ambiance feutrée." },
  { id: "gold", name: "Salon Or", minLevel: 16, betCapPercent: 20, description: "Réservé aux joueurs confirmés." },
  { id: "platinum", name: "Salon Platine", minLevel: 25, betCapPercent: 30, description: "Les grandes mises pour les grands joueurs." },
  { id: "diamond", name: "Salon Diamant", minLevel: 40, betCapPercent: 50, description: "Le salon le plus exclusif d'Ino Casino." },
];

export function currentSalon(level: number): Salon {
  let current = SALONS[0];
  for (const s of SALONS) {
    if (level >= s.minLevel) current = s;
    else break;
  }
  return current;
}

export function nextSalon(level: number): Salon | null {
  return SALONS.find((s) => s.minLevel > level) ?? null;
}
