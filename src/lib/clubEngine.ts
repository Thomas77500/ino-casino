import { biasedWeightedPick, biasedChance, chance, randInt, pick, type Weighted } from "./rng";

// ============================================================================
// L'Arc du Président de Club — 100% fictif, clubs et personnages inventés. Débloqué comme le
// Ministère/la Bourse : un cap de gains cumulés, pas de vraie monnaie en jeu.
// ============================================================================

export const UNLOCK_TOTAL_WON = 35_000_000;
export const ENTRY_COST = 50_000;

export interface Club {
  id: string;
  label: string;
  glyph: string;
  weight: number;
  tier: 0 | 1 | 2 | 3 | 4; // 0 = club en quasi-faillite, 4 = petro-club (jackpot)
  league: string;
  accent: string;
}

const TIER_MULTIPLIER: Record<Club["tier"], number> = { 0: 0, 1: 1, 2: 1.8, 3: 2.6, 4: 4.5 };

export const CLUBS: Club[] = [
  { id: "cambrousse", label: "AS Cambrousse", glyph: "🌾", weight: 15, tier: 1, league: "National 2", accent: "from-amber-600 to-amber-800" },
  { id: "marais", label: "Racing Club du Marais", glyph: "🗼", weight: 15, tier: 1, league: "National 2", accent: "from-fuchsia-600 to-fuchsia-800" },
  { id: "portuaire", label: "FC Portuaire", glyph: "⚓", weight: 13, tier: 1, league: "National", accent: "from-sky-600 to-sky-900" },
  { id: "caillouteux", label: "Stade Caillouteux", glyph: "🪨", weight: 12, tier: 2, league: "Ligue 2", accent: "from-stone-600 to-stone-800" },
  { id: "brumeuse", label: "AS Brumeuse", glyph: "🌫️", weight: 11, tier: 2, league: "Ligue 2", accent: "from-blue-600 to-blue-900" },
  { id: "canal", label: "Olympique du Canal", glyph: "🚤", weight: 9, tier: 2, league: "Ligue 2", accent: "from-emerald-600 to-emerald-800" },
  { id: "hauteurs", label: "Racing Club des Hauteurs", glyph: "⛰️", weight: 8, tier: 2, league: "Ligue 2", accent: "from-electric-500 to-electric-700" },
  { id: "metropole", label: "FC Métropole", glyph: "🏙️", weight: 6, tier: 3, league: "Ligue 1", accent: "from-gold-500 to-gold-700" },
  { id: "galactique", label: "Paris Galactique FC", glyph: "👑", weight: 3, tier: 4, league: "Ligue 1", accent: "from-gold-300 to-electric-500" },
  { id: "buvette", label: "US Buvette", glyph: "🍺", weight: 8, tier: 0, league: "Pré-National", accent: "from-ink-700 to-ink-900" },
];

const CLUB_WEIGHTS: Weighted<Club>[] = CLUBS.map((c) => ({ value: c, weight: c.weight }));

export function drawClub(bias = 1): Club {
  return biasedWeightedPick(CLUB_WEIGHTS, bias);
}

export function randomDecoyClub(): Club {
  return CLUBS[Math.floor(Math.random() * CLUBS.length)];
}

// ============================================================================
// Présidence — 5 saisons, chaque saison tire un grand événement à choix. Soutien des supporters à
// 0 = motion de défiance du conseil, présidence écourtée. Le budget influence le versement final.
// ============================================================================

export const PRESIDENCY_LENGTH = 5;
export const START_SUPPORT = 50;

export interface ClubChoice {
  label: string;
  outcome: string;
  support: number;
  budget: number;
  chaos?: boolean; // résolu dynamiquement par resolveClubChaos(), support/budget ci-dessus ignorés
}

export interface ClubEvent {
  id: string;
  category: "polemique" | "derive" | "fun" | "serieux" | "vote" | "happening";
  title: string;
  description: string;
  choices: [ClubChoice, ClubChoice];
}

export const CATEGORY_LABEL: Record<ClubEvent["category"], string> = {
  polemique: "Polémique",
  derive: "Dérive",
  fun: "Fun",
  serieux: "Sérieux",
  vote: "Conseil",
  happening: "Soirée",
};

