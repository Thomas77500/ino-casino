import { biasedWeightedPick, biasedChance, chance, randInt, pick, type Weighted } from "./rng";

// ============================================================================
// L'Arc Ministériel — 100% fictif, personnages et institutions inventés. Débloqué comme la
// Bourse (voir stockEngine.ts) : un cap de gains cumulés, pas de vraie monnaie en jeu.
// ============================================================================

export const UNLOCK_TOTAL_WON = 25_000_000;
export const ENTRY_COST = 50_000;

export interface Ministry {
  id: string;
  label: string;
  glyph: string;
  weight: number;
  tier: 0 | 1 | 2 | 3 | 4; // 0 = mandat avorté (Placard), 4 = Matignon (jackpot)
  accent: string;
}

const TIER_MULTIPLIER: Record<Ministry["tier"], number> = { 0: 0, 1: 1, 2: 1.8, 3: 2.6, 4: 4.5 };

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
  category: "polemique" | "derive" | "fun" | "serieux" | "vote" | "election";
  title: string;
  description: string;
  choices: [MandateChoice, MandateChoice];
}

export const CATEGORY_LABEL: Record<MandateEvent["category"], string> = {
  polemique: "Polémique",
  derive: "Dérive",
  fun: "Fun",
  serieux: "Sérieux",
  vote: "Vote",
  election: "Élection",
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

  // --- Votes budgétaires ---
  {
    id: "vote-budget-annuel", category: "vote", title: "Vote du Budget Annuel",
    description: "L'Assemblée doit voter le budget de ton ministère pour l'année à venir.",
    choices: [
      { label: "Défendre un budget ambitieux", outcome: "Le budget passe, les services publics respirent un peu.", popularity: 8, treasury: -25 },
      { label: "Proposer un budget resserré", outcome: "Le budget passe, mais Bercy est le seul content.", popularity: -6, treasury: 20 },
    ],
  },
  {
    id: "rallonge-hopital", category: "vote", title: "Rallonge pour l'Hôpital Public",
    description: "Les urgences de ta région craquent. Une rallonge budgétaire est demandée dans l'urgence.",
    choices: [
      { label: "Voter la rallonge immédiatement", outcome: "Un vrai soulagement sur le terrain.", popularity: 11, treasury: -22 },
      { label: "Renvoyer le dossier en commission", outcome: "Le temps perdu se voit, et se paie.", popularity: -13, treasury: 6 },
    ],
  },
  {
    id: "niche-fiscale", category: "vote", title: "Niche Fiscale Contestée",
    description: "Un rapport pointe une niche fiscale qui profite surtout à une poignée de grandes entreprises.",
    choices: [
      { label: "La supprimer", outcome: "Bien accueilli, sauf par quelques amis très puissants.", popularity: 5, treasury: 18 },
      { label: "La maintenir, le temps d'étudier", outcome: "Ça sent le service rendu, tout le monde l'a vu.", popularity: -9, treasury: -4 },
    ],
  },
  {
    id: "plan-relance", category: "vote", title: "Plan de Relance Express",
    description: "Une opportunité de relance économique se présente, mais elle coûte cher — et vite.",
    choices: [
      { label: "Foncer, quitte à emprunter", outcome: "L'effet d'annonce est énorme, la facture aussi.", popularity: 14, treasury: -28 },
      { label: "Étaler la dépense sur trois ans", outcome: "Plus sage, beaucoup moins spectaculaire.", popularity: 2, treasury: -10 },
    ],
  },
  {
    id: "gel-depenses", category: "vote", title: "Gel des Dépenses",
    description: "Bercy exige un gel immédiat de toutes les dépenses non-essentielles de ton ministère.",
    choices: [
      { label: "Appliquer le gel à la lettre", outcome: "Les comptes remontent, le terrain grogne.", popularity: -10, treasury: 16 },
      { label: "Trouver des exceptions créatives", outcome: "Petits arrangements, personne ne s'en aperçoit... pour l'instant.", popularity: 4, treasury: -6 },
    ],
  },
  {
    id: "credits-rectificatifs", category: "vote", title: "Crédits Rectificatifs",
    description: "Un vote rectificatif propose de revoir à la baisse les crédits alloués à ton administration.",
    choices: [
      { label: "Voter pour, en solidarité gouvernementale", outcome: "Discipline de groupe, sans plus.", popularity: 0, treasury: -15 },
      { label: "S'abstenir publiquement", outcome: "L'abstention fait jaser jusque dans ton propre camp.", popularity: -7, treasury: 8 },
    ],
  },
];

