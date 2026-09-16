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
import { IconFootball, IconLock } from "../components/icons";
import { formatCredits, cn } from "../lib/format";
import { xpForPayout } from "../lib/xp";
import { tierFromMultiplier, type WinTier } from "../lib/winTiers";
import {
  CLUBS, drawClub, randomDecoyClub, type Club as ClubDef,
  UNLOCK_TOTAL_WON, ENTRY_COST, PRESIDENCY_LENGTH, START_SUPPORT,
  drawPresidencyEvents, type ClubEvent, CATEGORY_LABEL,
  billsForSeason, resolveTransferVote, resolveBribeLeak, type Bill, type VoteChoice,
  bribeCost, resolveBribe, resolveClubChaos, resolveOusterMotion, computeOutcome,
  drawHappening, shouldTriggerHappening, shouldTriggerSurpriseOuster,
  CLUB_STAKEHOLDERS, START_STAKEHOLDER_CONFIDENCE, applyStakeholderConfidence,
  START_WAGE_RATIO, applyVoteWageImpact, applyEventWageImpact, ffpStatusFor, type FfpStatus,
  resolveClubSale,
} from "../lib/clubEngine";

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

type View = "presidence" | "palmares" | "salon";
type Phase = "idle" | "spinning" | "votes" | "happening" | "event" | "farewell" | "recap";

interface PresidencyState {
  club: ClubDef;
  turn: number;
  support: number;
  budget: number;
  wageRatio: number;
  stakeholderConfidence: Record<string, number>;
  events: ClubEvent[];
  startYear: number;
  bills: Bill[];
  billIndex: number;
  usedHappeningIds: string[];
}

interface RoundResult {
  club: ClubDef;
  support: number;
  budget: number;
  payout: number;
  label: string;
  ousted: boolean;
}

const CATEGORY_TONE: Record<ClubEvent["category"], "danger" | "gold" | "electric" | "neutral" | "success"> = {
  polemique: "danger",
  derive: "gold",
  fun: "electric",
  serieux: "neutral",
  vote: "success",
  happening: "electric",
};

const FFP_TONE: Record<FfpStatus, string> = {
  Conforme: "text-emerald-400",
  "Sous Surveillance": "text-ice-200/70",
  "Risque de Sanction": "text-amber-400",
  "Exclusion Europe": "text-red-400",
};

function ReelTile({ club }: { club: ClubDef }) {
  return (
    <div className={cn("flex h-32 w-32 shrink-0 flex-col items-center justify-center gap-1 rounded-xl border-2 border-white/15 bg-gradient-to-br p-2 text-center", club.accent)}>
      <span className="text-4xl">{club.glyph}</span>
      <p className="text-[11px] font-semibold leading-tight text-white">{club.label}</p>
      <p className="text-[9px] uppercase tracking-wide text-white/60">{club.league}</p>
    </div>
  );
}