export const EVENT_POOL: ClubEvent[] = [
  // --- Polémiques ---
  {
    id: "clause-mysterieuse", category: "polemique", title: "La Clause Mystérieuse",
    description: "Une clause secrète dans le contrat d'un joueur — un bonus caché à la revente — fuite dans la presse spécialisée.",
    choices: [
      { label: "Publier tous les détails du contrat", outcome: "La transparence surprend, elle est plutôt bien reçue.", support: 6, budget: -4 },
      { label: "Nier et menacer de poursuites", outcome: "Effet Streisand garanti, l'affaire enfle.", support: -15, budget: 0 },
    ],
  },
  {
    id: "story-instagram", category: "polemique", title: "La Story Malheureuse",
    description: "Ton attaquant vedette poste une story très maladroite la veille d'un match décisif.",
    choices: [
      { label: "Le sanctionner publiquement", outcome: "Fermeté saluée, l'image du club en sort grandie.", support: 5, budget: -3 },
      { label: "Fermer les yeux, il est trop important", outcome: "Ça se voit, et ça se sait.", support: -14, budget: 0 },
    ],
  },
  {
    id: "salaire-du-siecle", category: "polemique", title: "Le Salaire du Siècle",
    description: "La presse dévoile le salaire hallucinant de ton entraîneur, alors que l'équipe stagne en milieu de tableau.",
    choices: [
      { label: "Assumer, il vaut chaque centime", outcome: "Peu convaincant tant que les résultats ne suivent pas.", support: -8, budget: 0 },
      { label: "Renégocier publiquement à la baisse", outcome: "Un geste d'autorité qui rassure le vestiaire économique.", support: 7, budget: -6 },
    ],
  },
  {
    id: "transfert-suspect", category: "polemique", title: "Le Transfert Suspect",
    description: "Un transfert à un montant totalement disproportionné vers un club \"ami\" intrigue les observateurs.",
    choices: [
      { label: "Justifier avec un dossier détaillé", outcome: "Le dossier convainc, l'affaire retombe.", support: 5, budget: -5 },
      { label: "Ne rien dire, ça passera", outcome: "Ça ne passe pas, la commission s'en mêle.", support: -17, budget: 3 },
    ],
  },
  {
    id: "vestiaire-qui-fuite", category: "polemique", title: "Le Clash du Vestiaire",
    description: "Un enregistrement d'une violente altercation en vestiaire fuite sur les réseaux sociaux.",
    choices: [
      { label: "Organiser une conférence de presse d'apaisement", outcome: "Le discours calme le jeu, sans plus.", support: 2, budget: -2 },
      { label: "Punir tout le vestiaire collectivement", outcome: "L'ambiance se dégrade encore un peu plus.", support: -11, budget: 0 },
    ],
  },

  // --- Dérives ---
  {
    id: "enveloppe-agent", category: "derive", title: "L'Enveloppe de l'Agent",
    description: "Un agent de joueurs glisse une enveloppe pour accélérer discrètement un transfert.",
    choices: [
      { label: "Refuser, courtoisement", outcome: "Ta conscience est tranquille, ton compte un peu moins.", support: 3, budget: 0 },
      { label: "Accepter, discrètement", outcome: "Ça arrondit les fins de mois. Pour l'instant, personne ne sait.", support: -8, budget: 18 },
    ],
  },
  {
    id: "billets-au-marche-noir", category: "derive", title: "Les Billets au Marché Noir",
    description: "Des billets du match au sommet partent au marché noir avec la complicité discrète d'un employé.",
    choices: [
      { label: "Enquêter et sanctionner", outcome: "Un peu de fermeté, ça fait du bien à l'image.", support: 6, budget: -5 },
      { label: "Fermer les yeux, ça arrange tout le monde", outcome: "Les caisses respirent, la conscience un peu moins.", support: -12, budget: 9 },
    ],
  },
  {
    id: "poudre-blanche-club", category: "derive", title: "La Fête du Maintien qui Dégénère",
    description: "Après un match crucial arraché in extremis, une pochette blanche circule discrètement dans les loges VIP.",
    choices: [
      { label: "Refuser net, tu rentres te coucher", outcome: "Sage décision, personne ne le saura jamais.", support: 5, budget: 0 },
      { label: "Céder", outcome: "", support: 0, budget: 0, chaos: true },
    ],
  },
  {
    id: "sponsor-douteux", category: "derive", title: "Le Sponsor à la Réputation Sulfureuse",
    description: "Un sponsor maillot à la réputation trouble propose une somme énorme pour s'afficher sur le torse de l'équipe.",
    choices: [
      { label: "Refuser l'offre", outcome: "Image préservée, budget un peu plus serré.", support: 4, budget: -3 },
      { label: "Signer quand même", outcome: "L'argent rentre, l'image du club en prend un coup.", support: -10, budget: 20 },
    ],
  },
  {
    id: "note-de-frais-president", category: "derive", title: "Les Notes de Frais du Président",
    description: "Le trésorier s'étonne du nombre de déplacements \"professionnels\" en jet privé facturés au club.",
    choices: [
      { label: "Rembourser discrètement de ta poche", outcome: "Discret, efficace, personne ne s'en aperçoit.", support: 0, budget: -6 },
      { label: "Faire passer ça en frais de représentation", outcome: "Ça finira par sortir, mais pas tout de suite.", support: -13, budget: 4 },
    ],
  },

  // --- Fun ---
  {
    id: "chant-des-ultras", category: "fun", title: "Le Chant des Ultras",
    description: "Les groupes de supporters composent un chant improbable à ta gloire, repris à pleine voix en tribune.",
    choices: [
      { label: "Le reprendre à fond depuis la tribune présidentielle", outcome: "Moment de communion totale avec le kop.", support: 9, budget: 0 },
      { label: "Rester digne en loge", outcome: "Sympa, mais un peu distant comme image.", support: 1, budget: 0 },
    ],
  },
  {
    id: "penalty-charite", category: "fun", title: "Le Penalty de la Charité",
    description: "Tu es invité à tirer un penalty lors d'un match caritatif face à d'anciennes gloires du club.",
    choices: [
      { label: "Le tirer, quitte à te ridiculiser", outcome: "Le tir est raté, mais l'essai est salué.", support: 8, budget: 0 },
      { label: "Décliner poliment", outcome: "Personne ne t'en veut, personne ne s'en souvient non plus.", support: 0, budget: 0 },
    ],
  },
  {
    id: "mascotte-en-panne", category: "fun", title: "La Mascotte en Panne",
    description: "Le costume de la mascotte du club tombe en panne de fermeture éclair juste avant le coup d'envoi.",
    choices: [
      { label: "Improviser en costume toi-même", outcome: "Le moment devient culte, les tribunes explosent de rire.", support: 11, budget: 0 },
      { label: "Laisser passer le match sans mascotte", outcome: "Un peu terne, les enfants sont déçus.", support: -2, budget: 0 },
    ],
  },
  {
    id: "interview-decalee", category: "fun", title: "L'Interview Totalement Décalée",
    description: "Un jeune journaliste te pose des questions n'ayant aucun rapport avec le club en zone mixte.",
    choices: [
      { label: "Jouer le jeu avec humour", outcome: "Le clip devient viral, dans le bon sens.", support: 10, budget: 0 },
      { label: "Écourter sèchement", outcome: "Ça fait \"condescendant\" sur les réseaux.", support: -5, budget: 0 },
    ],
  },
  {
    id: "bus-en-panne", category: "fun", title: "Le Bus en Panne sur l'Autoroute",
    description: "Le bus de l'équipe tombe en panne sur l'autoroute, à trois heures d'un déplacement décisif.",
    choices: [
      { label: "Organiser un covoiturage improvisé avec les supporters présents", outcome: "L'anecdote devient une légende du club, ça circule partout.", support: 7, budget: -1 },
      { label: "Attendre un bus de remplacement, discrètement", outcome: "Personne n'en parle, ni en bien ni en mal.", support: 0, budget: -2 },
    ],
  },

  // --- Sérieux ---
  {
    id: "budget-en-berne", category: "serieux", title: "Le Budget en Berne",
    description: "Le trésorier t'alerte : le budget prévisionnel de la saison part sérieusement dans le rouge.",
    choices: [
      { label: "Couper dans la masse salariale", outcome: "Impopulaire, mais les comptes remontent.", support: -9, budget: 14 },
      { label: "Emprunter pour tenir la saison", outcome: "Ça passe pour l'instant, la facture arrivera plus tard.", support: 5, budget: -14 },
    ],
  },
  {
    id: "blessure-en-cascade", category: "serieux", title: "L'Hécatombe des Blessures",
    description: "Une série de blessures graves frappe l'effectif en plein sprint final pour le maintien.",
    choices: [
      { label: "Investir en urgence lors du mercato hivernal", outcome: "Le recrutement sauve la fin de saison.", support: 13, budget: -18 },
      { label: "Faire confiance aux jeunes du centre de formation", outcome: "Courageux, mais les résultats en pâtissent un peu.", support: -6, budget: 3 },
    ],
  },
  {
    id: "rapport-dncg", category: "serieux", title: "Le Rapport de la DNCG",
    description: "Un rapport de la commission de contrôle de gestion pointe des irrégularités dans la gestion du club.",
    choices: [
      { label: "Publier un plan de redressement transparent", outcome: "La transparence surprend, elle est saluée.", support: 9, budget: 0 },
      { label: "Minimiser publiquement", outcome: "Le rapport complet fuite quand même, en pire.", support: -12, budget: 0 },
    ],
  },
  {
    id: "greve-supporters", category: "serieux", title: "La Menace de Boycott",
    description: "Les groupes de supporters menacent de boycotter le prochain match en soutien à un salarié licencié.",
    choices: [
      { label: "Négocier et réintégrer le salarié", outcome: "Le dialogue avec le kop s'apaise nettement.", support: 8, budget: -4 },
      { label: "Maintenir la décision", outcome: "Le boycott a bien lieu, le stade est à moitié vide.", support: -10, budget: 2 },
    ],
  },
  {
    id: "infrastructure-vetuste", category: "serieux", title: "Le Centre d'Entraînement Vétuste",
    description: "Le centre d'entraînement tombe en ruine, les rapports de sécurité s'accumulent sur ton bureau.",
    choices: [
      { label: "Lancer une rénovation complète", outcome: "Un vrai signal envoyé au vestiaire et aux supporters.", support: 12, budget: -20 },
      { label: "Rafistoler au minimum", outcome: "Tranquille pour l'instant, le problème reste entier.", support: -7, budget: -3 },
    ],
  },

  // --- Conseil d'administration (budget/transferts) ---
  {
    id: "vote-budget-transfert", category: "vote", title: "Vote de l'Enveloppe Transferts",
    description: "Le conseil d'administration doit valider l'enveloppe transferts de la saison à venir.",
    choices: [
      { label: "Défendre une enveloppe ambitieuse", outcome: "L'enveloppe passe, le kop rêve déjà du mercato.", support: 8, budget: -25 },
      { label: "Proposer une enveloppe resserrée", outcome: "L'enveloppe passe, mais seuls les actionnaires sourient.", support: -6, budget: 20 },
    ],
  },
  {
    id: "vote-renovation-stade", category: "vote", title: "Vote de la Rénovation du Stade",
    description: "Un projet de rénovation complète du stade est soumis au vote du conseil.",
    choices: [
      { label: "Voter pour, quitte à s'endetter", outcome: "Le projet est validé sous les acclamations.", support: 11, budget: -22 },
      { label: "Reporter le projet", outcome: "Le report se voit, et se fait sentir en tribune.", support: -13, budget: 6 },
    ],
  },
  {
    id: "vote-salaire-star", category: "vote", title: "Vote de la Prolongation de la Star",
    description: "Le conseil débat de la prolongation à prix d'or de ton buteur vedette, courtisé par toute l'Europe.",
    choices: [
      { label: "Voter la prolongation", outcome: "L'effet d'annonce est énorme, la facture aussi.", support: 14, budget: -28 },
      { label: "Laisser filer vers un concurrent", outcome: "Plus sage financièrement, beaucoup moins spectaculaire.", support: 2, budget: -10 },
    ],
  },
  {
    id: "vote-plan-austerite", category: "vote", title: "Vote du Plan d'Austérité",
    description: "Face aux difficultés financières, le conseil propose un plan d'austérité strict.",
    choices: [
      { label: "Voter pour", outcome: "Les comptes remontent, le vestiaire grogne.", support: -10, budget: 16 },
      { label: "Voter contre, chercher un repreneur", outcome: "Plus risqué, mais ça évite le sacrifice immédiat.", support: 4, budget: -6 },
    ],
  },
];

