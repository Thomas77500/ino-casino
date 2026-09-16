import { biasedWeightedPick, biasedChance, randInt, pick, type Weighted } from "./rng";

// ============================================================================
// L'Arc Ministériel — 100% fictif, personnages et institutions inventés. Débloqué comme la
// Bourse (voir stockEngine.ts) : un cap de gains cumulés, pas de vraie monnaie en jeu.
// ============================================================================

export const UNLOCK_TOTAL_WON = 25_000_000;
export const ENTRY_COST = 3_000;

export interface Ministry {
  id: string;
  label: string;
  glyph: string;
  weight: number;
  tier: 0 | 1 | 2 | 3 | 4; // 0 = mandat avorté (Placard), 4 = Matignon (jackpot)
  accent: string;
}

const TIER_MULTIPLIER: Record<Ministry["tier"], number> = { 0: 0, 1: 1, 2: 1.6, 3: 2.3, 4: 3.2 };

export const MINISTRIES: Ministry[] = [
  { id: "agriculture", label: "Agriculture & Terroir", glyph: "🌾", weight: 15, tier: 1, accent: "from-amber-600 to-amber-800" },
  { id: "culture", label: "Culture & Patrimoine", glyph: "🎭", weight: 15, tier: 1, accent: "from-fuchsia-600 to-fuchsia-800" },
  { id: "numerique", label: "Numérique", glyph: "💾", weight: 13, tier: 1, accent: "from-electric-500 to-electric-700" },
  { id: "ecologie", label: "Transition Écologique", glyph: "🌳", weight: 12, tier: 2, accent: "from-emerald-600 to-emerald-800" },
  { id: "interieur", label: "Intérieur", glyph: "🚨", weight: 11, tier: 2, accent: "from-blue-600 to-blue-900" },
  { id: "etrangeres", label: "Affaires Étrangères", glyph: "🌍", weight: 9, tier: 2, accent: "from-sky-600 to-sky-900" },
  { id: "defense", label: "Défense", glyph: "🎖️", weight: 8, tier: 2, accent: "from-stone-600 to-stone-800" },
  { id: "economie", label: "Économie & Finances", glyph: "💼", weight: 6, tier: 3, accent: "from-gold-500 to-gold-700" },
  { id: "matignon", label: "Matignon — Premier Ministre", glyph: "🏛️", weight: 3, tier: 4, accent: "from-gold-300 to-electric-500" },
  { id: "placard", label: "Placard (mise au placard)", glyph: "🚪", weight: 8, tier: 0, accent: "from-ink-700 to-ink-900" },
];

const MINISTRY_WEIGHTS: Weighted<Ministry>[] = MINISTRIES.map((m) => ({ value: m, weight: m.weight }));

export function drawMinistry(bias = 1): Ministry {
  return biasedWeightedPick(MINISTRY_WEIGHTS, bias);
}

export function randomDecoyMinistry(): Ministry {
  return MINISTRIES[Math.floor(Math.random() * MINISTRIES.length)];
}

// ============================================================================
// Mandat — 5 tours (années), chaque tour tire un événement à choix. Popularité à 0 = motion de
// censure, mandat écourté. Le trésor influence le versement final, jamais le déroulement.
// ============================================================================

export const MANDATE_LENGTH = 5;
export const START_POPULARITY = 50;

export interface MandateChoice {
  label: string;
  outcome: string;
  popularity: number;
  treasury: number;
  chaos?: boolean; // résolu dynamiquement par resolveChaos(), popularity/treasury ci-dessus ignorés
}

export interface MandateEvent {
  id: string;
  category: "polemique" | "derive" | "fun" | "serieux";
  title: string;
  description: string;
  choices: [MandateChoice, MandateChoice];
}

export const CATEGORY_LABEL: Record<MandateEvent["category"], string> = {
  polemique: "Polémique",
  derive: "Dérive",
  fun: "Fun",
  serieux: "Sérieux",
};

