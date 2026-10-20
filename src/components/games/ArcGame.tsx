import { useEffect, useMemo, useRef, useState, type ComponentType, type SVGProps } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useCasinoStore, type HistoryEntry } from "../../store/casinoStore";
import { useToastStore } from "../../store/toastStore";
import { useGameStatusStore } from "../../store/gameStatusStore";
import { useAuthStore } from "../../store/authStore";
import { supabase } from "../../lib/supabase";
import { Card } from "../ui/Card";
import { Button } from "../ui/Button";
import { Badge } from "../ui/Badge";
import { ProgressBar } from "../ui/ProgressBar";
import { StatTile } from "../ui/StatTile";
import { RoomChat } from "../ui/RoomChat";
import { WinCelebration } from "../ui/WinCelebration";
import { LockedGame } from "./GameTile";
import { formatCredits, cn } from "../../lib/format";
import { xpForPayout } from "../../lib/xp";
import { tierFromMultiplier, type WinTier } from "../../lib/winTiers";
import { playSound } from "../../lib/sounds";
import {
  applyEffect, avgConfidence, buildEventOptions, dominantStance, factionVerdict, resolveStance, seasonInterludes, stanceLocked,
  type ArcFaction, type Ctx, type Effect, type Interlude, type Lexicon, type RpEvent, type RpOption, type RpState, type Stance,
} from "../../lib/rpEngine";

// ============================================================================
// One engine for every mandate arc: each arc page only supplies an ArcConfig (its content, its
// labels and how its engine names things). All the role-play depth lives here and in rpEngine.ts.
// ============================================================================

export interface ArcItem {
  id: string;
  label: string;
  glyph: string;
  accent: string;
  tier: number;
}

export interface ArcDrive {
  id: string;
  label: string;
  pool: string;
}

export interface ArcConfig {
  gameId: string;
  historyGame: HistoryEntry["game"];
  title: string;
  tagline: string;
  icon: ComponentType<SVGProps<SVGSVGElement>>;
  playTab: string;
  intro: string;
  unlockAt: number;
  lockedTitle: string;
  entryCost: number;
  length: number;
  period: string; // "Saison", "Tour", "Année"
  start: { a: number; r: number };
  axes: { a: string; r: string; m: string; aShort: string; rShort: string };
  mUnit: number;
  mFloor: number;
  items: ArcItem[];
  drawItem: (bias: number) => ArcItem;
  decoyItem: () => ArcItem;
  factions: ArcFaction[];
  stances: Stance[];
  drives: { badge: string; counter: string; prompt: (d: ArcDrive) => string; forSeason: () => ArcDrive[] };
  events: () => RpEvent[];
  happening: { draw: (used: string[]) => { event: RpEvent; usedIds: string[] }; trigger: () => boolean };
  categoryLabel: Record<string, string>;
  chaos: () => Effect;
  lexicon: Lexicon;
  bribe: { label: string; cost: (item: ArcItem) => number; resolve: (bias: number) => { success: boolean; a: number; r: number; text: string } };
  raid: { surprise: () => boolean; resolve: (a: number, r: number, bias: number, avg: number) => { survived: boolean; narrative: string; rAfter: number } };
  outcome: (item: ArcItem, a: number, m: number, busted: boolean) => { payout: number; label: string };
  finale: { title: string; text: string; quiet: string; bold: string; resolve: (a: number, bias: number) => { payout: number; label: string; narrative: string } };
  recap: { glyph: string; aStat: string; mStat: string; bustedTitle: string };
  records: {
    table: string;
    insert: (item: ArcItem, a: number, m: number, busted: boolean, outcome: { payout: number; label: string }) => Record<string, unknown>;
    select: string;
    map: (row: any) => { itemLabel: string; detail: string; busted: boolean };
    empty: string;
    bustedBadge: string;
    okBadge: string;
  };
  chat: { table: string; title: string };
}

const ITEM_WIDTH = 128;
const ITEM_GAP = 8;
const TRACK_PAD = 8;
const ITEM_STEP = ITEM_WIDTH + ITEM_GAP;
const REEL_LENGTH = 60;
const WINNING_INDEX = 50;
const SPIN_DURATION = 5.5;
const RAID_THRESHOLD = 75;

type View = "play" | "palmares" | "salon";
type Phase = "idle" | "spinning" | "drives" | "happening" | "interlude" | "event" | "farewell" | "recap";

interface Mandate {
  item: ArcItem;
  turn: number;
  rp: RpState;
  events: RpEvent[];
  drives: ArcDrive[];
  driveIndex: number;
  usedHappeningIds: string[];
  interludes: Interlude[];
}

interface RoundResult {
  item: ArcItem;
  a: number;
  m: number;
  payout: number;
  label: string;
  busted: boolean;
  rp: RpState | null;
}

interface Outcome {
  text: string;
  effect: Effect;
}

function ReelTile({ item }: { item: ArcItem }) {
  return (
    <div className={cn("flex h-32 w-32 shrink-0 flex-col items-center justify-center gap-1 rounded-xl border-2 border-white/15 bg-gradient-to-br p-2 text-center", item.accent)}>
      <span className="text-4xl">{item.glyph}</span>
      <p className="text-[11px] font-semibold leading-tight text-white">{item.label}</p>
    </div>
  );
}