export function drawPresidencyEvents(): ClubEvent[] {
  const shuffled = [...EVENT_POOL].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, PRESIDENCY_LENGTH);
}

// ============================================================================
// Happenings — soirées, réceptions et après-matchs qui surgissent entre deux votes du conseil,
// pour aérer la saison. Même forme qu'un ClubEvent, tirés d'un pool séparé, déclenchés au hasard.
// ============================================================================

export const HAPPENING_POOL: ClubEvent[] = [
  {
    id: "happening-presentation-recrue", category: "happening", title: "Présentation en Grande Pompe d'une Recrue",
    description: "Ta dernière recrue doit être présentée au public. Le service com veut en faire un show.",
    choices: [
      { label: "Faire simple et efficace", outcome: "Correct, sans éclat particulier.", support: 3, budget: 0 },
      { label: "Organiser un show pyrotechnique complet", outcome: "Le stade est comble, l'ambiance est électrique.", support: 7, budget: -3 },
    ],
  },
  {
    id: "happening-diner-sponsors", category: "happening", title: "Dîner de Gala avec les Sponsors",
    description: "Un dîner de gala réunit tous les partenaires du club autour d'un buffet interminable.",
    choices: [
      { label: "Rester concentré sur le business", outcome: "Deux nouveaux partenariats se dessinent.", support: 4, budget: 3 },
      { label: "Profiter un peu trop de l'open bar", outcome: "Ambiance excellente, un partenaire se plaint le lendemain.", support: -2, budget: 1 },
    ],
  },
  {
    id: "happening-apres-derby", category: "happening", title: "L'Après-Derby Victorieux",
    description: "Le derby est remporté dans la douleur. Le vestiaire exulte, et personne ne veut rentrer.",
    choices: [
      { label: "Fêter sobrement avec le staff", outcome: "Belle soirée, tout le monde rentre à une heure raisonnable.", support: 5, budget: 0 },
      { label: "Fêter ça comme il se doit, jusqu'au bout", outcome: "", support: 0, budget: 0, chaos: true },
    ],
  },
  {
    id: "happening-vernissage-boutique", category: "happening", title: "Inauguration de la Nouvelle Boutique",
    description: "La nouvelle boutique officielle du club ouvre ses portes, petits fours et maillots dédicacés au programme.",
    choices: [
      { label: "Couper le ruban et repartir", outcome: "Efficace, sans éclat.", support: 2, budget: 0 },
      { label: "Rester serrer des mains un long moment", outcome: "Belle image de proximité avec les supporters.", support: 6, budget: -1 },
    ],
  },
  {
    id: "happening-soiree-noel-staff", category: "happening", title: "Soirée de Noël du Staff",
    description: "Le staff du club organise sa soirée de Noël annuelle dans les salons du stade.",
    choices: [
      { label: "Passer dire bonjour", outcome: "Sympathique, l'équipe apprécie le geste.", support: 3, budget: 0 },
      { label: "Rester jusqu'au bout avec tout le monde", outcome: "Ambiance excellente, esprit de groupe renforcé.", support: 5, budget: -1 },
    ],
  },
  {
    id: "happening-after-boite-joueurs", category: "happening", title: "L'Invitation d'un Joueur en Boîte",
    description: "Un joueur cadre t'invite \"juste pour un verre\" dans une boîte branchée après un dîner d'équipe.",
    choices: [
      { label: "Décliner, tu as un conseil demain matin", outcome: "Raisonnable, personne ne le remarque vraiment.", support: 0, budget: 0 },
      { label: "Y aller, juste un peu", outcome: "", support: 0, budget: 0, chaos: true },
    ],
  },
  {
    id: "happening-tribune-presidentielle", category: "happening", title: "Visite d'un Élu Local en Tribune",
    description: "Un élu local vient assister au match depuis la tribune présidentielle, caméras en approche.",
    choices: [
      { label: "Rester protocolaire", outcome: "Correct, sans plus.", support: 2, budget: 0 },
      { label: "Lui offrir un maillot floqué à son nom", outcome: "Le geste plaît, l'image circule bien localement.", support: 6, budget: -1 },
    ],
  },
  {
    id: "happening-repas-anciens", category: "happening", title: "Repas des Anciens du Club",
    description: "Les anciennes gloires du club se retrouvent pour un déjeuner nostalgique, en ta présence.",
    choices: [
      { label: "Écouter leurs histoires avec plaisir", outcome: "Moment chaleureux, les anciens s'en souviendront.", support: 7, budget: 0 },
      { label: "Écourter, agenda chargé", outcome: "Un peu froid comme image.", support: -2, budget: 0 },
    ],
  },
  {
    id: "happening-anniversaire-club", category: "happening", title: "Anniversaire du Club",
    description: "Le club fête un anniversaire rond, grande fête populaire organisée sur la pelouse.",
    choices: [
      { label: "Ouvrir les festivités en personne", outcome: "Moment fédérateur, toute la ville en parle.", support: 9, budget: -2 },
      { label: "Passer en coup de vent", outcome: "Poli, mais un peu froid comme image.", support: 1, budget: 0 },
    ],
  },
  {
    id: "happening-diner-fonds-etranger", category: "happening", title: "Dîner avec un Fonds d'Investissement",
    description: "Un fonds d'investissement étranger t'invite à dîner pour \"explorer des synergies\".",
    choices: [
      { label: "Rester factuel sur les chiffres du club", outcome: "Discussion sérieuse, une piste de partenariat s'ouvre.", support: 2, budget: 4 },
      { label: "Se laisser porter par la soirée", outcome: "", support: 0, budget: 0, chaos: true },
    ],
  },
  {
    id: "happening-tournee-bars", category: "happening", title: "Tournée des Bars de Supporters",
    description: "Tu fais une tournée surprise des bars de supporters avant un match à domicile.",
    choices: [
      { label: "Boire un café avec les groupes de fans", outcome: "Moment sympathique et apprécié, sans excès.", support: 8, budget: 0 },
      { label: "Enchaîner les pintes avec les ultras", outcome: "Soirée mémorable, tu tiens à peine debout le lendemain.", support: 4, budget: 0 },
    ],
  },
  {
    id: "happening-emission-tv", category: "happening", title: "Invitation Surprise sur un Plateau Sportif",
    description: "Une chaîne sportive t'invite en direct pour parler des ambitions de la saison.",
    choices: [
      { label: "Rester mesuré sur les objectifs", outcome: "Prudent, personne ne peut te le reprocher.", support: 3, budget: 0 },
      { label: "Promettre le titre en direct", outcome: "Le pari fait le buzz, la pression monte d'un cran.", support: 9, budget: 0 },
    ],
  },
  {
    id: "happening-cocktail-agents", category: "happening", title: "Cocktail avec des Agents de Joueurs",
    description: "Un cocktail mondain réunit tout ce que le milieu compte d'agents de joueurs influents.",
    choices: [
      { label: "Garder ses distances", outcome: "Prudent, aucune trace, aucune histoire.", support: 2, budget: 0 },
      { label: "Négocier un deal avantageux autour d'un verre", outcome: "Un bon point pour le prochain mercato.", support: 5, budget: 6 },
    ],
  },
  {
    id: "happening-vernissage-musee", category: "happening", title: "Vernissage du Musée du Club",
    description: "Le tout nouveau musée du club ouvre ses portes, retraçant un siècle d'histoire.",
    choices: [
      { label: "Faire un discours ému sur l'histoire du club", outcome: "Moment fort, salué par les plus anciens supporters.", support: 8, budget: 0 },
      { label: "Visite rapide, sans discours", outcome: "Correct, sans éclat particulier.", support: 2, budget: 0 },
    ],
  },
  {
    id: "happening-tournoi-charite", category: "happening", title: "Tournoi de Charité entre Anciennes Gloires",
    description: "D'anciennes gloires du club organisent un tournoi caritatif et te réclament sur le terrain.",
    choices: [
      { label: "Jouer et se blesser un peu à l'ego", outcome: "Le geste est très apprécié, malgré la performance discutable.", support: 10, budget: -1 },
      { label: "Rester en tribune, prudent", outcome: "Correct, sans plus.", support: 2, budget: 0 },
    ],
  },
  {
    id: "happening-after-victoire-europe", category: "happening", title: "After d'une Qualification Européenne Historique",
    description: "Le club se qualifie pour la première fois en coupe d'Europe. Le vestiaire veut fêter ça toute la nuit.",
    choices: [
      { label: "Rentrer se reposer, la saison continue", outcome: "Sage, la suite du calendrier est chargée.", support: 4, budget: 0 },
      { label: "Fêter ça comme il se doit", outcome: "", support: 0, budget: 0, chaos: true },
    ],
  },
];