export function Club() {
  const totalWon = useCasinoStore((s) => s.totalWon);
  const credits = useCasinoStore((s) => s.credits);
  const placeBet = useCasinoStore((s) => s.placeBet);
  const award = useCasinoStore((s) => s.award);
  const addXp = useCasinoStore((s) => s.addXp);
  const recordRound = useCasinoStore((s) => s.recordRound);
  const push = useToastStore((s) => s.push);
  const winBias = useGameStatusStore((s) => s.statuses.club?.winBias ?? 1);
  const account = useAuthStore((s) => s.account);

  const [view, setView] = useState<View>("presidence");
  const [phase, setPhase] = useState<Phase>("idle");
  const [reel, setReel] = useState<ClubDef[]>(() => Array.from({ length: 10 }, randomDecoyClub));
  const [offset, setOffset] = useState(0);
  const [spinning, setSpinning] = useState(false);
  const [presidency, setPresidency] = useState<PresidencyState | null>(null);
  const [resolving, setResolving] = useState(false);
  const [lastOutcome, setLastOutcome] = useState<string | null>(null);
  const [chaosActive, setChaosActive] = useState(false);
  const [happening, setHappening] = useState<ClubEvent | null>(null);
  const [coinFlipping, setCoinFlipping] = useState(false);
  const [celebration, setCelebration] = useState<{ tier: WinTier; payout: number } | null>(null);
  const [result, setResult] = useState<RoundResult | null>(null);
  const trackRef = useRef<HTMLDivElement>(null);
  const pendingWinnerRef = useRef<ClubDef | null>(null);

  const unlocked = totalWon >= UNLOCK_TOTAL_WON;

  function finalizeRound(club: ClubDef, support: number, budget: number, outcome: { payout: number; label: string }, ousted: boolean) {
    award(outcome.payout);
    addXp(xpForPayout(outcome.payout));
    const tier = tierFromMultiplier(outcome.payout / ENTRY_COST);
    recordRound({ game: "Club", label: `${club.label} — ${outcome.label}`, bet: ENTRY_COST, payout: outcome.payout, tier });
    if (tier === "megaWin" || tier === "gigaWin" || tier === "maxWin") {
      setCelebration({ tier, payout: outcome.payout });
    } else {
      push({ kind: "success", title: `+${formatCredits(outcome.payout)} crédits` });
    }

    if (account) {
      supabase.from("club_records").insert({
        user_id: account.id,
        club_id: club.id,
        club_label: club.label,
        outcome_label: outcome.label,
        support,
        budget,
        payout: outcome.payout,
        ousted,
      });
    }

    setResult({ club, support, budget, payout: outcome.payout, label: outcome.label, ousted });
    setPresidency(null);
    setLastOutcome(null);
    setResolving(false);
    setPhase("recap");
  }

  function appoint(club: ClubDef) {
    setSpinning(false);
    if (club.tier === 0) {
      finalizeRound(club, 0, 0, computeOutcome(club, 0, 0, false), false);
      return;
    }
    const startYear = new Date().getFullYear();
    setPresidency({
      club, turn: 0, support: START_SUPPORT, budget: 0,
      wageRatio: START_WAGE_RATIO,
      stakeholderConfidence: Object.fromEntries(CLUB_STAKEHOLDERS.map((s) => [s.id, START_STAKEHOLDER_CONFIDENCE])),
      events: drawPresidencyEvents(), startYear,
      bills: billsForSeason(club), billIndex: 0,
      usedHappeningIds: [],
    });
    setPhase("votes");
  }

  function spin() {
    if (spinning || credits < ENTRY_COST) {
      if (credits < ENTRY_COST) push({ kind: "info", title: "Crédits insuffisants" });
      return;
    }
    placeBet(ENTRY_COST);
    setResult(null);
    setCelebration(null);

    const winner = drawClub(winBias);
    const strip = Array.from({ length: REEL_LENGTH }, (_, i) => (i === WINNING_INDEX ? winner : randomDecoyClub()));
    pendingWinnerRef.current = winner;
    setReel(strip);
    setOffset(0);
    setSpinning(true);
    setPhase("spinning");
  }

  // The reel track only mounts once `phase` becomes "spinning" — trackRef is still null at the
  // moment spin() runs, so the target offset (and the timer that reveals the winner) has to wait
  // for this effect, which fires only after the track has actually committed to the DOM.
  useEffect(() => {
    if (phase !== "spinning") return;
    const winner = pendingWinnerRef.current;
    if (!winner) return;

    const containerWidth = trackRef.current?.parentElement?.getBoundingClientRect().width ?? 320;
    const jitter = (Math.random() - 0.5) * (ITEM_WIDTH * 0.6);
    const target = -(TRACK_PAD + WINNING_INDEX * ITEM_STEP + ITEM_WIDTH / 2 - containerWidth / 2) + jitter;
    const raf = requestAnimationFrame(() => setOffset(target));
    const timer = setTimeout(() => appoint(winner), SPIN_DURATION * 1000);
    return () => {
      cancelAnimationFrame(raf);
      clearTimeout(timer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase]);

  function voteBill(choice: VoteChoice | "bribe") {
    if (!presidency || resolving) return;
    const bill = presidency.bills[presidency.billIndex];
    const vote: VoteChoice = choice === "bribe" ? bill.bribeOffer!.direction : choice;
    let extraText = "";
    let extraPenalty = 0;

    if (choice === "bribe") {
      const offer = bill.bribeOffer!;
      award(offer.amount);
      push({ kind: "success", title: `Enveloppe acceptée — +${formatCredits(offer.amount)} crédits` });
      const leak = resolveBribeLeak(winBias);
      if (leak.leaked) {
        extraText = "\n💰 L'enveloppe a été repérée par un journaliste.";
        extraPenalty = leak.supportPenalty;
      }
    }

    const result = resolveTransferVote(bill, vote, winBias);
    let newSupport = Math.max(0, Math.min(100, presidency.support + result.support - extraPenalty));
    const newBudget = presidency.budget + result.budget;
    const wageUpdate = applyVoteWageImpact(presidency.wageRatio, bill, result.passed);
    if (wageUpdate.narrative) extraText += `\n\n${wageUpdate.narrative}`;
    const newStakeholderConfidence = applyStakeholderConfidence(presidency.stakeholderConfidence, bill, vote);

    let ousted = newSupport <= 0;
    if (!ousted && (newSupport <= 30 || shouldTriggerSurpriseOuster())) {
      const avgConfidence = average(Object.values(newStakeholderConfidence));
      const om = resolveOusterMotion(newSupport, winBias, avgConfidence);
      extraText += `\n\n${om.narrative}`;
      if (om.survived) {
        newSupport = Math.max(0, newSupport - om.supportPenalty);
        ousted = newSupport <= 0;
      } else {
        ousted = true;
      }
    }

    setResolving(true);
    setLastOutcome(result.narrative + extraText);

    setTimeout(() => {
      if (ousted) {
        finalizeRound(presidency.club, newSupport, newBudget, computeOutcome(presidency.club, newSupport, newBudget, true), true);
        return;
      }
      const carried = { ...presidency, support: newSupport, budget: newBudget, wageRatio: wageUpdate.wageRatio, stakeholderConfidence: newStakeholderConfidence };
      const nextBillIndex = presidency.billIndex + 1;
      if (nextBillIndex < presidency.bills.length) {
        let usedHappeningIds = presidency.usedHappeningIds;
        const triggerHappening = shouldTriggerHappening();
        if (triggerHappening) {
          const picked = drawHappening(usedHappeningIds);
          usedHappeningIds = picked.usedIds;
          setHappening(picked.event);
        }
        setPresidency({ ...carried, billIndex: nextBillIndex, usedHappeningIds });
        setLastOutcome(null);
        setResolving(false);
        if (triggerHappening) setPhase("happening");
      } else {
        setPresidency(carried);
        setLastOutcome(null);
        setResolving(false);
        setPhase("event");
      }
    }, extraText.includes("Motion de défiance") ? 3200 : 1100);
  }

  function flipCoin() {
    if (!presidency || resolving || coinFlipping) return;
    setCoinFlipping(true);
    setTimeout(() => {
      setCoinFlipping(false);
      voteBill(Math.random() < 0.5 ? "pour" : "contre");
    }, 1400);
  }

  function resolveHappening(choice: "a" | "b") {
    if (!presidency || !happening || resolving) return;
    const picked = choice === "a" ? happening.choices[0] : happening.choices[1];
    let supportDelta = 0;
    let budgetDelta = 0;
    let outcomeText = "";

    if (picked.chaos) {
      const r = resolveClubChaos();
      supportDelta = r.support;
      budgetDelta = r.budget;
      outcomeText = r.outcome;
      setChaosActive(true);
      setTimeout(() => setChaosActive(false), 2400);
    } else {
      supportDelta = picked.support;
      budgetDelta = picked.budget;
      outcomeText = picked.outcome;
    }

    let newSupport = Math.max(0, Math.min(100, presidency.support + supportDelta));
    const newBudget = presidency.budget + budgetDelta;
    const wageUpdate = applyEventWageImpact(presidency.wageRatio, budgetDelta);
    if (wageUpdate.narrative) outcomeText += `\n\n${wageUpdate.narrative}`;
    let ousted = newSupport <= 0;

    if (!ousted && newSupport <= 30) {
      const avgConfidence = average(Object.values(presidency.stakeholderConfidence));
      const om = resolveOusterMotion(newSupport, winBias, avgConfidence);
      outcomeText += `\n\n${om.narrative}`;
      if (om.survived) {
        newSupport = Math.max(0, newSupport - om.supportPenalty);
        ousted = newSupport <= 0;
      } else {
        ousted = true;
      }
    }

    setResolving(true);
    setLastOutcome(outcomeText);

    setTimeout(() => {
      setHappening(null);
      if (ousted) {
        finalizeRound(presidency.club, newSupport, newBudget, computeOutcome(presidency.club, newSupport, newBudget, ousted), ousted);
      } else {
        setPresidency({ ...presidency, support: newSupport, budget: newBudget, wageRatio: wageUpdate.wageRatio });
        setLastOutcome(null);
        setResolving(false);
        setPhase("votes");
      }
    }, outcomeText.includes("Motion de défiance") ? 3200 : 1600);
  }

  function choose(choice: "a" | "b" | "bribe") {
    if (!presidency || resolving) return;
    const event = presidency.events[presidency.turn];
    let supportDelta = 0;
    let budgetDelta = 0;
    let outcomeText = "";

    if (choice === "bribe") {
      const cost = bribeCost(presidency.club);
      if (credits < cost) {
        push({ kind: "info", title: "Crédits insuffisants pour soudoyer" });
        return;
      }
      placeBet(cost);
      const r = resolveBribe(winBias);
      supportDelta = r.support;
      budgetDelta = r.budget;
      outcomeText = r.outcome;
      push({ kind: r.success ? "success" : "info", title: r.success ? "Soudoiement réussi" : "Soudoiement éventé" });
    } else {
      const picked = choice === "a" ? event.choices[0] : event.choices[1];
      if (picked.chaos) {
        const r = resolveClubChaos();
        supportDelta = r.support;
        budgetDelta = r.budget;
        outcomeText = r.outcome;
        setChaosActive(true);
        setTimeout(() => setChaosActive(false), 2400);
      } else {
        supportDelta = picked.support;
        budgetDelta = picked.budget;
        outcomeText = picked.outcome;
      }
    }

    let newSupport = Math.max(0, Math.min(100, presidency.support + supportDelta));
    const newBudget = presidency.budget + budgetDelta;
    const wageUpdate = applyEventWageImpact(presidency.wageRatio, budgetDelta);
    if (wageUpdate.narrative) outcomeText += `\n\n${wageUpdate.narrative}`;
    let ousted = newSupport <= 0;
    const nextTurn = presidency.turn + 1;

    if (!ousted && newSupport <= 30) {
      const avgConfidence = average(Object.values(presidency.stakeholderConfidence));
      const om = resolveOusterMotion(newSupport, winBias, avgConfidence);
      outcomeText += `\n\n${om.narrative}`;
      if (om.survived) {
        newSupport = Math.max(0, newSupport - om.supportPenalty);
        ousted = newSupport <= 0;
      } else {
        ousted = true;
      }
    }

    setResolving(true);
    setLastOutcome(outcomeText);

    setTimeout(() => {
      if (ousted) {
        finalizeRound(presidency.club, newSupport, newBudget, computeOutcome(presidency.club, newSupport, newBudget, true), true);
      } else if (nextTurn >= PRESIDENCY_LENGTH) {
        setPresidency({ ...presidency, turn: nextTurn, support: newSupport, budget: newBudget, wageRatio: wageUpdate.wageRatio });
        setLastOutcome(null);
        setResolving(false);
        setPhase("farewell");
      } else {
        setPresidency({
          ...presidency, turn: nextTurn, support: newSupport, budget: newBudget, wageRatio: wageUpdate.wageRatio,
          bills: billsForSeason(presidency.club), billIndex: 0,
        });
        setLastOutcome(null);
        setResolving(false);
        setPhase("votes");
      }
    }, outcomeText.includes("Motion de défiance") ? 3200 : 2000);
  }

  function endPresidencyQuietly() {
    if (!presidency) return;
    finalizeRound(presidency.club, presidency.support, presidency.budget, computeOutcome(presidency.club, presidency.support, presidency.budget, false), false);
  }

  function sellClub() {
    if (!presidency || resolving) return;
    const r = resolveClubSale(presidency.support, winBias);
    setResolving(true);
    setLastOutcome(r.narrative);
    setTimeout(() => {
      finalizeRound(presidency.club, presidency.support, presidency.budget, { payout: r.payout, label: r.label }, false);
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
        <h1 className="font-display text-2xl font-bold text-white">Présidence verrouillée</h1>
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

  const event = presidency?.events[presidency.turn] ?? null;
  const currentBill = presidency?.bills[presidency.billIndex] ?? null;

  return (
    <div className="mx-auto max-w-4xl px-4 py-8 sm:px-6">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-2">
          <IconFootball className="h-6 w-6 text-gold-400" />
          <div>
            <h1 className="font-display text-2xl font-bold text-white sm:text-3xl">Président de Club</h1>
            <p className="text-sm text-ice-200/60">Roulette de reprise, puis une présidence de {PRESIDENCY_LENGTH} saisons à ta sauce. 100% fictif, open bar.</p>
          </div>
        </div>
        <div className="flex items-center gap-1 rounded-xl border border-white/10 bg-white/[0.03] p-1">
          {(["presidence", "palmares", "salon"] as View[]).map((v) => (
            <button key={v} onClick={() => setView(v)} className={cn("rounded-lg px-3 py-1.5 text-xs font-semibold capitalize", view === v ? "bg-electric-500 text-white" : "text-ice-200/60")}>
              {v === "presidence" ? "Présidence" : v === "palmares" ? "Palmarès" : "Salon"}
            </button>
          ))}
        </div>
      </div>

      {view === "presidence" && (
        <motion.div
          animate={chaosActive ? { filter: ["hue-rotate(0deg) saturate(1)", "hue-rotate(210deg) saturate(2.6)", "hue-rotate(330deg) saturate(2.2)", "hue-rotate(0deg) saturate(1)"] } : { filter: "hue-rotate(0deg) saturate(1)" }}
          transition={chaosActive ? { duration: 2.2, ease: "easeInOut" } : { duration: 0.4 }}
        >
          {phase === "idle" && (
            <Card className="p-4 text-center sm:p-6" glow>
              <div className="mx-auto flex max-w-md flex-wrap justify-center gap-1.5">
                {CLUBS.map((c) => (
                  <span key={c.id} className="text-xl" title={c.label}>{c.glyph}</span>
                ))}
              </div>
              <p className="mt-4 text-sm text-ice-200/60">
                Tourne la roulette de reprise. Selon le club, tu prends la présidence pour {PRESIDENCY_LENGTH} saisons —
                15 à 20 votes de conseil par saison, quelques soirées et happenings imprévisibles entre deux votes,
                un grand événement annuel, et une motion de défiance jamais loin si ton soutien s'effondre.
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
                  {reel.map((c, i) => (
                    <ReelTile key={i} club={c} />
                  ))}
                </div>
              </div>
            </Card>
          )}

          {(phase === "votes" || phase === "happening" || phase === "event" || phase === "farewell") && presidency && (
            <div className="flex flex-col gap-4">
              <Card className="p-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="flex items-center gap-2">
                    <span className="text-2xl">{presidency.club.glyph}</span>
                    <div>
                      <p className="text-sm font-semibold text-white">{presidency.club.label} <span className="font-normal text-ice-200/40">· {presidency.club.league}</span></p>
                      <p className="text-xs text-ice-200/40">Saison {presidency.turn + 1}/{PRESIDENCY_LENGTH} · {presidency.startYear + presidency.turn}/{presidency.startYear + presidency.turn + 1}</p>
                    </div>
                  </div>
                  <div className="flex flex-wrap items-center gap-4">
                    <div className="w-32">
                      <p className="mb-1 text-[10px] uppercase tracking-wide text-ice-200/40">Soutien supporters</p>
                      <ProgressBar value={presidency.support} max={100} />
                    </div>
                    <div className="text-right">
                      <p className="text-[10px] uppercase tracking-wide text-ice-200/40">Budget</p>
                      <p className={cn("font-display text-sm font-bold", presidency.budget >= 0 ? "text-emerald-400" : "text-red-400")}>
                        {presidency.budget >= 0 ? "+" : ""}{presidency.budget}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-[10px] uppercase tracking-wide text-ice-200/40">Masse salariale</p>
                      <p className="font-display text-sm font-bold text-white">{presidency.wageRatio.toFixed(0)}% revenus</p>
                      <p className={cn("text-[10px]", FFP_TONE[ffpStatusFor(presidency.wageRatio)])}>{ffpStatusFor(presidency.wageRatio)}</p>
                    </div>
                  </div>
                </div>
                <div className="mt-3 flex flex-wrap gap-1.5 border-t border-white/10 pt-3">
                  {CLUB_STAKEHOLDERS.map((s) => {
                    const v = presidency.stakeholderConfidence[s.id] ?? 50;
                    return (
                      <span
                        key={s.id}
                        title={s.label}
                        className={cn(
                          "rounded-full border px-2 py-0.5 text-[10px] font-semibold",
                          v >= 60 ? "border-emerald-400/30 bg-emerald-500/10 text-emerald-300" :
                          v <= 35 ? "border-red-400/30 bg-red-500/10 text-red-300" :
                          "border-white/10 bg-white/5 text-ice-200/60"
                        )}
                      >
                        {s.short} {v}
                      </span>
                    );
                  })}
                </div>
              </Card>

              {phase === "votes" && currentBill && (
                <Card className="p-4 sm:p-6" glow>
                  <div className="mb-3 flex items-center justify-between gap-2">
                    <Badge tone={currentBill.direction === "hausse" ? "success" : "danger"}>
                      {currentBill.direction === "hausse" ? "Dépense" : "Économie"}
                    </Badge>
                    <span className="text-xs text-ice-200/40">Vote {presidency.billIndex + 1}/{presidency.bills.length}</span>
                  </div>
                  <h2 className="font-display text-lg font-bold text-white">{currentBill.title}</h2>
                  <p className="mt-2 text-sm text-ice-200/70">
                    Impact estimé : {currentBill.amountMEur} M€ — touche surtout {currentBill.topic.affected}.
                  </p>

                  {currentBill.bribeOffer && lastOutcome === null && (
                    <p className="mt-3 rounded-lg border border-gold-400/30 bg-gold-500/10 p-2.5 text-xs text-gold-300">
                      💰 Un agent te propose {formatCredits(currentBill.bribeOffer.amount)} crédits pour voter{" "}
                      {currentBill.bribeOffer.direction === "pour" ? "POUR" : "CONTRE"}.
                    </p>
                  )}

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
                        <Button variant="secondary" onClick={() => voteBill("pour")} disabled={resolving} className="flex-1">
                          Pour
                        </Button>
                        <Button variant="secondary" onClick={() => voteBill("contre")} disabled={resolving} className="flex-1">
                          Contre
                        </Button>
                        {currentBill.bribeOffer && (
                          <Button variant="gold" onClick={() => voteBill("bribe")} disabled={resolving} className="flex-1">
                            💰 Accepter
                          </Button>
                        )}
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
                      <Button variant="gold" onClick={() => choose("bribe")} disabled={resolving || credits < bribeCost(presidency.club)} className="w-full">
                        💰 Soudoyer l'arbitre — {formatCredits(bribeCost(presidency.club))}
                      </Button>
                    </div>
                  )}
                </Card>
              )}

              {phase === "farewell" && (
                <Card className="p-4 text-center sm:p-6" glow>
                  <span className="text-4xl">🏁</span>
                  <h2 className="mt-3 font-display text-lg font-bold text-white">Fin de Présidence</h2>
                  <p className="mt-2 text-sm text-ice-200/70">
                    Tes {PRESIDENCY_LENGTH} saisons à la tête du club touchent à leur fin. Tu peux repartir en paix, ou tenter le dernier coup.
                  </p>

                  {lastOutcome !== null ? (
                    <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} className="mt-4 whitespace-pre-line rounded-xl border border-white/10 bg-white/[0.03] p-4 text-left text-sm text-ice-200/80">
                      {lastOutcome}
                    </motion.div>
                  ) : (
                    <div className="mx-auto mt-5 flex max-w-sm flex-col gap-2">
                      <Button variant="secondary" onClick={endPresidencyQuietly} disabled={resolving} className="w-full">
                        Transmettre sagement le club
                      </Button>
                      <Button variant="gold" onClick={sellClub} disabled={resolving} className="w-full">
                        💸 Vendre le club à un fonds étranger
                      </Button>
                    </div>
                  )}
                </Card>
              )}
            </div>
          )}

          {phase === "recap" && result && (
            <Card className="p-4 text-center sm:p-6" glow>
              <span className="text-5xl">{result.ousted ? "⚖️" : result.club.tier === 0 ? "🚪" : "🏆"}</span>
              <h2 className="mt-3 font-display text-xl font-bold text-white">{result.label}</h2>
              <p className="mt-1 text-sm text-ice-200/60">{result.club.label}</p>
              {result.club.tier > 0 && (
                <div className="mx-auto mt-4 grid max-w-xs grid-cols-2 gap-2">
                  <StatTile label="Soutien final" value={`${result.support}/100`} />
                  <StatTile label="Budget" value={`${result.budget >= 0 ? "+" : ""}${result.budget}`} />
                </div>
              )}
              <p className="mt-4 font-display text-2xl font-bold text-gold-400">+{formatCredits(result.payout)}</p>
              <Button size="lg" className="mt-6" onClick={reset}>Nouvelle présidence</Button>
            </Card>
          )}
        </motion.div>
      )}

      {view === "palmares" && <Palmares />}
      {view === "salon" && <RoomChat table="club_messages" title="Vestiaire des Présidents" />}

      <WinCelebration tier={celebration?.tier ?? "none"} payout={celebration?.payout ?? 0} onClose={() => setCelebration(null)} />
    </div>
  );
}

interface RecordRow {
  id: string;
  clubLabel: string;
  outcomeLabel: string;
  support: number;
  payout: number;
  ousted: boolean;
  username: string;
  avatar: string;
}

async function fetchRecords(): Promise<RecordRow[]> {
  const { data } = await supabase
    .from("club_records")
    .select("id, club_label, outcome_label, support, payout, ousted, profile:profiles(username, avatar)")
    .order("payout", { ascending: false })
    .limit(50);
  return (data ?? []).map((r: any) => ({
    id: r.id,
    clubLabel: r.club_label,
    outcomeLabel: r.outcome_label,
    support: r.support,
    payout: r.payout,
    ousted: r.ousted,
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
      .channel("club-records-changes")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "club_records" }, refresh)
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
        <p className="px-5 py-8 text-center text-sm text-ice-200/40">Aucune présidence terminée pour l'instant.</p>
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
                  {r.username} <span className="font-normal text-ice-200/40">— {r.clubLabel}</span>
                </p>
                <p className="text-xs text-ice-200/40">{r.outcomeLabel} · Soutien {r.support}/100</p>
              </div>
              <Badge tone={r.ousted ? "danger" : "success"}>{r.ousted ? "Démis" : "Réélu"}</Badge>
              <span className="font-display text-sm font-bold text-gold-400">{formatCredits(r.payout)}</span>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}
