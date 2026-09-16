import { biasedWeightedPick, biasedChance, chance, randInt, pick, type Weighted } from "./rng";

// ============================================================================
// L'Arc Licorne — 100% fictif, entreprises et investisseurs inventés. Satire façon
// Theranos/FTX/WeWork : hype, métriques gonflées, pivots absurdes — jamais un vrai mode d'emploi de
// fraude financière, juste des punchlines sur le genre. Débloqué comme le Ministère/le Club/le
// Gourou : un cap de gains cumulés, pas de vraie monnaie en jeu.
// ============================================================================

export const UNLOCK_TOTAL_WON = 40_000_000;
export const ENTRY_COST = 50_000;

export interface Sector {
  id: string;
  label: string;
  glyph: string;
  weight: number;
  tier: 0 | 1 | 2 | 3 | 4; // 0 = refusée par tous les VCs, 4 = licorne planétaire (jackpot)
  accent: string;
}

const TIER_MULTIPLIER: Record<Sector["tier"], number> = { 0: 0, 1: 1, 2: 1.8, 3: 2.6, 4: 4.5 };

export const SECTORS: Sector[] = [
  { id: "foodtech", label: "FoodTech Durable", glyph: "🥑", weight: 15, tier: 1, accent: "from-lime-600 to-lime-800" },
  { id: "wellness", label: "App de Bien-Être", glyph: "🧘", weight: 15, tier: 1, accent: "from-emerald-600 to-emerald-800" },
  { id: "web3", label: "Web3 \"Décentralisé\"", glyph: "⛓️", weight: 13, tier: 1, accent: "from-fuchsia-600 to-fuchsia-800" },
  { id: "iaVague", label: "IA Générative (vague)", glyph: "🤖", weight: 12, tier: 2, accent: "from-electric-600 to-electric-900" },
  { id: "mobilite", label: "Micro-Mobilité Urbaine", glyph: "🛴", weight: 11, tier: 2, accent: "from-sky-600 to-sky-900" },
  { id: "fintech", label: "FinTech \"Disruptive\"", glyph: "💳", weight: 9, tier: 2, accent: "from-amber-600 to-amber-800" },
  { id: "spatial", label: "NewSpace Ambitieux", glyph: "🚀", weight: 8, tier: 2, accent: "from-stone-600 to-stone-800" },
  { id: "biotech", label: "BioTech Révolutionnaire", glyph: "🧬", weight: 6, tier: 3, accent: "from-gold-500 to-gold-700" },
  { id: "licorne", label: "Licorne Planétaire", glyph: "🦄", weight: 3, tier: 4, accent: "from-gold-300 to-fuchsia-500" },
  { id: "refusee", label: "Refusée par tous les VCs", glyph: "🚫", weight: 8, tier: 0, accent: "from-ink-700 to-ink-900" },
];

const SECTOR_WEIGHTS: Weighted<Sector>[] = SECTORS.map((s) => ({ value: s, weight: s.weight }));

export function drawSector(bias = 1): Sector {
  return biasedWeightedPick(SECTOR_WEIGHTS, bias);
}

export function randomDecoySector(): Sector {
  return SECTORS[Math.floor(Math.random() * SECTORS.length)];
}

// ============================================================================
// Mandat — 5 tours de table. Le hype (buzz médiatique et investisseur) remplace la popularité ;
// la scrutiny (attention de la presse d'investigation et des régulateurs) remplace la dette : elle
// ne fait que grimper, et un audit surprise peut tomber une fois qu'elle est haute.
// ============================================================================

export const MANDATE_LENGTH = 5;
export const START_HYPE = 50;
export const START_SCRUTINY = 10;

export interface MandateChoice {
  label: string;
  outcome: string;
  hype: number;
  scrutiny: number;
  funding: number;
  chaos?: boolean; // résolu dynamiquement par resolveChaos(), champs ci-dessus ignorés
}

export interface MandateEvent {
  id: string;
  category: "levee" | "derive" | "fun" | "serieux" | "happening";
  title: string;
  description: string;
  choices: [MandateChoice, MandateChoice];
}