export function drawHappening(usedIds: string[] = []): { event: ClubEvent; usedIds: string[] } {
  const available = HAPPENING_POOL.filter((h) => !usedIds.includes(h.id));
  const pool = available.length > 0 ? available : HAPPENING_POOL;
  const event = pick(pool);
  const nextUsed = available.length > 0 ? [...usedIds, event.id] : [event.id];
  return { event, usedIds: nextUsed };
}

export function shouldTriggerHappening(): boolean {
  return chance(0.28);
}

export function shouldTriggerSurpriseOuster(): boolean {
  return chance(0.05);
}

// ============================================================================
// Votes du conseil d'administration — inspiré de "La Bataille du Budget" : chaque saison, le
// conseil enchaîne 15 à 20 décisions (dépenses/économies), votées un par un en Pour/Contre, avec
// un impact immédiat sur le soutien des supporters. Certaines décisions s'accompagnent d'une
// enveloppe d'un agent : accepter force le vote dans le sens demandé contre des crédits réels.
// ============================================================================

export const VOTES_PER_SEASON_MIN = 15;
export const VOTES_PER_SEASON_MAX = 20;
export const BOARD_SEATS = 15;
export const BOARD_MAJORITY = 8;

export interface BoardTopic {
  id: string;
  hausseTitle: string;
  baisseTitle: string;
  affected: string;
}

