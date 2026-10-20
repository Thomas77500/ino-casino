import { ArcGame, type ArcConfig } from "../components/games/ArcGame";
import { IconUfo } from "../components/icons";
import { adaptEvent, factionReactions } from "../lib/rpEngine";
import {
  PROGRAMS, drawProgram, randomDecoyProgram, type Program,
  UNLOCK_TOTAL_WON, ENTRY_COST, MANDATE_LENGTH, START_CONTROL, START_LEAKS,
  drawMandateEvents, CATEGORY_LABEL, opsForYear,
  bribeCost, resolveBribe, resolveChaos, resolveAudit, computeOutcome,
  drawHappening, shouldTriggerHappening, shouldTriggerSurpriseAudit, resolveReveal, FACTIONS,
} from "../lib/area51Engine";

const KEYS = { a: "control", r: "leaks", m: "budget" };

// Hollywood gadgets and weather balloons — pure cinema, never a real coercion technique.
const AREA51: ArcConfig = {
  gameId: "area51",
  historyGame: "Area51",
  title: "Zone 51 Clandestine",
  tagline: `Roulette de programme, puis ${MANDATE_LENGTH} années à ta sauce. 100% fictif, open bar.`,
  icon: IconUfo,
  playTab: "Programme",
  intro: `Tourne la roulette de programme. Selon la case, tu prends la tête d'un programme classifié pour ${MANDATE_LENGTH} années : 12 à 18 témoins par année à faire taire avec ta méthode, des incidents de base imprévus, un grand événement annuel — et des fuites qui reviennent toujours au pire moment.`,
  unlockAt: UNLOCK_TOTAL_WON,
  lockedTitle: "Zone 51 verrouillée",
  entryCost: ENTRY_COST,
  length: MANDATE_LENGTH,
  period: "Année",
  start: { a: START_CONTROL, r: START_LEAKS },
  axes: { a: "Contrôle", r: "Fuites", m: "Budget noir", aShort: "Contrôle", rShort: "Fuites" },
  mUnit: 5000,
  mFloor: -100000, // le budget noir peut plonger dans le rouge, jusqu'à un certain point
  items: PROGRAMS,
  drawItem: drawProgram,
  decoyItem: randomDecoyProgram,
  factions: FACTIONS,
  stances: [
    {
      id: "nda", emoji: "📝", label: "Accord de confidentialité", blurb: "Propre et légal. Les politiques adorent la paperasse.",
      success: 0.72, win: { a: [1, 3], r: [0, 1], m: [-6000, -700] }, lose: { a: [-2, 0], r: [0, 2], m: [0, 0] },
      factions: { militaires: 0.2, scientifiques: 0.6, politiques: 0.7, "opinion-publique": 0.2, contractants: -0.2 },
      winLines: ["{pool} signe 47 pages en trois exemplaires. Plus jamais un mot.", "Un stylo, une signature : {pool} n'a jamais rien vu."],
      loseLines: ["{pool} lit les petites lignes… et refuse de signer.", "{pool} demande un avocat. Puis deux."],
      ending: "Le Bureaucrate de l'Ombre",
    },
    {
      id: "flash", emoji: "🕶️", label: "Flash du gadget à souvenirs", blurb: "Rapide, cinématographique, terrifie l'opinion.",
      success: 0.58, win: { a: [2, 6], r: [3, 7], m: [-2200, -700] }, lose: { a: [-3, -1], r: [4, 8], m: [0, 0] },
      factions: { militaires: 0.9, scientifiques: -0.7, politiques: -0.5, "opinion-publique": -0.9, contractants: 0.6 },
      winLines: ["Un flash, des lunettes noires : {pool} se souvient juste d'un joli coucher de soleil.", "{pool} repart convaincu d'avoir vu un ballon-sonde. Très convaincu."],
      loseLines: ["Le gadget fait juste « bip ». {pool} te regarde bizarrement.", "Le flash rate, {pool} filme toute la scène."],
      ending: "L'Agent en Costume Noir",
    },
    {
      id: "cheque", emoji: "💵", label: "Dédommagement généreux", blurb: "Coûte 4 000, calme l'opinion publique.", cost: 4000,
      success: 0.72, win: { a: [1, 3], r: [-4, -1], m: [0, 0] }, lose: { a: [-1, 0], r: [1, 3], m: [0, 0] },
      factions: { militaires: -0.3, scientifiques: 0.2, politiques: 0.4, "opinion-publique": 1, contractants: -0.4 },
      winLines: ["Un chèque « pour la gêne occasionnée » : {pool} n'a soudain plus rien à raconter.", "{pool} part en vacances aux frais du contribuable. Et se tait."],
      loseLines: ["{pool} encaisse… et donne quand même une interview.", "Le chèque est mal rempli. Ambiance."],
      ending: "Le Mécène du Silence",
    },
    {
      id: "piste", emoji: "🎈", label: "Fausse piste", blurb: "Désinformation créative. Génial ou catastrophique.",
      success: 0.5, win: { a: [3, 8], r: [-2, 2], m: [-3000, 0] }, lose: { a: [-4, -1], r: [3, 7], m: [-3000, 0] },
      factions: { militaires: 0.5, scientifiques: 0.4, politiques: -0.3, "opinion-publique": -0.6, contractants: 0.3 },
      winLines: ["Un « ballon météo » en papier alu et une conférence de presse : {pool} oublie tout.", "Tu fais fuiter une théorie encore plus folle. {pool} ne sait plus quoi croire."],
      loseLines: ["{pool} remarque que le ballon météo a des hublots.", "La fausse piste mène tout droit au hangar 18. Oups."],
      ending: "Le Maître de la Désinformation",
    },
  ],
  drives: {
    badge: "Confinement",
    counter: "Témoin",
    prompt: (d) => `Face à ${d.pool}. Quelle méthode ?`,
    forSeason: opsForYear,
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
    return { a: c.control, r: c.leaks, m: c.budget, factions: factionReactions(FACTIONS, { a: c.control, r: c.leaks }), text: c.outcome, success: c.good };
  },
  lexicon: {
    delegate: "le Major Hayes",
    gamble: "Invoquer le secret défense avec aplomb",
    gambleWin: "« Ce sujet est classifié. » Ton aplomb impressionne même les sceptiques.",
    gambleLose: "Ton « secret défense » fait sourire tout le monde. Le bluff est éventé.",
  },
  bribe: {
    label: "Acheter le silence d'un sénateur",
    cost: (item) => bribeCost(item as Program),
    resolve: (bias) => {
      const r = resolveBribe(bias);
      return { success: r.success, a: r.control, r: r.leaks, text: r.outcome };
    },
  },
  raid: {
    surprise: shouldTriggerSurpriseAudit,
    resolve: (a, r, bias, avg) => {
      const x = resolveAudit(a, r, bias, avg);
      return { survived: x.survived, narrative: x.narrative, rAfter: x.leaksAfter };
    },
  },
  outcome: (item, a, m, busted) => computeOutcome(item as Program, a, m, busted),
  finale: {
    title: "Fin de programme",
    text: `Tes ${MANDATE_LENGTH} années à la tête du programme touchent à leur fin. Tu peux tout enterrer tranquillement, ou révéler la vérité au monde.`,
    quiet: "Tout enterrer tranquillement",
    bold: "🛸 Révéler la vérité au monde",
    resolve: resolveReveal,
  },
  recap: { glyph: "👽", aStat: "Contrôle final", mStat: "Budget noir", bustedTitle: "Commission d'enquête — programme clos publiquement" },
  records: {
    table: "area51_records",
    insert: (item, a, m, busted, out) => ({ program_id: item.id, program_label: item.label, outcome_label: out.label, control: a, budget: m, payout: out.payout, busted }),
    select: "program_label, control, busted",
    map: (r) => ({ itemLabel: r.program_label, detail: `Contrôle ${r.control}/100`, busted: r.busted }),
    empty: "Aucun programme terminé pour l'instant.",
    bustedBadge: "Révélé",
    okBadge: "Classifié",
  },
  chat: { table: "area51_messages", title: "Mess des Officiers" },
};

export function Area51() {
  return <ArcGame cfg={AREA51} />;
}
