import { biasedWeightedPick, biasedChance, chance, randInt, pick, type Weighted } from "./rng";

// ============================================================================
// L'Arc Zone 51 — 100% fictif, personnages et incidents inventés. Pure conspiration délirante
// façon X-Files/Men in Black : rétro-ingénierie improbable, gadgets d'effacement de mémoire
// hollywoodiens, cover-ups comiques — jamais une vraie technique de manipulation ou d'intimidation.
// Débloqué comme les autres arcs secrets : un cap de gains cumulés, pas de vraie monnaie en jeu.
// ============================================================================

export const UNLOCK_TOTAL_WON = 60_000_000;
export const ENTRY_COST = 50_000;

export interface Program {
  id: string;
  label: string;
  glyph: string;
  weight: number;
  tier: 0 | 1 | 2 | 3 | 4; // 0 = programme fermé avant le premier vol, 4 = contact confirmé (jackpot)
  accent: string;
}

const TIER_MULTIPLIER: Record<Program["tier"], number> = { 0: 0, 1: 1, 2: 1.8, 3: 2.6, 4: 4.5 };

export const PROGRAMS: Program[] = [
  { id: "radar-fantome", label: "Programme Radar Fantôme", glyph: "📡", weight: 15, tier: 1, accent: "from-emerald-600 to-emerald-800" },
  { id: "lumieres-desert", label: "Étude des Lumières du Désert", glyph: "✨", weight: 15, tier: 1, accent: "from-sky-600 to-sky-900" },
  { id: "metal-inconnu", label: "Analyse d'un Alliage Inconnu", glyph: "🔩", weight: 13, tier: 1, accent: "from-stone-600 to-stone-800" },
  { id: "signal-radio", label: "Décodage d'un Signal Radio", glyph: "📻", weight: 12, tier: 2, accent: "from-electric-500 to-electric-700" },
  { id: "propulsion", label: "Rétro-ingénierie de Propulsion", glyph: "🛸", weight: 11, tier: 2, accent: "from-fuchsia-600 to-fuchsia-800" },
  { id: "biologie", label: "Étude Biologique Classifiée", glyph: "🧬", weight: 9, tier: 2, accent: "from-lime-600 to-lime-800" },
  { id: "champ-magnetique", label: "Anomalie de Champ Magnétique", glyph: "🧲", weight: 8, tier: 2, accent: "from-amber-600 to-amber-800" },
  { id: "vaisseau-entier", label: "Récupération d'un Vaisseau Entier", glyph: "🌌", weight: 6, tier: 3, accent: "from-gold-500 to-gold-700" },
  { id: "premier-contact", label: "Premier Contact Confirmé", glyph: "👽", weight: 3, tier: 4, accent: "from-gold-300 to-electric-500" },
  { id: "ferme", label: "Programme fermé avant le premier vol", glyph: "🚫", weight: 8, tier: 0, accent: "from-ink-700 to-ink-900" },
];

const PROGRAM_WEIGHTS: Weighted<Program>[] = PROGRAMS.map((p) => ({ value: p, weight: p.weight }));

export function drawProgram(bias = 1): Program {
  return biasedWeightedPick(PROGRAM_WEIGHTS, bias);
}

export function randomDecoyProgram(): Program {
  return PROGRAMS[Math.floor(Math.random() * PROGRAMS.length)];
}

// ============================================================================
// Mandat — 5 années de programme. Le contrôle (maîtrise du récit public) remplace la popularité ;
// les fuites (attention médiatique/politique) remplacent la dette : elles ne font que grimper, et
// un audit du Congrès peut tomber une fois qu'elles sont hautes.
// ============================================================================

export const MANDATE_LENGTH = 5;
export const START_CONTROL = 50;
export const START_LEAKS = 10;

export interface MandateChoice {
  label: string;
  outcome: string;
  control: number;
  leaks: number;
  budget: number;
  chaos?: boolean; // résolu dynamiquement par resolveChaos(), champs ci-dessus ignorés
}

export interface MandateEvent {
  id: string;
  category: "recherche" | "derive" | "fun" | "serieux" | "happening";
  title: string;
  description: string;
  choices: [MandateChoice, MandateChoice];
}

