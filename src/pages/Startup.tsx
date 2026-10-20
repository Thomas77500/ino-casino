import { ArcGame, type ArcConfig } from "../components/games/ArcGame";
import { IconUnicorn } from "../components/icons";
import { adaptEvent, factionReactions } from "../lib/rpEngine";
import {
  SECTORS, drawSector, randomDecoySector, type Sector,
  UNLOCK_TOTAL_WON, ENTRY_COST, MANDATE_LENGTH, START_HYPE, START_SCRUTINY,
  drawMandateEvents, CATEGORY_LABEL, pitchesForRound,
  bribeCost, resolveBribe, resolveChaos, resolveAudit, computeOutcome,
  drawHappening, shouldTriggerHappening, shouldTriggerSurpriseAudit, resolveIpo, FACTIONS,
} from "../lib/startupEngine";

const KEYS = { a: "hype", r: "scrutiny", m: "funding" };

const STARTUP: ArcConfig = {
  gameId: "startup",
  historyGame: "Startup",
  title: "Licorne Frauduleuse",
  tagline: `Roulette de secteur, puis ${MANDATE_LENGTH} tours de table à ta sauce. 100% fictif, open bar.`,
  icon: IconUnicorn,
  playTab: "Startup",
  intro: `Tourne la roulette de secteur. Selon la case, tu fondes une startup pour ${MANDATE_LENGTH} tours de table : 12 à 18 rendez-vous investisseurs par tour à pitcher à ta façon, des soirées imprévues, un grand événement par tour — et des promesses qui finissent toujours par te rattraper.`,
  unlockAt: UNLOCK_TOTAL_WON,
  lockedTitle: "Licorne verrouillée",
  entryCost: ENTRY_COST,
  length: MANDATE_LENGTH,
  period: "Tour",
  start: { a: START_HYPE, r: START_SCRUTINY },
  axes: { a: "Hype", r: "Scrutiny", m: "Levée cumulée", aShort: "Hype", rShort: "Scrutiny" },
  mUnit: 400000,
  mFloor: 0,
  items: SECTORS,
  drawItem: drawSector,
  decoyItem: randomDecoySector,
  factions: FACTIONS,
  stances: [
    {
      id: "chiffre", emoji: "📊", label: "Pitch chiffré", blurb: "Sérieux et rassurant. Les régulateurs approuvent.",
      success: 0.7, win: { a: [1, 3], r: [0, 1], m: [70000, 500000] }, lose: { a: [-2, 0], r: [0, 1], m: [0, 0] },
      factions: { board: 0.4, "equipe-technique": 0.7, "presse-tech": -0.3, regulateurs: 0.6, "premiers-clients": 0.5 },
      winLines: ["Tableur impeccable, unit economics carrées : {pool} signe sans broncher.", "{pool} adore ton slide 14. Chèque à la clé."],
      loseLines: ["{pool} trouve ton tableur « un peu trop raisonnable ».", "Rendez-vous poli. {pool} « reviendra vers toi »."],
      ending: "Pilier de la Rigueur",
    },
    {
      id: "vision", emoji: "🚀", label: "Pitch visionnaire", blurb: "Lève gros, fait rêver la presse, agace la tech.",
      success: 0.55, win: { a: [2, 6], r: [3, 7], m: [150000, 1300000] }, lose: { a: [-3, -1], r: [3, 7], m: [0, 0] },
      factions: { board: 0.8, "equipe-technique": -0.7, "presse-tech": 1, regulateurs: -0.9, "premiers-clients": -0.3 },
      winLines: ["« On ne vend pas un produit, on change le monde. » {pool} sort son carnet de chèques.", "Tu parles de Mars et de blockchain : {pool} est sous le charme."],
      loseLines: ["{pool} demande « mais concrètement ? ». Silence gênant.", "Ta vision est si grande que {pool} n'y voit plus rien."],
      ending: "Visionnaire Autoproclamé",
    },
    {
      id: "diner", emoji: "🍾", label: "Dîner d'affaires", blurb: "Coûte 40 000 d'avance, le board adore.", cost: 40000,
      success: 0.68, win: { a: [0, 2], r: [-2, 0], m: [150000, 650000] }, lose: { a: [-1, 0], r: [0, 2], m: [0, 0] },
      factions: { board: 0.9, "equipe-technique": -0.4, "presse-tech": 0.2, regulateurs: -0.2, "premiers-clients": 0 },
      winLines: ["Étoilé, grand cru, digestif : {pool} signe sur la nappe.", "Le dîner s'éternise et finit en term sheet."],
      loseLines: ["{pool} mange, boit, remercie… et disparaît.", "L'addition arrive. {pool} regarde ailleurs."],
      ending: "Roi du Networking",
    },
    {
      id: "demo", emoji: "🎭", label: "Démo truquée", blurb: "Jackpot ou scandale. La tech et les régulateurs détestent.",
      success: 0.45, win: { a: [3, 8], r: [2, 5], m: [300000, 1800000] }, lose: { a: [-5, -2], r: [5, 9], m: [-50000, 0] },
      factions: { board: 0.5, "equipe-technique": -1, "presse-tech": 0.6, regulateurs: -1, "premiers-clients": -0.6 },
      winLines: ["La démo « 100% IA » (un stagiaire caché derrière un rideau) bluffe {pool}.", "Tout marche à la perfection, pour une fois. {pool} est conquis."],
      loseLines: ["Le stagiaire derrière le rideau éternue. {pool} a tout vu.", "Écran bleu en pleine démo. {pool} prend des notes. Beaucoup."],
      ending: "Maître de la Démo Magique",
    },
  ],
  drives: {
    badge: "Rendez-vous investisseur",
    counter: "Pitch",
    prompt: (d) => `Face à ${d.pool}. Quel pitch tu sors ?`,
    forSeason: pitchesForRound,
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
    return { a: c.hype, r: c.scrutiny, m: c.funding, factions: factionReactions(FACTIONS, { a: c.hype, r: c.scrutiny }), text: c.outcome, success: c.good };
  },
  lexicon: {
    delegate: "ton CTO Kevin",
    gamble: "Annoncer un pivot en live",
    gambleWin: "Le pivot surprise enflamme la salle. Tout l'écosystème parle de toi.",
    gambleLose: "Personne ne comprend le pivot. Même pas toi.",
  },
  bribe: {
    label: "Graisser la patte d'un auditeur",
    cost: (item) => bribeCost(item as Sector),
    resolve: (bias) => {
      const r = resolveBribe(bias);
      return { success: r.success, a: r.hype, r: r.scrutiny, text: r.outcome };
    },
  },
  raid: {
    surprise: shouldTriggerSurpriseAudit,
    resolve: (a, r, bias, avg) => {
      const x = resolveAudit(a, r, bias, avg);
      return { survived: x.survived, narrative: x.narrative, rAfter: x.scrutinyAfter };
    },
  },
  outcome: (item, a, m, busted) => computeOutcome(item as Sector, a, m, busted),
  finale: {
    title: "Fin de cycle",
    text: `Tes ${MANDATE_LENGTH} tours de table touchent à leur fin. Tu peux vendre discrètement, ou tenter l'introduction en bourse.`,
    quiet: "Vendre discrètement à un fonds",
    bold: "📈 Tenter l'introduction en bourse",
    resolve: resolveIpo,
  },
  recap: { glyph: "🦄", aStat: "Hype finale", mStat: "Levée cumulée", bustedTitle: "Mise en examen — la startup s'effondre" },
  records: {
    table: "startup_records",
    insert: (item, a, m, busted, out) => ({ sector_id: item.id, sector_label: item.label, outcome_label: out.label, hype: a, funding: m, payout: out.payout, busted }),
    select: "sector_label, hype, busted",
    map: (r) => ({ itemLabel: r.sector_label, detail: `Hype ${r.hype}/100`, busted: r.busted }),
    empty: "Aucune startup terminée pour l'instant.",
    bustedBadge: "Mise en examen",
    okBadge: "En vie",
  },
  chat: { table: "startup_messages", title: "Salle du Board" },
};

export function Startup() {
  return <ArcGame cfg={STARTUP} />;
}