function DeltaChips({ effect, cfg }: { effect: Effect; cfg: ArcConfig }) {
  const chips: { text: string; good: boolean }[] = [];
  if (effect.a) chips.push({ text: `${effect.a > 0 ? "+" : ""}${effect.a} ${cfg.axes.aShort}`, good: effect.a > 0 });
  if (effect.r) chips.push({ text: `${effect.r > 0 ? "+" : ""}${effect.r} ${cfg.axes.rShort}`, good: effect.r < 0 });
  if (effect.m) chips.push({ text: `${effect.m > 0 ? "+" : "−"}${formatCredits(Math.abs(effect.m))}`, good: effect.m > 0 });
  for (const f of cfg.factions) {
    const d = effect.factions[f.id];
    if (d) chips.push({ text: `${d > 0 ? "+" : ""}${d} ${f.short}`, good: d > 0 });
  }
  if (chips.length === 0) return null;
  return (
    <div className="mt-3 flex flex-wrap gap-1.5">
      {chips.map((c, i) => (
        <motion.span
          key={i}
          initial={{ opacity: 0, y: 6, scale: 0.8 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ delay: 0.15 + i * 0.05 }}
          className={cn("rounded-full border px-2 py-0.5 text-[11px] font-bold", c.good ? "border-emerald-400/30 bg-emerald-500/10 text-emerald-300" : "border-red-400/30 bg-red-500/10 text-red-300")}
        >
          {c.text}
        </motion.span>
      ))}
    </div>
  );
}

function OutcomePanel({ outcome, cfg }: { outcome: Outcome; cfg: ArcConfig }) {
  return (
    <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} className="mt-4 rounded-xl border border-white/10 bg-white/[0.03] p-4">
      <p className="whitespace-pre-line text-sm text-ice-200/85">{outcome.text}</p>
      <DeltaChips effect={outcome.effect} cfg={cfg} />
    </motion.div>
  );
}

export function OptionList({ options, onPick, disabled }: { options: RpOption[]; onPick: (o: RpOption) => void; disabled: boolean }) {
  return (
    <div className="mt-5 grid gap-2">
      {options.map((o, i) => (
        <motion.button
          key={o.key}
          initial={{ opacity: 0, x: -10 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: i * 0.04 }}
          onClick={() => !o.locked && onPick(o)}
          disabled={disabled || !!o.locked}
          className={cn(
            "group flex w-full items-center gap-3 rounded-xl border px-3 py-2.5 text-left transition-colors disabled:cursor-not-allowed",
            o.locked
              ? "border-white/5 bg-white/[0.01] opacity-50"
              : o.tone === "special"
                ? "border-electric-400/30 bg-electric-500/[0.06] hover:border-electric-400/60 hover:bg-electric-500/10"
                : o.tone === "risky"
                  ? "border-gold-400/30 bg-gold-500/[0.05] hover:border-gold-400/60 hover:bg-gold-500/10"
                  : "border-white/10 bg-white/[0.03] hover:border-white/25 hover:bg-white/[0.06]"
          )}
        >
          <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-black/30 text-base">{o.locked ? "🔒" : o.emoji}</span>
          <span className="min-w-0 flex-1">
            <span className="block text-sm font-semibold text-white">{o.label}</span>
            {(o.locked || o.detail) && <span className="block text-[11px] text-ice-200/50">{o.locked ?? o.detail}</span>}
          </span>
          {o.chance !== undefined && !o.locked && (
            <span
              className={cn(
                "shrink-0 rounded-full px-2 py-0.5 text-[11px] font-black tabular-nums",
                o.chance >= 0.65 ? "bg-emerald-500/15 text-emerald-300" : o.chance >= 0.45 ? "bg-gold-500/15 text-gold-300" : "bg-red-500/15 text-red-300"
              )}
            >
              {Math.round(o.chance * 100)}%
            </span>
          )}
        </motion.button>
      ))}
    </div>
  );
}

