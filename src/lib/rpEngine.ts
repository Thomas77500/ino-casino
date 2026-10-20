import { biasedChance, pick, randInt } from "./rng";

// ============================================================================
// Shared role-play layer for the mandate arcs (Gourou, Licorne, Parrain, Zone 51).
// Every arc has the same three axes under different names:
//   a = standing (respect / influence / hype / contrôle)   — higher is better
//   r = heat     (flics / suspicion / scrutiny / fuites)   — higher is worse, 75+ triggers a raid
//   m = treasury (recettes / dons / levée / budget noir)   — higher is better
// Nothing here is binary: 4 stances per arc, 5+ options per event (some gated, some with a
// visible success chance), factions that each react differently, consequences that come back
// in later seasons, and an epilogue shaped by how you actually played.
// ============================================================================

export type Range = [number, number];

export interface ArcFaction {
  id: string;
  label: string;
  short: string;
  lean: number; // -1 cautious … +1 loves bold moves
}

export interface Stance {
  id: string;
  emoji: string;
  label: string;
  blurb: string;
  success: number;
  win: { a: Range; r: Range; m: Range };
  lose: { a: Range; r: Range; m: Range };
  factions: Record<string, number>; // per-faction affinity, -1..1
  cost?: number; // treasury paid up front
  winLines: string[]; // "{pool}" is replaced by the target
  loseLines: string[];
  ending: string; // epilogue title when this is your dominant style
}

export interface Effect {
  a: number;
  r: number;
  m: number;
  factions: Record<string, number>;
  text: string;
  flags?: string[];
  consume?: string[];
  success?: boolean;
  chaos?: boolean;
}

export interface AuthoredChoice {
  label: string;
  outcome: string;
  a: number;
  r: number;
  m: number;
  chaos?: boolean;
}

export interface RpEvent {
  id: string;
  category: string;
  title: string;
  description: string;
  choices: AuthoredChoice[];
}

export type OptionTone = "authored" | "special" | "risky" | "locked";

export interface RpOption {
  key: string;
  emoji: string;
  label: string;
  detail?: string;
  chance?: number;
  locked?: string;
  tone: OptionTone;
  resolve: () => Effect;
}

export interface JournalEntry {
  turn: number;
  title: string;
  choice: string;
  good: boolean;
}

export interface RpState {
  a: number;
  r: number;
  m: number;
  factions: Record<string, number>;
  flags: string[];
  journal: JournalEntry[];
  stanceCounts: Record<string, number>;
}

export interface Lexicon {
  delegate: string; // "ton consigliere Sal"
  gamble: string; // label of the bluff option
  gambleWin: string;
  gambleLose: string;
}

export interface Ctx {
  factions: ArcFaction[];
  mUnit: number; // a "typical" treasury amount for this arc
  mFloor: number; // the treasury can't be spent below this
  lexicon: Lexicon;
  chaos: () => Effect;
}

export const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));
export const rollRange = ([lo, hi]: Range) => randInt(Math.min(lo, hi), Math.max(lo, hi));
export const avgConfidence = (f: Record<string, number>) => {
  const v = Object.values(f);
  return v.length ? v.reduce((s, x) => s + x, 0) / v.length : 50;
};
const fmtM = (n: number) => Math.round(Math.abs(n)).toLocaleString("fr-FR");

// Engine events name their axes per arc (respect/heat/recettes…) — map them to a/r/m once.
export function adaptEvent(e: { id: string; category: string; title: string; description: string; choices: readonly Record<string, any>[] }, keys: { a: string; r: string; m: string }): RpEvent {
  return {
    id: e.id,
    category: e.category,
    title: e.title,
    description: e.description,
    choices: e.choices.map((c) => ({ label: c.label, outcome: c.outcome, a: c[keys.a] ?? 0, r: c[keys.r] ?? 0, m: c[keys.m] ?? 0, chaos: c.chaos })),
  };
}

