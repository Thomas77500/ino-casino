import { biasedWeightedPick, biasedChance, chance, randInt, pick, type Weighted } from "./rng";

// ============================================================================
// L'Arc Parrain — 100% fictif, quartiers et personnages inventés. Satire façon Sopranos/Le
// Parrain : archétypes, ellipses, jamais une scène de violence réelle ni un mode d'emploi — les
// "dérives" restent des conséquences racontées après coup, jamais mises en scène. Débloqué comme
// les autres arcs secrets : un cap de gains cumulés, pas de vraie monnaie en jeu.
// ============================================================================

export const UNLOCK_TOTAL_WON = 55_000_000;
export const ENTRY_COST = 50_000;

export interface Territory {
  id: string;
  label: string;
  glyph: string;
  weight: number;
  tier: 0 | 1 | 2 | 3 | 4; // 0 = repris par les flics avant même de commencer, 4 = contrôle total de la ville
  accent: string;
}

const TIER_MULTIPLIER: Record<Territory["tier"], number> = { 0: 0, 1: 1, 2: 1.8, 3: 2.6, 4: 4.5 };

export const TERRITORIES: Territory[] = [
  { id: "vieux-port", label: "Le Vieux Port", glyph: "⚓", weight: 15, tier: 1, accent: "from-stone-600 to-stone-800" },
  { id: "marche-couvert", label: "Le Marché Couvert", glyph: "🧺", weight: 15, tier: 1, accent: "from-amber-600 to-amber-800" },
  { id: "quartier-gare", label: "Le Quartier de la Gare", glyph: "🚉", weight: 13, tier: 1, accent: "from-sky-600 to-sky-900" },
  { id: "zone-industrielle", label: "La Zone Industrielle", glyph: "🏭", weight: 12, tier: 2, accent: "from-slate-600 to-slate-800" },
  { id: "quartier-nuit", label: "Le Quartier de Nuit", glyph: "🌃", weight: 11, tier: 2, accent: "from-fuchsia-600 to-fuchsia-800" },
  { id: "marina", label: "La Marina", glyph: "🛥️", weight: 9, tier: 2, accent: "from-electric-600 to-electric-900" },
  { id: "colline", label: "Les Hauteurs Chic", glyph: "🏘️", weight: 8, tier: 2, accent: "from-emerald-600 to-emerald-800" },
  { id: "centre-ville", label: "Le Centre-Ville", glyph: "🏙️", weight: 6, tier: 3, accent: "from-gold-500 to-gold-700" },
  { id: "toute-la-ville", label: "Toute la Ville", glyph: "👑", weight: 3, tier: 4, accent: "from-gold-300 to-red-500" },
  { id: "demantele", label: "Réseau démantelé avant l'ouverture", glyph: "🚫", weight: 8, tier: 0, accent: "from-ink-700 to-ink-900" },
];

const TERRITORY_WEIGHTS: Weighted<Territory>[] = TERRITORIES.map((t) => ({ value: t, weight: t.weight }));

export function drawTerritory(bias = 1): Territory {
  return biasedWeightedPick(TERRITORY_WEIGHTS, bias);
}

export function randomDecoyTerritory(): Territory {
  return TERRITORIES[Math.floor(Math.random() * TERRITORIES.length)];
}

// ============================================================================
// Règne — 5 saisons. Le respect (autorité sur la rue) remplace la popularité ; l'attention des
// flics remplace la dette : elle ne fait que grimper, et une descente peut tomber une fois qu'elle
// est haute.
// ============================================================================

export const MANDATE_LENGTH = 5;
export const START_RESPECT = 50;
export const START_HEAT = 10;

export interface MandateChoice {
  label: string;
  outcome: string;
  respect: number;
  heat: number;
  recettes: number;
  chaos?: boolean; // résolu dynamiquement par resolveChaos(), champs ci-dessus ignorés
}

export interface MandateEvent {
  id: string;
  category: "affaires" | "derive" | "fun" | "serieux" | "happening";
  title: string;
  description: string;
  choices: [MandateChoice, MandateChoice];
}

export const CATEGORY_LABEL: Record<MandateEvent["category"], string> = {
  affaires: "Affaires",
  derive: "Dérive",
  fun: "Fun",
  serieux: "Sérieux",
  happening: "Réception",
};