// Moment fixe, hors tirage aléatoire — placé sur l'année civile réelle 2027 quand le mandat la
// couvre (voir drawMandateEvents). Un remaniement plane sur tout le gouvernement, indépendamment
// du portefeuille tenu.
export const ELECTION_2027_EVENT: MandateEvent = {
  id: "election-2027",
  category: "election",
  title: "Élections Présidentielles 2027",
  description: "Le pays vote. Un remaniement ministériel plane sur tout le gouvernement, quel que soit le résultat.",
  choices: [
    { label: "Faire campagne à fond pour la majorité sortante", outcome: "Tu tiens ton poste — la nouvelle équipe te reconduit, de justesse.", popularity: 12, treasury: -20 },
    { label: "Rester en retrait, ne pas prendre parti", outcome: "Discret, tu passes sous les radars du remaniement.", popularity: -4, treasury: 5 },
  ],
};

// The 2027 election lands on whichever mandate year matches that real calendar year. If the
// mandate starts after 2031 it never falls within the 5 years — the slot silently reverts to a
// normal random draw instead of forcing a now-meaningless date.
export function drawMandateEvents(startYear: number = new Date().getFullYear()): MandateEvent[] {
  const electionTurnIndex = 2027 - startYear;
  const shuffled = [...EVENT_POOL].sort(() => Math.random() - 0.5);
  const events: MandateEvent[] = [];
  let poolIdx = 0;
  for (let i = 0; i < MANDATE_LENGTH; i++) {
    if (i === electionTurnIndex) events.push(ELECTION_2027_EVENT);
    else events.push(shuffled[poolIdx++]);
  }
  return events;
}

// ============================================================================
// Votes législatifs — inspiré de "La Bataille du Budget" : chaque année, l'Assemblée enchaîne
// 15 à 20 textes de loi (taxes/détaxes) générés à la volée sur un pool de sujets, votés un par un
// en Pour/Contre, avec un résultat de vote immédiat et un impact sur la popularité. Certains textes
// s'accompagnent d'une enveloppe du Premier ministre : accepter force le vote dans le sens demandé
// contre des crédits réels, avec un risque de fuite.
// ============================================================================

export const VOTES_PER_YEAR_MIN = 15;
export const VOTES_PER_YEAR_MAX = 20;

export interface BillTopic {
  id: string;
  hausseTitle: string;
  baisseTitle: string;
  affected: string;
}

export const BILL_TOPICS: BillTopic[] = [
  { id: "carburant", hausseTitle: "Hausse de la taxe sur le carburant", baisseTitle: "Baisse de la taxe sur le carburant", affected: "les automobilistes" },
  { id: "tabac", hausseTitle: "Hausse du prix du tabac", baisseTitle: "Gel du prix du tabac", affected: "les buralistes" },
  { id: "alcool", hausseTitle: "Hausse des droits sur l'alcool", baisseTitle: "Baisse des droits sur l'alcool", affected: "les viticulteurs" },
  { id: "entreprises", hausseTitle: "Hausse de l'impôt sur les sociétés", baisseTitle: "Baisse de l'impôt sur les sociétés", affected: "le patronat" },
  { id: "heritage", hausseTitle: "Hausse des droits de succession", baisseTitle: "Baisse des droits de succession", affected: "les héritiers" },
  { id: "immobilier", hausseTitle: "Hausse de la taxe foncière", baisseTitle: "Baisse de la taxe foncière", affected: "les propriétaires" },
  { id: "gafa", hausseTitle: "Taxe GAFA renforcée", baisseTitle: "Allègement de la taxe GAFA", affected: "les géants du numérique" },
  { id: "agriculteurs", hausseTitle: "Hausse des cotisations agricoles", baisseTitle: "Exonération de cotisations agricoles", affected: "les agriculteurs" },
  { id: "hauts-revenus", hausseTitle: "Nouvelle tranche d'impôt pour les hauts revenus", baisseTitle: "Plafonnement de l'impôt sur le revenu", affected: "les hauts revenus" },
  { id: "tva", hausseTitle: "Hausse d'un point de TVA", baisseTitle: "TVA réduite sur les produits de première nécessité", affected: "tous les consommateurs" },
  { id: "automobile", hausseTitle: "Malus renforcé sur les grosses cylindrées", baisseTitle: "Suppression du malus écologique", affected: "les automobilistes" },
  { id: "streaming", hausseTitle: "Taxe sur les plateformes de streaming", baisseTitle: "Suppression de la taxe streaming", affected: "les plateformes" },
  { id: "crypto", hausseTitle: "Taxation renforcée des plus-values crypto", baisseTitle: "Régime fiscal allégé pour la crypto", affected: "les investisseurs" },
  { id: "jeux-argent", hausseTitle: "Hausse de la taxe sur les jeux d'argent", baisseTitle: "Baisse de la taxe sur les jeux d'argent", affected: "les casinos en ligne" },
  { id: "tourisme", hausseTitle: "Hausse de la taxe de séjour", baisseTitle: "Suppression de la taxe de séjour", affected: "les hôteliers" },
  { id: "cantines", hausseTitle: "Hausse du tarif des cantines scolaires", baisseTitle: "Cantines à un euro généralisées", affected: "les familles" },
  { id: "fonctionnaires", hausseTitle: "Gel du point d'indice des fonctionnaires", baisseTitle: "Dégel et revalorisation du point d'indice", affected: "les fonctionnaires" },
  { id: "retraites", hausseTitle: "Report de l'âge de départ à la retraite", baisseTitle: "Retour à la retraite à 62 ans", affected: "les retraités" },
  { id: "peages", hausseTitle: "Hausse des péages autoroutiers", baisseTitle: "Gel des péages autoroutiers", affected: "les usagers de l'autoroute" },
  { id: "niches", hausseTitle: "Suppression d'une niche fiscale sectorielle", baisseTitle: "Création d'une niche fiscale sectorielle", affected: "les lobbys concernés" },
];