// Each camp reads a decision through its own lens: cautious camps punish heat, bold ones reward it,
// everyone likes seeing your standing grow.
export function factionReactions(factions: ArcFaction[], d: { a: number; r: number }): Record<string, number> {
  return Object.fromEntries(factions.map((f) => [f.id, clamp(Math.round(f.lean * d.r * 0.6 + d.a * 0.3), -8, 8)]));
}

export function stanceLocked(stance: Stance, state: RpState, ctx: Ctx): string | undefined {
  if (stance.cost && state.m - stance.cost < ctx.mFloor) return `Il faut ${fmtM(stance.cost)} en caisse`;
  return undefined;
}

export function resolveStance(stance: Stance, pool: string, ctx: Ctx, bias = 1): Effect {
  const ok = biasedChance(stance.success, bias);
  const t = ok ? stance.win : stance.lose;
  return {
    a: rollRange(t.a),
    r: rollRange(t.r),
    m: rollRange(t.m) - (stance.cost ?? 0),
    factions: Object.fromEntries(ctx.factions.map((f) => [f.id, Math.round((stance.factions[f.id] ?? 0) * randInt(1, 4))])),
    text: pick(ok ? stance.winLines : stance.loseLines).replace("{pool}", pool),
    success: ok,
  };
}

export function applyEffect(state: RpState, e: Effect): RpState {
  const factions = { ...state.factions };
  for (const [id, d] of Object.entries(e.factions)) factions[id] = clamp((factions[id] ?? 50) + d, 0, 100);
  let flags = state.flags.filter((f) => !(e.consume ?? []).includes(f));
  if (e.flags) flags = [...flags, ...e.flags];
  return { ...state, a: clamp(state.a + e.a, 0, 100), r: clamp(state.r + e.r, 0, 100), m: state.m + e.m, factions, flags };
}

const score = (c: AuthoredChoice, mUnit: number) => c.a - c.r * 0.7 + (c.m / mUnit) * 2;

function authoredEffect(c: AuthoredChoice, ctx: Ctx): Effect {
  if (c.chaos) return { ...ctx.chaos(), chaos: true };
  return { a: c.a, r: c.r, m: c.m, factions: factionReactions(ctx.factions, c), text: c.outcome };
}

// A choice that blows up (big heat spike) leaves a trace that comes back next season.
function withTrace(e: Effect, title: string): Effect {
  return e.r >= 8 ? { ...e, flags: [...(e.flags ?? []), `scandal:${title}`] } : e;
}

function gambleOption(state: RpState, ctx: Ctx, key = "gamble"): RpOption {
  const p = clamp(0.2 + state.a / 240, 0.2, 0.62);
  return {
    key,
    emoji: "🎲",
    label: ctx.lexicon.gamble,
    detail: "Ça passe ou ça casse — mieux vaut avoir de l'aura.",
    chance: p,
    tone: "risky",
    resolve: () =>
      Math.random() < p
        ? { a: randInt(4, 7), r: -randInt(1, 3), m: 0, factions: factionReactions(ctx.factions, { a: 5, r: 0 }), text: ctx.lexicon.gambleWin, success: true }
        : { a: -randInt(5, 8), r: randInt(7, 11), m: 0, factions: factionReactions(ctx.factions, { a: -6, r: 9 }), text: ctx.lexicon.gambleLose, success: false },
  };
}

function topFaction(state: RpState, ctx: Ctx): ArcFaction {
  return ctx.factions.reduce((best, f) => ((state.factions[f.id] ?? 50) > (state.factions[best.id] ?? 50) ? f : best));
}
function lowFaction(state: RpState, ctx: Ctx): ArcFaction {
  return ctx.factions.reduce((low, f) => ((state.factions[f.id] ?? 50) < (state.factions[low.id] ?? 50) ? f : low));
}

