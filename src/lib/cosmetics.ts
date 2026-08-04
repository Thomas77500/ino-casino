export interface FrameOption {
  id: string;
  label: string;
  price: number;
  ring: string;
}

// "none" is always owned/equippable at zero cost — the default, unadorned avatar.
export const FRAME_OPTIONS: FrameOption[] = [
  { id: "none", label: "Aucun", price: 0, ring: "" },
  { id: "electric", label: "Anneau Électrique", price: 2_000, ring: "ring-2 ring-electric-400 shadow-glow" },
  { id: "gold", label: "Anneau Doré", price: 8_000, ring: "ring-2 ring-gold-400 shadow-glow-gold" },
  { id: "fire", label: "Anneau de Feu", price: 25_000, ring: "ring-2 ring-red-400 shadow-glow-red" },
  { id: "rainbow", label: "Anneau Arc-en-ciel", price: 75_000, ring: "ring-2 ring-fuchsia-400" },
  { id: "royal", label: "Anneau Royal", price: 250_000, ring: "ring-4 ring-gold-400 shadow-glow-gold" },
  // Earned for free by completing a Boosters edition binder (also purchasable outright for the
  // impatient) — src/pages/Boosters.tsx grants these via useCasinoStore.buyFrame(id, 0).
  { id: "cadre-racines", label: "Cadre Racines Sauvages", price: 500_000, ring: "ring-2 ring-emerald-400 shadow-glow" },
  { id: "cadre-orage", label: "Cadre Orage Voltaïque", price: 500_000, ring: "ring-2 ring-electric-300 shadow-glow" },
  { id: "cadre-abysses", label: "Cadre Abysses Glacées", price: 500_000, ring: "ring-2 ring-ice-100 shadow-glow" },
  { id: "cadre-braise", label: "Cadre Braise Ancestrale", price: 500_000, ring: "ring-4 ring-red-400 shadow-glow-red" },
];

export function frameRing(id: string | null | undefined): string {
  return FRAME_OPTIONS.find((f) => f.id === id)?.ring ?? "";
}
