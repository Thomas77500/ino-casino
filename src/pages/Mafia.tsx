import { ArcGame, type ArcConfig } from "../components/games/ArcGame";
import { IconFedora } from "../components/icons";
import { adaptEvent, factionReactions } from "../lib/rpEngine";
import {
  TERRITORIES, drawTerritory, randomDecoyTerritory, type Territory,
  UNLOCK_TOTAL_WON, ENTRY_COST, MANDATE_LENGTH, START_RESPECT, START_HEAT,
  drawMandateEvents, CATEGORY_LABEL, racketsForSeason,
  bribeCost, resolveBribe, resolveChaos, resolveRaid, computeOutcome,
  drawHappening, shouldTriggerHappening, shouldTriggerSurpriseRaid, resolveTakeover, FACTIONS,
} from "../lib/mafiaEngine";

const KEYS = { a: "respect", r: "heat", m: "recettes" };

// Archetypes straight out of a gangster film — ellipsis and bluff, never real violence.
const MAFIA: ArcConfig = {
  gameId: "mafia",
  historyGame: "Mafia",
  title: "Parrain de Quartier",
  tagline: `Roulette de territoire, puis ${MANDATE_LENGTH} saisons de règne à ta sauce. 100% fictif, open bar.`,
  icon: IconFedora,
  playTab: "Règne",
  intro: `Tourne la roulette de territoire. Selon la case, tu prends la tête d'un quartier pour ${MANDATE_LENGTH} saisons : 12 à 18 commerces à « convaincre » par saison avec la manière qui te ressemble, des réceptions imprévues, un grand événement par saison — et des décisions qui te reviennent dans la figure plus tard.`,
  unlockAt: UNLOCK_TOTAL_WON,
  lockedTitle: "Parrain verrouillé",
  entryCost: ENTRY_COST,
  length: MANDATE_LENGTH,
  period: "Saison",
  start: { a: START_RESPECT, r: START_HEAT },
  axes: { a: "Respect", r: "Attention des flics", m: "Recettes", aShort: "Respect", rShort: "Flics" },
  mUnit: 5000,
  mFloor: 0,
  items: TERRITORIES,
  drawItem: drawTerritory,
  decoyItem: randomDecoyTerritory,
  factions: FACTIONS,
  stances: [
    {
      id: "amiable", emoji: "🤝", label: "Arrangement à l'amiable", blurb: "Sûr, apprécié des commerçants, rapporte peu.",
      success: 0.72, win: { a: [1, 3], r: [0, 1], m: [1200, 4000] }, lose: { a: [-2, 0], r: [0, 2], m: [0, 0] },
      factions: { "vieille-garde": 0.2, "jeunes-recrues": -0.6, commercants: 1, "contacts-police": 0.5, "familles-rivales": -0.2 },
      winLines: ["Un café, une poignée de main : {pool} accepte de cotiser à « la caisse du quartier ».", "Tu trouves un terrain d'entente avec {pool}. Tout le monde y gagne — surtout toi."],
      loseLines: ["{pool} écoute poliment… et ne paie rien.", "Pas d'accord. {pool} pense que tu bluffes."],
      ending: "Le Parrain Diplomate",
    },
    {
      id: "pression", emoji: "👊", label: "Coup de pression", blurb: "Rapporte gros, mais les flics et les commerçants détestent.",
      success: 0.58, win: { a: [2, 6], r: [3, 7], m: [2500, 9000] }, lose: { a: [-3, -1], r: [4, 8], m: [0, 0] },
      factions: { "vieille-garde": 0.8, "jeunes-recrues": 1, commercants: -1, "contacts-police": -0.9, "familles-rivales": 0.5 },
      winLines: ["Deux armoires à glace dans l'entrée ont suffi : {pool} paie rubis sur l'ongle.", "{pool} a compris le message avant même que tu finisses ta phrase."],
      loseLines: ["{pool} appelle ses cousins. Ça finit en face-à-face tendu en pleine rue.", "La pression tourne au fiasco : {pool} porte plainte « contre X »."],
      ending: "Le Parrain qu'on Craint",
    },
    {
      id: "pattes", emoji: "💼", label: "Graisser les pattes", blurb: "Coûte 1 500 d'avance, calme la police.", cost: 1500,
      success: 0.7, win: { a: [0, 2], r: [-3, 0], m: [2500, 7000] }, lose: { a: [-1, 0], r: [1, 3], m: [0, 0] },
      factions: { "vieille-garde": -0.3, "jeunes-recrues": -0.3, commercants: 0.2, "contacts-police": 1, "familles-rivales": -0.4 },
      winLines: ["Une enveloppe au bon endroit, et {pool} devient soudain très coopératif.", "Tout se règle en douceur — même l'inspecteur du coin regarde ailleurs."],
      loseLines: ["L'enveloppe disparaît… et {pool} aussi.", "Mauvaise personne, mauvais moment : l'enveloppe fait jaser."],
      ending: "Le Parrain Homme d'Affaires",
    },
    {
      id: "combine", emoji: "🃏", label: "Monter une combine", blurb: "Très risqué, très payant. Les rivaux détestent être doublés.",
      success: 0.5, win: { a: [3, 7], r: [0, 3], m: [4000, 13000] }, lose: { a: [-4, -1], r: [2, 6], m: [-2000, 0] },
      factions: { "vieille-garde": 0.2, "jeunes-recrues": 0.6, commercants: -0.4, "contacts-police": -0.3, "familles-rivales": -0.9 },
      winLines: ["Fausse assurance, vrai profit : {pool} n'y voit que du feu.", "La combine est si belle que même tes rivaux applaudissent en silence."],
      loseLines: ["La combine s'effondre comme un château de cartes devant {pool}.", "Un détail cloche, {pool} flaire l'arnaque et le raconte à tout le monde."],
      ending: "Le Renard du Quartier",
    },
  ],
  drives: {
    badge: "Racket",
    counter: "Commerce",
    prompt: (d) => `Cible : ${d.pool}. Quelle manière pour celui-là ?`,
    forSeason: racketsForSeason,
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
    return { a: c.respect, r: c.heat, m: c.recettes, factions: factionReactions(FACTIONS, { a: c.respect, r: c.heat }), text: c.outcome, success: c.good };
  },
  lexicon: {
    delegate: "ton consigliere Sal",
    gamble: "Jouer de ta réputation de parrain",
    gambleWin: "Un regard, un silence. Tout le monde baisse les yeux — ta légende grandit.",
    gambleLose: "Ton bluff tombe à plat. Dans le quartier, on commence à ricaner dans ton dos.",
  },
  bribe: {
    label: "Acheter le silence d'un commissaire",
    cost: (item) => bribeCost(item as Territory),
    resolve: (bias) => {
      const r = resolveBribe(bias);
      return { success: r.success, a: r.respect, r: r.heat, text: r.outcome };
    },
  },
  raid: {
    surprise: shouldTriggerSurpriseRaid,
    resolve: (a, r, bias, avg) => {
      const x = resolveRaid(a, r, bias, avg);
      return { survived: x.survived, narrative: x.narrative, rAfter: x.heatAfter };
    },
  },
  outcome: (item, a, m, busted) => computeOutcome(item as Territory, a, m, busted),
  finale: {
    title: "Fin de règne",
    text: `Tes ${MANDATE_LENGTH} saisons à la tête du quartier touchent à leur fin. Tu peux passer la main tranquillement, ou tenter de prendre toute la ville.`,
    quiet: "Passer la main tranquillement",
    bold: "👑 Tenter de prendre le contrôle de la ville",
    resolve: resolveTakeover,
  },
  recap: { glyph: "🎩", aStat: "Respect final", mStat: "Recettes", bustedTitle: "Descente de police — réseau démantelé" },
  records: {
    table: "mafia_records",
    insert: (item, a, m, busted, out) => ({ territory_id: item.id, territory_label: item.label, outcome_label: out.label, respect: a, recettes: m, payout: out.payout, busted }),
    select: "territory_label, respect, busted",
    map: (r) => ({ itemLabel: r.territory_label, detail: `Respect ${r.respect}/100`, busted: r.busted }),
    empty: "Aucun règne terminé pour l'instant.",
    bustedBadge: "Démantelé",
    okBadge: "En place",
  },
  chat: { table: "mafia_messages", title: "Le Bar du Quartier" },
};

export function Mafia() {
  return <ArcGame cfg={MAFIA} />;
}