export function drawMandateEvents(): MandateEvent[] {
  return [...EVENT_POOL].sort(() => Math.random() - 0.5).slice(0, MANDATE_LENGTH);
}

export const EVENT_POOL: MandateEvent[] = [
  {
    id: "commercant-recalcitrant", category: "affaires", title: "Le Commerçant Récalcitrant",
    description: "Le nouveau boulanger de la rue refuse poliment mais fermement de payer \"la protection\".",
    choices: [
      { label: "Le laisser tranquille, ça ne vaut pas le coup", outcome: "La rue s'en souvient — un peu d'autorité en moins.", respect: -3, heat: 0, recettes: 0 },
      { label: "Lui envoyer un message clair", outcome: "Sa vitrine est \"accidentellement\" cassée le lendemain. Il paie dès la semaine suivante.", respect: 7, heat: 6, recettes: 3000 },
    ],
  },
  {
    id: "flic-curieux", category: "serieux", title: "Un Flic un Peu Trop Curieux",
    description: "Un jeune inspecteur commence à poser des questions précises sur les allées et venues de ton entrepôt.",
    choices: [
      { label: "Ne rien changer à tes habitudes", outcome: "Rien à cacher, rien à craindre — pour l'instant.", respect: 1, heat: 5, recettes: 0 },
      { label: "Le faire muter discrètement, par relations", outcome: "Réglé sans bruit. Ton contact au commissariat est reconnaissant.", respect: 0, heat: -4, recettes: -4000 },
    ],
  },
  {
    id: "lieutenant-ambitieux", category: "affaires", title: "Un Lieutenant Trop Ambitieux",
    description: "Un de tes hommes de confiance commence à traiter des affaires \"de son côté\", sans t'en parler.",
    choices: [
      { label: "Avoir une discussion ferme, en privé", outcome: "Il rentre dans le rang, un peu humilié mais loyal.", respect: 5, heat: 0, recettes: 0 },
      { label: "Le laisser faire, tant qu'il partage", outcome: "Les recettes montent, mais son ambition grandit aussi.", respect: -2, heat: 3, recettes: 8000 },
    ],
  },
  {
    id: "mariage-fille", category: "happening", title: "Le Mariage de ta Fille",
    description: "Toute la ville — légale ou pas — est invitée au grand mariage de ta fille.",
    choices: [
      { label: "Une cérémonie sobre et élégante", outcome: "Classe et discrétion saluées par tout le quartier.", respect: 8, heat: 1, recettes: -5000 },
      { label: "Le mariage le plus somptueux de la décennie", outcome: "On en parle encore des mois après — et pas que dans le quartier.", respect: 14, heat: 8, recettes: -20000 },
    ],
  },
  {
    id: "denonciateur", category: "serieux", title: "Un Ancien Associé Menace de Parler",
    description: "Un ancien partenaire, aigri après une dispute, laisse entendre qu'il pourrait \"tout raconter\" à la police.",
    choices: [
      { label: "Le racheter avec une grosse somme", outcome: "Le silence a un prix, mais il est acheté durablement.", respect: 0, heat: -6, recettes: -25000 },
      { label: "L'ignorer, il n'oserait jamais", outcome: "Il se ravise finalement, par peur des représailles.", respect: 3, heat: 10, recettes: 0 },
    ],
  },
  {
    id: "don-charitable", category: "affaires", title: "Le Don \"Charitable\" au Quartier",
    description: "Une association locale demande de l'aide pour rénover le terrain de jeu du quartier.",
    choices: [
      { label: "Financer généreusement, en ton nom", outcome: "Le quartier t'adore un peu plus — un vrai parrain protecteur.", respect: 10, heat: -2, recettes: -8000 },
      { label: "Décliner, ce n'est pas rentable", outcome: "Correct sur le papier, un peu froid pour l'image.", respect: -4, heat: 0, recettes: 0 },
    ],
  },
  {
    id: "soiree-poker", category: "fun", title: "La Grande Soirée Poker",
    description: "Une partie de poker clandestine réunit toute l'élite du quartier chez toi.",
    choices: [
      { label: "Jouer honnêtement, comme un hôte parfait", outcome: "Soirée mémorable, ta réputation d'hôte grandit.", respect: 9, heat: 1, recettes: 4000 },
      { label: "Truquer légèrement les cartes", outcome: "", respect: 0, heat: 0, recettes: 0, chaos: true },
    ],
  },
  {
    id: "journaliste-enquete", category: "serieux", title: "Une Journaliste Enquête sur le Quartier",
    description: "Une journaliste d'investigation commence à interroger les commerçants sur \"des versements suspects\".",
    choices: [
      { label: "La rencontrer, jouer la carte du dialogue", outcome: "Charmée par ton aplomb, elle édulcore son article.", respect: 4, heat: -3, recettes: 0 },
      { label: "Faire pression sur son rédacteur en chef", outcome: "L'article est repoussé, mais elle ne lâche pas l'affaire.", respect: -2, heat: 9, recettes: -3000 },
    ],
  },
  {
    id: "restaurant-facade", category: "affaires", title: "Ouvrir un Restaurant Vitrine",
    description: "Un vieux restaurant du quartier ferme. L'occasion rêvée d'une façade légale pour blanchir un peu d'image.",
    choices: [
      { label: "En faire une vraie bonne table, sérieusement gérée", outcome: "Le restaurant cartonne, ta légitimité aussi.", respect: 6, heat: -2, recettes: 6000 },
      { label: "Le garder minimal, juste pour la façade", outcome: "Ça fait le travail, sans plus.", respect: 1, heat: 2, recettes: 2000 },
    ],
  },
  {
    id: "fete-quartier", category: "happening", title: "La Fête du Quartier",
    description: "La fête annuelle du quartier bat son plein, et tout le monde s'attend à te voir passer.",
    choices: [
      { label: "Passer saluer tout le monde, discrètement", outcome: "Présence appréciée, sans en faire trop.", respect: 5, heat: 0, recettes: 0 },
      { label: "Offrir la tournée générale toute la soirée", outcome: "Le quartier t'adore ce soir-là — et s'en souvient.", respect: 11, heat: 3, recettes: -6000 },
    ],
  },
  {
    id: "camion-cargaison", category: "affaires", title: "Un Camion \"Tombé du Port\"",
    description: "Une cargaison entière disparaît discrètement des quais un soir de faible surveillance.",
    choices: [
      { label: "La revendre lentement, sur plusieurs mois", outcome: "Discret et rentable, personne n'y voit rien.", respect: 3, heat: 2, recettes: 15000 },
      { label: "Tout écouler d'un coup, vite fait", outcome: "Gros cash immédiat, mais ça fait beaucoup de bruit.", respect: 5, heat: 9, recettes: 35000 },
    ],
  },
  {
    id: "avocat-cher", category: "serieux", title: "L'Avocat Très Cher",
    description: "Ton avocat habituel te conseille de \"passer à la vitesse supérieure\" en termes de protection juridique.",
    choices: [
      { label: "Investir dans une équipe juridique solide", outcome: "Une tranquillité d'esprit qui vaut cher, mais qui vaut le coup.", respect: 2, heat: -7, recettes: -18000 },
      { label: "Rester avec l'avocat actuel, ça suffit", outcome: "Économies faites, mais un peu de vulnérabilité en plus.", respect: 0, heat: 3, recettes: 0 },
    ],
  },
];