export const CATEGORY_LABEL: Record<MandateEvent["category"], string> = {
  recherche: "Recherche",
  derive: "Dérive",
  fun: "Fun",
  serieux: "Sérieux",
  happening: "Base",
};

export function drawMandateEvents(): MandateEvent[] {
  return [...EVENT_POOL].sort(() => Math.random() - 0.5).slice(0, MANDATE_LENGTH);
}

export const EVENT_POOL: MandateEvent[] = [
  {
    id: "fermier-temoin", category: "derive", title: "Le Fermier qui a Tout Vu",
    description: "Un fermier du coin prétend avoir vu \"un truc lumineux\" atterrir près de son champ hier soir.",
    choices: [
      { label: "Lui faire signer un accord de confidentialité (et un gros chèque)", outcome: "Il repart satisfait, et très silencieux.", control: 6, leaks: -2, budget: -15000 },
      { label: "Le convaincre que c'était \"juste Vénus\"", outcome: "Il n'y croit qu'à moitié, et le raconte au bar du coin.", control: 2, leaks: 6, budget: 0 },
    ],
  },
  {
    id: "senateur-visite", category: "serieux", title: "Une Sénatrice Demande une Visite",
    description: "Une sénatrice de la commission de défense exige une visite surprise du site.",
    choices: [
      { label: "Lui montrer le hangar 'officiel', vide de tout", outcome: "Visite sans accroc, elle repart rassurée.", control: 5, leaks: -3, budget: 0 },
      { label: "Refuser catégoriquement, invoquer le secret défense", outcome: "Ça éveille encore plus sa curiosité.", control: -3, leaks: 9, budget: 0 },
    ],
  },
  {
    id: "specimen-actif", category: "recherche", title: "Le Spécimen S'Active",
    description: "L'objet à l'étude émet soudain un signal que personne ne parvient à expliquer.",
    choices: [
      { label: "Suspendre les recherches par précaution", outcome: "Prudent — on garde le contrôle de la situation.", control: 4, leaks: 0, budget: -5000 },
      { label: "Pousser les recherches à fond, malgré le risque", outcome: "", control: 0, leaks: 0, budget: 0, chaos: true },
    ],
  },
  {
    id: "photo-satellite", category: "serieux", title: "Une Photo Satellite Fuite en Ligne",
    description: "Une photo satellite floue du site, prise \"par erreur\", commence à circuler sur les forums.",
    choices: [
      { label: "La faire passer pour un photomontage bien fait", outcome: "La théorie du complot inverse fonctionne étrangement bien.", control: 5, leaks: -4, budget: -8000 },
      { label: "Ignorer, ça finira par se calmer", outcome: "Ça ne se calme pas — au contraire, ça s'amplifie.", control: -4, leaks: 11, budget: 0 },
    ],
  },
  {
    id: "scientifique-doute", category: "derive", title: "Une Scientifique a des Doutes Éthiques",
    description: "Une chercheuse de l'équipe commence à remettre en question la nature exacte de vos recherches.",
    choices: [
      { label: "La rassurer avec un dossier complet et transparent (en interne)", outcome: "Elle repart convaincue de l'importance de la mission.", control: 4, leaks: -2, budget: 0 },
      { label: "La réaffecter ailleurs, discrètement", outcome: "Réglé sans bruit, mais elle reste perplexe.", control: 1, leaks: 5, budget: -6000 },
    ],
  },
  {
    id: "documentaire-streaming", category: "fun", title: "Une Plateforme Veut un Documentaire",
    description: "Un producteur célèbre veut faire un documentaire \"exclusif\" sur les légendes autour de la base.",
    choices: [
      { label: "Coopérer, en gardant un œil sur le montage", outcome: "Le documentaire, très divertissant, brouille encore plus les pistes.", control: 9, leaks: 3, budget: -4000 },
      { label: "Refuser tout accès", outcome: "Il le fait quand même, sans ta version des faits.", control: -5, leaks: 6, budget: 0 },
    ],
  },
  {
    id: "soucoupe-defile", category: "fun", title: "Un Défilé Local Utilise ton Logo",
    description: "Le défilé annuel de la petite ville voisine adopte une mascotte \"petit alien\" mi-sérieuse mi-blague.",
    choices: [
      { label: "Sponsoriser discrètement l'événement", outcome: "Ambiance bon enfant, ça détourne l'attention avec humour.", control: 8, leaks: 1, budget: -3000 },
      { label: "Envoyer une lettre pour faire retirer le logo", outcome: "Effet Streisand, la mascotte devient encore plus populaire.", control: -6, leaks: 7, budget: 0 },
    ],
  },
  {
    id: "employe-parle", category: "serieux", title: "Un Ancien Employé Parle à un Podcast",
    description: "Un technicien récemment licencié accorde une interview anonyme à un podcast spécialisé.",
    choices: [
      { label: "Décrédibiliser la source, poliment", outcome: "L'interview passe pour une élucubration de plus parmi tant d'autres.", control: 6, leaks: 2, budget: -5000 },
      { label: "Le poursuivre en justice pour rupture de confidentialité", outcome: "Effet Streisand garanti, l'épisode explose en popularité.", control: -8, leaks: 14, budget: -10000 },
    ],
  },
  {
    id: "gadget-effaceur", category: "recherche", title: "Le Prototype d'Effaceur de Souvenirs",
    description: "L'équipe R&D présente fièrement un gadget clignotant \"censé\" effacer les souvenirs récents — totalement fictif et jamais fonctionnel dans la vraie vie.",
    choices: [
      { label: "Le ranger, ça relève plus du gadget de fiction", outcome: "Sage décision — l'équipe se concentre sur des méthodes plus sérieuses (paperasse et cafés).", control: 3, leaks: -1, budget: -2000 },
      { label: "Le tester \"pour de rire\" lors du prochain incident", outcome: "", control: 0, leaks: 0, budget: 0, chaos: true },
    ],
  },
  {
    id: "budget-audit-interne", category: "serieux", title: "Un Audit Interne du Budget Noir",
    description: "Le Pentagone demande un état des lieux précis des dépenses du programme, ligne par ligne.",
    choices: [
      { label: "Fournir un dossier complet et cohérent", outcome: "L'audit passe sans accroc, ta crédibilité grandit.", control: 5, leaks: -6, budget: 0 },
      { label: "Maquiller quelques lignes trop voyantes", outcome: "Ça passe cette fois, mais un auditeur note une incohérence.", control: -2, leaks: 10, budget: 12000 },
    ],
  },
  {
    id: "objet-recupere", category: "recherche", title: "Un Objet Métallique Non-Identifié",
    description: "Un fragment métallique d'origine inconnue est récupéré après un \"incident météorologique\" officiel.",
    choices: [
      { label: "L'analyser prudemment, protocole complet", outcome: "Analyse rigoureuse, quelques résultats troublants mais maîtrisés.", control: 4, leaks: 1, budget: -10000 },
      { label: "Foncer, analyse accélérée sans protocole", outcome: "Des résultats fascinants, et une fuite de données accidentelle.", control: 7, leaks: 8, budget: -3000 },
    ],
  },
  {
    id: "touristes-curieux", category: "derive", title: "Des Touristes Trop Curieux",
    description: "Un groupe de touristes s'approche dangereusement près de la clôture périphérique avec des caméras.",
    choices: [
      { label: "Les escorter poliment hors de la zone", outcome: "Ils repartent déçus mais sans photo utilisable.", control: 3, leaks: 0, budget: 0 },
      { label: "Confisquer discrètement leur matériel", outcome: "Efficace, mais l'un d'eux poste déjà la scène sur les réseaux.", control: -3, leaks: 8, budget: 0 },
    ],
  },
];