export const CATEGORY_LABEL: Record<MandateEvent["category"], string> = {
  levee: "Levée de fonds",
  derive: "Dérive",
  fun: "Fun",
  serieux: "Sérieux",
  happening: "Soirée",
};

export function drawMandateEvents(): MandateEvent[] {
  return [...EVENT_POOL].sort(() => Math.random() - 0.5).slice(0, MANDATE_LENGTH);
}

export const EVENT_POOL: MandateEvent[] = [
  {
    id: "metrique-gonflee", category: "derive", title: "La Métrique un Peu Gonflée",
    description: "Ton CTO propose de compter les comptes de test et les bots dans le nombre d'utilisateurs actifs du prochain deck.",
    choices: [
      { label: "Garder les vrais chiffres, quitte à décevoir", outcome: "Moins impressionnant, mais personne ne pourra jamais te reprendre dessus.", hype: 2, scrutiny: -2, funding: 0 },
      { label: "Arrondir généreusement vers le haut", outcome: "Le deck fait son petit effet immédiat auprès des investisseurs.", hype: 9, scrutiny: 8, funding: 400000 },
    ],
  },
  {
    id: "pivot-soudain", category: "levee", title: "Le Pivot de Dernière Minute",
    description: "Trois jours avant un rendez-vous clé, un investisseur laisse entendre qu'il préfère \"tout ce qui touche à l'IA\".",
    choices: [
      { label: "Rester fidèle à ton produit actuel", outcome: "Cohérent, mais l'investisseur reste tiède.", hype: 1, scrutiny: 0, funding: 0 },
      { label: "Renommer le produit \"IA-powered\" du jour au lendemain", outcome: "Le deck repart comme neuf, personne ne demande vraiment où est l'IA.", hype: 8, scrutiny: 5, funding: 250000 },
    ],
  },
  {
    id: "employe-inquiet", category: "serieux", title: "Un Employé Pose des Questions",
    description: "Ton responsable financier junior commence à poser des questions précises sur le rapprochement bancaire du mois.",
    choices: [
      { label: "Tout lui expliquer en détail, en toute transparence", outcome: "Il repart rassuré, et encore plus loyal.", hype: -1, scrutiny: -4, funding: 0 },
      { label: "Le muter sur un autre dossier, urgent", outcome: "Le problème est repoussé, pas résolu.", hype: 0, scrutiny: 7, funding: 0 },
    ],
  },
  {
    id: "audit-interne", category: "serieux", title: "L'Auditeur Externe Demande des Détails",
    description: "Le cabinet d'audit annuel demande le détail des contrats signés ce trimestre, plus précisément que d'habitude.",
    choices: [
      { label: "Fournir un dossier complet et carré", outcome: "L'audit passe sans accroc, ta crédibilité grimpe.", hype: 5, scrutiny: -6, funding: 0 },
      { label: "Retarder la réponse de quelques semaines", outcome: "Ça sent l'embrouille — l'auditeur note une réserve.", hype: -3, scrutiny: 10, funding: 0 },
    ],
  },
  {
    id: "journaliste-tech", category: "serieux", title: "Un Journaliste Tech Creuse le Dossier",
    description: "Une enquête sur les \"licornes qui n'en sont pas vraiment\" commence à mentionner ta startup en exemple.",
    choices: [
      { label: "Répondre point par point, sur le fond", outcome: "L'article, finalement plutôt neutre, ne fait pas trop de dégâts.", hype: -2, scrutiny: -5, funding: 0 },
      { label: "Envoyer une mise en demeure", outcome: "Effet Streisand garanti, l'article s'étoffe encore.", hype: -6, scrutiny: 12, funding: 0 },
    ],
  },
  {
    id: "co-fondateur-doute", category: "derive", title: "Ton Co-Fondateur a des Doutes",
    description: "Ton associé historique commence à trouver que \"le discours aux investisseurs s'éloigne un peu de la réalité produit\".",
    choices: [
      { label: "Recentrer le discours ensemble", outcome: "Un peu moins spectaculaire, mais l'équipe reste soudée.", hype: 1, scrutiny: -3, funding: 0 },
      { label: "Le convaincre de continuer comme ça, pour l'instant", outcome: "Il accepte, à contrecœur. Sa confiance s'effrite.", hype: 4, scrutiny: 4, funding: 100000 },
    ],
  },
  {
    id: "conference-keynote", category: "fun", title: "Invitation Keynote sur Scène",
    description: "Une grande conférence tech t'invite à présenter ta vision du futur devant 3000 personnes.",
    choices: [
      { label: "Préparer un discours sobre et factuel", outcome: "Solide, apprécié des connaisseurs.", hype: 5, scrutiny: 0, funding: 0 },
      { label: "Promettre une révolution totale du secteur", outcome: "Standing ovation. Les attentes explosent, tout comme les questions ensuite.", hype: 14, scrutiny: 6, funding: 0 },
    ],
  },
  {
    id: "meme-linkedin", category: "fun", title: "Ton Post LinkedIn Devient Viral",
    description: "Un post un peu trop lyrique sur \"la culture d'entreprise\" devient un mème dans toute la tech française.",
    choices: [
      { label: "En rire toi-même publiquement", outcome: "L'auto-dérision te rend attachant, le hype grimpe.", hype: 9, scrutiny: 1, funding: 0 },
      { label: "Supprimer le post discrètement", outcome: "Trop tard, les captures d'écran circulent déjà.", hype: -4, scrutiny: 2, funding: 0 },
    ],
  },
  {
    id: "hackathon-nuit", category: "fun", title: "Hackathon Interne de Nuit",
    description: "L'équipe propose une nuit blanche pour sortir une nouvelle fonctionnalité avant le prochain rendez-vous investisseur.",
    choices: [
      { label: "Encadrer raisonnablement, avec pauses", outcome: "Fonctionnalité livrée, équipe fatiguée mais soudée.", hype: 6, scrutiny: 0, funding: 0 },
      { label: "Pousser à fond toute la nuit, sans limite", outcome: "", hype: 0, scrutiny: 0, funding: 0, chaos: true },
    ],
  },
  {
    id: "concurrent-rachete", category: "levee", title: "Un Concurrent Direct se Fait Racheter",
    description: "Un concurrent direct vient d'être racheté à prix d'or par un géant du secteur. Le marché s'enflamme.",
    choices: [
      { label: "Communiquer sobrement sur ta différenciation", outcome: "Positionnement clair, les investisseurs apprécient la rigueur.", hype: 4, scrutiny: 0, funding: 150000 },
      { label: "Laisser entendre que tu es \"en discussions similaires\"", outcome: "Le bruit court, l'intérêt explose — personne ne vérifie vraiment.", hype: 11, scrutiny: 7, funding: 500000 },
    ],
  },
  {
    id: "board-question", category: "serieux", title: "Le Board Pose des Questions sur le Burn Rate",
    description: "Ton board s'inquiète du rythme de dépense, très supérieur à ce qui avait été annoncé.",
    choices: [
      { label: "Présenter un plan de réduction des coûts", outcome: "Rassurant, même si ça pique un peu à court terme.", hype: -3, scrutiny: -4, funding: -100000 },
      { label: "Promettre que \"la prochaine levée change tout\"", outcome: "Le board temporise, sceptique mais pas encore inquiet.", hype: 2, scrutiny: 6, funding: 0 },
    ],
  },
  {
    id: "offre-rachat", category: "levee", title: "Une Offre de Rachat Discrète",
    description: "Un grand groupe propose de te racheter à un prix correct, mais bien en dessous de ta valorisation affichée.",
    choices: [
      { label: "Refuser, viser plus haut", outcome: "Risqué, mais tu gardes le contrôle total de l'histoire.", hype: 3, scrutiny: 1, funding: 0 },
      { label: "Négocier discrètement, au cas où", outcome: "La rumeur d'un rachat imminent fuite, l'ambiance devient bizarre.", hype: -2, scrutiny: 5, funding: 0 },
    ],
  },
  {
    id: "lanceur-alerte-interne", category: "serieux", title: "Un Lanceur d'Alerte en Interne",
    description: "Un employé anonyme envoie un long mail interne détaillant des \"pratiques comptables douteuses\" à toute l'équipe.",
    choices: [
      { label: "Organiser une réunion transparente sur les chiffres", outcome: "La confiance interne se reconstruit, non sans quelques départs.", hype: -3, scrutiny: -4, funding: -50000 },
      { label: "Identifier et licencier discrètement le lanceur d'alerte", outcome: "Le mail continue de circuler, désormais accompagné de captures d'écran.", hype: -6, scrutiny: 15, funding: 0 },
    ],
  },
  {
    id: "concurrent-rachete-toi", category: "levee", title: "Une Offre de Rachat de TON Concurrent",
    description: "Ton principal concurrent, à court de trésorerie, te propose de le racheter à bas prix.",
    choices: [
      { label: "Décliner, rester concentré sur ton propre produit", outcome: "Sage décision — l'intégration aurait été un cauchemar.", hype: 2, scrutiny: 0, funding: 0 },
      { label: "Racheter pour éliminer la concurrence", outcome: "Position dominante acquise, mais la fusion coûte cher et fait grincer des dents.", hype: 10, scrutiny: 6, funding: -400000 },
    ],
  },
  {
    id: "influenceur-tech-critique", category: "fun", title: "Un Influenceur Tech Démonte ton Produit",
    description: "Une vidéo virale d'un influenceur tech connu démonte publiquement les promesses marketing de ton produit.",
    choices: [
      { label: "Répondre avec humour et humilité", outcome: "L'auto-dérision retourne l'opinion en ta faveur.", hype: 8, scrutiny: 1, funding: 0 },
      { label: "Le menacer de poursuites pour diffamation", outcome: "Effet Streisand garanti, la vidéo explose encore plus.", hype: -10, scrutiny: 8, funding: -20000 },
    ],
  },
  {
    id: "grosse-panne-serveur", category: "serieux", title: "Une Panne Majeure en Pleine Démo Investisseur",
    description: "Les serveurs tombent en panne au pire moment possible — en plein pitch devant un fonds prestigieux.",
    choices: [
      { label: "Assumer avec transparence et humour", outcome: "L'honnêteté impressionne plus que la démo n'aurait pu le faire.", hype: 6, scrutiny: 0, funding: 100000 },
      { label: "Improviser une fausse démo pré-enregistrée", outcome: "Ça passe sur le moment, mais un technicien du fonds s'en aperçoit.", hype: 3, scrutiny: 12, funding: 250000 },
    ],
  },
];