// ============================================================================
// Réceptions — dîners, fêtes et événements de prestige entre deux campagnes de rackets.
// ============================================================================

export const HAPPENING_POOL: MandateEvent[] = [
  {
    id: "happening-diner-dimanche", category: "happening", title: "Le Grand Dîner du Dimanche",
    description: "Toute la famille et les proches lieutenants se retrouvent pour le traditionnel dîner du dimanche.",
    choices: [
      { label: "Un moment simple et chaleureux", outcome: "La famille se sent unie, la loyauté se renforce.", respect: 6, heat: 0, recettes: 0 },
      { label: "En faire un vrai raout, avec tout le quartier", outcome: "Fête mémorable, un peu trop visible pour certains goûts.", respect: 9, heat: 4, recettes: -3000 },
    ],
  },
  {
    id: "happening-opera", category: "happening", title: "Une Soirée à l'Opéra",
    description: "Une loge privée à l'opéra t'attend, l'occasion de te montrer sous ton meilleur jour.",
    choices: [
      { label: "Une soirée discrète et élégante", outcome: "Image de respectabilité renforcée dans les hautes sphères.", respect: 7, heat: -1, recettes: 0 },
      { label: "Y amener toute ta cour", outcome: "Entrée fracassante, la presse people s'en mêle.", respect: 5, heat: 5, recettes: 0 },
    ],
  },
  {
    id: "happening-tournoi-boules", category: "happening", title: "Le Tournoi de Pétanque du Quartier",
    description: "Le tournoi annuel de pétanque rassemble tout le quartier, petits commerçants compris.",
    choices: [
      { label: "Jouer franc jeu, avec tout le monde", outcome: "Belle image de proximité, très appréciée.", respect: 6, heat: 0, recettes: 0 },
      { label: "S'arranger discrètement pour gagner", outcome: "", respect: 0, heat: 0, recettes: 0, chaos: true },
    ],
  },
  {
    id: "happening-bapteme", category: "happening", title: "Le Baptême du Neveu",
    description: "Le baptême de ton neveu réunit toute la famille élargie, y compris des cousins qu'on ne voit jamais.",
    choices: [
      { label: "Une cérémonie familiale et sobre", outcome: "Moment touchant, la famille se sent proche.", respect: 5, heat: 0, recettes: -1000 },
      { label: "Une fête somptueuse, invitations à tout le quartier", outcome: "Le quartier entier en parle — dans le bon comme dans le mauvais sens.", respect: 8, heat: 5, recettes: -8000 },
    ],
  },
  {
    id: "happening-bar-nuit", category: "happening", title: "Nuit au Bar Privé",
    description: "Une soirée improvisée dans ton bar privé s'étire bien après la fermeture officielle.",
    choices: [
      { label: "Fermer à l'heure, comme prévu", outcome: "Discret et sans histoire.", respect: 1, heat: 0, recettes: 0 },
      { label: "Continuer la fête jusqu'au bout de la nuit", outcome: "", respect: 0, heat: 0, recettes: 0, chaos: true },
    ],
  },
  {
    id: "happening-gala-charite", category: "happening", title: "Gala de Charité du Quartier",
    description: "Un gala de charité organisé \"en ton honneur\" attire du beau monde, légal et moins légal.",
    choices: [
      { label: "Faire un don généreux et sincère", outcome: "Image de bienfaiteur du quartier renforcée durablement.", respect: 10, heat: -3, recettes: -12000 },
      { label: "Faire acte de présence, sans plus", outcome: "Présence notée, sans grand effet.", respect: 2, heat: 0, recettes: 0 },
    ],
  },
  {
    id: "happening-anniversaire", category: "happening", title: "Ton Anniversaire au Restaurant Vitrine",
    description: "Tes lieutenants organisent une grande fête surprise dans ton propre restaurant.",
    choices: [
      { label: "Apprécier la soirée en petit comité", outcome: "Moment chaleureux avec tes plus proches fidèles.", respect: 5, heat: 0, recettes: 0 },
      { label: "Ouvrir la fête à tout le quartier", outcome: "Soirée légendaire, mais très voyante pour les autorités.", respect: 9, heat: 6, recettes: -4000 },
    ],
  },
  {
    id: "happening-course-chevaux", category: "happening", title: "Journée aux Courses",
    description: "Une journée à l'hippodrome, loge VIP, avec tout le gratin du quartier.",
    choices: [
      { label: "Miser petit, profiter de l'ambiance", outcome: "Belle journée détente, sans excès.", respect: 3, heat: 0, recettes: 1000 },
      { label: "Miser gros sur un tuyau \"garanti\"", outcome: "Le tuyau était bidon — une grosse perte, mais l'audace impressionne.", respect: 4, heat: 2, recettes: -10000 },
    ],
  },
];