export const BOARD_TOPICS: BoardTopic[] = [
  { id: "recrue-star", hausseTitle: "Recrutement d'un attaquant vedette à prix d'or", baisseTitle: "Miser sur les jeunes du centre de formation", affected: "l'effectif offensif" },
  { id: "prix-billets", hausseTitle: "Hausse du prix des abonnements", baisseTitle: "Gel du prix des abonnements", affected: "les abonnés" },
  { id: "salaire-coach", hausseTitle: "Revalorisation du salaire de l'entraîneur", baisseTitle: "Renégociation à la baisse du staff technique", affected: "le staff technique" },
  { id: "stade", hausseTitle: "Lancement des travaux du nouveau stade", baisseTitle: "Report des travaux du stade", affected: "les riverains et les supporters" },
  { id: "scouting", hausseTitle: "Hausse du budget scouting international", baisseTitle: "Réduction du réseau de recruteurs", affected: "la cellule de recrutement" },
  { id: "sponsor-maillot", hausseTitle: "Signature d'un nouveau sponsor maillot controversé", baisseTitle: "Refus du sponsor controversé", affected: "l'image du club" },
  { id: "capitaine", hausseTitle: "Prolongation coûteuse du capitaine historique", baisseTitle: "Laisser partir le capitaine en fin de contrat", affected: "le vestiaire" },
  { id: "formation", hausseTitle: "Investissement massif dans le centre de formation", baisseTitle: "Coupe dans le budget formation", affected: "les jeunes du centre" },
  { id: "primes", hausseTitle: "Hausse des primes de match", baisseTitle: "Baisse des primes de match", affected: "les joueurs professionnels" },
  { id: "staff-adjoint", hausseTitle: "Recrutement d'un adjoint de renom", baisseTitle: "Économie sur le staff technique", affected: "le banc de touche" },
  { id: "pelouse", hausseTitle: "Rénovation complète de la pelouse", baisseTitle: "Report de l'entretien de la pelouse", affected: "la qualité du jeu" },
  { id: "securite", hausseTitle: "Renforcement du dispositif de sécurité en tribune", baisseTitle: "Réduction du dispositif de sécurité", affected: "les spectateurs" },
  { id: "rachat-ancien", hausseTitle: "Rachat coûteux d'un ancien joueur formé au club", baisseTitle: "Vente d'un joueur formé au club", affected: "le lien avec les supporters historiques" },
  { id: "merchandising", hausseTitle: "Hausse du budget merchandising et boutique", baisseTitle: "Réduction du budget merchandising", affected: "les recettes annexes" },
  { id: "equipe-feminine", hausseTitle: "Investissement dans la section féminine", baisseTitle: "Gel du budget de la section féminine", affected: "la section féminine du club" },
  { id: "bus-equipe", hausseTitle: "Achat d'un nouveau bus d'équipe tout confort", baisseTitle: "Conserver l'ancien bus", affected: "le confort de déplacement" },
  { id: "medical", hausseTitle: "Hausse du budget médical et prévention blessures", baisseTitle: "Réduction du staff médical", affected: "la santé de l'effectif" },
  { id: "vestiaires", hausseTitle: "Rénovation haut de gamme des vestiaires", baisseTitle: "Vestiaires laissés en l'état", affected: "le confort des joueurs" },
  { id: "communication", hausseTitle: "Hausse du budget communication et réseaux sociaux", baisseTitle: "Réduction du budget communication", affected: "l'image du club en ligne" },
  { id: "academie-internationale", hausseTitle: "Ouverture d'une académie à l'international", baisseTitle: "Abandon du projet d'académie internationale", affected: "le rayonnement du club" },
];