function costLock(cost: number, state: RpState, ctx: Ctx): string | undefined {
  return cost > 0 && state.m - cost < ctx.mFloor ? `Caisse insuffisante (${fmtM(cost)})` : undefined;
}

// The authored choices, plus three moves that exist for every event: hand it to your right hand
// (odds depend on how much the camps trust you), call in a faction's favour (needs one camp at 60+,
// and they will ask for something back), or bluff your way through (odds depend on your standing).
export function buildEventOptions(event: RpEvent, state: RpState, ctx: Ctx): RpOption[] {
  const plain = event.choices.filter((c) => !c.chaos);
  const options: RpOption[] = event.choices.map((c, i) => {
    const cost = c.m < 0 ? -c.m : 0;
    const locked = costLock(cost, state, ctx);
    return {
      key: `c${i}`,
      emoji: c.chaos ? "🌀" : "▸",
      label: c.label,
      detail: c.chaos ? "Imprévisible." : cost > 0 ? `Coûte ${fmtM(cost)}` : undefined,
      locked,
      tone: c.chaos ? "risky" : "authored",
      resolve: () => withTrace(authoredEffect(c, ctx), event.title),
    };
  });

  if (plain.length > 0) {
    const sorted = [...plain].sort((x, y) => score(y, ctx.mUnit) - score(x, ctx.mUnit));
    const best = sorted[0];
    const worst = sorted[sorted.length - 1];
    const safest = [...plain].sort((x, y) => x.r - y.r)[0];
    const pDelegate = clamp(0.3 + avgConfidence(state.factions) / 250, 0.25, 0.7);

    options.push({
      key: "delegate",
      emoji: "🫡",
      label: `Confier l'affaire à ${ctx.lexicon.delegate}`,
      detail: "Plus les camps te font confiance, mieux c'est exécuté.",
      chance: pDelegate,
      tone: "special",
      resolve: () => {
        const ok = Math.random() < pDelegate;
        const c = ok ? best : worst;
        const e = authoredEffect(c, ctx);
        return withTrace(
          { ...e, a: e.a + (ok ? 2 : -1), r: e.r + (ok ? 0 : 4), text: `${ok ? `${ctx.lexicon.delegate} gère ça à merveille.` : `${ctx.lexicon.delegate} se plante en beauté.`} ${c.outcome}`, success: ok },
          event.title
        );
      },
    });

    const top = topFaction(state, ctx);
    const topConf = state.factions[top.id] ?? 50;
    options.push({
      key: "leverage",
      emoji: "🤝",
      label: `Faire jouer tes relations — ${top.label}`,
      detail: "Ils règlent ça en coulisses… et viendront réclamer leur dû.",
      locked: topConf < 60 ? `Il faut un camp à 60+ de confiance (meilleur : ${top.short} ${topConf})` : undefined,
      tone: "special",
      resolve: () => {
        const e = authoredEffect(safest, ctx);
        return {
          ...e,
          r: e.r - 5,
          factions: { ...e.factions, [top.id]: (e.factions[top.id] ?? 0) - 8 },
          text: `${top.label} arrange les choses en coulisses. ${safest.outcome}`,
          flags: [`favor:${top.id}`],
          success: true,
        };
      },
    });
  }

  options.push(gambleOption(state, ctx));
  return options;
}

// ============================================================================
// Interludes — consequences that come back at the start of a season. At most two per season,
// most pressing first.
// ============================================================================

export interface Interlude {
  id: string;
  emoji: string;
  title: string;
  description: string;
  options: RpOption[];
}