export function ArcGame({ cfg }: { cfg: ArcConfig }) {
  const totalWon = useCasinoStore((s) => s.totalWon);
  const credits = useCasinoStore((s) => s.credits);
  const placeBet = useCasinoStore((s) => s.placeBet);
  const award = useCasinoStore((s) => s.award);
  const addXp = useCasinoStore((s) => s.addXp);
  const recordRound = useCasinoStore((s) => s.recordRound);
  const push = useToastStore((s) => s.push);
  const winBias = useGameStatusStore((s) => s.statuses[cfg.gameId]?.winBias ?? 1);
  const account = useAuthStore((s) => s.account);

  const [view, setView] = useState<View>("play");
  const [phase, setPhase] = useState<Phase>("idle");
  const [reel, setReel] = useState<ArcItem[]>(() => Array.from({ length: 10 }, cfg.decoyItem));
  const [offset, setOffset] = useState(0);
  const [spinning, setSpinning] = useState(false);
  const [mandate, setMandate] = useState<Mandate | null>(null);
  const [resolving, setResolving] = useState(false);
  const [outcome, setOutcome] = useState<Outcome | null>(null);
  const [chaosActive, setChaosActive] = useState(false);
  const [happening, setHappening] = useState<RpEvent | null>(null);
  const [coinFlipping, setCoinFlipping] = useState(false);
  const [celebration, setCelebration] = useState<{ tier: WinTier; payout: number } | null>(null);
  const [result, setResult] = useState<RoundResult | null>(null);
  const trackRef = useRef<HTMLDivElement>(null);
  const pendingWinnerRef = useRef<ArcItem | null>(null);

  const ctx: Ctx = useMemo(() => ({ factions: cfg.factions, mUnit: cfg.mUnit, mFloor: cfg.mFloor, lexicon: cfg.lexicon, chaos: cfg.chaos }), [cfg]);
  const unlocked = totalWon >= cfg.unlockAt;

  const event = mandate && phase === "event" ? mandate.events[mandate.turn] : null;
  const interlude = mandate && phase === "interlude" ? mandate.interludes[0] : null;

  // Options are built once per decision point — their odds reflect the state at that moment.
  const eventOptions = useMemo(() => (event && mandate ? buildEventOptions(event, mandate.rp, ctx) : []), [event?.id, mandate?.turn, phase]); // eslint-disable-line react-hooks/exhaustive-deps
  const happeningOptions = useMemo(() => (happening && mandate ? buildEventOptions(happening, mandate.rp, ctx) : []), [happening?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  function finalizeRound(item: ArcItem, rp: RpState | null, busted: boolean, out: { payout: number; label: string }) {
    const a = rp?.a ?? 0;
    const m = rp?.m ?? 0;
    award(out.payout);
    addXp(xpForPayout(out.payout));
    const tier = tierFromMultiplier(out.payout / cfg.entryCost);
    recordRound({ game: cfg.historyGame, label: `${item.label} — ${out.label}`, bet: cfg.entryCost, payout: out.payout, tier });
    if (tier === "megaWin" || tier === "gigaWin" || tier === "maxWin") setCelebration({ tier, payout: out.payout });
    else push({ kind: "success", title: `+${formatCredits(out.payout)} crédits` });
    if (account) supabase.from(cfg.records.table).insert({ user_id: account.id, ...cfg.records.insert(item, a, m, busted, out) }).then(undefined, () => {});
    setResult({ item, a, m, payout: out.payout, label: out.label, busted, rp });
    setMandate(null);
    setOutcome(null);
    setResolving(false);
    setPhase("recap");
  }

  function begin(item: ArcItem) {
    setSpinning(false);
    if (item.tier === 0) {
      finalizeRound(item, null, false, cfg.outcome(item, 0, 0, false));
      return;
    }
    setMandate({
      item,
      turn: 0,
      rp: {
        a: cfg.start.a,
        r: cfg.start.r,
        m: 0,
        factions: Object.fromEntries(cfg.factions.map((f) => [f.id, 50])),
        flags: [],
        journal: [],
        stanceCounts: {},
      },
      events: cfg.events(),
      drives: cfg.drives.forSeason(),
      driveIndex: 0,
      usedHappeningIds: [],
      interludes: [],
    });
    setPhase("drives");
  }

  function spin() {
    if (spinning || credits < cfg.entryCost) {
      if (credits < cfg.entryCost) push({ kind: "info", title: "Crédits insuffisants" });
      return;
    }
    placeBet(cfg.entryCost);
    setResult(null);
    setCelebration(null);
    const winner = cfg.drawItem(winBias);
    pendingWinnerRef.current = winner;
    setReel(Array.from({ length: REEL_LENGTH }, (_, i) => (i === WINNING_INDEX ? winner : cfg.decoyItem())));
    setOffset(0);
    setSpinning(true);
    setPhase("spinning");
  }

  useEffect(() => {
    if (phase !== "spinning") return;
    const winner = pendingWinnerRef.current;
    if (!winner) return;
    const containerWidth = trackRef.current?.parentElement?.getBoundingClientRect().width ?? 320;
    const jitter = (Math.random() - 0.5) * (ITEM_WIDTH * 0.6);
    const target = -(TRACK_PAD + WINNING_INDEX * ITEM_STEP + ITEM_WIDTH / 2 - containerWidth / 2) + jitter;
    const raf = requestAnimationFrame(() => setOffset(target));
    const timer = setTimeout(() => begin(winner), SPIN_DURATION * 1000);
    return () => {
      cancelAnimationFrame(raf);
      clearTimeout(timer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase]);

  // Applies an effect, checks for a raid, shows the outcome, then hands over to `next`.
  function commit(m: Mandate, effect: Effect, journalTitle: string | null, choiceLabel: string, next: (m: Mandate) => void, forceRaid = false) {
    let rp = applyEffect(m.rp, effect);
    if (journalTitle) rp = { ...rp, journal: [...rp.journal, { turn: m.turn + 1, title: journalTitle, choice: choiceLabel, good: effect.success ?? effect.a >= effect.r }] };
    let text = effect.text;
    let busted = false;
    if (rp.r >= RAID_THRESHOLD || forceRaid) {
      const raid = cfg.raid.resolve(rp.a, rp.r, winBias, avgConfidence(rp.factions));
      text += `\n\n🚨 ${raid.narrative}`;
      if (raid.survived) rp = { ...rp, r: raid.rAfter };
      else busted = true;
    }
    if (effect.chaos) {
      setChaosActive(true);
      setTimeout(() => setChaosActive(false), 2400);
    }
    playSound(busted ? "boom" : effect.success === false ? "tick" : "chip");
    setResolving(true);
    setOutcome({ text, effect });
    const carried = { ...m, rp };
    setTimeout(
      () => {
        setOutcome(null);
        setResolving(false);
        if (busted) finalizeRound(m.item, rp, true, cfg.outcome(m.item, rp.a, rp.m, true));
        else next(carried);
      },
      text.includes("🚨") ? 3400 : 1900
    );
  }

  function endSeasonDrives(m: Mandate) {
    const interludes = seasonInterludes(m.rp, ctx);
    setMandate({ ...m, interludes });
    setPhase(interludes.length > 0 ? "interlude" : "event");
  }

  function runDrive(stance: Stance) {
    if (!mandate || resolving) return;
    const drive = mandate.drives[mandate.driveIndex];
    const eff = resolveStance(stance, drive.pool, ctx, winBias);
    const withCount = { ...mandate, rp: { ...mandate.rp, stanceCounts: { ...mandate.rp.stanceCounts, [stance.id]: (mandate.rp.stanceCounts[stance.id] ?? 0) + 1 } } };
    commit(
      withCount,
      { ...eff, text: `${stance.emoji} ${drive.label} — ${eff.text}` },
      null,
      stance.label,
      (m) => {
        const nextIndex = m.driveIndex + 1;
        if (nextIndex >= m.drives.length) return endSeasonDrives(m);
        let used = m.usedHappeningIds;
        if (cfg.happening.trigger()) {
          const picked = cfg.happening.draw(used);
          used = picked.usedIds;
          setHappening(picked.event);
          setMandate({ ...m, driveIndex: nextIndex, usedHappeningIds: used });
          setPhase("happening");
          return;
        }
        setMandate({ ...m, driveIndex: nextIndex, usedHappeningIds: used });
      },
      cfg.raid.surprise()
    );
  }

  function flipCoin() {
    if (!mandate || resolving || coinFlipping) return;
    const usable = cfg.stances.filter((s) => !stanceLocked(s, mandate.rp, ctx));
    setCoinFlipping(true);
    setTimeout(() => {
      setCoinFlipping(false);
      runDrive(usable[Math.floor(Math.random() * usable.length)]);
    }, 1400);
  }

  function pickHappening(o: RpOption) {
    if (!mandate || !happening || resolving) return;
    commit(mandate, o.resolve(), null, o.label, (m) => {
      setHappening(null);
      setMandate(m);
      setPhase("drives");
    });
  }

  function pickInterlude(o: RpOption) {
    if (!mandate || !interlude || resolving) return;
    commit(mandate, o.resolve(), interlude.title, o.label, (m) => {
      const rest = m.interludes.slice(1);
      setMandate({ ...m, interludes: rest });
      setPhase(rest.length > 0 ? "interlude" : "event");
    });
  }

  function afterEvent(m: Mandate) {
    const nextTurn = m.turn + 1;
    if (nextTurn >= cfg.length) {
      setMandate({ ...m, turn: nextTurn });
      setPhase("farewell");
    } else {
      setMandate({ ...m, turn: nextTurn, drives: cfg.drives.forSeason(), driveIndex: 0 });
      setPhase("drives");
    }
  }

  function pickEvent(o: RpOption) {
    if (!mandate || !event || resolving) return;
    commit(mandate, o.resolve(), event.title, o.label, afterEvent);
  }

  function bribe() {
    if (!mandate || !event || resolving) return;
    const cost = cfg.bribe.cost(mandate.item);
    if (credits < cost) {
      push({ kind: "info", title: "Crédits insuffisants" });
      return;
    }
    placeBet(cost);
    const r = cfg.bribe.resolve(winBias);
    push({ kind: r.success ? "success" : "info", title: r.success ? "Marché conclu" : "Le marché a fuité" });
    commit(mandate, { a: r.a, r: r.r, m: 0, factions: {}, text: r.text, success: r.success }, event.title, "💰 Pot-de-vin", afterEvent);
  }

  function endQuietly() {
    if (!mandate) return;
    finalizeRound(mandate.item, mandate.rp, false, cfg.outcome(mandate.item, mandate.rp.a, mandate.rp.m, false));
  }

  function goBold() {
    if (!mandate || resolving) return;
    const r = cfg.finale.resolve(mandate.rp.a, winBias);
    setResolving(true);
    setOutcome({ text: r.narrative, effect: { a: 0, r: 0, m: 0, factions: {}, text: "" } });
    setTimeout(() => finalizeRound(mandate.item, mandate.rp, false, { payout: r.payout, label: r.label }), 2600);
  }

  if (!unlocked) return <LockedGame gameId={cfg.gameId} title={cfg.lockedTitle} totalWon={totalWon} unlockAt={cfg.unlockAt} />;

  const drive = mandate?.drives[mandate.driveIndex] ?? null;
  const Icon = cfg.icon;

  return (
    <div className="mx-auto max-w-4xl px-4 py-8 sm:px-6">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-2">
          <Icon className="h-6 w-6 text-gold-400" />
          <div>
            <h1 className="font-display text-2xl font-bold text-white sm:text-3xl">{cfg.title}</h1>
            <p className="text-sm text-ice-200/60">{cfg.tagline}</p>
          </div>
        </div>
        <div className="flex items-center gap-1 rounded-xl border border-white/10 bg-white/[0.03] p-1">
          {(["play", "palmares", "salon"] as View[]).map((v) => (
            <button key={v} onClick={() => setView(v)} className={cn("rounded-lg px-3 py-1.5 text-xs font-semibold", view === v ? "bg-electric-500 text-white" : "text-ice-200/60")}>
              {v === "play" ? cfg.playTab : v === "palmares" ? "Palmarès" : "Salon"}
            </button>
          ))}
        </div>
      </div>

      {view === "play" && (
        <motion.div
          animate={chaosActive ? { filter: ["hue-rotate(0deg) saturate(1)", "hue-rotate(210deg) saturate(2.6)", "hue-rotate(330deg) saturate(2.2)", "hue-rotate(0deg) saturate(1)"] } : { filter: "hue-rotate(0deg) saturate(1)" }}
          transition={chaosActive ? { duration: 2.2, ease: "easeInOut" } : { duration: 0.4 }}
        >
          {phase === "idle" && (
            <Card className="p-4 text-center sm:p-6" glow>
              <div className="mx-auto flex max-w-md flex-wrap justify-center gap-1.5">
                {cfg.items.map((t) => (
                  <span key={t.id} className="text-xl" title={t.label}>{t.glyph}</span>
                ))}
              </div>
              <p className="mt-4 text-sm text-ice-200/60">{cfg.intro}</p>
              <div className="mx-auto mt-5 grid max-w-xl grid-cols-2 gap-2 text-left sm:grid-cols-4">
                {cfg.stances.map((s) => (
                  <div key={s.id} className="rounded-xl border border-white/10 bg-white/[0.03] p-2.5">
                    <p className="text-lg">{s.emoji}</p>
                    <p className="text-xs font-bold text-white">{s.label}</p>
                    <p className="text-[10px] text-ice-200/50">{s.blurb}</p>
                  </div>
                ))}
              </div>
              <div className="mt-6 flex justify-center">
                <Button size="lg" onClick={spin} disabled={spinning || credits < cfg.entryCost}>
                  Tourner la roulette — {formatCredits(cfg.entryCost)}
                </Button>
              </div>
            </Card>
          )}

          {phase === "spinning" && (
            <Card className="p-4 sm:p-6" glow>
              <div className="relative mx-auto w-full max-w-2xl overflow-hidden rounded-2xl border border-white/10 bg-ink-950/60 py-4">
                <div className="pointer-events-none absolute inset-y-0 left-1/2 z-10 w-0.5 -translate-x-1/2 bg-gold-400 shadow-glow-gold" />
                <div ref={trackRef} className="flex gap-2 px-2" style={{ transform: `translateX(${offset}px)`, transition: `transform ${SPIN_DURATION}s cubic-bezier(0.15, 0.85, 0.2, 1)` }}>
                  {reel.map((t, i) => (
                    <ReelTile key={i} item={t} />
                  ))}
                </div>
              </div>
            </Card>
          )}

          {mandate && (phase === "drives" || phase === "happening" || phase === "interlude" || phase === "event" || phase === "farewell") && (
            <div className="flex flex-col gap-4">
              <Card className="p-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="flex items-center gap-2">
                    <span className="text-2xl">{mandate.item.glyph}</span>
                    <div>
                      <p className="text-sm font-semibold text-white">{mandate.item.label}</p>
                      <p className="text-xs text-ice-200/40">
                        {cfg.period} {Math.min(mandate.turn + 1, cfg.length)}/{cfg.length}
                      </p>
                    </div>
                  </div>
                  <div className="flex flex-wrap items-center gap-4">
                    <div className="w-28 sm:w-32">
                      <p className="mb-1 text-[10px] uppercase tracking-wide text-ice-200/40">{cfg.axes.a} · {mandate.rp.a}</p>
                      <ProgressBar value={mandate.rp.a} max={100} />
                    </div>
                    <div className="w-28 sm:w-32">
                      <p className="mb-1 text-[10px] uppercase tracking-wide text-ice-200/40">{cfg.axes.r} · {mandate.rp.r}</p>
                      <ProgressBar value={mandate.rp.r} max={100} barClassName={mandate.rp.r >= RAID_THRESHOLD ? "!bg-none !bg-red-500" : mandate.rp.r >= 45 ? "!bg-none !bg-gold-400" : undefined} />
                    </div>
                    <div className="text-right">
                      <p className="text-[10px] uppercase tracking-wide text-ice-200/40">{cfg.axes.m}</p>
                      <p className={cn("font-display text-sm font-bold", mandate.rp.m >= 0 ? "text-emerald-400" : "text-red-400")}>{formatCredits(mandate.rp.m)}</p>
                    </div>
                  </div>
                </div>
                <div className="mt-3 grid grid-cols-5 gap-1.5 border-t border-white/10 pt-3">
                  {cfg.factions.map((f) => {
                    const v = mandate.rp.factions[f.id] ?? 50;
                    return (
                      <div key={f.id} title={`${f.label} — ${factionVerdict(v).text}`} className="min-w-0">
                        <div className="flex items-baseline justify-between gap-1">
                          <span className="truncate text-[10px] font-semibold text-ice-200/60">{f.short}</span>
                          <span className={cn("text-[10px] font-black tabular-nums", v >= 60 ? "text-emerald-300" : v <= 30 ? "text-red-300" : "text-ice-200/60")}>{v}</span>
                        </div>
                        <div className="mt-0.5 h-1 overflow-hidden rounded-full bg-white/10">
                          <motion.div className={cn("h-full rounded-full", v >= 60 ? "bg-emerald-400" : v <= 30 ? "bg-red-400" : "bg-ice-200/50")} animate={{ width: `${v}%` }} />
                        </div>
                      </div>
                    );
                  })}
                </div>
                {mandate.rp.flags.some((f) => f.startsWith("scandal:") || f.startsWith("favor:")) && (
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {mandate.rp.flags.filter((f) => f.startsWith("scandal:")).map((f) => (
                      <span key={f} className="rounded-full border border-red-400/30 bg-red-500/10 px-2 py-0.5 text-[10px] text-red-300">🗞️ {f.slice(8)}</span>
                    ))}
                    {mandate.rp.flags.filter((f) => f.startsWith("favor:")).map((f) => (
                      <span key={f} className="rounded-full border border-gold-400/30 bg-gold-500/10 px-2 py-0.5 text-[10px] text-gold-300">
                        📨 Dette envers {cfg.factions.find((x) => x.id === f.slice(6))?.short}
                      </span>
                    ))}
                  </div>
                )}
              </Card>

              <AnimatePresence mode="wait">
                {phase === "drives" && drive && (
                  <motion.div key={`d-${mandate.turn}-${mandate.driveIndex}`} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}>
                    <Card className="p-4 sm:p-6" glow>
                      <div className="mb-3 flex items-center justify-between gap-2">
                        <Badge tone="success">{cfg.drives.badge}</Badge>
                        <span className="text-xs text-ice-200/40">
                          {cfg.drives.counter} {mandate.driveIndex + 1}/{mandate.drives.length}
                        </span>
                      </div>
                      <h2 className="font-display text-lg font-bold text-white">{drive.label}</h2>
                      <p className="mt-2 text-sm text-ice-200/70">{cfg.drives.prompt(drive)}</p>

                      {outcome ? (
                        <OutcomePanel outcome={outcome} cfg={cfg} />
                      ) : coinFlipping ? (
                        <div className="mt-5 flex flex-col items-center gap-2 py-4">
                          <motion.span className="text-5xl" animate={{ rotateY: [0, 360, 720, 1080] }} transition={{ duration: 1.4, ease: "easeInOut" }}>
                            🪙
                          </motion.span>
                          <p className="text-xs text-ice-200/50">Le destin choisit pour toi...</p>
                        </div>
                      ) : (
                        <div className="mt-5 flex flex-col gap-2">
                          <div className="grid grid-cols-2 gap-2">
                            {cfg.stances.map((s) => {
                              const locked = stanceLocked(s, mandate.rp, ctx);
                              return (
                                <button
                                  key={s.id}
                                  onClick={() => runDrive(s)}
                                  disabled={resolving || !!locked}
                                  className="flex flex-col items-start gap-0.5 rounded-xl border border-white/10 bg-white/[0.03] p-3 text-left transition-colors hover:border-electric-400/50 hover:bg-electric-500/10 disabled:cursor-not-allowed disabled:opacity-40"
                                >
                                  <span className="flex w-full items-center justify-between">
                                    <span className="text-xl">{s.emoji}</span>
                                    <span className="text-[10px] font-black text-ice-200/50">{Math.round(s.success * 100)}%</span>
                                  </span>
                                  <span className="text-sm font-bold text-white">{s.label}</span>
                                  <span className="text-[11px] leading-snug text-ice-200/50">{locked ?? s.blurb}</span>
                                </button>
                              );
                            })}
                          </div>
                          <Button variant="ghost" size="sm" onClick={flipCoin} disabled={resolving} className="w-full text-ice-200/50">
                            🪙 Laisser le destin choisir
                          </Button>
                        </div>
                      )}
                    </Card>
                  </motion.div>
                )}

                {phase === "happening" && happening && (
                  <motion.div key={`h-${happening.id}`} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}>
                    <Card className="p-4 sm:p-6" glow>
                      <Badge tone="electric">{cfg.categoryLabel[happening.category] ?? happening.category}</Badge>
                      <h2 className="mt-3 font-display text-lg font-bold text-white">{happening.title}</h2>
                      <p className="mt-2 text-sm text-ice-200/70">{happening.description}</p>
                      {outcome ? <OutcomePanel outcome={outcome} cfg={cfg} /> : <OptionList options={happeningOptions} onPick={pickHappening} disabled={resolving} />}
                    </Card>
                  </motion.div>
                )}

                {phase === "interlude" && interlude && (
                  <motion.div key={`i-${interlude.id}`} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}>
                    <Card className="border-gold-400/30 p-4 sm:p-6" glow>
                      <Badge tone="gold">Conséquence</Badge>
                      <h2 className="mt-3 font-display text-lg font-bold text-white">
                        {interlude.emoji} {interlude.title}
                      </h2>
                      <p className="mt-2 text-sm text-ice-200/70">{interlude.description}</p>
                      {outcome ? <OutcomePanel outcome={outcome} cfg={cfg} /> : <OptionList options={interlude.options} onPick={pickInterlude} disabled={resolving} />}
                    </Card>
                  </motion.div>
                )}

                {phase === "event" && event && (
                  <motion.div key={`e-${event.id}`} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}>
                    <Card className="p-4 sm:p-6" glow>
                      <div className="flex items-center gap-2">
                        <Badge tone="neutral">{cfg.categoryLabel[event.category] ?? event.category}</Badge>
                        <span className="text-[11px] text-ice-200/40">Grand événement de la {cfg.period.toLowerCase()}</span>
                      </div>
                      <h2 className="mt-3 font-display text-lg font-bold text-white">{event.title}</h2>
                      <p className="mt-2 text-sm text-ice-200/70">{event.description}</p>
                      {outcome ? (
                        <OutcomePanel outcome={outcome} cfg={cfg} />
                      ) : (
                        <>
                          <OptionList options={eventOptions} onPick={pickEvent} disabled={resolving} />
                          <Button variant="gold" onClick={bribe} disabled={resolving || credits < cfg.bribe.cost(mandate.item)} className="mt-2 w-full">
                            💰 {cfg.bribe.label} — {formatCredits(cfg.bribe.cost(mandate.item))}
                          </Button>
                        </>
                      )}
                    </Card>
                  </motion.div>
                )}

                {phase === "farewell" && (
                  <motion.div key="farewell" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
                    <Card className="p-4 text-center sm:p-6" glow>
                      <span className="text-4xl">🏁</span>
                      <h2 className="mt-3 font-display text-lg font-bold text-white">{cfg.finale.title}</h2>
                      <p className="mt-2 text-sm text-ice-200/70">{cfg.finale.text}</p>
                      {outcome ? (
                        <OutcomePanel outcome={outcome} cfg={cfg} />
                      ) : (
                        <div className="mx-auto mt-5 flex max-w-sm flex-col gap-2">
                          <Button variant="secondary" onClick={endQuietly} disabled={resolving} className="w-full">
                            {cfg.finale.quiet}
                          </Button>
                          <Button variant="gold" onClick={goBold} disabled={resolving} className="w-full">
                            {cfg.finale.bold}
                          </Button>
                        </div>
                      )}
                    </Card>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          )}

          {phase === "recap" && result && <Recap result={result} cfg={cfg} onAgain={() => { setPhase("idle"); setResult(null); }} />}
        </motion.div>
      )}

      {view === "palmares" && <Palmares cfg={cfg} />}
      {view === "salon" && <RoomChat table={cfg.chat.table} title={cfg.chat.title} />}

      <WinCelebration tier={celebration?.tier ?? "none"} payout={celebration?.payout ?? 0} onClose={() => setCelebration(null)} game={cfg.title} />
    </div>
  );
}

function Recap({ result, cfg, onAgain }: { result: RoundResult; cfg: ArcConfig; onAgain: () => void }) {
  const rp = result.rp;
  const style = rp ? dominantStance(cfg.stances, rp.stanceCounts) : null;
  const totalStances = rp ? Object.values(rp.stanceCounts).reduce((s, x) => s + x, 0) : 0;
  return (
    <Card className="p-4 sm:p-6" glow>
      <div className="text-center">
        <motion.span className="inline-block text-5xl" initial={{ scale: 0, rotate: -20 }} animate={{ scale: 1, rotate: 0 }} transition={{ type: "spring", stiffness: 200, damping: 12 }}>
          {result.busted ? "🚨" : result.item.tier === 0 ? "🚫" : cfg.recap.glyph}
        </motion.span>
        {style && !result.busted && <p className="mt-3 text-xs font-bold uppercase tracking-[0.25em] text-gold-300/80">{style.ending}</p>}
        <h2 className="mt-1 font-display text-xl font-bold text-white">{result.busted ? cfg.recap.bustedTitle : result.label}</h2>
        <p className="mt-1 text-sm text-ice-200/60">{result.item.label}</p>
        {result.item.tier > 0 && (
          <div className="mx-auto mt-4 grid max-w-xs grid-cols-2 gap-2">
            <StatTile label={cfg.recap.aStat} value={`${result.a}/100`} />
            <StatTile label={cfg.recap.mStat} value={formatCredits(result.m)} />
          </div>
        )}
        <p className="mt-4 font-display text-3xl font-black text-gold-400">+{formatCredits(result.payout)}</p>
      </div>

      {rp && result.item.tier > 0 && (
        <div className="mt-6 grid gap-4 sm:grid-cols-2">
          <div className="rounded-xl border border-white/10 bg-white/[0.02] p-4">
            <p className="mb-3 text-[11px] font-bold uppercase tracking-wider text-ice-200/50">Ce qu'ils pensent de toi</p>
            <ul className="flex flex-col gap-2">
              {cfg.factions.map((f) => {
                const v = rp.factions[f.id] ?? 50;
                const verdict = factionVerdict(v);
                return (
                  <li key={f.id} className="flex items-center justify-between gap-2 text-xs">
                    <span className="text-ice-200/80">{f.label}</span>
                    <span className={cn("text-right font-semibold", verdict.tone === "good" ? "text-emerald-300" : verdict.tone === "bad" ? "text-red-300" : "text-ice-200/50")}>
                      {verdict.text}
                    </span>
                  </li>
                );
              })}
            </ul>
            {totalStances > 0 && (
              <>
                <p className="mb-2 mt-4 text-[11px] font-bold uppercase tracking-wider text-ice-200/50">Ton style</p>
                {cfg.stances.map((s) => {
                  const n = rp.stanceCounts[s.id] ?? 0;
                  return (
                    <div key={s.id} className="mb-1.5 flex items-center gap-2 text-[11px]">
                      <span className="w-28 shrink-0 truncate text-ice-200/70">{s.emoji} {s.label}</span>
                      <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-white/10">
                        <motion.div className="h-full rounded-full bg-gradient-to-r from-electric-500 to-gold-400" initial={{ width: 0 }} animate={{ width: `${(n / totalStances) * 100}%` }} transition={{ duration: 0.8 }} />
                      </div>
                      <span className="w-6 text-right tabular-nums text-ice-200/50">{n}</span>
                    </div>
                  );
                })}
              </>
            )}
          </div>
          <div className="rounded-xl border border-white/10 bg-white/[0.02] p-4">
            <p className="mb-3 text-[11px] font-bold uppercase tracking-wider text-ice-200/50">Journal</p>
            {rp.journal.length === 0 ? (
              <p className="text-xs text-ice-200/40">Aucune décision majeure.</p>
            ) : (
              <ol className="flex flex-col gap-2">
                {rp.journal.map((j, i) => (
                  <li key={i} className="flex gap-2 text-xs">
                    <span className="shrink-0 font-bold text-ice-200/40">{cfg.period[0]}{j.turn}</span>
                    <span className={j.good ? "text-emerald-400" : "text-red-400"}>●</span>
                    <span className="text-ice-200/80">
                      <span className="font-semibold text-white">{j.title}</span> — {j.choice}
                    </span>
                  </li>
                ))}
              </ol>
            )}
          </div>
        </div>
      )}

      <div className="mt-6 flex justify-center">
        <Button size="lg" onClick={onAgain}>Rejouer</Button>
      </div>
    </Card>
  );
}

function Palmares({ cfg }: { cfg: ArcConfig }) {
  const [records, setRecords] = useState<{ id: string; username: string; avatar: string; outcome: string; payout: number; itemLabel: string; detail: string; busted: boolean }[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    async function refresh() {
      const { data } = await supabase
        .from(cfg.records.table)
        .select(`id, outcome_label, payout, ${cfg.records.select}, profile:profiles(username, avatar)`)
        .order("payout", { ascending: false })
        .limit(50);
      if (cancelled) return;
      setRecords(
        (data ?? []).map((r: any) => ({
          id: r.id,
          username: r.profile?.username ?? "?",
          avatar: r.profile?.avatar ?? "🎲",
          outcome: r.outcome_label,
          payout: r.payout,
          ...cfg.records.map(r),
        }))
      );
      setLoading(false);
    }
    refresh();
    const channel = supabase
      .channel(`${cfg.records.table}-changes`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: cfg.records.table }, refresh)
      .subscribe();
    return () => {
      cancelled = true;
      supabase.removeChannel(channel);
    };
  }, [cfg]);

  return (
    <Card className="overflow-hidden">
      {loading ? (
        <p className="px-5 py-8 text-center text-sm text-ice-200/40">Chargement du palmarès...</p>
      ) : records.length === 0 ? (
        <p className="px-5 py-8 text-center text-sm text-ice-200/40">{cfg.records.empty}</p>
      ) : (
        <ul className="divide-y divide-white/5">
          {records.map((r, i) => (
            <li key={r.id} className="flex items-center gap-3 px-5 py-3.5">
              <span className={cn("grid h-8 w-8 shrink-0 place-items-center rounded-full font-display text-sm font-bold", i === 0 ? "bg-gold-400 text-ink-950" : i === 1 ? "bg-ice-100 text-ink-950" : i === 2 ? "bg-electric-600 text-white" : "bg-white/10 text-ice-200/70")}>
                {i + 1}
              </span>
              <span className="text-xl">{r.avatar}</span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold text-white">
                  {r.username} <span className="font-normal text-ice-200/40">— {r.itemLabel}</span>
                </p>
                <p className="truncate text-xs text-ice-200/40">{r.outcome} · {r.detail}</p>
              </div>
              <Badge tone={r.busted ? "danger" : "success"}>{r.busted ? cfg.records.bustedBadge : cfg.records.okBadge}</Badge>
              <span className="font-display text-sm font-bold text-gold-400">{formatCredits(r.payout)}</span>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}
