import { useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import { useCasinoStore } from "../store/casinoStore";
import { useToastStore } from "../store/toastStore";
import { useGameStatusStore } from "../store/gameStatusStore";
import { useAuthStore } from "../store/authStore";
import { supabase } from "../lib/supabase";
import { Card } from "../components/ui/Card";
import { Button } from "../components/ui/Button";
import { Badge } from "../components/ui/Badge";
import { ProgressBar } from "../components/ui/ProgressBar";
import { StatTile } from "../components/ui/StatTile";
import { RoomChat } from "../components/ui/RoomChat";
import { WinCelebration } from "../components/ui/WinCelebration";
import { IconUfo, IconLock } from "../components/icons";
import { formatCredits, cn } from "../lib/format";
import { xpForPayout } from "../lib/xp";
import { tierFromMultiplier, type WinTier } from "../lib/winTiers";
import {
  PROGRAMS, drawProgram, randomDecoyProgram, type Program,
  UNLOCK_TOTAL_WON, ENTRY_COST, MANDATE_LENGTH, START_CONTROL, START_LEAKS,
  drawMandateEvents, type MandateEvent, CATEGORY_LABEL,
  opsForYear, resolveOp, type Witness, type OpsApproach,
  bribeCost, resolveBribe, resolveChaos, resolveAudit, computeOutcome,
  drawHappening, shouldTriggerHappening, shouldTriggerSurpriseAudit,
  resolveReveal, FACTIONS, START_FACTION_CONFIDENCE, applyFactionConfidence,
} from "../lib/area51Engine";

function average(values: number[]): number {
  return values.reduce((a, b) => a + b, 0) / values.length;
}

const ITEM_WIDTH = 128;
const ITEM_GAP = 8;
const TRACK_PAD = 8;
const ITEM_STEP = ITEM_WIDTH + ITEM_GAP;
const REEL_LENGTH = 60;
const WINNING_INDEX = 50;
const SPIN_DURATION = 5.5;

type View = "programme" | "palmares" | "salon";
type Phase = "idle" | "spinning" | "ops" | "happening" | "event" | "farewell" | "recap";

interface MandateState {
  program: Program;
  turn: number;
  control: number;
  leaks: number;
  budget: number;
  factionConfidence: Record<string, number>;
  events: MandateEvent[];
  ops: Witness[];
  opIndex: number;
  usedHappeningIds: string[];
}

interface RoundResult {
  program: Program;
  control: number;
  budget: number;
  payout: number;
  label: string;
  busted: boolean;
}

const CATEGORY_TONE: Record<MandateEvent["category"], "danger" | "gold" | "electric" | "neutral" | "success"> = {
  recherche: "success",
  derive: "gold",
  fun: "electric",
  serieux: "neutral",
  happening: "electric",
};

function ReelTile({ program }: { program: Program }) {
  return (
    <div className={cn("flex h-32 w-32 shrink-0 flex-col items-center justify-center gap-1 rounded-xl border-2 border-white/15 bg-gradient-to-br p-2 text-center", program.accent)}>
      <span className="text-4xl">{program.glyph}</span>
      <p className="text-[11px] font-semibold leading-tight text-white">{program.label}</p>
    </div>
  );
}

export function Area51() {
  const totalWon = useCasinoStore((s) => s.totalWon);
  const credits = useCasinoStore((s) => s.credits);
  const placeBet = useCasinoStore((s) => s.placeBet);
  const award = useCasinoStore((s) => s.award);
  const addXp = useCasinoStore((s) => s.addXp);
  const recordRound = useCasinoStore((s) => s.recordRound);
  const push = useToastStore((s) => s.push);
  const winBias = useGameStatusStore((s) => s.statuses.area51?.winBias ?? 1);
  const account = useAuthStore((s) => s.account);

  const [view, setView] = useState<View>("programme");
  const [phase, setPhase] = useState<Phase>("idle");
  const [reel, setReel] = useState<Program[]>(() => Array.from({ length: 10 }, randomDecoyProgram));
  const [offset, setOffset] = useState(0);
  const [spinning, setSpinning] = useState(false);
  const [mandate, setMandate] = useState<MandateState | null>(null);
  const [resolving, setResolving] = useState(false);
  const [lastOutcome, setLastOutcome] = useState<string | null>(null);
  const [chaosActive, setChaosActive] = useState(false);
  const [happening, setHappening] = useState<MandateEvent | null>(null);
  const [coinFlipping, setCoinFlipping] = useState(false);
  const [celebration, setCelebration] = useState<{ tier: WinTier; payout: number } | null>(null);
  const [result, setResult] = useState<RoundResult | null>(null);
  const trackRef = useRef<HTMLDivElement>(null);
  const pendingWinnerRef = useRef<Program | null>(null);

  const unlocked = totalWon >= UNLOCK_TOTAL_WON;

  function finalizeRound(program: Program, control: number, budget: number, busted: boolean, outcome: { payout: number; label: string }) {
    award(outcome.payout);
    addXp(xpForPayout(outcome.payout));
    const tier = tierFromMultiplier(outcome.payout / ENTRY_COST);
    recordRound({ game: "Area51", label: `${program.label} — ${outcome.label}`, bet: ENTRY_COST, payout: outcome.payout, tier });
    if (tier === "megaWin" || tier === "gigaWin" || tier === "maxWin") {
      setCelebration({ tier, payout: outcome.payout });
    } else {
      push({ kind: "success", title: `+${formatCredits(outcome.payout)} crédits` });
    }

    if (account) {
      supabase.from("area51_records").insert({
        user_id: account.id,
        program_id: program.id,
        program_label: program.label,
        outcome_label: outcome.label,
        control,
        budget,
        payout: outcome.payout,
        busted,
      });
    }

    setResult({ program, control, budget, payout: outcome.payout, label: outcome.label, busted });
    setMandate(null);
    setLastOutcome(null);
    setResolving(false);
    setPhase("recap");
  }

  function launchProgram(program: Program) {
    setSpinning(false);
    if (program.tier === 0) {
      finalizeRound(program, 0, 0, false, computeOutcome(program, 0, 0, false));
      return;
    }
    setMandate({
      program, turn: 0, control: START_CONTROL, leaks: START_LEAKS, budget: 0,
      factionConfidence: Object.fromEntries(FACTIONS.map((f) => [f.id, START_FACTION_CONFIDENCE])),
      events: drawMandateEvents(), ops: opsForYear(), opIndex: 0,
      usedHappeningIds: [],
    });
    setPhase("ops");
  }

  function spin() {
    if (spinning || credits < ENTRY_COST) {
      if (credits < ENTRY_COST) push({ kind: "info", title: "Crédits insuffisants" });
      return;
    }
    placeBet(ENTRY_COST);
    setResult(null);
    setCelebration(null);

    const winner = drawProgram(winBias);
    const strip = Array.from({ length: REEL_LENGTH }, (_, i) => (i === WINNING_INDEX ? winner : randomDecoyProgram()));
    pendingWinnerRef.current = winner;
    setReel(strip);
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
    const timer = setTimeout(() => launchProgram(winner), SPIN_DURATION * 1000);
    return () => {
      cancelAnimationFrame(raf);
      clearTimeout(timer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase]);

  function runOp(approach: OpsApproach) {
    if (!mandate || resolving) return;
    const witness = mandate.ops[mandate.opIndex];
    const result = resolveOp(witness, approach, winBias);
    let newControl = Math.max(0, Math.min(100, mandate.control + result.control));
    let newLeaks = Math.max(0, Math.min(100, mandate.leaks + result.leaks));
    const newBudget = mandate.budget + result.budget;
    const newFactionConfidence = applyFactionConfidence(mandate.factionConfidence, approach);
    let extraText = "";
    let busted = false;

    if (newLeaks >= 75 || shouldTriggerSurpriseAudit()) {
      const avgConfidence = average(Object.values(newFactionConfidence));
      const audit = resolveAudit(newControl, newLeaks, winBias, avgConfidence);
      extraText += `\n\n${audit.narrative}`;
      if (audit.survived) {
        newLeaks = audit.leaksAfter;
      } else {
        busted = true;
      }
    }

    setResolving(true);
    setLastOutcome(result.narrative + extraText);

    setTimeout(() => {
      if (busted) {
        finalizeRound(mandate.program, newControl, newBudget, true, computeOutcome(mandate.program, newControl, newBudget, true));
        return;
      }
      const carried = { ...mandate, control: newControl, leaks: newLeaks, budget: newBudget, factionConfidence: newFactionConfidence };
      const nextOpIndex = mandate.opIndex + 1;
      if (nextOpIndex < mandate.ops.length) {
        let usedHappeningIds = mandate.usedHappeningIds;
        const triggerHappening = shouldTriggerHappening();
        if (triggerHappening) {
          const picked = drawHappening(usedHappeningIds);
          usedHappeningIds = picked.usedIds;
          setHappening(picked.event);
        }
        setMandate({ ...carried, opIndex: nextOpIndex, usedHappeningIds });
        setLastOutcome(null);
        setResolving(false);
        if (triggerHappening) setPhase("happening");
      } else {
        setMandate(carried);
        setLastOutcome(null);
        setResolving(false);
        setPhase("event");
      }
    }, extraText.includes("audit") ? 3200 : 1100);
  }

  function flipCoin() {
    if (!mandate || resolving || coinFlipping) return;
    setCoinFlipping(true);
    setTimeout(() => {
      setCoinFlipping(false);
      runOp(Math.random() < 0.5 ? "discrete" : "agressive");
    }, 1400);
  }

  function resolveHappening(choice: "a" | "b") {
    if (!mandate || !happening || resolving) return;
    const picked = choice === "a" ? happening.choices[0] : happening.choices[1];
    let controlDelta = 0;
    let leaksDelta = 0;
    let budgetDelta = 0;
    let outcomeText = "";

    if (picked.chaos) {
      const r = resolveChaos();
      controlDelta = r.control;
      leaksDelta = r.leaks;
      budgetDelta = r.budget;
      outcomeText = r.outcome;
      setChaosActive(true);
      setTimeout(() => setChaosActive(false), 2400);
    } else {
      controlDelta = picked.control;
      leaksDelta = picked.leaks;
      budgetDelta = picked.budget;
      outcomeText = picked.outcome;
    }

    let newControl = Math.max(0, Math.min(100, mandate.control + controlDelta));
    let newLeaks = Math.max(0, Math.min(100, mandate.leaks + leaksDelta));
    const newBudget = mandate.budget + budgetDelta;
    let busted = false;

    if (newLeaks >= 75) {
      const avgConfidence = average(Object.values(mandate.factionConfidence));
      const audit = resolveAudit(newControl, newLeaks, winBias, avgConfidence);
      outcomeText += `\n\n${audit.narrative}`;
      if (audit.survived) {
        newLeaks = audit.leaksAfter;
      } else {
        busted = true;
      }
    }

    setResolving(true);
    setLastOutcome(outcomeText);

    setTimeout(() => {
      setHappening(null);
      if (busted) {
        finalizeRound(mandate.program, newControl, newBudget, true, computeOutcome(mandate.program, newControl, newBudget, true));
      } else {
        setMandate({ ...mandate, control: newControl, leaks: newLeaks, budget: newBudget });
        setLastOutcome(null);
        setResolving(false);
        setPhase("ops");
      }
    }, outcomeText.includes("audit") ? 3200 : 1600);
  }

  function choose(choice: "a" | "b" | "bribe") {
    if (!mandate || resolving) return;
    const event = mandate.events[mandate.turn];
    let controlDelta = 0;
    let leaksDelta = 0;
    let budgetDelta = 0;
    let outcomeText = "";

    if (choice === "bribe") {
      const cost = bribeCost(mandate.program);
      if (credits < cost) {
        push({ kind: "info", title: "Crédits insuffisants pour acheter le silence" });
        return;
      }
      placeBet(cost);
      const r = resolveBribe(winBias);
      controlDelta = r.control;
      leaksDelta = r.leaks;
      outcomeText = r.outcome;
      push({ kind: r.success ? "success" : "info", title: r.success ? "Silence acheté" : "Le marché a fuité" });
    } else {
      const picked = choice === "a" ? event.choices[0] : event.choices[1];
      if (picked.chaos) {
        const r = resolveChaos();
        controlDelta = r.control;
        leaksDelta = r.leaks;
        budgetDelta = r.budget;
        outcomeText = r.outcome;
        setChaosActive(true);
        setTimeout(() => setChaosActive(false), 2400);
      } else {
        controlDelta = picked.control;
        leaksDelta = picked.leaks;
        budgetDelta = picked.budget;
        outcomeText = picked.outcome;
      }
    }

    let newControl = Math.max(0, Math.min(100, mandate.control + controlDelta));
    let newLeaks = Math.max(0, Math.min(100, mandate.leaks + leaksDelta));
    const newBudget = mandate.budget + budgetDelta;
    let busted = false;
    const nextTurn = mandate.turn + 1;

    if (newLeaks >= 75) {
      const avgConfidence = average(Object.values(mandate.factionConfidence));
      const audit = resolveAudit(newControl, newLeaks, winBias, avgConfidence);
      outcomeText += `\n\n${audit.narrative}`;
      if (audit.survived) {
        newLeaks = audit.leaksAfter;
      } else {
        busted = true;
      }
    }

    setResolving(true);
    setLastOutcome(outcomeText);

    setTimeout(() => {
      if (busted) {
        finalizeRound(mandate.program, newControl, newBudget, true, computeOutcome(mandate.program, newControl, newBudget, true));
      } else if (nextTurn >= MANDATE_LENGTH) {
        setMandate({ ...mandate, turn: nextTurn, control: newControl, leaks: newLeaks, budget: newBudget });
        setLastOutcome(null);
        setResolving(false);
        setPhase("farewell");
      } else {
        setMandate({
          ...mandate, turn: nextTurn, control: newControl, leaks: newLeaks, budget: newBudget,
          ops: opsForYear(), opIndex: 0,
        });
        setLastOutcome(null);
        setResolving(false);
        setPhase("ops");
      }
    }, outcomeText.includes("audit") ? 3200 : 2000);
  }

  function endMandateQuietly() {
    if (!mandate) return;
    finalizeRound(mandate.program, mandate.control, mandate.budget, false, computeOutcome(mandate.program, mandate.control, mandate.budget, false));
  }

  function tryReveal() {
    if (!mandate || resolving) return;
    const r = resolveReveal(mandate.control, winBias);
    setResolving(true);
    setLastOutcome(r.narrative);
    setTimeout(() => {
      finalizeRound(mandate.program, mandate.control, mandate.budget, false, { payout: r.payout, label: r.label });
    }, 2600);
  }

  function reset() {
    setPhase("idle");
    setResult(null);
  }

  if (!unlocked) {
    return (
      <div className="mx-auto max-w-lg px-4 py-16 text-center">
        <IconLock className="mx-auto mb-4 h-10 w-10 text-ice-200/40" />
        <h1 className="font-display text-2xl font-bold text-white">Zone 51 verrouillée</h1>
        <p className="mt-2 text-sm text-ice-200/60">
          Débloque ce jeu en cumulant {formatCredits(UNLOCK_TOTAL_WON)} crédits gagnés au total.
        </p>
        <Card className="mt-6 p-4">
          <p className="mb-2 text-xs text-ice-200/50">{formatCredits(totalWon)} / {formatCredits(UNLOCK_TOTAL_WON)}</p>
          <ProgressBar value={totalWon} max={UNLOCK_TOTAL_WON} />
        </Card>
      </div>
    );
  }

  const event = mandate?.events[mandate.turn] ?? null;
  const currentOp = mandate?.ops[mandate.opIndex] ?? null;

  return (
    <div className="mx-auto max-w-4xl px-4 py-8 sm:px-6">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-2">
          <IconUfo className="h-6 w-6 text-gold-400" />
          <div>
            <h1 className="font-display text-2xl font-bold text-white sm:text-3xl">Zone 51 Clandestine</h1>
            <p className="text-sm text-ice-200/60">Roulette de programme, puis {MANDATE_LENGTH} années à ta sauce. 100% fictif, open bar.</p>
          </div>
        </div>
        <div className="flex items-center gap-1 rounded-xl border border-white/10 bg-white/[0.03] p-1">
          {(["programme", "palmares", "salon"] as View[]).map((v) => (
            <button key={v} onClick={() => setView(v)} className={cn("rounded-lg px-3 py-1.5 text-xs font-semibold capitalize", view === v ? "bg-electric-500 text-white" : "text-ice-200/60")}>
              {v === "programme" ? "Programme" : v === "palmares" ? "Palmarès" : "Salon"}
            </button>
          ))}
        </div>
      </div>

      {view === "programme" && (
        <motion.div
          animate={chaosActive ? { filter: ["hue-rotate(0deg) saturate(1)", "hue-rotate(210deg) saturate(2.6)", "hue-rotate(330deg) saturate(2.2)", "hue-rotate(0deg) saturate(1)"] } : { filter: "hue-rotate(0deg) saturate(1)" }}
          transition={chaosActive ? { duration: 2.2, ease: "easeInOut" } : { duration: 0.4 }}
        >
          {phase === "idle" && (
            <Card className="p-4 text-center sm:p-6" glow>
              <div className="mx-auto flex max-w-md flex-wrap justify-center gap-1.5">
                {PROGRAMS.map((p) => (
                  <span key={p.id} className="text-xl" title={p.label}>{p.glyph}</span>
                ))}
              </div>
              <p className="mt-4 text-sm text-ice-200/60">
                Tourne la roulette de programme. Selon la case, tu prends la tête d'un programme classifié pour {MANDATE_LENGTH} années —
                12 à 18 opérations de confinement par année, quelques événements de base et dérapages imprévisibles entre deux opérations,
                un grand événement annuel, et un audit du Congrès jamais loin si les fuites grimpent trop.
              </p>
              <div className="mt-6 flex justify-center">
                <Button size="lg" onClick={spin} disabled={spinning || credits < ENTRY_COST}>
                  Tourner la roulette — {formatCredits(ENTRY_COST)}
                </Button>
              </div>
            </Card>
          )}

          {phase === "spinning" && (
            <Card className="p-4 sm:p-6" glow>
              <div className="relative mx-auto w-full max-w-2xl overflow-hidden rounded-2xl border border-white/10 bg-ink-950/60 py-4">
                <div className="pointer-events-none absolute inset-y-0 left-1/2 z-10 w-0.5 -translate-x-1/2 bg-gold-400 shadow-glow-gold" />
                <div ref={trackRef} className="flex gap-2 px-2" style={{ transform: `translateX(${offset}px)`, transition: `transform ${SPIN_DURATION}s cubic-bezier(0.15, 0.85, 0.2, 1)` }}>
                  {reel.map((p, i) => (
                    <ReelTile key={i} program={p} />
                  ))}
                </div>
              </div>
            </Card>
          )}

          {(phase === "ops" || phase === "happening" || phase === "event" || phase === "farewell") && mandate && (
            <div className="flex flex-col gap-4">
              <Card className="p-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="flex items-center gap-2">
                    <span className="text-2xl">{mandate.program.glyph}</span>
                    <div>
                      <p className="text-sm font-semibold text-white">{mandate.program.label}</p>
                      <p className="text-xs text-ice-200/40">Année {mandate.turn + 1}/{MANDATE_LENGTH}</p>
                    </div>
                  </div>
                  <div className="flex flex-wrap items-center gap-4">
                    <div className="w-32">
                      <p className="mb-1 text-[10px] uppercase tracking-wide text-ice-200/40">Contrôle</p>
                      <ProgressBar value={mandate.control} max={100} />
                    </div>
                    <div className="w-32">
                      <p className="mb-1 text-[10px] uppercase tracking-wide text-ice-200/40">Fuites</p>
                      <ProgressBar
                        value={mandate.leaks}
                        max={100}
                        barClassName={mandate.leaks >= 75 ? "!bg-none !bg-red-500" : mandate.leaks >= 45 ? "!bg-none !bg-gold-400" : undefined}
                      />
                    </div>
                    <div className="text-right">
                      <p className="text-[10px] uppercase tracking-wide text-ice-200/40">Budget noir</p>
                      <p className={cn("font-display text-sm font-bold", mandate.budget >= 0 ? "text-emerald-400" : "text-red-400")}>
                        {mandate.budget >= 0 ? "+" : ""}{formatCredits(mandate.budget)}
                      </p>
                    </div>
                  </div>
                </div>
                <div className="mt-3 flex flex-wrap gap-1.5 border-t border-white/10 pt-3">
                  {FACTIONS.map((f) => {
                    const v = mandate.factionConfidence[f.id] ?? 50;
                    return (
                      <span
                        key={f.id}
                        title={f.label}
                        className={cn(
                          "rounded-full border px-2 py-0.5 text-[10px] font-semibold",
                          v >= 60 ? "border-emerald-400/30 bg-emerald-500/10 text-emerald-300" :
                          v <= 35 ? "border-red-400/30 bg-red-500/10 text-red-300" :
                          "border-white/10 bg-white/5 text-ice-200/60"
                        )}
                      >
                        {f.short} {v}
                      </span>
                    );
                  })}
                </div>
              </Card>

              {phase === "ops" && currentOp && (
                <Card className="p-4 sm:p-6" glow>
                  <div className="mb-3 flex items-center justify-between gap-2">
                    <Badge tone="success">Confinement</Badge>
                    <span className="text-xs text-ice-200/40">Témoin {mandate.opIndex + 1}/{mandate.ops.length}</span>
                  </div>
                  <h2 className="font-display text-lg font-bold text-white">{currentOp.label}</h2>
                  <p className="mt-2 text-sm text-ice-200/70">
                    Face à {currentOp.pool} : approche discrète (accord de confidentialité, sûre) ou agressive (plus rapide, plus risquée) ?
                  </p>

                  {lastOutcome !== null ? (
                    <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} className="mt-4 whitespace-pre-line rounded-xl border border-white/10 bg-white/[0.03] p-4 text-sm text-ice-200/80">
                      {lastOutcome}
                    </motion.div>
                  ) : coinFlipping ? (
                    <div className="mt-5 flex flex-col items-center gap-2 py-4">
                      <motion.span className="text-5xl" animate={{ rotateY: [0, 360, 720, 1080] }} transition={{ duration: 1.4, ease: "easeInOut" }}>
                        🪙
                      </motion.span>
                      <p className="text-xs text-ice-200/50">Pile ou face...</p>
                    </div>
                  ) : (
                    <div className="mt-5 flex flex-col gap-2">
                      <div className="flex gap-2">
                        <Button variant="secondary" onClick={() => runOp("discrete")} disabled={resolving} className="flex-1">
                          Approche discrète
                        </Button>
                        <Button variant="secondary" onClick={() => runOp("agressive")} disabled={resolving} className="flex-1">
                          Approche agressive
                        </Button>
                      </div>
                      <Button variant="ghost" size="sm" onClick={flipCoin} disabled={resolving} className="w-full text-ice-200/50">
                        🪙 Trop indécis ? Pile ou face
                      </Button>
                    </div>
                  )}
                </Card>
              )}

              {phase === "happening" && happening && (
                <Card className="p-4 sm:p-6" glow>
                  <div className="mb-3 flex items-center gap-2">
                    <Badge tone={CATEGORY_TONE[happening.category]}>{CATEGORY_LABEL[happening.category]}</Badge>
                  </div>
                  <h2 className="font-display text-lg font-bold text-white">{happening.title}</h2>
                  <p className="mt-2 text-sm text-ice-200/70">{happening.description}</p>

                  {lastOutcome !== null ? (
                    <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} className="mt-4 whitespace-pre-line rounded-xl border border-white/10 bg-white/[0.03] p-4 text-sm text-ice-200/80">
                      {lastOutcome}
                    </motion.div>
                  ) : (
                    <div className="mt-5 flex flex-col gap-2">
                      <Button variant="secondary" onClick={() => resolveHappening("a")} disabled={resolving} className="w-full">
                        {happening.choices[0].label}
                      </Button>
                      <Button variant="secondary" onClick={() => resolveHappening("b")} disabled={resolving} className="w-full">
                        {happening.choices[1].label}
                      </Button>
                    </div>
                  )}
                </Card>
              )}

              {phase === "event" && event && (
                <Card className="p-4 sm:p-6" glow>
                  <div className="mb-3 flex items-center gap-2">
                    <Badge tone={CATEGORY_TONE[event.category]}>{CATEGORY_LABEL[event.category]}</Badge>
                  </div>
                  <h2 className="font-display text-lg font-bold text-white">{event.title}</h2>
                  <p className="mt-2 text-sm text-ice-200/70">{event.description}</p>

                  {lastOutcome !== null ? (
                    <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} className="mt-4 whitespace-pre-line rounded-xl border border-white/10 bg-white/[0.03] p-4 text-sm text-ice-200/80">
                      {lastOutcome}
                    </motion.div>
                  ) : (
                    <div className="mt-5 flex flex-col gap-2">
                      <Button variant="secondary" onClick={() => choose("a")} disabled={resolving} className="w-full">
                        {event.choices[0].label}
                      </Button>
                      <Button variant="secondary" onClick={() => choose("b")} disabled={resolving} className="w-full">
                        {event.choices[1].label}
                      </Button>
                      <Button variant="gold" onClick={() => choose("bribe")} disabled={resolving || credits < bribeCost(mandate.program)} className="w-full">
                        💰 Acheter le silence d'un sénateur — {formatCredits(bribeCost(mandate.program))}
                      </Button>
                    </div>
                  )}
                </Card>
              )}

              {phase === "farewell" && (
                <Card className="p-4 text-center sm:p-6" glow>
                  <span className="text-4xl">🏁</span>
                  <h2 className="mt-3 font-display text-lg font-bold text-white">Fin de Programme</h2>
                  <p className="mt-2 text-sm text-ice-200/70">
                    Tes {MANDATE_LENGTH} années à la tête du programme touchent à leur fin. Tu peux tout enterrer tranquillement, ou révéler la vérité au monde.
                  </p>

                  {lastOutcome !== null ? (
                    <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} className="mt-4 whitespace-pre-line rounded-xl border border-white/10 bg-white/[0.03] p-4 text-left text-sm text-ice-200/80">
                      {lastOutcome}
                    </motion.div>
                  ) : (
                    <div className="mx-auto mt-5 flex max-w-sm flex-col gap-2">
                      <Button variant="secondary" onClick={endMandateQuietly} disabled={resolving} className="w-full">
                        Tout enterrer tranquillement
                      </Button>
                      <Button variant="gold" onClick={tryReveal} disabled={resolving} className="w-full">
                        🛸 Révéler la vérité au monde
                      </Button>
                    </div>
                  )}
                </Card>
              )}
            </div>
          )}

          {phase === "recap" && result && (
            <Card className="p-4 text-center sm:p-6" glow>
              <span className="text-5xl">{result.busted ? "🚨" : result.program.tier === 0 ? "🚫" : "👽"}</span>
              <h2 className="mt-3 font-display text-xl font-bold text-white">{result.label}</h2>
              <p className="mt-1 text-sm text-ice-200/60">{result.program.label}</p>
              {result.program.tier > 0 && (
                <div className="mx-auto mt-4 grid max-w-xs grid-cols-2 gap-2">
                  <StatTile label="Contrôle final" value={`${result.control}/100`} />
                  <StatTile label="Budget noir" value={formatCredits(result.budget)} />
                </div>
              )}
              <p className="mt-4 font-display text-2xl font-bold text-gold-400">+{formatCredits(result.payout)}</p>
              <Button size="lg" className="mt-6" onClick={reset}>Nouveau programme</Button>
            </Card>
          )}
        </motion.div>
      )}

      {view === "palmares" && <Palmares />}
      {view === "salon" && <RoomChat table="area51_messages" title="Mess des Officiers" />}

      <WinCelebration tier={celebration?.tier ?? "none"} payout={celebration?.payout ?? 0} onClose={() => setCelebration(null)} game="Zone 51 Clandestine" />
    </div>
  );
}