export const EVENT_POOL: MandateEvent[] = [
  // --- Polémiques ---
  {
    id: "vacances-discretes", category: "polemique", title: "Vacances Très Discrètes",
    description: "Tu pars une semaine dans un hôtel 5 étoiles \"offert par un ami\" en pleine crise sociale. La presse people a des photos.",
    choices: [
      { label: "Rentrer en urgence et t'excuser", outcome: "Le retour surprise calme un peu le jeu.", popularity: 4, treasury: -5 },
      { label: "Ignorer et prolonger le séjour", outcome: "Les Unes s'enchaînent, mais bon, t'étais bien.", popularity: -18, treasury: 2 },
    ],
  },
  {
    id: "tweet-3h", category: "polemique", title: "Le Message de 3h du Matin",
    description: "Un message très compromettant part de ton compte officiel en pleine nuit.",
    choices: [
      { label: "\"Piratage, j'ai porté plainte\"", outcome: "Personne n'y croit vraiment, mais ça calme le jeu.", popularity: -3, treasury: -8 },
      { label: "Assumer, c'était toi", outcome: "Le cash surprend, une partie du public apprécie la franchise.", popularity: 6, treasury: 0 },
    ],
  },
  {
    id: "cousin-bien-place", category: "polemique", title: "Le Cousin Bien Placé",
    description: "La presse découvre que ton cousin a été nommé \"conseiller spécial\" à 9 000€/mois, sans réel poste.",
    choices: [
      { label: "Le démettre immédiatement", outcome: "Bon réflexe, mais il ne te parle plus à Noël.", popularity: 5, treasury: -6 },
      { label: "Le maintenir, il fait du très bon travail", outcome: "La presse en fait des gorges chaudes pendant deux semaines.", popularity: -20, treasury: -4 },
    ],
  },
  {
    id: "selfie-malheureux", category: "polemique", title: "Le Selfie Malheureux",
    description: "Une photo de toi trinquant au champagne le jour même d'une annonce de plan social fuite sur les réseaux.",
    choices: [
      { label: "S'excuser sur tous les plateaux", outcome: "Ça calme un peu, sans plus.", popularity: 0, treasury: -3 },
      { label: "Dire que c'était de l'eau pétillante", outcome: "Personne n'y croit, ça empire tout.", popularity: -14, treasury: 0 },
    ],
  },
  {
    id: "notes-de-frais", category: "polemique", title: "Notes de Frais Étonnantes",
    description: "La Cour des Comptes s'étonne de 40 additions de restaurant à plus de 300€ facturées en un trimestre.",
    choices: [
      { label: "Rembourser de ta poche", outcome: "Un vrai geste, salué même par l'opposition.", popularity: 7, treasury: -10 },
      { label: "\"C'était pour recevoir des partenaires stratégiques\"", outcome: "Personne n'est dupe.", popularity: -10, treasury: -2 },
    ],
  },
  {
    id: "clip-qui-fait-mal", category: "polemique", title: "Le Clip qui Fait Mal",
    description: "Un rappeur sort un morceau qui te clashe en règle. Il cartonne.",
    choices: [
      { label: "Répondre avec humour en interview", outcome: "Le clash tourne à ton avantage, tu passes pour quelqu'un de cool.", popularity: 10, treasury: 0 },
      { label: "Envoyer un courrier d'avocat", outcome: "Effet Streisand garanti, le clip explose encore plus.", popularity: -16, treasury: -5 },
    ],
  },

  // --- Dérives ---
  {
    id: "enveloppe-lobbyiste", category: "derive", title: "L'Enveloppe du Lobbyiste",
    description: "Un lobbyiste de l'agroalimentaire te propose une enveloppe contre un coup de pouce réglementaire, discrètement.",
    choices: [
      { label: "Refuser, courtoisement", outcome: "Ta conscience est tranquille, ton compte en banque un peu moins.", popularity: 3, treasury: 0 },
      { label: "Accepter, discrètement", outcome: "Ça arrondit les fins de mois. Pour l'instant, personne ne sait.", popularity: -8, treasury: 18 },
    ],
  },
  {
    id: "marche-public-bizarre", category: "derive", title: "Le Marché Public qui Sent Bizarre",
    description: "Un marché public de 2M€ part sans appel d'offres chez une entreprise qui appartient à un ami d'enfance.",
    choices: [
      { label: "Annuler et relancer proprement", outcome: "Un peu de courage, ça fait du bien.", popularity: 6, treasury: -5 },
      { label: "Laisser filer", outcome: "L'ami d'enfance t'invite au ski en retour.", popularity: -12, treasury: 10 },
    ],
  },
  {
    id: "poudre-blanche", category: "derive", title: "Taper dans la Poudre Blanche",
    description: "Lors d'une soirée avec des \"partenaires stratégiques\", quelqu'un sort un sachet suspect et te le tend.",
    choices: [
      { label: "Refuser net, tu rentres te coucher", outcome: "Sage décision, personne ne le saura jamais.", popularity: 5, treasury: 0 },
      { label: "Céder", outcome: "", popularity: 0, treasury: 0, chaos: true },
    ],
  },
  {
    id: "chauffeur-ministre", category: "derive", title: "Le Chauffeur de Ministre",
    description: "Tu peux faire classer ton neveu en tête du concours de chauffeur ministériel, sans les épreuves.",
    choices: [
      { label: "Le faire repasser le concours normalement", outcome: "Correct, un peu long.", popularity: 4, treasury: 0 },
      { label: "Le faire nommer directement", outcome: "Ça sort dans la presse deux mois plus tard.", popularity: -11, treasury: -3 },
    ],
  },
  {
    id: "carte-bleue-pro", category: "derive", title: "La Carte Bleue Professionnelle",
    description: "Tu utilises la carte du ministère pour un week-end perso, classé \"mission de terrain\".",
    choices: [
      { label: "Rembourser avant que ça se sache", outcome: "Discret, efficace.", popularity: 0, treasury: -6 },
      { label: "Faire passer ça en frais de représentation", outcome: "Ça finira par sortir, mais pas tout de suite.", popularity: -13, treasury: 4 },
    ],
  },
  {
    id: "ami-restaurateur", category: "derive", title: "L'Ami Restaurateur",
    description: "Un restaurateur ami t'offre systématiquement l'addition, à toi et à tes équipes, depuis deux ans.",
    choices: [
      { label: "Commencer à payer comme tout le monde", outcome: "Un peu tard, mais bien vu.", popularity: 3, treasury: -4 },
      { label: "Continuer, c'est entre amis", outcome: "Amitié précieuse, image un peu moins.", popularity: -9, treasury: 6 },
    ],
  },

  // --- Fun ---
  {
    id: "duel-petanque", category: "fun", title: "Duel de Pétanque",
    description: "Le ministre voisin te défie en pétanque devant les caméras lors d'un déplacement officiel.",
    choices: [
      { label: "Jouer sérieusement, à fond", outcome: "Un joli coup au but, l'opinion adore.", popularity: 9, treasury: 0 },
      { label: "Le laisser gagner, diplomatie oblige", outcome: "Sympa, mais un peu fade en image.", popularity: 4, treasury: 0 },
    ],
  },
  {
    id: "interview-surrealiste", category: "fun", title: "Interview Surréaliste",
    description: "Une chaîne te pose des questions n'ayant aucun rapport avec ton portefeuille pendant 20 minutes.",
    choices: [
      { label: "Jouer le jeu avec humour", outcome: "Le clip devient viral, dans le bon sens.", popularity: 11, treasury: 0 },
      { label: "Recadrer sèchement le journaliste", outcome: "Ça fait \"condescendant\" sur les réseaux.", popularity: -6, treasury: 0 },
    ],
  },
  {
    id: "karaoke-sommet", category: "fun", title: "Le Karaoké de Fin de Sommet",
    description: "Après un sommet international interminable, on te tend un micro pour le karaoké.",
    choices: [
      { label: "Chanter à fond, sans complexe", outcome: "La vidéo devient culte, tu deviens attachant.", popularity: 13, treasury: 0 },
      { label: "Décliner poliment", outcome: "Personne ne t'en veut, personne ne s'en souvient non plus.", popularity: 0, treasury: 0 },
    ],
  },
  {
    id: "meme-involontaire", category: "fun", title: "Le Mème Involontaire",
    description: "Une photo de toi, bouche grande ouverte en plein discours, devient un mème national.",
    choices: [
      { label: "En rire toi-même publiquement", outcome: "L'auto-dérision, ça marche toujours.", popularity: 10, treasury: 0 },
      { label: "Faire retirer les publications", outcome: "Effet Streisand, le mème explose encore plus.", popularity: -15, treasury: -2 },
    ],
  },
  {
    id: "bebe-sur-les-bras", category: "fun", title: "Le Bébé sur les Bras",
    description: "Lors d'un bain de foule, on te confie un bébé qui hurle sans s'arrêter.",
    choices: [
      { label: "Continuer à sourire, jusqu'au bout", outcome: "Une image attendrissante fait le tour des JT.", popularity: 7, treasury: 0 },
      { label: "Le rendre discrètement", outcome: "Un peu gênant à l'image.", popularity: -3, treasury: 0 },
    ],
  },

  // --- Sérieux ---
  {
    id: "greve-generale", category: "serieux", title: "Grève Générale",
    description: "Un mouvement social bloque le pays. Les syndicats demandent une négociation immédiate.",
    choices: [
      { label: "Négocier, quitte à concéder du terrain", outcome: "Le dialogue paie, socialement.", popularity: 8, treasury: -12 },
      { label: "Tenir bon, ne rien lâcher", outcome: "Le conflit s'enlise, mais les caisses respirent.", popularity: -10, treasury: 5 },
    ],
  },
  {
    id: "trou-budgetaire", category: "serieux", title: "Le Trou Budgétaire",
    description: "Bercy annonce un trou de plusieurs milliards dans ton portefeuille.",
    choices: [
      { label: "Couper dans les dépenses", outcome: "Impopulaire, mais les comptes remontent.", popularity: -9, treasury: 14 },
      { label: "Emprunter davantage", outcome: "Ça passe pour l'instant, la note arrivera plus tard.", popularity: 5, treasury: -14 },
    ],
  },
  {
    id: "catastrophe-naturelle", category: "serieux", title: "La Catastrophe Naturelle",
    description: "Une tempête ravage une région entière. Il faut décider du plan de secours.",
    choices: [
      { label: "Débloquer un plan d'urgence massif", outcome: "La réponse est saluée par tous les bords.", popularity: 14, treasury: -18 },
      { label: "Suivre la procédure standard", outcome: "Trop lent, trop froid, ça se voit.", popularity: -8, treasury: -4 },
    ],
  },
  {
    id: "rapport-accablant", category: "serieux", title: "Le Rapport Accablant",
    description: "Un rapport indépendant pointe des failles graves dans ton administration.",
    choices: [
      { label: "Publier le rapport intégralement", outcome: "La transparence, ça surprend, ça plaît.", popularity: 9, treasury: 0 },
      { label: "En publier une version édulcorée", outcome: "Le rapport complet fuite quand même, en pire.", popularity: -12, treasury: 0 },
    ],
  },
  {
    id: "reforme-impopulaire", category: "serieux", title: "La Réforme Impopulaire mais Nécessaire",
    description: "Tes équipes techniques t'assurent qu'une réforme impopulaire est indispensable à long terme.",
    choices: [
      { label: "La porter malgré le risque", outcome: "Le courage a un prix immédiat, mais les experts saluent.", popularity: -14, treasury: 16 },
      { label: "L'enterrer discrètement", outcome: "Tranquille pour l'instant, le problème reste entier.", popularity: 6, treasury: -8 },
    ],
  },
];