export function drawHappening(usedIds: string[] = []): { event: MandateEvent; usedIds: string[] } {
  const available = HAPPENING_POOL.filter((h) => !usedIds.includes(h.id));
  const pool = available.length > 0 ? available : HAPPENING_POOL;
  const event = pick(pool);
  const nextUsed = available.length > 0 ? [...usedIds, event.id] : [event.id];
  return { event, usedIds: nextUsed };
}

export function shouldTriggerHappening(): boolean {
  return chance(0.28);
}

export function shouldTriggerSurpriseRaid(): boolean {
  return chance(0.05);
}

// ============================================================================
// Rackets — 12 à 18 par saison, chacun visant un commerce tiré au hasard. L'approche "discrète"
// rapporte moins mais fait moins de bruit ; "musclée" rapporte plus mais attire l'attention des flics.
// ============================================================================

export const RACKETS_PER_SEASON_MIN = 12;
export const RACKETS_PER_SEASON_MAX = 18;

export interface Business {
  id: string;
  label: string;
  pool: string;
}

export const BUSINESSES: Business[] = [
  { id: "boulangerie", label: "La Boulangerie du Coin", pool: "un boulanger inquiet" },
  { id: "garage", label: "Le Garage Automobile", pool: "un garagiste débrouillard" },
  { id: "restaurant", label: "Le Petit Restaurant Familial", pool: "une famille de restaurateurs" },
  { id: "bar-quartier", label: "Le Bar du Quartier", pool: "un tenancier de bar blasé" },
  { id: "epicerie", label: "L'Épicerie de Nuit", pool: "un épicier discret" },
  { id: "salon-coiffure", label: "Le Salon de Coiffure", pool: "une coiffeuse bavarde" },
  { id: "pressing", label: "Le Pressing du Quartier", pool: "un teinturier prudent" },
  { id: "boite-nuit", label: "La Boîte de Nuit", pool: "un videur peu commode" },
  { id: "supermarche", label: "Le Supérette du Quartier", pool: "un gérant de chaîne nerveux" },
  { id: "atelier", label: "L'Atelier de Retouches", pool: "un couturier discret" },
  { id: "cave-vins", label: "La Cave à Vins", pool: "un caviste raffiné" },
  { id: "salle-sport", label: "La Salle de Sport", pool: "un patron de salle costaud" },
];

