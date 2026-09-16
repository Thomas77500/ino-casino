import { biasedChance, pick } from "./rng";

// ============================================================================
// Blanchiment — même ressort que Crash (crashEngine.ts) : un taux qui grimpe en temps réel,
// il faut extraire avant que ça tourne mal. Ici, "ça tourne mal" = un contrôle fiscal. Courbe de
// croissance dédiée (un peu plus lente que Crash) pour laisser le temps de savourer la tension.
// 100% fictif, aucune vraie opération financière — juste des crédits de jeu.
// ============================================================================

const GROWTH_PERIOD_MS = 3400;

// riskMultiplier > 1 (couverture voyante) rapproche le seuil de contrôle ; < 1 (couverture
// discrète) l'éloigne. Même distribution à queue lourde que Crash pour garder de gros multiplicateurs
// rares mais possibles.
export function rollAuditThreshold(bias = 1, riskMultiplier = 1): number {
  if (biasedChance(0.03, bias, true)) return 1.0;
  const r = Math.random();
  const raw = (0.97 * bias) / ((1 - r) * riskMultiplier);
  return Math.max(1.01, Math.round(raw * 100) / 100);
}

export function rateAt(elapsedMs: number): number {
  return Math.pow(2, elapsedMs / GROWTH_PERIOD_MS);
}

export interface LaunderingFront {
  id: string;
  label: string;
  glyph: string;
  description: string;
  riskMultiplier: number;
}

export const FRONTS: LaunderingFront[] = [
  { id: "laverie", label: "Laverie Automatique \"Quick Wash\"", glyph: "🧺", description: "Discrète, peu de passage, peu suspecte.", riskMultiplier: 0.85 },
  { id: "foodtruck", label: "Food Truck \"Le Bon Wrap\"", glyph: "🌯", description: "Petit chiffre d'affaires, ça reste sous les radars.", riskMultiplier: 0.9 },
  { id: "kebab", label: "Kebab \"Chez Tonton\"", glyph: "🥙", description: "Un classique du genre. Le fisc connaît la musique.", riskMultiplier: 1 },
  { id: "salle-sport", label: "Salle de Sport \"Muscle & Discrétion\"", glyph: "🏋️", description: "Beaucoup d'abonnements \"payés comptant\".", riskMultiplier: 1.05 },
  { id: "manucure", label: "Salon \"Nails & Cash\"", glyph: "💅", description: "Petit volume, mais des marges qui font sourciller.", riskMultiplier: 1.1 },
  { id: "immo", label: "Agence \"Pierre d'Or\"", glyph: "🏘️", description: "Grosses sommes, grosse visibilité — grosse tentation.", riskMultiplier: 1.2 },
  { id: "auto", label: "Concession \"Vroom Discount\"", glyph: "🚗", description: "Le grand classique du blanchiment. Très surveillé.", riskMultiplier: 1.3 },
  { id: "meubles", label: "Import-Export de Meubles Scandinaves", glyph: "🛋️", description: "Personne ne comprend vraiment ce business. Suspect par nature.", riskMultiplier: 1.4 },
];

const AUDIT_LINES: Record<string, string[]> = {
  laverie: ["Un contrôleur remarque qu'aucune machine n'a jamais autant tourné pour si peu de linge.", "Les tickets de caisse ne correspondent à aucun cycle de lavage réel."],
  foodtruck: ["Impossible de vendre autant de wraps avec une seule plancha.", "Le fisc s'étonne d'un chiffre d'affaires qui dépasse la taille du camion."],
  kebab: ["Le fisc a déjà une liste de kebabs suspects, et le tien est en haut.", "Le nombre de sandwichs vendus dépasse largement la population du quartier."],
  "salle-sport": ["Personne n'a jamais vu autant de monde s'entraîner à 4h du matin.", "Les abonnements \"payés comptant\" attirent immédiatement l'attention."],
  manucure: ["Les marges affichées sont physiquement impossibles pour un salon de cette taille.", "Un contrôleur s'étonne du nombre de clientes... jamais aperçues sur place."],
  immo: ["Des transactions immobilières bouclées en quelques heures, sans aucune visite.", "Le prix de vente ne correspond à rien sur le marché local."],
  auto: ["Trop de voitures vendues, jamais aucune sur le parking.", "Le contrôleur reconnaît immédiatement le schéma classique."],
  meubles: ["Personne, absolument personne, n'a jamais reçu le moindre meuble scandinave.", "Le contrôleur demande à voir un seul canapé. Il n'y en a aucun."],
};

export function auditNarrative(frontId: string): string {
  const lines = AUDIT_LINES[frontId] ?? ["Le contrôle fiscal tombe sans prévenir. Tout est saisi."];
  return pick(lines);
}
