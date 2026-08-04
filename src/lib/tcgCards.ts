export type CardRarity = "commune" | "peuCommune" | "rare" | "rareHolo" | "ultraRare" | "secrete";

export const RARITY_ORDER: CardRarity[] = ["commune", "peuCommune", "rare", "rareHolo", "ultraRare", "secrete"];

export const RARITY_LABEL: Record<CardRarity, string> = {
  commune: "Commune",
  peuCommune: "Peu Commune",
  rare: "Rare",
  rareHolo: "Rare Holo",
  ultraRare: "Ultra Rare",
  secrete: "Secrète",
};

export const RARITY_STYLE: Record<CardRarity, { text: string; ring: string; glow: boolean }> = {
  commune: { text: "text-ice-200/70", ring: "border-white/10", glow: false },
  peuCommune: { text: "text-emerald-400", ring: "border-emerald-500/30", glow: false },
  rare: { text: "text-electric-400", ring: "border-electric-500/40", glow: false },
  rareHolo: { text: "text-electric-300", ring: "border-electric-400/60", glow: true },
  ultraRare: { text: "text-gold-400", ring: "border-gold-400/60", glow: true },
  secrete: { text: "text-gold-300", ring: "border-gold-300", glow: true },
};

// Base credit value per rarity — same table used by every edition, independent of booster price.
export const RARITY_VALUE: Record<CardRarity, number> = {
  commune: 12,
  peuCommune: 35,
  rare: 100,
  rareHolo: 350,
  ultraRare: 1100,
  secrete: 7000,
};

// Duplicates of a given rarity required to trade up one tier — see tradeIn in tcgStore.ts.
// Secrète has no tier above it, so its cost is unused (trade-up is disabled in the UI for it).
export const TRADE_IN_COST: Record<CardRarity, number> = {
  commune: 4,
  peuCommune: 4,
  rare: 3,
  rareHolo: 3,
  ultraRare: 2,
  secrete: 0,
};

// Per-slot pull odds (sum to 100 each), same shape as Pokémon TCG Pocket's real booster layout:
// the first 3 cards lean heavily common, the 4th is noticeably better, the 5th carries almost all
// of the rare-Holo+/secrète probability — a real floor on the last slot instead of one flat table.
// Together they land the booster around the same ~83% RTP the old flat table gave.
const SLOT_COMMON: Record<CardRarity, number> = { commune: 70, peuCommune: 25, rare: 4, rareHolo: 1, ultraRare: 0, secrete: 0 };
const SLOT_UNCOMMON: Record<CardRarity, number> = { commune: 30, peuCommune: 35, rare: 25, rareHolo: 8, ultraRare: 2, secrete: 0 };
const SLOT_RARE: Record<CardRarity, number> = { commune: 0, peuCommune: 10, rare: 40, rareHolo: 30, ultraRare: 15, secrete: 5 };

export const BOOSTER_SLOT_WEIGHTS: Record<CardRarity, number>[] = [SLOT_COMMON, SLOT_COMMON, SLOT_COMMON, SLOT_UNCOMMON, SLOT_RARE];

// "God pack" equivalent — vanishingly rare chance every slot rerolls off the best table.
export const PERFECT_PACK_CHANCE = 1 / 500;

// Display: better floor odds, and every card pulled is a "foil" print worth more (see
// DISPLAY_VALUE_MULTIPLIER) — the spectacle/prestige justifies the steep price, not a literal
// 36x-booster-value calculation.
export const DISPLAY_WEIGHTS: Record<CardRarity, number> = {
  commune: 30,
  peuCommune: 28,
  rare: 20,
  rareHolo: 13,
  ultraRare: 7,
  secrete: 2,
};
export const DISPLAY_VALUE_MULTIPLIER = 16;

export interface TcgCard {
  id: string;
  name: string;
  glyph: string;
  rarity: CardRarity;
  hp: number;
  attackName: string;
  attackDamage: number;
}

