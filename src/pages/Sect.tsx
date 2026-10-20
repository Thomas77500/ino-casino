import { ArcGame, type ArcConfig } from "../components/games/ArcGame";
import { IconCultEye } from "../components/icons";
import { adaptEvent, factionReactions } from "../lib/rpEngine";
import {
  CULT_TYPES, drawCultType, randomDecoyCultType, type CultType,
  UNLOCK_TOTAL_WON, ENTRY_COST, MANDATE_LENGTH, START_INFLUENCE, START_SUSPICION,
  drawMandateEvents, CATEGORY_LABEL, drivesForSeason,
  bribeCost, resolveBribe, resolveChaos, resolveRaid, computeOutcome,
  drawHappening, shouldTriggerHappening, shouldTriggerSurpriseRaid, resolveGlobalExpansion, FACTIONS,
} from "../lib/sectEngine";

const KEYS = { a: "influence", r: "suspicion", m: "dons" };

// Pure satire: tisanes, merch and wires-and-mirrors "miracles" — never a real persuasion technique.
const SECT: ArcConfig = {
  gameId: "sect",
  historyGame: "Sect",
  title: "Gourou",
  tagline: `Roulette de fondation, puis ${MANDATE_LENGTH} saisons de recrutement à ta sauce. 100% fictif, open bar.`,
  icon: IconCultEye,
  playTab: "Culte",
  intro: `Tourne la roulette de fondation. Selon la case, tu fondes un mouvement pour ${MANDATE_LENGTH} saisons : 12 à 18 campagnes de recrutement par saison menées avec ton style, des retraites imprévues, un grand événement par saison — et des décisions qui reviennent te hanter.`,
  unlockAt: UNLOCK_TOTAL_WON,
  lockedTitle: "Gourou verrouillé",
  entryCost: ENTRY_COST,
  length: MANDATE_LENGTH,
  period: "Saison",
  start: { a: START_INFLUENCE, r: START_SUSPICION },
  axes: { a: "Influence", r: "Suspicion", m: "Dons collectés", aShort: "Influence", rShort: "Suspicion" },
  mUnit: 3000,
  mFloor: 0,
  items: CULT_TYPES,
  drawItem: drawCultType,
  decoyItem: randomDecoyCultType,
  factions: FACTIONS,
  stances: [
    {
      id: "retraite", emoji: "🕯️", label: "Retraite bien-être", blurb: "Douce et rassurante, rapporte peu.",
      success: 0.7, win: { a: [1, 3], r: [0, 1], m: [800, 3500] }, lose: { a: [-2, 0], r: [0, 1], m: [0, 0] },
      factions: { "premier-cercle": -0.2, "nouveaux-adeptes": 0.8, "familles-inquietes": 0.6, "presse-locale": 0.3, mecenes: 0 },
      winLines: ["Yoga, tisane et chants de baleines : {pool} repart conquis… et adhérent.", "Une retraite si apaisante que {pool} promet de revenir avec des amis."],
      loseLines: ["{pool} trouve la tisane infecte et file avant le gong.", "Retraite annulée : il pleut, et {pool} n'a pas pris de k-way."],
      ending: "Le Gourou Zen",
    },
    {
      id: "grand-messe", emoji: "📣", label: "Grand-messe spectaculaire", blurb: "Recrute en masse, inquiète les familles et la presse.",
      success: 0.58, win: { a: [2, 6], r: [3, 7], m: [2000, 8800] }, lose: { a: [-3, -1], r: [3, 7], m: [0, 0] },
      factions: { "premier-cercle": 0.9, "nouveaux-adeptes": 0.6, "familles-inquietes": -1, "presse-locale": -0.8, mecenes: 0.5 },
      winLines: ["Fumigènes, lasers et chorale : {pool} n'a jamais rien vu de pareil.", "Ta grand-messe affiche complet, {pool} au premier rang."],
      loseLines: ["Le micro grésille, la machine à fumée s'emballe : {pool} évacue en toussant.", "La presse filme le show. Les commentaires sont… mitigés."],
      ending: "Le Prophète Tonitruant",
    },
    {
      id: "goodies", emoji: "🎁", label: "Goodies et cadeaux", blurb: "Coûte 1 000 d'avance, adoré des nouveaux.", cost: 1000,
      success: 0.7, win: { a: [0, 2], r: [-2, 0], m: [1800, 6000] }, lose: { a: [-1, 0], r: [0, 2], m: [0, 0] },
      factions: { "premier-cercle": -0.3, "nouveaux-adeptes": 0.9, "familles-inquietes": 0.2, "presse-locale": 0.2, mecenes: -0.4 },
      winLines: ["Tote bags, mugs et bracelets lumineux : {pool} adore le merch.", "{pool} poste une story avec ton mug. Pub gratuite."],
      loseLines: ["{pool} prend les goodies… et file sans un regard.", "Les mugs sont imprimés à l'envers. Moment de gêne."],
      ending: "Le Gourou Marketing",
    },
    {
      id: "miracle", emoji: "🔮", label: "Miracle mis en scène", blurb: "Spectaculaire et payant. La presse adore démasquer.",
      success: 0.48, win: { a: [3, 8], r: [1, 4], m: [3000, 11000] }, lose: { a: [-5, -2], r: [3, 7], m: [-1500, 0] },
      factions: { "premier-cercle": 0.6, "nouveaux-adeptes": 0.4, "familles-inquietes": -0.7, "presse-locale": -1, mecenes: 0.8 },
      winLines: ["Une lévitation (merci les câbles transparents) : {pool} crie au prodige.", "Le tour est si propre que {pool} filme, bouche bée."],
      loseLines: ["Un câble lâche en plein miracle. {pool} éclate de rire.", "Un magicien amateur parmi {pool} dévoile le truc en direct."],
      ending: "L'Illusionniste Céleste",
    },
  ],
  drives: {
    badge: "Recrutement",
    counter: "Campagne",
    prompt: (d) => `Cible : ${d.pool}. Comment tu t'y prends ?`,
    forSeason: drivesForSeason,
  },
  events: () => drawMandateEvents().map((e) => adaptEvent(e, KEYS)),
  happening: {
    draw: (used) => {
      const p = drawHappening(used);
      return { event: adaptEvent(p.event, KEYS), usedIds: p.usedIds };
    },
    trigger: shouldTriggerHappening,
  },
  categoryLabel: CATEGORY_LABEL,
  chaos: () => {
    const c = resolveChaos();
    return { a: c.influence, r: c.suspicion, m: c.dons, factions: factionReactions(FACTIONS, { a: c.influence, r: c.suspicion }), text: c.outcome, success: c.good };
  },
  lexicon: {
    delegate: "Sœur Clémence, ta fidèle bras droit",
    gamble: "Improviser une prophétie",
    gambleWin: "Ta prophétie floue se réalise vaguement — tout le monde crie au génie.",
    gambleLose: "Ta prophétie tombe complètement à côté. Même le Premier Cercle tousse.",
  },
  bribe: {
    label: "Acheter le silence d'un journaliste",
    cost: (item) => bribeCost(item as CultType),
    resolve: (bias) => {
      const r = resolveBribe(bias);
      return { success: r.success, a: r.influence, r: r.suspicion, text: r.outcome };
    },
  },
  raid: {
    surprise: shouldTriggerSurpriseRaid,
    resolve: (a, r, bias, avg) => {
      const x = resolveRaid(a, r, bias, avg);
      return { survived: x.survived, narrative: x.narrative, rAfter: x.suspicionAfter };
    },
  },
  outcome: (item, a, m, busted) => computeOutcome(item as CultType, a, m, busted),
  finale: {
    title: "Fin de saison",
    text: `Tes ${MANDATE_LENGTH} saisons à la tête du mouvement touchent à leur fin. Tu peux transmettre le flambeau en paix, ou tenter l'expansion mondiale.`,
    quiet: "Transmettre sagement le mouvement",
    bold: "🌍 Tenter l'expansion mondiale",
    resolve: resolveGlobalExpansion,
  },
  recap: { glyph: "👁️", aStat: "Influence finale", mStat: "Dons collectés", bustedTitle: "Descente des autorités — culte démantelé" },
  records: {
    table: "sect_records",
    insert: (item, a, m, busted, out) => ({ cult_id: item.id, cult_label: item.label, outcome_label: out.label, influence: a, dons: m, payout: out.payout, raided: busted }),
    select: "cult_label, influence, raided",
    map: (r) => ({ itemLabel: r.cult_label, detail: `Influence ${r.influence}/100`, busted: r.raided }),
    empty: "Aucun culte terminé pour l'instant.",
    bustedBadge: "Démantelé",
    okBadge: "Debout",
  },
  chat: { table: "sect_messages", title: "Cercle Intérieur" },
};

export function Sect() {
  return <ArcGame cfg={SECT} />;
}