export type BillDirection = "hausse" | "baisse";
export type VoteChoice = "pour" | "contre";

export interface BribeOffer {
  direction: VoteChoice;
  amount: number;
}

export interface Bill {
  topic: BoardTopic;
  direction: BillDirection;
  title: string;
  amountMEur: number; // pur habillage narratif, sans lien mécanique direct — sauf via applyVoteWageImpact
  bribeOffer: BribeOffer | null;
}

export function generateBill(club: Club): Bill {
  const topic = pick(BOARD_TOPICS);
  const direction: BillDirection = chance(0.5) ? "hausse" : "baisse";
  const bribeOffer: BribeOffer | null = chance(0.3)
    ? { direction: chance(0.5) ? "pour" : "contre", amount: Math.round(bribeCost(club) * (0.5 + Math.random())) }
    : null;
  return {
    topic,
    direction,
    title: direction === "hausse" ? topic.hausseTitle : topic.baisseTitle,
    amountMEur: Math.round((0.3 + Math.random() * 7.7) * 10) / 10,
    bribeOffer,
  };
}

export function billsForSeason(club: Club): Bill[] {
  const count = randInt(VOTES_PER_SEASON_MIN, VOTES_PER_SEASON_MAX);
  return Array.from({ length: count }, () => generateBill(club));
}

export interface VoteResult {
  passed: boolean;
  votesFor: number;
  narrative: string;
  support: number;
  budget: number;
}

// Le vote du président influence les chances d'adoption sans les décider — voter "pour" les rend
// plus probables, "contre" moins. Contrairement au Ministère (hausse d'impôt = impopulaire), ici
// "hausse" = plus de dépenses = généralement populaire auprès des supporters, mais coûte au budget.
export function resolveTransferVote(bill: Bill, vote: VoteChoice, bias = 1): VoteResult {
  const supportChance = 0.42 + (vote === "pour" ? 0.16 : -0.16);
  const passed = biasedChance(supportChance, bias);
  const votesFor = passed ? randInt(BOARD_MAJORITY, BOARD_SEATS - 1) : randInt(4, BOARD_MAJORITY - 1);

  const magnitude = passed ? 1 : 0.4;
  const directionSign = bill.direction === "hausse" ? 1 : -1;
  const voteSign = vote === "pour" ? 1 : -1;
  let support = Math.round(directionSign * voteSign * randInt(2, 5) * magnitude);
  if ((vote === "pour") !== passed) support -= randInt(0, 2);

  const budget = passed ? (bill.direction === "hausse" ? -randInt(4, 9) : randInt(4, 9)) : 0;
  const narrative = `${bill.title} — ${votesFor}/${BOARD_SEATS} voix pour, ${passed ? "adoptée" : "rejetée"}.`;
  return { passed, votesFor, narrative, support, budget };
}

export interface BribeLeakResult {
  leaked: boolean;
  supportPenalty: number;
}

export function resolveBribeLeak(bias = 1): BribeLeakResult {
  const leaked = !biasedChance(0.8, bias);
  return { leaked, supportPenalty: leaked ? randInt(18, 32) : 0 };
}

// ============================================================================
// Soudoyer l'arbitre — dépense de vrais crédits pendant une saison, en alternative aux deux choix
// narratifs. Le risque est piloté par le même curseur admin "Probabilité de gain" que les autres jeux.
// ============================================================================

export function bribeCost(club: Club): number {
  return Math.round(ENTRY_COST * 1.5 * Math.max(1, TIER_MULTIPLIER[club.tier]));
}