const HP_BASE: Record<CardRarity, number> = { commune: 60, peuCommune: 80, rare: 110, rareHolo: 140, ultraRare: 170, secrete: 220 };
const ATTACK_DAMAGE_BASE: Record<CardRarity, number> = { commune: 15, peuCommune: 25, rare: 40, rareHolo: 60, ultraRare: 85, secrete: 120 };

// Deterministic per-id jitter (not Math.random) — stats stay identical across renders/sessions
// for the same card instead of reshuffling every time the card is displayed.
function hashJitter(id: string, span = 10): number {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0;
  return (h % (span * 2 + 1)) - span;
}

export interface TcgEdition {
  id: string;
  name: string;
  theme: string;
  accent: string;
  minLevel: number;
  boosterPrice: number;
  cardsPerBooster: number;
  boostersPerDisplay: number;
  displayPrice: number;
  completionFrameId: string; // cosmetics.ts frame id granted for free on 100% binder completion
  cards: TcgCard[];
}

function cards(edition: string, attackPool: string[], entries: [string, string, CardRarity][]): TcgCard[] {
  return entries.map(([name, glyph, rarity], i) => {
    const id = `${edition}-${i}`;
    return {
      id,
      name,
      glyph,
      rarity,
      hp: Math.max(20, HP_BASE[rarity] + hashJitter(id)),
      attackName: attackPool[i % attackPool.length],
      attackDamage: Math.max(5, ATTACK_DAMAGE_BASE[rarity] + hashJitter(`${id}-atk`, 6)),
    };
  });
}