interface RecordRow {
  id: string;
  programLabel: string;
  outcomeLabel: string;
  control: number;
  payout: number;
  busted: boolean;
  username: string;
  avatar: string;
}

async function fetchRecords(): Promise<RecordRow[]> {
  const { data } = await supabase
    .from("area51_records")
    .select("id, program_label, outcome_label, control, payout, busted, profile:profiles(username, avatar)")
    .order("payout", { ascending: false })
    .limit(50);
  return (data ?? []).map((r: any) => ({
    id: r.id,
    programLabel: r.program_label,
    outcomeLabel: r.outcome_label,
    control: r.control,
    payout: r.payout,
    busted: r.busted,
    username: r.profile?.username ?? "?",
    avatar: r.profile?.avatar ?? "🎲",
  }));
}

function Palmares() {
  const [records, setRecords] = useState<RecordRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    function refresh() {
      fetchRecords().then((r) => {
        if (!cancelled) {
          setRecords(r);
          setLoading(false);
        }
      });
    }
    refresh();

    const channel = supabase
      .channel("area51-records-changes")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "area51_records" }, refresh)
      .subscribe();

    return () => {
      cancelled = true;
      supabase.removeChannel(channel);
    };
  }, []);

  return (
    <Card className="overflow-hidden">
      {loading ? (
        <p className="px-5 py-8 text-center text-sm text-ice-200/40">Chargement du palmarès...</p>
      ) : records.length === 0 ? (
        <p className="px-5 py-8 text-center text-sm text-ice-200/40">Aucun programme terminé pour l'instant.</p>
      ) : (
        <ul className="divide-y divide-white/5">
          {records.map((r, i) => (
            <li key={r.id} className="flex items-center gap-3 px-5 py-3.5">
              <span className={cn("grid h-8 w-8 shrink-0 place-items-center rounded-full font-display text-sm font-bold", i === 0 ? "bg-gold-400 text-ink-950" : i === 1 ? "bg-ice-100 text-ink-950" : i === 2 ? "bg-electric-600 text-white" : "bg-white/10 text-ice-200/70")}>
                {i + 1}
              </span>
              <span className="text-xl">{r.avatar}</span>
              <div className="flex-1">
                <p className="text-sm font-semibold text-white">
                  {r.username} <span className="font-normal text-ice-200/40">— {r.programLabel}</span>
                </p>
                <p className="text-xs text-ice-200/40">{r.outcomeLabel} · Contrôle {r.control}/100</p>
              </div>
              <Badge tone={r.busted ? "danger" : "success"}>{r.busted ? "Révélé" : "Classifié"}</Badge>
              <span className="font-display text-sm font-bold text-gold-400">{formatCredits(r.payout)}</span>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}