const BRIBE_SUCCESS_LINES = [
  "L'arbitre siffle exactement ce qu'il fallait, sans un mot de plus.",
  "Un simple regard entendu a suffi à orienter la soirée.",
  "Ton contact est reconnaissant... et très discret.",
];
const BRIBE_FAIL_LINES = [
  "Un journaliste avait tout filmé depuis la tribune de presse.",
  "La commission de discipline s'en mêle, l'affaire éclate.",
  "L'enveloppe a fuité sur les réseaux en moins d'une heure.",
];

export interface BribeResult {
  success: boolean;
  support: number;
  budget: number;
  outcome: string;
}

export function resolveBribe(bias = 1): BribeResult {
  const success = biasedChance(0.6, bias);
  if (success) {
    return { success: true, support: randInt(18, 30), budget: randInt(20, 45), outcome: pick(BRIBE_SUCCESS_LINES) };
  }
  return { success: false, support: -randInt(28, 42), budget: -randInt(25, 45), outcome: pick(BRIBE_FAIL_LINES) };
}

// ============================================================================
// Chaos — résolution spéciale des dérives "Céder"/"Y aller". Grosse variance dans les deux sens.
// ============================================================================

const CLUB_CHAOS_GOOD_LINES = [
  "Sous le coup de l'euphorie, tu improvises un discours qui galvanise le vestiaire pour le reste de la saison.",
  "Une énergie inexplicable te pousse à boucler trois deals sur un coin de table — et ils tiennent la route.",
  "Tu montes sur la table du carré VIP pour chanter avec les ultras. Les images tournent, et étrangement, ça passe très bien.",
];
const CLUB_CHAOS_BAD_LINES = [
  "Tu t'effondres en pleine conférence de presse, les images tournent en boucle.",
  "Une story totalement incohérente est postée depuis le compte officiel du club.",
  "Tu promets en public de titulariser tous les jeunes du centre de formation, sans en parler à l'entraîneur. Le staff panique.",
];

export interface ChaosResult {
  support: number;
  budget: number;
  outcome: string;
  good: boolean;
}

export function resolveClubChaos(): ChaosResult {
  const roll = randInt(-35, 45);
  const good = roll > 5;
  return { support: roll, budget: -randInt(10, 25), outcome: pick(good ? CLUB_CHAOS_GOOD_LINES : CLUB_CHAOS_BAD_LINES), good };
}

// ============================================================================
// Groupes de supporters/parties prenantes — confiance de chaque bloc (0-100, départ à 50), pure
// couleur sur un seul axe "dépenses". Pèse ensuite dans la survie d'une motion de défiance.
// ============================================================================

export interface ClubStakeholder {
  id: string;
  label: string;
  short: string;
  spendLean: number; // -1 (toujours pour l'austérité) à +1 (toujours pour plus de dépenses) — pure fiction
}

export const CLUB_STAKEHOLDERS: ClubStakeholder[] = [
  { id: "ultras", label: "Groupes Ultras", short: "ULTRAS", spendLean: 1 },
  { id: "medias", label: "Médias Sportifs", short: "MÉDIAS", spendLean: 0.6 },
  { id: "anciens", label: "Anciens du Club", short: "ANCIENS", spendLean: 0.4 },
  { id: "sponsors", label: "Sponsors", short: "SPONS.", spendLean: -0.2 },
  { id: "dncg", label: "Ligue / DNCG", short: "DNCG", spendLean: -0.6 },
  { id: "actionnaires", label: "Actionnaires", short: "ACTION.", spendLean: -0.8 },
];

export const START_STAKEHOLDER_CONFIDENCE = 50;

export function applyStakeholderConfidence(confidence: Record<string, number>, bill: Bill, vote: VoteChoice): Record<string, number> {
  const next = { ...confidence };
  const directionSign = bill.direction === "hausse" ? 1 : -1;
  const voteSign = vote === "pour" ? 1 : -1;
  for (const s of CLUB_STAKEHOLDERS) {
    const delta = Math.round(s.spendLean * directionSign * voteSign * randInt(1, 4));
    next[s.id] = Math.max(0, Math.min(100, (next[s.id] ?? START_STAKEHOLDER_CONFIDENCE) + delta));
  }
  return next;
}

// ============================================================================
// Masse salariale / DNCG — pilotée par les votes eux-mêmes (via le M€ déjà affiché sur chaque
// décision) et par les grands événements/happenings (via leur delta de budget abstrait). Franchir
// un seuil déclenche une note de la commission de contrôle.
// ============================================================================

export const CLUB_REVENUE_M_EUR = 150; // revenu annuel fictif du club, en M€ — sert à convertir une décision en points de ratio
export const START_WAGE_RATIO = 65; // % des revenus consacrés à la masse salariale

export type FfpStatus = "Conforme" | "Sous Surveillance" | "Risque de Sanction" | "Exclusion Europe";
const FFP_ORDER: FfpStatus[] = ["Conforme", "Sous Surveillance", "Risque de Sanction", "Exclusion Europe"];

export function ffpStatusFor(wageRatio: number): FfpStatus {
  if (wageRatio < 60) return "Conforme";
  if (wageRatio < 80) return "Sous Surveillance";
  if (wageRatio < 100) return "Risque de Sanction";
  return "Exclusion Europe";
}

export interface WageRatioImpact {
  wageRatio: number;
  narrative: string | null;
}

function finalizeWageRatioImpact(prevStatus: FfpStatus, nextRatio: number): WageRatioImpact {
  const nextStatus = ffpStatusFor(nextRatio);
  if (nextStatus === prevStatus) return { wageRatio: nextRatio, narrative: null };
  const worse = FFP_ORDER.indexOf(nextStatus) > FFP_ORDER.indexOf(prevStatus);
  const narrative = worse
    ? `📉 La DNCG place le club en "${nextStatus}" — la masse salariale dérape.`
    : `📈 La DNCG améliore le statut du club en "${nextStatus}" — les comptes s'assainissent.`;
  return { wageRatio: nextRatio, narrative };
}