export function seasonInterludes(state: RpState, ctx: Ctx): Interlude[] {
  const out: Interlude[] = [];
  const top = topFaction(state, ctx);
  const low = lowFaction(state, ctx);
  const u = ctx.mUnit;

  const scandal = state.flags.find((f) => f.startsWith("scandal:"));
  if (scandal) {
    const title = scandal.slice("scandal:".length);
    const hush = Math.round(u * 2.5);
    out.push({
      id: scandal,
      emoji: "🗞️",
      title: `Retour de flamme : ${title}`,
      description: `L'affaire « ${title} » refait surface. Quelqu'un a gardé des preuves et compte bien s'en servir.`,
      options: [
        { key: "own", emoji: "🎙️", label: "Assumer publiquement", detail: "Ça écorne ton image, mais ça coupe court.", tone: "authored", resolve: () => ({ a: -4, r: -6, m: 0, factions: factionReactions(ctx.factions, { a: -4, r: -6 }), text: "Tu montes au créneau. Les gens retiennent surtout que tu n'as pas fui.", consume: [scandal], success: true }) },
        { key: "hush", emoji: "💼", label: "Étouffer l'affaire", detail: `Coûte ${fmtM(hush)}`, locked: costLock(hush, state, ctx), tone: "authored", resolve: () => ({ a: 0, r: -12, m: -hush, factions: {}, text: "Les preuves disparaissent, les témoins ont soudain la mémoire courte.", consume: [scandal], success: true }) },
        { key: "blame", emoji: "🎯", label: `Faire porter le chapeau à ${low.label}`, detail: "Efficace. Ils ne l'oublieront jamais.", tone: "authored", resolve: () => ({ a: 2, r: -9, m: 0, factions: { [low.id]: -18 }, text: `${low.label} devient le coupable idéal. L'orage passe — loin de toi.`, consume: [scandal], success: true }) },
        { ...gambleOption(state, ctx, "scandal-gamble"), resolve: () => ({ ...gambleOption(state, ctx).resolve(), consume: [scandal] }) },
      ],
    });
  }

  const favor = state.flags.find((f) => f.startsWith("favor:"));
  if (favor) {
    const f = ctx.factions.find((x) => x.id === favor.slice("favor:".length))!;
    const conf = state.factions[f.id] ?? 50;
    const repay = Math.round(u * 1.5);
    const p = clamp(conf / 100, 0.15, 0.9);
    out.push({
      id: favor,
      emoji: "📨",
      title: `${f.label} réclame son dû`,
      description: `Tu leur dois un service depuis la dernière fois. Ils viennent poliment, mais fermement, demander un retour.`,
      options: [
        { key: "repay", emoji: "🤲", label: "Rendre la pareille", detail: `Coûte ${fmtM(repay)}`, locked: costLock(repay, state, ctx), tone: "authored", resolve: () => ({ a: 1, r: 0, m: -repay, factions: { [f.id]: 12 }, text: `${f.label} apprécie. Une alliance solide se dessine.`, consume: [favor], success: true }) },
        { key: "refuse", emoji: "✋", label: "Refuser poliment", detail: "Gratuit. Pour l'instant.", tone: "authored", resolve: () => ({ a: 0, r: 4, m: 0, factions: { [f.id]: -20 }, text: `${f.label} encaisse le refus. Froidement.`, consume: [favor], success: false }) },
        {
          key: "negotiate",
          emoji: "⚖️",
          label: "Négocier un service plus modeste",
          chance: p,
          tone: "risky",
          resolve: () =>
            Math.random() < p
              ? { a: 2, r: 0, m: -Math.round(u * 0.5), factions: { [f.id]: 5 }, text: "Compromis trouvé, tout le monde repart satisfait.", consume: [favor], success: true }
              : { a: -2, r: 2, m: 0, factions: { [f.id]: -12 }, text: "Ils prennent ta contre-offre pour une insulte.", consume: [favor], success: false },
        },
      ],
    });
  }

  const lowConf = state.factions[low.id] ?? 50;
  if (out.length < 2 && lowConf <= 20) {
    const concession = Math.round(u * 2);
    const pTop = clamp((state.factions[top.id] ?? 50) / 100, 0.15, 0.9);
    out.push({
      id: `ultimatum:${low.id}`,
      emoji: "⚠️",
      title: `Ultimatum de ${low.label}`,
      description: `${low.label} est à bout. Soit les choses changent, soit ils passent à l'action contre toi.`,
      options: [
        { key: "concede", emoji: "🕊️", label: "Faire une vraie concession", detail: `Coûte ${fmtM(concession)}`, locked: costLock(concession, state, ctx), tone: "authored", resolve: () => ({ a: -2, r: -3, m: -concession, factions: { [low.id]: 25 }, text: "Le geste est apprécié. La tension retombe d'un cran.", success: true }) },
        { key: "firm", emoji: "🧱", label: "Rester ferme", detail: "Tu gagnes en autorité, ils deviennent dangereux.", tone: "authored", resolve: () => ({ a: 5, r: 8, m: 0, factions: { [low.id]: -10 }, text: `Tu ne plies pas. ${low.label} commence à parler à qui veut l'entendre.`, success: false }) },
        {
          key: "mediate",
          emoji: "🧩",
          label: `Demander à ${top.label} de servir de médiateur`,
          chance: pTop,
          tone: "risky",
          resolve: () =>
            Math.random() < pTop
              ? { a: 2, r: -2, m: 0, factions: { [low.id]: 15, [top.id]: -5 }, text: "La médiation fonctionne. Tout le monde sauve la face.", success: true }
              : { a: -2, r: 6, m: 0, factions: { [top.id]: -5 }, text: "La médiation tourne au règlement de comptes.", success: false },
        },
      ],
    });
  }

  const topConf = state.factions[top.id] ?? 50;
  const patronKey = `patron:${top.id}`;
  if (out.length < 2 && topConf >= 85 && !state.flags.includes(patronKey)) {
    const gift = Math.round(u * 2);
    out.push({
      id: patronKey,
      emoji: "👑",
      title: `${top.label} te propose son soutien`,
      description: `Ta cote est au sommet auprès de ${top.label}. Ils te proposent un coup de pouce — choisis lequel.`,
      options: [
        { key: "money", emoji: "💰", label: "Un soutien financier", detail: `+${fmtM(gift)}`, tone: "authored", resolve: () => ({ a: 0, r: 0, m: gift, factions: { [top.id]: -10 }, text: "Une enveloppe généreuse arrive sans un mot.", flags: [patronKey], success: true }) },
        { key: "shield", emoji: "🛡️", label: "Une protection", detail: "Fait nettement retomber la pression.", tone: "authored", resolve: () => ({ a: 0, r: -15, m: 0, factions: { [top.id]: -10 }, text: "Des portes se ferment devant ceux qui s'intéressaient de trop près à toi.", flags: [patronKey], success: true }) },
        { key: "power", emoji: "📣", label: "Une démonstration de force", detail: "Ton aura grimpe.", tone: "authored", resolve: () => ({ a: 10, r: 3, m: 0, factions: { [top.id]: -10 }, text: "Tout le monde voit qui te soutient. Personne ne l'oubliera.", flags: [patronKey], success: true }) },
      ],
    });
  }

  return out.slice(0, 2);
}

// ============================================================================
// Epilogue
// ============================================================================

export function factionVerdict(v: number): { text: string; tone: "good" | "neutral" | "bad" } {
  if (v >= 75) return { text: "te voue une loyauté totale", tone: "good" };
  if (v >= 60) return { text: "te fait confiance", tone: "good" };
  if (v >= 40) return { text: "reste sur la réserve", tone: "neutral" };
  if (v >= 25) return { text: "se méfie de toi", tone: "bad" };
  return { text: "attend ta chute", tone: "bad" };
}

export function dominantStance(stances: Stance[], counts: Record<string, number>): Stance | null {
  const total = Object.values(counts).reduce((s, x) => s + x, 0);
  if (total === 0) return null;
  return stances.reduce((best, s) => ((counts[s.id] ?? 0) > (counts[best.id] ?? 0) ? s : best));
}