// ============================================================================
// Base — événements de vie de base entre deux campagnes de confinement.
// ============================================================================

export const HAPPENING_POOL: MandateEvent[] = [
  {
    id: "happening-barbecue-base", category: "happening", title: "Barbecue du Personnel",
    description: "Le traditionnel barbecue trimestriel du personnel rassemble scientifiques et militaires sur le parking du hangar.",
    choices: [
      { label: "Un moment convivial et sobre", outcome: "Bonne ambiance, l'équipe se sent soudée.", control: 6, leaks: 0, budget: -1000 },
      { label: "Sortir \"la bonne bouteille réservée aux grandes occasions\"", outcome: "", control: 0, leaks: 0, budget: 0, chaos: true },
    ],
  },
  {
    id: "happening-gala-pentagone", category: "happening", title: "Gala Annuel au Pentagone",
    description: "Le gala annuel des programmes classifiés réunit tous les directeurs de site, sous haute discrétion.",
    choices: [
      { label: "Présenter un rapport sobre et rassurant", outcome: "Ton programme reste discret mais bien considéré.", control: 5, leaks: -2, budget: 0 },
      { label: "Impressionner avec des résultats \"prometteurs\"", outcome: "Ça capte l'attention — et augmente le budget, et les questions.", control: 9, leaks: 4, budget: 20000 },
    ],
  },
  {
    id: "happening-simulation-defense", category: "happening", title: "Exercice de Simulation Grandeur Nature",
    description: "Un exercice de simulation d'incident majeur mobilise toute la base pendant 48 heures.",
    choices: [
      { label: "Suivre le protocole à la lettre", outcome: "Exercice impeccable, l'équipe est prête pour un vrai incident.", control: 7, leaks: 0, budget: -6000 },
      { label: "Improviser un scénario \"plus réaliste\"", outcome: "", control: 0, leaks: 0, budget: 0, chaos: true },
    ],
  },
  {
    id: "happening-conference-scientifique", category: "happening", title: "Conférence Scientifique Discrète",
    description: "Une petite conférence entre initiés permet d'échanger sur les découvertes récentes, sous stricte confidentialité.",
    choices: [
      { label: "Rester factuel et mesuré", outcome: "Échanges productifs, rien ne filtre à l'extérieur.", control: 4, leaks: -1, budget: -2000 },
      { label: "Partager plus de détails que prévu, en confiance", outcome: "Un participant, impressionné, ne peut s'empêcher d'en parler ensuite.", control: 6, leaks: 5, budget: 0 },
    ],
  },
  {
    id: "happening-fete-independance", category: "happening", title: "Feu d'Artifice du 4 Juillet",
    description: "Le feu d'artifice annuel de la base est visible à des kilomètres à la ronde — un vrai casse-tête de discrétion.",
    choices: [
      { label: "Le garder modeste, comme toutes les bases voisines", outcome: "Rien ne se distingue, mission accomplie.", control: 3, leaks: 0, budget: -2000 },
      { label: "Un feu d'artifice spectaculaire, autant en profiter", outcome: "Magnifique, mais ça alimente encore les théories des environs.", control: 6, leaks: 6, budget: -8000 },
    ],
  },
  {
    id: "happening-visite-officiels", category: "happening", title: "Visite d'Officiels Étrangers",
    description: "Une délégation militaire alliée demande une visite de courtoisie du site.",
    choices: [
      { label: "Leur montrer la partie 'vitrine' du programme", outcome: "Visite diplomatique réussie, relations renforcées.", control: 7, leaks: -1, budget: 0 },
      { label: "Refuser poliment tout accès", outcome: "Un peu tendu diplomatiquement, mais rien ne fuite.", control: 2, leaks: 3, budget: 0 },
    ],
  },
  {
    id: "happening-soiree-cinema", category: "happening", title: "Soirée Cinéma sur la Base",
    description: "Le personnel organise une projection en plein air d'un vieux film de science-fiction, en clin d'œil complice.",
    choices: [
      { label: "Profiter de la soirée avec l'équipe", outcome: "Moment léger et bienvenu après des semaines tendues.", control: 4, leaks: 0, budget: 0 },
      { label: "Projeter un vrai extrait d'archive \"pour rire\"", outcome: "", control: 0, leaks: 0, budget: 0, chaos: true },
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
// Opérations de confinement — 12 à 18 par année, chacune visant un témoin/fuite tirée au hasard.
// L'approche "discrète" fuit moins mais coûte plus cher en discrétion ; "agressive" contient plus
// vite mais laisse plus de traces.
// ============================================================================

export const OPS_PER_YEAR_MIN = 12;
export const OPS_PER_YEAR_MAX = 18;

export interface Witness {
  id: string;
  label: string;
  pool: string;
}

export const WITNESSES: Witness[] = [
  { id: "fermier", label: "Un Fermier Voisin de la Base", pool: "un fermier local" },
  { id: "routier", label: "Un Routier de Nuit", pool: "un chauffeur routier" },
  { id: "randonneur", label: "Un Randonneur Égaré", pool: "un randonneur curieux" },
  { id: "blogueur", label: "Un Blogueur Complotiste", pool: "un blogueur passionné" },
  { id: "policier-local", label: "Un Policier Local Intrigué", pool: "un officier de la police locale" },
  { id: "touriste-etranger", label: "Un Touriste Étranger", pool: "un touriste de passage" },
  { id: "pilote-amateur", label: "Un Pilote Amateur", pool: "un pilote de loisir" },
  { id: "radioamateur", label: "Un Radioamateur", pool: "un passionné de radio" },
  { id: "journaliste-local", label: "Un Journaliste du Journal Local", pool: "un journaliste régional" },
  { id: "campeur", label: "Des Campeurs du Désert", pool: "un groupe de campeurs" },
  { id: "chasseur", label: "Un Chasseur Matinal", pool: "un chasseur local" },
  { id: "photographe", label: "Un Photographe Amateur d'Étoiles", pool: "un astrophotographe amateur" },
];

export type OpsApproach = "discrete" | "agressive";

export function generateOp(): Witness {
  return pick(WITNESSES);
}

export function opsForYear(): Witness[] {
  const count = randInt(OPS_PER_YEAR_MIN, OPS_PER_YEAR_MAX);
  return Array.from({ length: count }, generateOp);
}

export interface OpResult {
  success: boolean;
  narrative: string;
  control: number;
  leaks: number;
  budget: number;
}

export function resolveOp(witness: Witness, approach: OpsApproach, bias = 1): OpResult {
  const successChance = 0.6 + (approach === "discrete" ? 0.06 : -0.04);
  const success = biasedChance(successChance, bias);
  const budget = success ? -randInt(500, approach === "discrete" ? 4000 : 1500) : 0;
  const control = success ? randInt(1, approach === "agressive" ? 5 : 3) : -randInt(0, 2);
  const leaks = approach === "agressive" ? randInt(2, 6) : randInt(0, 2);
  const narrative = `${witness.label} — ${success ? `Confidentialité obtenue auprès de ${witness.pool}.` : `${witness.pool} refuse de coopérer.`}`;
  return { success, narrative, control, leaks, budget };
}

// ============================================================================
// Chaos — issue spéciale des choix "risqués" (recherche accélérée, gadget testé pour de rire).
// ============================================================================

const CHAOS_GOOD_LINES = [
  "L'expérience produit un résultat spectaculaire et parfaitement maîtrisé — l'équipe exulte.",
  "Le \"gadget\" ne fait absolument rien, ce qui détend tout le monde et devient une blague de service.",
  "L'incident tourne à l'avantage du programme : une découverte inattendue relance tout l'intérêt en interne.",
];
const CHAOS_BAD_LINES = [
  "Une alarme se déclenche en pleine nuit pour un simple faux contact — tout le voisinage l'entend.",
  "Le générateur de secours lâche en pleine expérience, plongeant le hangar dans le noir total.",
  "Une vidéo floue de l'incident, prise par un employé amusé, atterrit accidentellement en ligne.",
];

export interface ChaosResult {
  control: number;
  leaks: number;
  budget: number;
  outcome: string;
  good: boolean;
}

export function resolveChaos(): ChaosResult {
  const roll = randInt(-35, 45);
  const good = roll > 5;
  return { control: roll, leaks: good ? randInt(0, 5) : randInt(10, 25), budget: good ? randInt(0, 4000) : -randInt(2000, 8000), outcome: pick(good ? CHAOS_GOOD_LINES : CHAOS_BAD_LINES), good };
}

// ============================================================================
// Acheter le silence d'un sénateur curieux — dépense de vrais crédits, en alternative aux choix
// narratifs, pour faire retomber les fuites.
// ============================================================================

export function bribeCost(program: Program): number {
  return Math.round(ENTRY_COST * 1.5 * Math.max(1, TIER_MULTIPLIER[program.tier]));
}

const BRIBE_SUCCESS_LINES = [
  "Le sénateur retrouve soudain d'autres priorités bien plus urgentes.",
  "Une ligne budgétaire discrète a suffi à calmer les curiosités.",
  "Ton contact au Congrès est reconnaissant... et très discret.",
];
const BRIBE_FAIL_LINES = [
  "Le sénateur a tout consigné, y compris la tentative.",
  "L'offre devient elle-même le sujet d'une sous-commission.",
  "Un collègue du sénateur découvre le pot aux roses avant que l'affaire soit conclue.",
];

export interface BribeResult {
  success: boolean;
  control: number;
  leaks: number;
  outcome: string;
}

export function resolveBribe(bias = 1): BribeResult {
  const success = biasedChance(0.6, bias);
  if (success) {
    return { success: true, control: randInt(5, 12), leaks: -randInt(15, 28), outcome: pick(BRIBE_SUCCESS_LINES) };
  }
  return { success: false, control: -randInt(20, 35), leaks: randInt(20, 35), outcome: pick(BRIBE_FAIL_LINES) };
}

// ============================================================================
// Audit du Congrès — se déclenche à la fin de toute année où les fuites finissent à 75 ou plus.
// ============================================================================

export interface AuditResult {
  survived: boolean;
  narrative: string;
  leaksAfter: number;
}

export function resolveAudit(control: number, leaks: number, bias = 1): AuditResult {
  const basis = control * 0.6 - leaks * 0.4;
  const surviveChance = 0.25 + (Math.max(0, Math.min(100, basis + 50)) / 100) * 0.55;
  const survived = biasedChance(surviveChance, bias);
  const narrative = survived
    ? "L'audit du Congrès ne trouve rien d'exploitable — le programme reste classifié, la routine reprend."
    : "L'audit aboutit à une fermeture immédiate et une commission d'enquête publique. Le programme est officiellement clos.";
  return { survived, narrative, leaksAfter: survived ? Math.max(0, leaks - randInt(20, 35)) : leaks };
}

// ============================================================================
// Fin de mandat
// ============================================================================

export interface MandateOutcome {
  payout: number;
  label: string;
}

export function computeOutcome(program: Program, control: number, budget: number, busted: boolean): MandateOutcome {
  if (program.tier === 0) {
    return { payout: Math.round(ENTRY_COST * 0.15), label: "Programme fermé avant même le premier vol" };
  }
  if (busted) {
    return { payout: Math.round(ENTRY_COST * 0.25), label: "Commission d'enquête — programme clos publiquement" };
  }
  const base = ENTRY_COST * TIER_MULTIPLIER[program.tier];
  const controlFactor = 0.5 + (Math.max(0, Math.min(100, control)) / 100) * 1.3;
  const budgetFactor = Math.max(0.7, Math.min(1.35, 1 + (budget + 100000) / 300000));
  const payout = Math.round(base * controlFactor * budgetFactor);
  const label =
    control >= 80 ? "Programme légendaire, jamais officiellement confirmé" :
    control >= 60 ? "Programme discret et parfaitement maîtrisé" :
    control >= 40 ? "Programme stable, quelques fuites contenues" :
    "Programme chancelant, mais toujours classifié";
  return { payout, label };
}

// ============================================================================
// Révéler la vérité au monde — offert uniquement à la toute fin d'un mandat mené jusqu'au bout
// (pas d'audit raté). Pari à haut risque.
// ============================================================================

const REVEAL_WIN_MULTIPLIER = 12;
const REVEAL_LOSE_MULTIPLIER = 0.5;

export interface RevealResult {
  won: boolean;
  payout: number;
  label: string;
  narrative: string;
}

export function resolveReveal(control: number, bias = 1): RevealResult {
  const winChance = 0.15 + (Math.max(0, Math.min(100, control)) / 100) * 0.5;
  const won = biasedChance(winChance, bias);
  const payout = Math.round(ENTRY_COST * (won ? REVEAL_WIN_MULTIPLIER : REVEAL_LOSE_MULTIPLIER) * (0.8 + Math.random() * 0.5));
  return {
    won,
    payout,
    label: won ? "La vérité éclate au grand jour — tu deviens une légende" : "La révélation tourne au fiasco médiatique",
    narrative: won
      ? "Le monde entier découvre la vérité en direct. Ton nom restera à jamais associé à la plus grande révélation du siècle."
      : "Personne ne te croit. Les médias te traitent de mythomane et l'affaire est enterrée en une semaine.",
  };
}