export function drawMandateEvents(): MandateEvent[] {
  const shuffled = [...EVENT_POOL].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, MANDATE_LENGTH);
}

// ============================================================================
// Soudoyer — dépense de vrais crédits pendant un tour, en alternative aux deux choix narratifs.
// Le risque est piloté par le même curseur admin "Probabilité de gain" que les autres jeux.
// ============================================================================

export function bribeCost(ministry: Ministry): number {
  return Math.round(ENTRY_COST * 0.4 * Math.max(1, TIER_MULTIPLIER[ministry.tier]));
}

const BRIBE_SUCCESS_LINES = [
  "L'enveloppe a fait son effet, discrètement.",
  "Un simple \"merci\" a suffi à débloquer la situation.",
  "Ton contact est reconnaissant... et discret.",
];
const BRIBE_FAIL_LINES = [
  "Un journaliste avait tout filmé depuis le début.",
  "Le Parquet s'en mêle, l'affaire éclate.",
  "L'enveloppe a fuité sur les réseaux en moins d'une heure.",
];

export interface BribeResult {
  success: boolean;
  popularity: number;
  treasury: number;
  outcome: string;
}

export function resolveBribe(bias = 1): BribeResult {
  const success = biasedChance(0.65, bias);
  if (success) {
    return { success: true, popularity: randInt(12, 22), treasury: randInt(5, 15), outcome: pick(BRIBE_SUCCESS_LINES) };
  }
  return { success: false, popularity: -randInt(18, 30), treasury: -randInt(10, 25), outcome: pick(BRIBE_FAIL_LINES) };
}