export const TCG_EDITIONS: TcgEdition[] = [
  {
    id: "racines-sauvages",
    name: "Racines Sauvages",
    theme: "Créatures de forêt",
    accent: "from-emerald-500 to-electric-400",
    minLevel: 1,
    boosterPrice: 1000,
    cardsPerBooster: 5,
    boostersPerDisplay: 36,
    displayPrice: 1_000_000,
    completionFrameId: "cadre-racines",
    cards: cards("racines", ["Griffe Sauvage", "Charge Feuillue", "Rugissement Bestial", "Morsure Vive", "Feuille Tranchante"], [
      ["Écureuil Feuillu", "🐿️", "commune"],
      ["Lapin Mousseux", "🐇", "commune"],
      ["Chenille Verte", "🐛", "commune"],
      ["Hérisson Épineux", "🦔", "commune"],
      ["Escargot Doré", "🐌", "commune"],
      ["Chouette Grise", "🦉", "commune"],
      ["Taupe Curieuse", "🦫", "commune"],
      ["Grenouille Verte", "🐸", "commune"],
      ["Moineau des Bois", "🐦", "commune"],
      ["Blaireau Nocturne", "🦡", "commune"],
      ["Renard Rusé", "🦊", "peuCommune"],
      ["Sanglier Robuste", "🐗", "peuCommune"],
      ["Cerf Sylvain", "🦌", "peuCommune"],
      ["Abeille Reine", "🐝", "peuCommune"],
      ["Papillon Nacré", "🦋", "peuCommune"],
      ["Putois Espiègle", "🦨", "peuCommune"],
      ["Paresseux Placide", "🦥", "peuCommune"],
      ["Chèvre des Montagnes", "🐐", "peuCommune"],
      ["Loup Alpha", "🐺", "rare"],
      ["Aigle Royal", "🦅", "rare"],
      ["Ours Ancien", "🐻", "rare"],
      ["Rhinocéros des Bois", "🦏", "rare"],
      ["Buffle Ancien", "🐃", "rare"],
      ["Lynx des Ombres", "🐈‍⬛", "rare"],
      ["Licorne Boréale", "🦄", "rareHolo"],
      ["Dragonnet des Bois", "🐲", "rareHolo"],
      ["Wyvern des Bois", "🦖", "rareHolo"],
      ["Esprit de la Forêt", "🌳", "ultraRare"],
      ["Esprit Floral", "🌺", "ultraRare"],
      ["Gardien Millénaire", "👑", "secrete"],
      ["Ancien des Bois", "🌲", "secrete"],
    ]),
  },
  {
    id: "orage-voltaique",
    name: "Orage Voltaïque",
    theme: "Créatures électriques",
    accent: "from-electric-400 to-gold-400",
    minLevel: 15,
    boosterPrice: 1000,
    cardsPerBooster: 5,
    boostersPerDisplay: 36,
    displayPrice: 1_000_000,
    completionFrameId: "cadre-orage",
    cards: cards("orage", ["Décharge", "Étincelle Vive", "Tempête Voltaïque", "Choc Fulgurant", "Onde de Choc"], [
      ["Souris Électrique", "🐁", "commune"],
      ["Hamster Chargé", "🐹", "commune"],
      ["Gecko Étincelant", "🦎", "commune"],
      ["Moineau Voltage", "🐦", "commune"],
      ["Frelon Électrique", "🐝", "commune"],
      ["Lièvre Foudre", "🐇", "commune"],
      ["Rat Chargé", "🐀", "commune"],
      ["Grillon Électrique", "🦗", "commune"],
      ["Perruche Voltage", "🦜", "commune"],
      ["Crapaud Statique", "🐸", "commune"],
      ["Elfe Voltaïque", "🧚", "peuCommune"],
      ["Hérisson Statique", "🦔", "peuCommune"],
      ["Écureuil Turbo", "🐿️", "peuCommune"],
      ["Papillon Plasma", "🦋", "peuCommune"],
      ["Serpent Conducteur", "🐍", "peuCommune"],
      ["Chauve-souris Voltaïque", "🦇", "peuCommune"],
      ["Castor Turbo", "🦫", "peuCommune"],
      ["Corbeau Chargé", "🐦‍⬛", "peuCommune"],
      ["Lion Fulgurant", "🦁", "rare"],
      ["Tigre Électrique", "🐯", "rare"],
      ["Scorpion Ionisé", "🦂", "rare"],
      ["Rhinocéros Électrique", "🦏", "rare"],
      ["Taureau Foudroyant", "🐂", "rare"],
      ["Aigle Voltaïque", "🦅", "rare"],
      ["Dragon d'Orage", "🐉", "rareHolo"],
      ["Requin Voltaïque", "🦈", "rareHolo"],
      ["Paon Électrique", "🦚", "rareHolo"],
      ["Titan de la Tempête", "🌩️", "ultraRare"],
      ["Kraken Voltaïque", "🐙", "ultraRare"],
      ["Empereur du Tonnerre", "⚡", "secrete"],
      ["Étoile Voltaïque", "🌟", "secrete"],
    ]),
  },
  {
    id: "abysses-glacees",
    name: "Abysses Glacées",
    theme: "Créatures de glace et d'eau",
    accent: "from-electric-400 to-ice-100",
    minLevel: 35,
    boosterPrice: 1000,
    cardsPerBooster: 5,
    boostersPerDisplay: 36,
    displayPrice: 1_000_000,
    completionFrameId: "cadre-abysses",
    cards: cards("abysses", ["Souffle Glacé", "Lame de Glace", "Vague Polaire", "Griffe Gelée", "Blizzard"], [
      ["Poisson Givré", "🐟", "commune"],
      ["Crevette Polaire", "🦐", "commune"],
      ["Coquillage Gelé", "🐚", "commune"],
      ["Calamar Bleu", "🦑", "commune"],
      ["Manchot Cristal", "🐧", "commune"],
      ["Loutre Polaire", "🦦", "commune"],
      ["Étoile de Mer Gelée", "⭐", "commune"],
      ["Anémone Glacée", "🪸", "commune"],
      ["Moule Cristalline", "🦪", "commune"],
      ["Grenouille des Glaces", "🐸", "commune"],
      ["Dauphin Glacial", "🐬", "peuCommune"],
      ["Phoque Argenté", "🦭", "peuCommune"],
      ["Poisson-Globe Gelé", "🐡", "peuCommune"],
      ["Homard Cristallin", "🦞", "peuCommune"],
      ["Tortue des Glaces", "🐢", "peuCommune"],
      ["Otarie Joueuse", "🦭", "peuCommune"],
      ["Mouette Polaire", "🐦", "peuCommune"],
      ["Anémone Vivace", "🫧", "peuCommune"],
      ["Requin des Abysses", "🦈", "rare"],
      ["Baleine Ancienne", "🐋", "rare"],
      ["Kraken Juvénile", "🐙", "rare"],
      ["Ours Polaire", "🐻‍❄️", "rare"],
      ["Morse Ancien", "🦷", "rare"],
      ["Pieuvre Profonde", "🐙", "rare"],
      ["Dragon des Glaces", "🐉", "rareHolo"],
      ["Golem de Cristal", "🧊", "rareHolo"],
      ["Serpent des Glaces", "🐍", "rareHolo"],
      ["Esprit Boréal", "❄️", "ultraRare"],
      ["Titan Abyssal", "🌀", "ultraRare"],
      ["Souveraine des Abysses", "🌊", "secrete"],
      ["Empereur des Mers", "👑", "secrete"],
    ]),
  },
  {
    id: "braise-ancestrale",
    name: "Braise Ancestrale",
    theme: "Créatures de feu et dragons",
    accent: "from-red-500 to-gold-400",
    minLevel: 55,
    boosterPrice: 1000,
    cardsPerBooster: 5,
    boostersPerDisplay: 36,
    displayPrice: 1_000_000,
    completionFrameId: "cadre-braise",
    cards: cards("braise", ["Flamme Ardente", "Éruption", "Souffle Brûlant", "Griffe Ardente", "Coulée de Lave"], [
      ["Salamandre Ardente", "🦎", "commune"],
      ["Coq de Braise", "🐔", "commune"],
      ["Chien de Feu", "🐕", "commune"],
      ["Chauve-souris Cendrée", "🦇", "commune"],
      ["Fourmi de Lave", "🐜", "commune"],
      ["Araignée Brûlante", "🕷️", "commune"],
      ["Iguane de Cendres", "🐊", "commune"],
      ["Corbeau de Suie", "🐦‍⬛", "commune"],
      ["Rat des Braises", "🐀", "commune"],
      ["Grillon de Lave", "🦗", "commune"],
      ["Panthère Écarlate", "🐆", "peuCommune"],
      ["Scorpion de Magma", "🦂", "peuCommune"],
      ["Vipère Incandescente", "🐍", "peuCommune"],
      ["Phénix Juvénile", "🦅", "peuCommune"],
      ["Sanglier Volcanique", "🐗", "peuCommune"],
      ["Renard Ardent", "🦊", "peuCommune"],
      ["Faucon Ardent", "🦉", "peuCommune"],
      ["Taureau de Magma", "🐂", "peuCommune"],
      ["Lion de Feu", "🦁", "rare"],
      ["Tigre des Braises", "🐯", "rare"],
      ["Loup Infernal", "🐺", "rare"],
      ["Rhinocéros de Lave", "🦏", "rare"],
      ["Ours de Braise", "🐻", "rare"],
      ["Chacal Infernal", "🐕‍🦺", "rare"],
      ["Dragon Écarlate", "🐉", "rareHolo"],
      ["Golem de Lave", "🗿", "rareHolo"],
      ["Wyvern Ardent", "🦖", "rareHolo"],
      ["Titan du Volcan", "🌋", "ultraRare"],
      ["Phénix Ancestral", "🔥", "ultraRare"],
      ["Empereur Draconique", "👑", "secrete"],
      ["Souverain des Flammes", "🌞", "secrete"],
    ]),
  },
];