// ponytail: linear drift (0.05/vote) + montant de la décision converti en points de ratio — tune
// VOTE_WAGE_BASE_DRIFT ou la conversion /100 si le ratio semble trop nerveux ou trop plat sur 5 saisons.
const VOTE_WAGE_BASE_DRIFT = 0.05;

export function applyVoteWageImpact(wageRatio: number, bill: Bill, passed: boolean): WageRatioImpact {
  const prevStatus = ffpStatusFor(wageRatio);
  const billEffect = passed ? (bill.direction === "hausse" ? bill.amountMEur : -bill.amountMEur) / (CLUB_REVENUE_M_EUR / 100) : 0;
  const nextRatio = Math.max(20, Math.min(150, wageRatio + VOTE_WAGE_BASE_DRIFT + billEffect));
  return finalizeWageRatioImpact(prevStatus, nextRatio);
}

const EVENT_WAGE_IMPACT_FACTOR = 0.08;

export function applyEventWageImpact(wageRatio: number, budgetDelta: number): WageRatioImpact {
  const prevStatus = ffpStatusFor(wageRatio);
  const nextRatio = Math.max(20, Math.min(150, wageRatio - budgetDelta * EVENT_WAGE_IMPACT_FACTOR));
  return finalizeWageRatioImpact(prevStatus, nextRatio);
}

// ============================================================================
// Motion de défiance — se déclenche à la fin de tout tour où le soutien des supporters finit à 30
// ou moins (mais pas encore à zéro, qui reste une chute immédiate). Conseil de 15 membres, majorité
// à 8 voix — pur décor, aucun rapport avec un fait réel.
// ============================================================================

export interface OusterResult {
  survived: boolean;
  narrative: string;
  supportPenalty: number;
}

// avgStakeholderConfidence, quand connue, se mélange au soutien brut — un président populaire
// auprès du public peut quand même tomber si toutes les parties prenantes se méfient de lui.
export function resolveOusterMotion(support: number, bias = 1, avgStakeholderConfidence?: number): OusterResult {
  const basis = avgStakeholderConfidence !== undefined ? support * 0.6 + avgStakeholderConfidence * 0.4 : support;
  const surviveChance = 0.3 + (Math.max(0, Math.min(100, basis)) / 100) * 0.6;
  const survived = biasedChance(surviveChance, bias);
  const votesForOuster = survived ? randInt(4, BOARD_MAJORITY - 1) : randInt(BOARD_MAJORITY, 14);
  const narrative = survived
    ? `Motion de défiance déposée en conseil — ${votesForOuster}/${BOARD_SEATS} voix pour, il en fallait ${BOARD_MAJORITY}. Tu conserves ton fauteuil, de justesse.`
    : `Motion de défiance déposée en conseil — ${votesForOuster}/${BOARD_SEATS} voix pour. La motion est adoptée. Tu es démis de tes fonctions.`;
  return { survived, narrative, supportPenalty: survived ? randInt(3, 8) : 0 };
}

// ============================================================================
// Fin de présidence
// ============================================================================

export interface PresidencyOutcome {
  payout: number;
  label: string;
}

export function computeOutcome(club: Club, support: number, budget: number, ousted: boolean): PresidencyOutcome {
  if (club.tier === 0) {
    return { payout: Math.round(ENTRY_COST * 0.15), label: "Club en quasi-faillite dès la reprise" };
  }
  if (ousted) {
    return { payout: Math.round(ENTRY_COST * 0.25), label: "Motion de défiance — présidence écourtée" };
  }
  const base = ENTRY_COST * TIER_MULTIPLIER[club.tier];
  const supportFactor = 0.5 + (Math.max(0, Math.min(100, support)) / 100) * 1.3;
  const budgetFactor = Math.max(0.7, Math.min(1.35, 1 + budget / 250));
  const payout = Math.round(base * supportFactor * budgetFactor);
  const label =
    support >= 80 ? "Statue érigée devant le stade" :
    support >= 60 ? "Présidence saluée par les supporters" :
    support >= 40 ? "Présidence honorable" :
    "Présidence chahutée, mais tenue jusqu'au bout";
  return { payout, label };
}

// ============================================================================
// Vendre le club — offert uniquement à la toute fin d'une présidence menée jusqu'au bout (pas de
// motion de défiance). Pari à haut risque : le gain dépasse largement une fin de mandat classique
// en cas de vente réussie, une vente bâclée paie moins bien qu'une présidence sagement terminée.
// ============================================================================

const CLUB_SALE_WIN_MULTIPLIER = 10;
const CLUB_SALE_LOSE_MULTIPLIER = 0.6;

export interface ClubSaleResult {
  won: boolean;
  payout: number;
  label: string;
  narrative: string;
}

export function resolveClubSale(support: number, bias = 1): ClubSaleResult {
  const winChance = 0.2 + (Math.max(0, Math.min(100, support)) / 100) * 0.5;
  const won = biasedChance(winChance, bias);
  const payout = Math.round(ENTRY_COST * (won ? CLUB_SALE_WIN_MULTIPLIER : CLUB_SALE_LOSE_MULTIPLIER) * (0.8 + Math.random() * 0.5));
  return {
    won,
    payout,
    label: won ? "Vente Légendaire — Rachat par un Fonds Souverain" : "Vente Bâclée, Club Cédé au Rabais",
    narrative: won
      ? "Un fonds d'investissement étranger rachète le club à prix d'or. Les supporters t'érigent une statue avant même ton départ."
      : "Les négociations s'enlisent, tu dois céder le club en urgence, très en dessous de sa valeur réelle.",
  };
}
