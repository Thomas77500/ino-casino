import { biasedWeightedPick, biasedChance, chance, randInt, pick, type Weighted } from "./rng";

// ============================================================================
// L'Arc Gourou — 100% fictif, personnages et organisations inventés. Satire du dérapage sectaire
// façon documentaire Netflix, jamais un mode d'emploi : les "dérives" restent des punchlines
// (dépenser sa voiture, boire une potion douteuse), jamais une mise en scène d'abus réel. Débloqué
// comme le Ministère/le Club : un cap de gains cumulés, pas de vraie monnaie en jeu.
// ============================================================================

export const UNLOCK_TOTAL_WON = 45_000_000;
export const ENTRY_COST = 50_000;

export interface CultType {
  id: string;
  label: string;
  glyph: string;
  weight: number;
  tier: 0 | 1 | 2 | 3 | 4; // 0 = dissous avant l'ouverture, 4 = culte planétaire (jackpot)
  accent: string;
}

const TIER_MULTIPLIER: Record<CultType["tier"], number> = { 0: 0, 1: 1, 2: 1.8, 3: 2.6, 4: 4.5 };

export const CULT_TYPES: CultType[] = [
  { id: "meditation", label: "Cercle de Méditation", glyph: "🧘", weight: 15, tier: 1, accent: "from-emerald-600 to-emerald-800" },
  { id: "bien-etre", label: "Communauté Bien-Être", glyph: "🌿", weight: 15, tier: 1, accent: "from-lime-600 to-lime-800" },
  { id: "spirituel", label: "Cercle Spirituel Éveillé", glyph: "🔮", weight: 13, tier: 1, accent: "from-fuchsia-600 to-fuchsia-800" },
  { id: "survivalisme", label: "Communauté Survivaliste", glyph: "⛺", weight: 12, tier: 2, accent: "from-stone-600 to-stone-800" },
  { id: "detox", label: "Retraite de Détox Totale", glyph: "🥗", weight: 11, tier: 2, accent: "from-amber-600 to-amber-800" },
  { id: "prophetie", label: "Église de la Prophétie Nouvelle", glyph: "✨", weight: 9, tier: 2, accent: "from-electric-600 to-electric-900" },
  { id: "guerison", label: "Centre de Guérison Universelle", glyph: "💫", weight: 8, tier: 2, accent: "from-sky-600 to-sky-900" },
  { id: "megachurch", label: "Méga-Église Médiatique", glyph: "📺", weight: 6, tier: 3, accent: "from-gold-500 to-gold-700" },
  { id: "elu", label: "L'Élu(e) — Culte Planétaire", glyph: "👁️", weight: 3, tier: 4, accent: "from-gold-300 to-fuchsia-500" },
  { id: "dissous", label: "Dissous avant l'ouverture", glyph: "🚫", weight: 8, tier: 0, accent: "from-ink-700 to-ink-900" },
];

const CULT_WEIGHTS: Weighted<CultType>[] = CULT_TYPES.map((c) => ({ value: c, weight: c.weight }));

export function drawCultType(bias = 1): CultType {
  return biasedWeightedPick(CULT_WEIGHTS, bias);
}

export function randomDecoyCultType(): CultType {
  return CULT_TYPES[Math.floor(Math.random() * CULT_TYPES.length)];
}

// ============================================================================
// Mandat — 5 saisons de recrutement. L'influence (charisme sur le troupeau) remplace la
// popularité ; la suspicion (attention des autorités) remplace la dette : elle ne fait que
// grimper, et une descente peut tomber à tout moment une fois qu'elle est haute.
// ============================================================================

export const MANDATE_LENGTH = 5;
export const START_INFLUENCE = 50;
export const START_SUSPICION = 10;

export interface MandateChoice {
  label: string;
  outcome: string;
  influence: number;
  suspicion: number;
  dons: number;
  chaos?: boolean; // résolu dynamiquement par resolveChaos(), champs ci-dessus ignorés
}