export type BillDirection = "hausse" | "baisse";
export type VoteChoice = "pour" | "contre";

export interface BribeOffer {
  direction: VoteChoice;
  amount: number;
}

export interface Bill {
  topic: BillTopic;
  direction: BillDirection;
  title: string;
  amountMdEur: number; // pur habillage narratif, sans lien mécanique avec la trésorerie
  bribeOffer: BribeOffer | null;
}

export function generateBill(ministry: Ministry): Bill {
  const topic = pick(BILL_TOPICS);
  const direction: BillDirection = chance(0.5) ? "hausse" : "baisse";
  const bribeOffer: BribeOffer | null = chance(0.3)
    ? { direction: chance(0.5) ? "pour" : "contre", amount: Math.round(bribeCost(ministry) * (0.5 + Math.random())) }
    : null;
  return {
    topic,
    direction,
    title: direction === "hausse" ? topic.hausseTitle : topic.baisseTitle,
    amountMdEur: Math.round((0.4 + Math.random() * 4.6) * 10) / 10,
    bribeOffer,
  };
}

export function billsForYear(ministry: Ministry): Bill[] {
  const count = randInt(VOTES_PER_YEAR_MIN, VOTES_PER_YEAR_MAX);
  return Array.from({ length: count }, () => generateBill(ministry));
}

export interface VoteResult {
  passed: boolean;
  votesFor: number;
  narrative: string;
  popularity: number;
  treasury: number;
}

// The player's own vote nudges the Assembly's odds (government whip effect) without deciding the
// outcome outright — voting "pour" makes passage likelier, "contre" makes it less likely.
export function resolveVote(bill: Bill, vote: VoteChoice, bias = 1): VoteResult {
  const supportChance = 0.42 + (vote === "pour" ? 0.16 : -0.16);
  const passed = biasedChance(supportChance, bias);
  const votesFor = passed ? randInt(289, 360) : randInt(210, 288);

  const magnitude = passed ? 1 : 0.4; // a bill that never passed anyway barely registers
  const directionSign = bill.direction === "baisse" ? 1 : -1; // cuts play well, hikes don't
  const voteSign = vote === "pour" ? 1 : -1;
  let popularity = Math.round(directionSign * voteSign * randInt(2, 5) * magnitude);
  // Backing a bill that fails looks weak; opposing one that passes anyway looks powerless.
  if ((vote === "pour") !== passed) popularity -= randInt(0, 2);

  const treasury = passed ? (bill.direction === "hausse" ? randInt(4, 9) : -randInt(4, 9)) : 0;
  const narrative = `${bill.title} — ${votesFor}/577 voix pour, ${passed ? "adoptée" : "rejetée"}.`;
  return { passed, votesFor, narrative, popularity, treasury };
}

// 18% base chance an accepted envelope gets noticed by the press — same admin bias knob as every
// other risk roll in this game.
export interface BribeLeakResult {
  leaked: boolean;
  popularityPenalty: number;
}

export function resolveBribeLeak(bias = 1): BribeLeakResult {
  const leaked = !biasedChance(0.82, bias);
  return { leaked, popularityPenalty: leaked ? randInt(10, 20) : 0 };
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
// Motion de censure — se déclenche à la fin de tout tour où la popularité finit à 30 ou moins
// (mais pas encore à zéro, qui reste une chute immédiate sans vote). Chances de survie
// proportionnelles à la popularité restante, mêmes 577 sièges et seuil de 289 voix que la vraie
// Assemblée nationale — pur décor, aucun rapport avec un fait réel.
// ============================================================================

export interface CensureResult {
  survived: boolean;
  narrative: string;
  popularityPenalty: number;
}

export function resolveCensureMotion(popularity: number, bias = 1): CensureResult {
  const surviveChance = 0.3 + (Math.max(0, Math.min(100, popularity)) / 100) * 0.6;
  const survived = biasedChance(surviveChance, bias);
  const votesForCensure = survived ? randInt(220, 288) : randInt(289, 344);
  const narrative = survived
    ? `Motion de censure déposée — ${votesForCensure}/577 voix pour, il en fallait 289. Le gouvernement survit, de justesse.`
    : `Motion de censure déposée — ${votesForCensure}/577 voix pour. La motion est adoptée. Le gouvernement tombe.`;
  return { survived, narrative, popularityPenalty: survived ? randInt(3, 8) : 0 };
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