// ============================================================================
// Chaos — résolution spéciale de "Taper dans la Poudre Blanche" côté "Céder". Grosse variance
// dans les deux sens, plus intense que n'importe quel autre événement — c'est le but.
// ============================================================================

const CHAOS_GOOD_LINES = [
  "Sous l'effet, tu improvises un discours enflammé qui devient culte.",
  "Une énergie inexplicable te fait signer trois réformes dans la nuit — et elles tiennent la route.",
  "Tu danses sur la table du Conseil des ministres. Les images inondent le pays, et étrangement, ça passe.",
];
const CHAOS_BAD_LINES = [
  "Tu t'effondres en direct sur un plateau télé, les images tournent en boucle.",
  "Un discours totalement incohérent est diffusé en intégralité sur les chaînes d'info.",
  "Tu promets la gratuité totale de tout, en public, sans en parler à personne. Bercy panique.",
];

export interface ChaosResult {
  popularity: number;
  treasury: number;
  outcome: string;
  good: boolean;
}

export function resolveChaos(): ChaosResult {
  const roll = randInt(-35, 45);
  const good = roll > 5;
  return { popularity: roll, treasury: -randInt(10, 25), outcome: pick(good ? CHAOS_GOOD_LINES : CHAOS_BAD_LINES), good };
}

// ============================================================================
// Fin de mandat
// ============================================================================

export interface MandateOutcome {
  payout: number;
  label: string;
}

export function computeOutcome(ministry: Ministry, popularity: number, treasury: number, censured: boolean): MandateOutcome {
  if (ministry.tier === 0) {
    return { payout: Math.round(ENTRY_COST * 0.15), label: "Mise au placard avant même la prise de poste" };
  }
  if (censured) {
    return { payout: Math.round(ENTRY_COST * 0.25), label: "Motion de censure — mandat écourté" };
  }
  const base = ENTRY_COST * TIER_MULTIPLIER[ministry.tier];
  const popFactor = 0.5 + (Math.max(0, Math.min(100, popularity)) / 100) * 1.3;
  const treasuryFactor = Math.max(0.7, Math.min(1.35, 1 + treasury / 250));
  const payout = Math.round(base * popFactor * treasuryFactor);
  const label =
    popularity >= 80 ? "Réélection triomphale" :
    popularity >= 60 ? "Fin de mandat saluée" :
    popularity >= 40 ? "Mandat honorable" :
    "Mandat chahuté, mais tenu jusqu'au bout";
  return { payout, label };
}