export interface MandateEvent {
  id: string;
  category: "recrutement" | "derive" | "fun" | "serieux" | "happening";
  title: string;
  description: string;
  choices: [MandateChoice, MandateChoice];
}

export const CATEGORY_LABEL: Record<MandateEvent["category"], string> = {
  recrutement: "Recrutement",
  derive: "Dérive",
  fun: "Fun",
  serieux: "Sérieux",
  happening: "Retraite",
};

// One event per mandate turn (5), shuffled fresh each mandate — no calendar-locked special event
// here (unlike Ministry's 2027 election), the pool is simple enough to just shuffle-and-take.
export function drawMandateEvents(): MandateEvent[] {
  return [...EVENT_POOL].sort(() => Math.random() - 0.5).slice(0, MANDATE_LENGTH);
}

export const EVENT_POOL: MandateEvent[] = [
  {
    id: "premiere-adepte", category: "recrutement", title: "La Première Grande Adepte",
    description: "Une héritière discrète tombe complètement sous ton charme dès la première session.",
    choices: [
      { label: "La garder proche, comme conseillère", outcome: "Son réseau t'ouvre des portes insoupçonnées.", influence: 8, suspicion: 1, dons: 4000 },
      { label: "Lui demander de \"tout donner\" tout de suite", outcome: "Elle s'exécute, radieuse. Sa famille, elle, s'inquiète.", influence: 4, suspicion: 6, dons: 22000 },
    ],
  },
  {
    id: "vente-voiture", category: "derive", title: "\"Vends ta Voiture pour l'Éveil\"",
    description: "Un adepte dévoué propose de vendre sa voiture et de te donner l'intégralité de la somme.",
    choices: [
      { label: "Refuser, lui conseiller de garder une part", outcome: "Il insiste pour donner quand même un peu plus — la confiance grandit.", influence: 6, suspicion: 0, dons: 2000 },
      { label: "Accepter avec gratitude", outcome: "Sa famille commence à poser des questions gênantes.", influence: 2, suspicion: 5, dons: 9000 },
    ],
  },
  {
    id: "potion-douteuse", category: "derive", title: "La Potion de Purification",
    description: "Ton \"guérisseur\" maison propose une nouvelle potion \"100% naturelle\" pour la cérémonie du soir.",
    choices: [
      { label: "La refuser, prétexter une intuition", outcome: "Sage décision — trois adeptes ont mal réagi la fois précédente.", influence: 3, suspicion: -2, dons: 0 },
      { label: "La boire en premier, pour l'exemple", outcome: "", influence: 0, suspicion: 0, dons: 0, chaos: true },
    ],
  },
  {
    id: "journaliste-infiltre", category: "serieux", title: "Le Journaliste Infiltré",
    description: "Un membre récent pose des questions bizarrement précises sur les comptes du culte.",
    choices: [
      { label: "L'exclure discrètement", outcome: "Il publie quand même un article, mais sans preuve solide.", influence: -2, suspicion: 8, dons: 0 },
      { label: "Le noyer sous l'attention et l'affection", outcome: "Désarçonné par tant de chaleur, il abandonne son article.", influence: 5, suspicion: -3, dons: 0 },
    ],
  },
  {
    id: "prophetie-ratee", category: "serieux", title: "La Prophétie qui Ne S'est Pas Réalisée",
    description: "Tu avais annoncé un \"grand basculement cosmique\" pour minuit. Il ne s'est rien passé.",
    choices: [
      { label: "\"C'était un test de votre foi\"", outcome: "Les plus dévoués adorent cette explication.", influence: 6, suspicion: 3, dons: 3000 },
      { label: "Admettre s'être trompé dans les calculs", outcome: "Une poignée d'adeptes partent, déçus. Le reste t'admire pour l'honnêteté.", influence: -8, suspicion: -4, dons: 0 },
    ],
  },
  {
    id: "famille-inquiete", category: "serieux", title: "Une Famille Porte Plainte",
    description: "Les parents d'un jeune adepte très investi déposent une plainte pour \"emprise mentale\".",
    choices: [
      { label: "Envoyer un avocat négocier un arrangement", outcome: "L'affaire est étouffée, discrètement et cher.", influence: -1, suspicion: 4, dons: -15000 },
      { label: "Laisser l'adepte s'exprimer publiquement pour toi", outcome: "Son témoignage passionné retourne l'opinion en ta faveur.", influence: 10, suspicion: 10, dons: 0 },
    ],
  },
  {
    id: "costume-doré", category: "fun", title: "Le Nouveau Costume Doré",
    description: "Ton styliste personnel propose une tenue cérémonielle... très dorée, très voyante.",
    choices: [
      { label: "La porter fièrement au prochain rassemblement", outcome: "L'image devient culte, littéralement — les réseaux adorent.", influence: 9, suspicion: 2, dons: 0 },
      { label: "Rester sobre, robe blanche classique", outcome: "Discret, efficace, un peu moins mémorable.", influence: 2, suspicion: 0, dons: 0 },
    ],
  },
  {
    id: "chant-viral", category: "fun", title: "Le Chant Rituel Devenu Viral",
    description: "Un adepte filme discrètement un de tes chants rituels. La vidéo explose sur les réseaux.",
    choices: [
      { label: "En rire et surfer sur la vague", outcome: "Des milliers de curieux affluent aux prochaines portes ouvertes.", influence: 12, suspicion: 4, dons: 6000 },
      { label: "Faire retirer la vidéo immédiatement", outcome: "Effet Streisand garanti, elle circule encore plus.", influence: -6, suspicion: 6, dons: 0 },
    ],
  },
  {
    id: "documentaire", category: "fun", title: "Une Plateforme de Streaming Appelle",
    description: "Un producteur veut faire un documentaire \"bienveillant\" sur ta communauté.",
    choices: [
      { label: "Accepter, en gardant le contrôle du montage", outcome: "Le documentaire, très flatteur, fait un carton.", influence: 14, suspicion: 5, dons: 8000 },
      { label: "Refuser toute caméra extérieure", outcome: "Prudent — mais une rumeur d'opacité s'installe.", influence: -3, suspicion: -2, dons: 0 },
    ],
  },
  {
    id: "conseil-des-anciens", category: "recrutement", title: "Le Conseil des Anciens Adeptes",
    description: "Tes premiers disciples réclament un statut officiel et une part des décisions.",
    choices: [
      { label: "Créer un \"cercle intérieur\" honorifique", outcome: "Ils se sentent valorisés, la loyauté grimpe encore.", influence: 7, suspicion: 1, dons: 1000 },
      { label: "Refuser tout partage de pouvoir", outcome: "Deux d'entre eux partent, amers, prêts à parler à la presse.", influence: -5, suspicion: 7, dons: 0 },
    ],
  },
  {
    id: "campus-recrutement", category: "recrutement", title: "Stand sur un Campus Universitaire",
    description: "Un étudiant militant propose de tenir un stand de recrutement officiel devant l'amphi.",
    choices: [
      { label: "Miser sur le bien-être et la méditation", outcome: "Approche douce, quelques inscriptions solides.", influence: 4, suspicion: 1, dons: 1500 },
      { label: "Promettre l'illumination immédiate", outcome: "Beaucoup de curieux, l'administration s'inquiète vite.", influence: 6, suspicion: 5, dons: 3500 },
    ],
  },
  {
    id: "compte-offshore", category: "serieux", title: "Le Comptable Suggère un Montage",
    description: "Ton comptable propose de loger les dons du culte dans une structure offshore \"pour les protéger\".",
    choices: [
      { label: "Refuser, tout rester déclaré", outcome: "Moins optimisé fiscalement, mais aucune trace à effacer.", influence: 1, suspicion: -3, dons: -2000 },
      { label: "Accepter le montage", outcome: "Ça arrondit joliment les comptes. Pour l'instant, personne ne sait.", influence: 0, suspicion: 9, dons: 18000 },
    ],
  },
];