export type RacketApproach = "discrete" | "musclee";

export function generateRacket(): Business {
  return pick(BUSINESSES);
}

export function racketsForSeason(): Business[] {
  const count = randInt(RACKETS_PER_SEASON_MIN, RACKETS_PER_SEASON_MAX);
  return Array.from({ length: count }, generateRacket);
}

export interface RacketResult {
  success: boolean;
  narrative: string;
  respect: number;
  heat: number;
  recettes: number;
}

export function resolveRacket(business: Business, approach: RacketApproach, bias = 1): RacketResult {
  const successChance = 0.6 + (approach === "discrete" ? 0.06 : -0.04);
  const success = biasedChance(successChance, bias);
  const recettes = success ? randInt(800, approach === "musclee" ? 6000 : 3000) : 0;
  const respect = success ? randInt(1, approach === "musclee" ? 5 : 3) : -randInt(0, 2);
  const heat = approach === "musclee" ? randInt(2, 6) : randInt(0, 2);
  const narrative = `${business.label} — ${success ? `Versement obtenu de ${business.pool}.` : `Refus catégorique de ${business.pool}.`}`;
  return { success, narrative, respect, heat, recettes };
}

// ============================================================================
// Chaos — issue spéciale des choix "risqués" (cartes truquées, soirée qui dérape).
// ============================================================================

const CHAOS_GOOD_LINES = [
  "La soirée tourne à la légende du quartier — on en parlera encore dans dix ans.",
  "Un coup de bluff monumental impressionne même tes rivaux les plus méfiants.",
  "Dans l'euphorie générale, deux commerçants hésitants rejoignent ton réseau de leur plein gré.",
];
const CHAOS_BAD_LINES = [
  "La combine est repérée en pleine partie — l'ambiance devient glaciale d'un coup.",
  "Une dispute éclate et dégénère devant témoins, en pleine rue.",
  "Un invité un peu trop bavard raconte des choses qu'il n'aurait jamais dû répéter.",
];

export interface ChaosResult {
  respect: number;
  heat: number;
  recettes: number;
  outcome: string;
  good: boolean;
}

export function resolveChaos(): ChaosResult {
  const roll = randInt(-35, 45);
  const good = roll > 5;
  return { respect: roll, heat: good ? randInt(0, 5) : randInt(10, 25), recettes: good ? randInt(0, 5000) : -randInt(2000, 10000), outcome: pick(good ? CHAOS_GOOD_LINES : CHAOS_BAD_LINES), good };
}

// ============================================================================
// Acheter le silence d'un commissaire — dépense de vrais crédits, en alternative aux choix
// narratifs, pour faire retomber l'attention des flics.
// ============================================================================

export function bribeCost(territory: Territory): number {
  return Math.round(ENTRY_COST * 1.5 * Math.max(1, TIER_MULTIPLIER[territory.tier]));
}