// ============================================================================
// Happenings — soirées de lancement, dîners VC et retraites d'équipe entre deux campagnes de
// pitchs.
// ============================================================================

export const HAPPENING_POOL: MandateEvent[] = [
  {
    id: "happening-soiree-lancement", category: "happening", title: "Soirée de Lancement",
    description: "La grande soirée de lancement du produit réunit presse, investisseurs et équipe au grand complet.",
    choices: [
      { label: "Un discours court, un produit qui marche", outcome: "Démo sans accroc, la presse repart convaincue.", hype: 10, scrutiny: 1, funding: 0 },
      { label: "Un show spectaculaire, produit encore instable", outcome: "Effet waouh garanti, deux bugs visibles en direct.", hype: 13, scrutiny: 6, funding: 0 },
    ],
  },
  {
    id: "happening-diner-vc", category: "happening", title: "Dîner Privé avec des VC de Renom",
    description: "Un dîner exclusif avec plusieurs fonds prestigieux se transforme vite en compétition de promesses.",
    choices: [
      { label: "Rester mesuré sur les projections", outcome: "Crédible, apprécié par les investisseurs les plus sérieux.", hype: 5, scrutiny: 0, funding: 200000 },
      { label: "Annoncer des objectifs très ambitieux", outcome: "L'enthousiasme est total, les attentes aussi.", hype: 11, scrutiny: 5, funding: 450000 },
    ],
  },
  {
    id: "happening-seminaire-ile", category: "happening", title: "Séminaire d'Équipe sur une Île",
    description: "Le board approuve un séminaire de cohésion \"pour aligner la vision\" dans un cadre idyllique.",
    choices: [
      { label: "Garder le séminaire sobre et productif", outcome: "L'équipe revient alignée et reposée.", hype: 4, scrutiny: 0, funding: -50000 },
      { label: "Le transformer en grande fête", outcome: "Souvenirs mémorables, une story compromettante circule.", hype: 2, scrutiny: 4, funding: -80000 },
    ],
  },
  {
    id: "happening-remise-prix-tech", category: "happening", title: "Cérémonie \"Startup de l'Année\"",
    description: "Un média tech te nomine pour un prix très suivi de la profession.",
    choices: [
      { label: "Accepter avec humilité", outcome: "Image positive, sans excès.", hype: 6, scrutiny: 0, funding: 0 },
      { label: "Préparer un discours grandiloquent", outcome: "Standing ovation, quelques sourcils levés dans la salle.", hype: 10, scrutiny: 4, funding: 0 },
    ],
  },
  {
    id: "happening-afterwork-equipe", category: "happening", title: "Afterwork Géant de l'Équipe",
    description: "Toute l'équipe fête en grand la signature d'un nouveau contrat majeur.",
    choices: [
      { label: "Célébrer sobrement, tout le monde rentre tôt", outcome: "Ambiance chaleureuse, productivité intacte le lendemain.", hype: 3, scrutiny: 0, funding: 0 },
      { label: "Laisser filer jusqu'au bout de la nuit", outcome: "", hype: 0, scrutiny: 0, funding: 0, chaos: true },
    ],
  },
  {
    id: "happening-salon-tech", category: "happening", title: "Stand au Grand Salon Tech",
    description: "Un stand très visible au plus grand salon tech du pays attire une foule de curieux et d'investisseurs.",
    choices: [
      { label: "Présenter le produit tel quel", outcome: "Honnête, quelques belles connexions établies.", hype: 5, scrutiny: 0, funding: 100000 },
      { label: "Présenter une démo \"conceptuelle\" du futur produit", outcome: "L'engouement est énorme — personne n'a testé le vrai produit.", hype: 12, scrutiny: 8, funding: 300000 },
    ],
  },
  {
    id: "happening-podcast", category: "happening", title: "Invitation sur un Podcast Tech Culte",
    description: "L'animateur d'un podcast très écouté te propose une interview longue format.",
    choices: [
      { label: "Répondre avec honnêteté aux questions difficiles", outcome: "Interview appréciée pour sa sincérité rare dans le milieu.", hype: 7, scrutiny: -2, funding: 0 },
      { label: "Rester dans les éléments de langage habituels", outcome: "Correct, sans éclat particulier.", hype: 2, scrutiny: 0, funding: 0 },
    ],
  },
  {
    id: "happening-retraite-ski", category: "happening", title: "Retraite de Direction au Ski",
    description: "Le board propose une retraite stratégique en altitude \"pour prendre de la hauteur\".",
    choices: [
      { label: "Travailler sérieusement sur la roadmap", outcome: "Plan solide pour les prochains mois.", hype: 4, scrutiny: 0, funding: -30000 },
      { label: "Profiter surtout des pistes", outcome: "Belle cohésion, roadmap un peu vague au retour.", hype: 1, scrutiny: 2, funding: -60000 },
    ],
  },
  {
    id: "happening-demo-day", category: "happening", title: "Demo Day de l'Incubateur",
    description: "Le grand Demo Day annuel de ton ancien incubateur t'invite à revenir présenter ton évolution devant tout l'écosystème.",
    choices: [
      { label: "Une présentation honnête de tes vrais résultats", outcome: "Respecté pour ta transparence par tout l'écosystème.", hype: 6, scrutiny: -1, funding: 100000 },
      { label: "Une présentation \"enjolivée\" pour marquer les esprits", outcome: "Standing ovation garantie, quelques questions gênantes en coulisses ensuite.", hype: 12, scrutiny: 6, funding: 300000 },
    ],
  },
  {
    id: "happening-offsite-equipe", category: "happening", title: "Offsite d'Équipe à l'Étranger",
    description: "Toute l'équipe s'envole pour un séminaire de trois jours dans une destination \"inspirante\".",
    choices: [
      { label: "Un programme structuré autour de vrais objectifs", outcome: "Retour productif, roadmap clarifiée pour le trimestre.", hype: 5, scrutiny: 0, funding: -80000 },
      { label: "Laisser l'équipe profiter à fond de la destination", outcome: "Cohésion excellente, quelques photos gênantes circulent en interne.", hype: 3, scrutiny: 3, funding: -150000 },
    ],
  },
  {
    id: "happening-couverture-magazine", category: "happening", title: "Couverture d'un Magazine Business",
    description: "Un grand magazine économique te propose la couverture de son numéro \"Jeunes Fondateurs qui Comptent\".",
    choices: [
      { label: "Une interview mesurée et factuelle", outcome: "Image sérieuse renforcée durablement.", hype: 8, scrutiny: -2, funding: 0 },
      { label: "Une interview flamboyante, pleine de promesses", outcome: "Couverture spectaculaire, attentes énormes créées d'un coup.", hype: 15, scrutiny: 7, funding: 0 },
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

export function shouldTriggerSurpriseAudit(): boolean {
  return chance(0.05);
}

// ============================================================================
// Factions — la confiance de chaque camp autour de la startup (0-100, départ à 50) envers ta prise
// de risque. Chaque pitch déplace la confiance de tous les camps à la fois selon leur affinité pour
// l'audace ou la prudence, et la confiance moyenne pèse ensuite dans les chances de survie d'un
// audit — une startup peut avoir un hype personnel énorme mais couler quand même si tous les camps
// se méfient d'elle.
// ============================================================================

export interface Faction {
  id: string;
  label: string;
  short: string;
  lean: number; // -1 (déteste l'audace, aime la prudence) à +1 (encourage l'audace) — pure fiction
}

export const FACTIONS: Faction[] = [
  { id: "board", label: "Le Board d'Investisseurs", short: "Board", lean: 0.5 },
  { id: "equipe-technique", label: "L'Équipe Technique", short: "Tech", lean: -0.6 },
  { id: "presse-tech", label: "La Presse Tech", short: "Presse", lean: 0.4 },
  { id: "regulateurs", label: "Les Régulateurs (AMF fictive)", short: "Régul.", lean: -0.8 },
  { id: "premiers-clients", label: "Les Premiers Clients", short: "Clients", lean: -0.3 },
];

export const START_FACTION_CONFIDENCE = 50;

export function applyFactionConfidence(confidence: Record<string, number>, approach: PitchApproach): Record<string, number> {
  const next = { ...confidence };
  const sign = approach === "audacieuse" ? 1 : -1;
  for (const f of FACTIONS) {
    const delta = Math.round(f.lean * sign * randInt(1, 4));
    next[f.id] = Math.max(0, Math.min(100, (next[f.id] ?? START_FACTION_CONFIDENCE) + delta));
  }
  return next;
}

// ============================================================================
// Rendez-vous investisseurs — 12 à 18 par tour de table, chacun ciblant un profil tiré au hasard.
// L'approche "prudente" lève moins mais discrètement ; "audacieuse" lève plus mais fait grimper la
// scrutiny plus vite.
// ============================================================================

export const PITCHES_PER_ROUND_MIN = 12;
export const PITCHES_PER_ROUND_MAX = 18;

export interface InvestorProfile {
  id: string;
  label: string;
  pool: string;
}

export const INVESTOR_PROFILES: InvestorProfile[] = [
  { id: "angel", label: "Business Angel en quête de coup de cœur", pool: "un investisseur individuel" },
  { id: "seed-fund", label: "Fonds d'Amorçage Spécialisé", pool: "un fonds d'amorçage" },
  { id: "corporate-vc", label: "Fonds Corporate d'un Grand Groupe", pool: "un fonds corporate" },
  { id: "family-office", label: "Family Office Discret", pool: "un family office" },
  { id: "vc-star", label: "Fonds VC Star de la Silicon Valley", pool: "un fonds américain prestigieux" },
  { id: "crowdfunding", label: "Campagne de Financement Participatif", pool: "des centaines de petits investisseurs" },
  { id: "banque", label: "Comité de Prêt Bancaire", pool: "un banquier prudent" },
  { id: "fonds-souverain", label: "Émissaire d'un Fonds Souverain", pool: "un fonds souverain étranger" },
  { id: "influenceur-invest", label: "Influenceur Devenu \"Business Angel\"", pool: "un influenceur reconverti" },
  { id: "incubateur", label: "Comité de Sélection d'un Incubateur", pool: "un jury d'incubateur" },
  { id: "vc-secondaire", label: "Fonds VC de Second Tour", pool: "un fonds VC généraliste" },
  { id: "media-invest", label: "Groupe Médiatique en Diversification", pool: "un groupe média" },
];

export type PitchApproach = "prudente" | "audacieuse";

export function generatePitch(): InvestorProfile {
  return pick(INVESTOR_PROFILES);
}

export function pitchesForRound(): InvestorProfile[] {
  const count = randInt(PITCHES_PER_ROUND_MIN, PITCHES_PER_ROUND_MAX);
  return Array.from({ length: count }, generatePitch);
}

export interface PitchResult {
  success: boolean;
  raised: number;
  narrative: string;
  hype: number;
  scrutiny: number;
  funding: number;
}

export function resolvePitch(investor: InvestorProfile, approach: PitchApproach, bias = 1): PitchResult {
  const successChance = 0.55 + (approach === "prudente" ? 0.08 : -0.05);
  const success = biasedChance(successChance, bias);
  const raised = success ? randInt(70000, approach === "audacieuse" ? 1300000 : 550000) : 0;
  const funding = success ? raised : 0;
  const hype = success ? randInt(1, approach === "audacieuse" ? 6 : 3) : -randInt(0, 2);
  const scrutiny = approach === "audacieuse" ? randInt(2, 7) : randInt(0, 2);
  const narrative = `${investor.label} — ${success ? `${(raised / 1000).toFixed(0)}k€ levés auprès ${investor.pool}.` : `Rendez-vous infructueux avec ${investor.pool}.`}`;
  return { success, raised, narrative, hype, scrutiny, funding };
}

// ============================================================================
// Chaos — issue spéciale des choix "risqués" (nuit blanche, afterwork qui dérape).
// ============================================================================

const CHAOS_GOOD_LINES = [
  "Dans l'euphorie de la nuit, l'équipe sort une fonctionnalité brillante que personne n'avait anticipée.",
  "Une idée griffonnée sur un tableau blanc à 4h du matin devient le nouvel argument phare du pitch.",
  "La soirée se termine en freestyle improvisé qui devient viral — l'image de la boîte explose, dans le bon sens.",
];
const CHAOS_BAD_LINES = [
  "Le serveur de prod tombe en pleine démo investisseur le lendemain matin, personne n'a dormi pour le réparer.",
  "Une story compromettante de la soirée fuite sur les réseaux professionnels.",
  "Un développeur épuisé pousse du code non testé en production — panne générale le jour du rendez-vous clé.",
];

export interface ChaosResult {
  hype: number;
  scrutiny: number;
  funding: number;
  outcome: string;
  good: boolean;
}

export function resolveChaos(): ChaosResult {
  const roll = randInt(-35, 45);
  const good = roll > 5;
  return { hype: roll, scrutiny: good ? randInt(0, 5) : randInt(10, 25), funding: good ? randInt(0, 300000) : -randInt(50000, 200000), outcome: pick(good ? CHAOS_GOOD_LINES : CHAOS_BAD_LINES), good };
}

// ============================================================================
// Graisser la patte d'un auditeur — dépense de vrais crédits, en alternative aux choix narratifs,
// pour faire retomber la scrutiny.
// ============================================================================

export function bribeCost(sector: Sector): number {
  return Math.round(ENTRY_COST * 2.2 * Math.max(1, TIER_MULTIPLIER[sector.tier]));
}

const BRIBE_SUCCESS_LINES = [
  "Le rapport d'audit ressort étonnamment favorable.",
  "Un simple virement a suffi à arrondir quelques angles gênants.",
  "Ton contact chez l'auditeur est reconnaissant... et très discret.",
];
const BRIBE_FAIL_LINES = [
  "L'auditeur a tout consigné, y compris la tentative.",
  "L'offre se retrouve elle-même dans le rapport final.",
  "Un confrère de l'auditeur découvre le pot aux roses avant que l'affaire soit conclue.",
];

export interface BribeResult {
  success: boolean;
  hype: number;
  scrutiny: number;
  outcome: string;
}

export function resolveBribe(bias = 1): BribeResult {
  const success = biasedChance(0.6, bias);
  if (success) {
    return { success: true, hype: randInt(8, 18), scrutiny: -randInt(22, 40), outcome: pick(BRIBE_SUCCESS_LINES) };
  }
  return { success: false, hype: -randInt(30, 50), scrutiny: randInt(30, 50), outcome: pick(BRIBE_FAIL_LINES) };
}

// ============================================================================
// Enquête surprise (AMF/SEC fictive) — se déclenche à la fin de tout tour où la scrutiny finit à
// 75 ou plus.
// ============================================================================

export interface AuditResult {
  survived: boolean;
  narrative: string;
  scrutinyAfter: number;
}

export function resolveAudit(hype: number, scrutiny: number, bias = 1, avgFactionConfidence?: number): AuditResult {
  const core = hype * 0.6 - scrutiny * 0.4;
  const basis = avgFactionConfidence !== undefined ? core * 0.7 + (avgFactionConfidence - 50) * 0.3 : core;
  const surviveChance = 0.25 + (Math.max(0, Math.min(100, basis + 50)) / 100) * 0.55;
  const survived = biasedChance(surviveChance, bias);
  const narrative = survived
    ? "Une enquête surprise des régulateurs ne trouve rien d'exploitable — tes avocats gèrent la communication en temps réel."
    : "L'enquête aboutit à une mise en examen immédiate. La startup est placée sous administration judiciaire.";
  return { survived, narrative, scrutinyAfter: survived ? Math.max(0, scrutiny - randInt(20, 35)) : scrutiny };
}

// ============================================================================
// Fin de mandat
// ============================================================================

export interface MandateOutcome {
  payout: number;
  label: string;
}

export function computeOutcome(sector: Sector, hype: number, funding: number, busted: boolean): MandateOutcome {
  if (sector.tier === 0) {
    return { payout: Math.round(ENTRY_COST * 0.15), label: "Refusée par tous les VCs dès le premier pitch" };
  }
  if (busted) {
    return { payout: Math.round(ENTRY_COST * 0.25), label: "Mise en examen — la startup s'effondre" };
  }
  const base = ENTRY_COST * TIER_MULTIPLIER[sector.tier];
  const hypeFactor = 0.5 + (Math.max(0, Math.min(100, hype)) / 100) * 1.3;
  const fundingFactor = Math.max(0.7, Math.min(1.35, 1 + funding / 4000000));
  const payout = Math.round(base * hypeFactor * fundingFactor);
  const label =
    hype >= 80 ? "Licorne planétaire, valorisation record" :
    hype >= 60 ? "Startup florissante et adulée de la presse" :
    hype >= 40 ? "Entreprise stable, quelques beaux contrats" :
    "Startup chancelante, mais toujours en vie";
  return { payout, label };
}

// ============================================================================
// Tenter l'introduction en bourse (IPO) — offerte uniquement à la toute fin d'un mandat mené
// jusqu'au bout (pas de mise en examen). Pari à haut risque.
// ============================================================================

const IPO_WIN_MULTIPLIER = 12;
const IPO_LOSE_MULTIPLIER = 0.5;

export interface IpoResult {
  won: boolean;
  payout: number;
  label: string;
  narrative: string;
}

export function resolveIpo(hype: number, bias = 1): IpoResult {
  const winChance = 0.15 + (Math.max(0, Math.min(100, hype)) / 100) * 0.5;
  const won = biasedChance(winChance, bias);
  const payout = Math.round(ENTRY_COST * (won ? IPO_WIN_MULTIPLIER : IPO_LOSE_MULTIPLIER) * (0.8 + Math.random() * 0.5));
  return {
    won,
    payout,
    label: won ? "Introduction en bourse triomphale !" : "L'introduction en bourse tourne au fiasco",
    narrative: won
      ? "Le cours explose dès la première heure de cotation. Les journaux parlent déjà de toi comme d'une légende de la tech."
      : "Le cours s'effondre de 80% le premier jour. Les procès des petits actionnaires commencent dès la semaine suivante.",
  };
}