// ============================================================================
// Retraites — soirées, cérémonies et rassemblements qui surgissent entre deux campagnes de
// recrutement. Même forme qu'un MandateEvent, tirées d'un pool séparé.
// ============================================================================

export const HAPPENING_POOL: MandateEvent[] = [
  {
    id: "happening-feu-de-camp", category: "happening", title: "Veillée Autour du Feu",
    description: "Une grande veillée nocturne rassemble tous les adeptes autour d'un feu et de longs discours.",
    choices: [
      { label: "Prononcer un discours inspirant et sobre", outcome: "Moment de communion intense, très partagé en interne.", influence: 8, suspicion: 1, dons: 500 },
      { label: "Laisser la soirée s'éterniser jusqu'à l'aube", outcome: "Ambiance mystique totale, quelques voisins se plaignent du bruit.", influence: 4, suspicion: 4, dons: 0 },
    ],
  },
  {
    id: "happening-retraite-silencieuse", category: "happening", title: "Retraite du Silence",
    description: "Une semaine de silence total est organisée dans un chalet isolé loué pour l'occasion.",
    choices: [
      { label: "Encadrer chaque instant avec rigueur", outcome: "Expérience marquante saluée par tous les participants.", influence: 9, suspicion: 2, dons: 2000 },
      { label: "Improviser au fil de l'humeur du groupe", outcome: "Ambiance particulière, deux adeptes craquent nerveusement.", influence: -2, suspicion: 3, dons: 0 },
    ],
  },
  {
    id: "happening-gala-donateurs", category: "happening", title: "Gala des Grands Donateurs",
    description: "Une soirée habillée pour remercier les plus gros contributeurs tourne vite au concours de générosité.",
    choices: [
      { label: "Rester digne et reconnaissant", outcome: "La soirée renforce la loyauté du premier cercle.", influence: 6, suspicion: 1, dons: 12000 },
      { label: "Enchaîner les annonces de \"paliers d'éveil\" payants", outcome: "", influence: 0, suspicion: 0, dons: 0, chaos: true },
    ],
  },
  {
    id: "happening-mariage-collectif", category: "happening", title: "Cérémonie d'Union Collective",
    description: "Plusieurs couples d'adeptes demandent une bénédiction collective officiée par toi-même.",
    choices: [
      { label: "Officier avec émotion et simplicité", outcome: "Moment magnifique, très fédérateur pour la communauté.", influence: 10, suspicion: 2, dons: 1000 },
      { label: "En faire un spectacle filmé et diffusé", outcome: "Beau coup de communication, mais ça sent le marketing.", influence: 5, suspicion: 6, dons: 4000 },
    ],
  },
  {
    id: "happening-jeune-collectif", category: "happening", title: "Le Grand Jeûne Collectif",
    description: "Un jeûne de trois jours \"pour purifier le corps et l'esprit\" est annoncé au groupe.",
    choices: [
      { label: "Le garder raisonnable, avec suivi médical", outcome: "Expérience intense mais encadrée, tout se passe bien.", influence: 7, suspicion: 1, dons: 0 },
      { label: "Pousser le jeûne \"pour les plus déterminés\"", outcome: "", influence: 0, suspicion: 0, dons: 0, chaos: true },
    ],
  },
  {
    id: "happening-anniversaire-culte", category: "happening", title: "Anniversaire de la Fondation",
    description: "Le culte fête son anniversaire avec un grand rassemblement ouvert aux familles des adeptes.",
    choices: [
      { label: "Ouvrir grand les portes, transparence totale", outcome: "Les familles repartent rassurées, l'image s'améliore nettement.", influence: 11, suspicion: -5, dons: 3000 },
      { label: "N'inviter que les plus fidèles", outcome: "Belle fête, mais l'entre-soi inquiète ceux restés dehors.", influence: 3, suspicion: 3, dons: 1500 },
    ],
  },
  {
    id: "happening-retraite-exotique", category: "happening", title: "Retraite sous les Tropiques",
    description: "Un donateur richissime propose de financer une retraite d'une semaine sur une île privée.",
    choices: [
      { label: "N'emmener que le premier cercle", outcome: "Moment de cohésion fort pour tes plus proches lieutenants.", influence: 6, suspicion: 2, dons: 0 },
      { label: "Facturer une place à prix d'or à tout le monde", outcome: "Rentable, mais deux adeptes se ruinent pour y participer.", influence: 2, suspicion: 8, dons: 20000 },
    ],
  },
  {
    id: "happening-soiree-mecenes", category: "happening", title: "Soirée avec des Mécènes Extérieurs",
    description: "Des investisseurs curieux, séduits par ton aura, viennent \"voir de plus près\" lors d'une réception privée.",
    choices: [
      { label: "Rester mesuré sur les promesses", outcome: "Ils repartent impressionnés, sans excès de promesses intenables.", influence: 5, suspicion: 0, dons: 5000 },
      { label: "Promettre monts et merveilles spirituelles", outcome: "", influence: 0, suspicion: 0, dons: 0, chaos: true },
    ],
  },
  {
    id: "happening-ceremonie-lune", category: "happening", title: "Cérémonie de Pleine Lune",
    description: "La cérémonie mensuelle de pleine lune attire cette fois-ci un public inhabituellement large.",
    choices: [
      { label: "Garder le rituel intime et sobre", outcome: "Ceux qui étaient là repartent profondément marqués.", influence: 6, suspicion: 0, dons: 800 },
      { label: "L'ouvrir en grand, quitte à improviser", outcome: "Belle énergie collective, un peu de chaos dans l'organisation.", influence: 8, suspicion: 3, dons: 2500 },
    ],
  },
  {
    id: "happening-conference-presse", category: "happening", title: "Conférence de Presse Surprise",
    description: "Face à la rumeur grandissante, tu convoques toi-même la presse pour \"mettre les choses au clair\".",
    choices: [
      { label: "Préparer chaque réponse avec ton avocat", outcome: "La conférence désamorce l'essentiel des soupçons.", influence: 4, suspicion: -8, dons: -3000 },
      { label: "Improviser, en toute confiance", outcome: "Charismatique, mais une question piège fait mouche.", influence: 3, suspicion: 5, dons: 0 },
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

// ~5% chance après chaque campagne de recrutement qu'une descente surprise tombe, indépendamment
// du seuil de suspicion habituel — pure drama imprévisible.
export function shouldTriggerSurpriseRaid(): boolean {
  return chance(0.05);
}

// ============================================================================
// Campagnes de recrutement — 12 à 18 par saison, chacune ciblant un public tiré au hasard.
// L'approche "douce" recrute moins mais discrètement ; "agressive" recrute plus mais fait grimper
// la suspicion plus vite. Même charpente que le vote législatif du Ministère.
// ============================================================================

export const DRIVES_PER_SEASON_MIN = 12;
export const DRIVES_PER_SEASON_MAX = 18;

export interface RecruitTarget {
  id: string;
  label: string;
  pool: string;
}

export const RECRUIT_TARGETS: RecruitTarget[] = [
  { id: "etudiants", label: "Campus étudiant en pleine session d'examens", pool: "des étudiants stressés" },
  { id: "divorces", label: "Groupe de parole post-rupture", pool: "des personnes fraîchement séparées" },
  { id: "influenceurs", label: "Salon bien-être plein d'influenceurs", pool: "des influenceurs lifestyle" },
  { id: "retraites", label: "Club de randonnée pour retraités", pool: "des retraités aisés" },
  { id: "startuppers", label: "Afterwork de startuppers épuisés", pool: "des startuppers en burn-out" },
  { id: "festival", label: "Festival de musique alternative", pool: "des festivaliers en quête de sens" },
  { id: "emploi", label: "Antenne d'aide à l'emploi", pool: "des demandeurs d'emploi" },
  { id: "celebrites", label: "Soirée mondaine avec people", pool: "des célébrités en perte de repères" },
  { id: "voisinage", label: "Réunion de copropriété", pool: "de simples voisins curieux" },
  { id: "reseaux", label: "Groupe de développement personnel en ligne", pool: "des accros au développement personnel" },
  { id: "salle-sport", label: "Salle de sport haut de gamme", pool: "des habitués de la salle de sport" },
  { id: "librairie", label: "Rayon spiritualité d'une grande librairie", pool: "des lecteurs curieux" },
];

export type RecruitApproach = "douce" | "agressive";

export function generateDrive(): RecruitTarget {
  return pick(RECRUIT_TARGETS);
}

export function drivesForSeason(): RecruitTarget[] {
  const count = randInt(DRIVES_PER_SEASON_MIN, DRIVES_PER_SEASON_MAX);
  return Array.from({ length: count }, generateDrive);
}

export interface DriveResult {
  success: boolean;
  recruited: number;
  narrative: string;
  influence: number;
  suspicion: number;
  dons: number;
}

export function resolveDrive(target: RecruitTarget, approach: RecruitApproach, bias = 1): DriveResult {
  const successChance = 0.55 + (approach === "douce" ? 0.08 : -0.05);
  const success = biasedChance(successChance, bias);
  const recruited = success ? randInt(3, approach === "agressive" ? 14 : 9) : randInt(0, 2);
  const dons = success ? recruited * randInt(150, 400) : randInt(0, 100);
  const influence = success ? randInt(1, approach === "agressive" ? 5 : 3) : -randInt(0, 2);
  const suspicion = approach === "agressive" ? randInt(2, 6) : randInt(0, 2);
  const narrative = `${target.label} — ${success ? `${recruited} nouveaux adeptes parmi ${target.pool}.` : `Approche infructueuse auprès ${target.pool}.`}`;
  return { success, recruited, narrative, influence, suspicion, dons };
}

// ============================================================================
// Chaos — issue spéciale des choix "risqués" (potion, jeûne extrême, promesses folles). Grosse
// variance dans les deux sens.
// ============================================================================

const CHAOS_GOOD_LINES = [
  "Tout le monde vit une expérience mystique inoubliable — la légende du culte grandit d'un coup.",
  "Un moment de grâce collective inexplicable est filmé et devient culte, littéralement.",
  "Ton discours improvisé sous l'émotion du moment devient le texte fondateur du mouvement.",
];
const CHAOS_BAD_LINES = [
  "Plusieurs adeptes réagissent très mal, une ambulance doit être appelée discrètement.",
  "La soirée dérape complètement, des vidéos compromettantes circulent dès le lendemain.",
  "Tu perds le contrôle du discours en pleine cérémonie, la panique s'installe dans le public.",
];

export interface ChaosResult {
  influence: number;
  suspicion: number;
  dons: number;
  outcome: string;
  good: boolean;
}

export function resolveChaos(): ChaosResult {
  const roll = randInt(-35, 45);
  const good = roll > 5;
  return { influence: roll, suspicion: good ? randInt(0, 5) : randInt(10, 25), dons: good ? randInt(0, 4000) : -randInt(2000, 8000), outcome: pick(good ? CHAOS_GOOD_LINES : CHAOS_BAD_LINES), good };
}

// ============================================================================
// Acheter le silence d'un journaliste — dépense de vrais crédits, en alternative aux choix
// narratifs, pour faire retomber la suspicion. Même curseur admin "Probabilité de gain" que le
// reste du jeu.
// ============================================================================

export function bribeCost(cult: CultType): number {
  return Math.round(ENTRY_COST * 1.5 * Math.max(1, TIER_MULTIPLIER[cult.tier]));
}

const BRIBE_SUCCESS_LINES = [
  "L'article ne sortira jamais — le journaliste a soudain d'autres priorités.",
  "Un simple virement a suffi à calmer les ardeurs de la rédaction.",
  "Ton contact médiatique est reconnaissant... et très discret.",
];
const BRIBE_FAIL_LINES = [
  "Le journaliste a enregistré toute la conversation.",
  "L'offre de silence devient elle-même le sujet de l'article.",
  "Un confrère publie l'affaire avant même que le marché soit conclu.",
];

export interface BribeResult {
  success: boolean;
  influence: number;
  suspicion: number;
  outcome: string;
}

export function resolveBribe(bias = 1): BribeResult {
  const success = biasedChance(0.6, bias);
  if (success) {
    return { success: true, influence: randInt(5, 12), suspicion: -randInt(15, 28), outcome: pick(BRIBE_SUCCESS_LINES) };
  }
  return { success: false, influence: -randInt(20, 35), suspicion: randInt(20, 35), outcome: pick(BRIBE_FAIL_LINES) };
}

// ============================================================================
// Descente des autorités — se déclenche à la fin de toute saison où la suspicion finit à 75 ou
// plus. Chances de survie dépendantes de l'influence (avocats, image publique) et inversement de
// la suspicion elle-même.
// ============================================================================

export interface RaidResult {
  survived: boolean;
  narrative: string;
  suspicionAfter: number;
}

export function resolveRaid(influence: number, suspicion: number, bias = 1): RaidResult {
  const basis = influence * 0.6 - suspicion * 0.4;
  const surviveChance = 0.25 + (Math.max(0, Math.min(100, basis + 50)) / 100) * 0.55;
  const survived = biasedChance(surviveChance, bias);
  const narrative = survived
    ? "Une descente surprise des autorités ne trouve rien d'exploitable — tes avocats gèrent la communication en temps réel."
    : "La descente tourne à la fermeture administrative immédiate. Le culte est dissous.";
  return { survived, narrative, suspicionAfter: survived ? Math.max(0, suspicion - randInt(20, 35)) : suspicion };
}

// ============================================================================
// Fin de mandat
// ============================================================================

export interface MandateOutcome {
  payout: number;
  label: string;
}

export function computeOutcome(cult: CultType, influence: number, dons: number, raided: boolean): MandateOutcome {
  if (cult.tier === 0) {
    return { payout: Math.round(ENTRY_COST * 0.15), label: "Dissous avant même la première réunion" };
  }
  if (raided) {
    return { payout: Math.round(ENTRY_COST * 0.25), label: "Descente des autorités — culte démantelé" };
  }
  const base = ENTRY_COST * TIER_MULTIPLIER[cult.tier];
  const influenceFactor = 0.5 + (Math.max(0, Math.min(100, influence)) / 100) * 1.3;
  const donsFactor = Math.max(0.7, Math.min(1.35, 1 + dons / 300000));
  const payout = Math.round(base * influenceFactor * donsFactor);
  const label =
    influence >= 80 ? "Culte planétaire, adeptes par millions" :
    influence >= 60 ? "Communauté florissante et adulée" :
    influence >= 40 ? "Culte stable, quelques fidèles solides" :
    "Culte chancelant, mais toujours debout";
  return { payout, label };
}

// ============================================================================
// Partir à l'international — offert uniquement à la toute fin d'un mandat mené jusqu'au bout
// (pas de descente). Pari à haut risque : le gain dépasse largement le culte planétaire en cas de
// succès, l'échec paie moins bien qu'une fin de mandat sagement gérée.
// ============================================================================

const GLOBAL_WIN_MULTIPLIER = 12;
const GLOBAL_LOSE_MULTIPLIER = 0.5;

export interface GlobalExpansionResult {
  won: boolean;
  payout: number;
  label: string;
  narrative: string;
}

export function resolveGlobalExpansion(influence: number, bias = 1): GlobalExpansionResult {
  const winChance = 0.15 + (Math.max(0, Math.min(100, influence)) / 100) * 0.5;
  const won = biasedChance(winChance, bias);
  const payout = Math.round(ENTRY_COST * (won ? GLOBAL_WIN_MULTIPLIER : GLOBAL_LOSE_MULTIPLIER) * (0.8 + Math.random() * 0.5));
  return {
    won,
    payout,
    label: won ? "Mouvement mondial reconnu sur cinq continents !" : "L'expansion internationale s'effondre",
    narrative: won
      ? "Des antennes s'ouvrent sur cinq continents. Ton nom est désormais connu du monde entier."
      : "Le premier antenne étrangère implose en scandale. Retour discret au pays natal.",
  };
}