const BRIBE_SUCCESS_LINES = [
  "Le dossier disparaît discrètement d'une pile de paperasse.",
  "Un simple virement a suffi à calmer les ardeurs du commissariat.",
  "Ton contact chez les flics est reconnaissant... et très discret.",
];
const BRIBE_FAIL_LINES = [
  "Le commissaire a enregistré toute la conversation.",
  "L'offre devient elle-même une pièce à conviction.",
  "Un collègue trop honnête découvre le pot aux roses avant que l'affaire soit conclue.",
];

export interface BribeResult {
  success: boolean;
  respect: number;
  heat: number;
  outcome: string;
}

export function resolveBribe(bias = 1): BribeResult {
  const success = biasedChance(0.6, bias);
  if (success) {
    return { success: true, respect: randInt(5, 12), heat: -randInt(15, 28), outcome: pick(BRIBE_SUCCESS_LINES) };
  }
  return { success: false, respect: -randInt(20, 35), heat: randInt(20, 35), outcome: pick(BRIBE_FAIL_LINES) };
}

// ============================================================================
// Descente de police — se déclenche à la fin de toute saison où l'attention des flics finit à 75
// ou plus.
// ============================================================================

export interface RaidResult {
  survived: boolean;
  narrative: string;
  heatAfter: number;
}

export function resolveRaid(respect: number, heat: number, bias = 1): RaidResult {
  const basis = respect * 0.6 - heat * 0.4;
  const surviveChance = 0.25 + (Math.max(0, Math.min(100, basis + 50)) / 100) * 0.55;
  const survived = biasedChance(surviveChance, bias);
  const narrative = survived
    ? "Une descente surprise ne trouve rien d'exploitable — tes avocats et tes contacts gèrent la suite en coulisses."
    : "La descente aboutit à un démantèlement en règle. Le réseau s'effondre du jour au lendemain.";
  return { survived, narrative, heatAfter: survived ? Math.max(0, heat - randInt(20, 35)) : heat };
}

// ============================================================================
// Fin de règne
// ============================================================================

export interface MandateOutcome {
  payout: number;
  label: string;
}

export function computeOutcome(territory: Territory, respect: number, recettes: number, busted: boolean): MandateOutcome {
  if (territory.tier === 0) {
    return { payout: Math.round(ENTRY_COST * 0.15), label: "Réseau démantelé avant même de démarrer" };
  }
  if (busted) {
    return { payout: Math.round(ENTRY_COST * 0.25), label: "Descente de police — réseau démantelé" };
  }
  const base = ENTRY_COST * TIER_MULTIPLIER[territory.tier];
  const respectFactor = 0.5 + (Math.max(0, Math.min(100, respect)) / 100) * 1.3;
  const recettesFactor = Math.max(0.7, Math.min(1.35, 1 + recettes / 300000));
  const payout = Math.round(base * respectFactor * recettesFactor);
  const label =
    respect >= 80 ? "Parrain incontesté, toute la ville te respecte" :
    respect >= 60 ? "Réseau prospère et craint de tous" :
    respect >= 40 ? "Territoire stable, quelques fidèles solides" :
    "Règne chancelant, mais toujours en place";
  return { payout, label };
}

// ============================================================================
// Prendre le contrôle de toute la ville — offert uniquement à la toute fin d'un règne mené jusqu'au
// bout (pas de descente). Pari à haut risque.
// ============================================================================

const TAKEOVER_WIN_MULTIPLIER = 12;
const TAKEOVER_LOSE_MULTIPLIER = 0.5;

export interface TakeoverResult {
  won: boolean;
  payout: number;
  label: string;
  narrative: string;
}

export function resolveTakeover(respect: number, bias = 1): TakeoverResult {
  const winChance = 0.15 + (Math.max(0, Math.min(100, respect)) / 100) * 0.5;
  const won = biasedChance(winChance, bias);
  const payout = Math.round(ENTRY_COST * (won ? TAKEOVER_WIN_MULTIPLIER : TAKEOVER_LOSE_MULTIPLIER) * (0.8 + Math.random() * 0.5));
  return {
    won,
    payout,
    label: won ? "Toute la ville t'appartient désormais" : "La tentative de prise de contrôle échoue",
    narrative: won
      ? "Les autres familles plient l'une après l'autre. Ton nom devient une légende de la ville entière."
      : "Une alliance de rivaux te prend de court. Tu dois te replier, la tête haute mais les mains vides.",
  };
}
