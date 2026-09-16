import { pick, biasedWeightedPick, type Weighted } from "./rng";
import { type CardRarity, RARITY_ORDER } from "./tcgCards";

// ============================================================================
// Marché Noir — 100% fictif, objets satiriques inventés. Trois "collections" (contrebande, intel
// & chantage, cybercrime) au lieu d'armes/organes réels — même esprit que l'Arc Ministériel : de
// l'humour noir sur des archétypes, jamais un vrai mode d'emploi ni une vraie victime. Débloqué
// comme le Ministère/le Club : un cap de gains cumulés, pas de vraie monnaie en jeu.
// ============================================================================

export const UNLOCK_TOTAL_WON = 15_000_000;

export interface BlackmarketItem {
  id: string;
  label: string;
  glyph: string;
  rarity: CardRarity;
  collectionId: string;
}

export interface BlackmarketCollection {
  id: string;
  label: string;
  tagline: string;
  glyph: string;
  accent: string;
  lotPrice: number;
  items: BlackmarketItem[];
}

// Valeur estimée par rareté, purement indicative dans l'UI — le prix réel d'une annonce est
// toujours fixé librement par le vendeur.
export const ITEM_VALUE: Record<CardRarity, number> = {
  commune: 800,
  peuCommune: 2500,
  rare: 8000,
  rareHolo: 25000,
  ultraRare: 80000,
  secrete: 400000,
};

function items(collectionId: string, list: [string, string, CardRarity][]): BlackmarketItem[] {
  return list.map(([id, label, rarity]) => ({ id: `${collectionId}-${id}`, label, glyph: GLYPHS[id] ?? "❓", rarity, collectionId }));
}

const GLYPHS: Record<string, string> = {
  montre: "🕰️", vin: "🍷", passeport: "🛂", lingot: "🪙", statuette: "🗿", vermeer: "🖼️", cle: "🗝️", registre: "📕",
  ragot: "🗣️", ticket: "🧾", audio: "🎙️", carnet: "📓", audit: "📊", offshore: "🏝️", dossier: "📁", lanceur: "🔐",
  vpn: "🌐", bot: "⭐", phishing: "🎣", ransomware: "🦠", bdd: "🗄️", deepfake: "🎭", rugpull: "📉", source: "💾",
  cigares: "🚬", caisse: "📦", icone: "🕉️", carteTresor: "🗺️",
  rumeur: "🤫", sms: "📱", interview: "🎤", releve: "💳",
  extension: "🧩", captcha: "🤖", cracker: "🔓", zeroday: "🐛",
};

export const COLLECTIONS: BlackmarketCollection[] = [
  {
    id: "contrebande",
    label: "Contrebande",
    tagline: "Butin, faux et marchandises tombées du camion.",
    glyph: "📦",
    accent: "from-amber-600 to-amber-900",
    lotPrice: 8000,
    items: items("contrebande", [
      ["montre", "Montre Suisse Contrefaite", "commune"],
      ["vin", "Cargaison de Vin \"Égaré\"", "commune"],
      ["passeport", "Passeport Diplomatique Vierge", "peuCommune"],
      ["lingot", "Lingot \"Tombé du Camion\"", "peuCommune"],
      ["statuette", "Statuette Précolombienne Douteuse", "rare"],
      ["vermeer", "Faux Vermeer (Copie Parfaite)", "rareHolo"],
      ["cle", "Clé du Coffre Numéro 7", "ultraRare"],
      ["registre", "Le Registre du Receleur", "secrete"],
      ["cigares", "Cigares Cubains \"Authentiques\"", "commune"],
      ["caisse", "Caisse de Douane Égarée", "commune"],
      ["icone", "Icône Religieuse Volée", "peuCommune"],
      ["carteTresor", "Carte au Trésor (Photocopie)", "rare"],
    ]),
  },
  {
    id: "intel",
    label: "Intel & Chantage",
    tagline: "Dossiers, secrets et informateurs anonymes.",
    glyph: "🕵️",
    accent: "from-stone-600 to-stone-900",
    lotPrice: 8000,
    items: items("intel", [
      ["ragot", "Ragot de Couloir", "commune"],
      ["ticket", "Ticket de Caisse Compromettant", "commune"],
      ["audio", "Enregistrement Audio Flou", "peuCommune"],
      ["carnet", "Carnet d'Adresses Volé", "peuCommune"],
      ["audit", "Rapport d'Audit Fuité", "rare"],
      ["offshore", "Liste de Comptes Offshore (Partielle)", "rareHolo"],
      ["dossier", "Dossier Compromettant d'un Élu Anonyme", "ultraRare"],
      ["lanceur", "La Clé du Lanceur d'Alerte", "secrete"],
      ["rumeur", "Rumeur de Vestiaire", "commune"],
      ["sms", "SMS Mal Effacé", "commune"],
      ["interview", "Interview Non-Publiée", "peuCommune"],
      ["releve", "Relevé Bancaire Suspect", "rare"],
    ]),
  },
  {
    id: "cyber",
    label: "Cybercrime",
    tagline: "Outils numériques plus ou moins fonctionnels.",
    glyph: "💻",
    accent: "from-electric-600 to-electric-900",
    lotPrice: 8000,
    items: items("cyber", [
      ["vpn", "VPN \"Indétectable\" (l'est un peu)", "commune"],
      ["bot", "Bot à Faux Avis 5 Étoiles", "commune"],
      ["phishing", "Kit de Phishing Clé en Main", "peuCommune"],
      ["ransomware", "Ransomware Jouet", "peuCommune"],
      ["bdd", "Base de Données \"Fuitée\" (Douteuse)", "rare"],
      ["deepfake", "Générateur de Deepfake Amateur", "rareHolo"],
      ["rugpull", "Script de Rug-Pull Crypto (Buggé)", "ultraRare"],
      ["source", "Le Code Source Perdu", "secrete"],
      ["extension", "Extension Navigateur Louche", "commune"],
      ["captcha", "Générateur de Faux CAPTCHA", "commune"],
      ["cracker", "Cracker de Mot de Passe (Lent)", "peuCommune"],
      ["zeroday", "Exploit Zero-Day (Périmé)", "rare"],
    ]),
  },
];

export function findItem(itemId: string): BlackmarketItem | null {
  for (const c of COLLECTIONS) {
    const found = c.items.find((i) => i.id === itemId);
    if (found) return found;
  }
  return null;
}

// Un lot ne tire qu'un seul objet (comme Cases, pas comme un booster à 5 slots) : on tire d'abord
// une rareté sur une table pondérée, puis un objet au hasard de cette rareté dans la collection.
const LOT_WEIGHTS: Record<CardRarity, number> = {
  commune: 45, peuCommune: 28, rare: 16, rareHolo: 7, ultraRare: 3.5, secrete: 0.5,
};

export function openLot(collectionId: string, bias = 1): BlackmarketItem {
  const collection = COLLECTIONS.find((c) => c.id === collectionId) ?? COLLECTIONS[0];
  const weighted: Weighted<CardRarity>[] = RARITY_ORDER.map((r) => ({ value: r, weight: LOT_WEIGHTS[r] }));
  const rarity = biasedWeightedPick(weighted, bias);
  const pool = collection.items.filter((i) => i.rarity === rarity);
  return pick(pool.length ? pool : collection.items);
}
