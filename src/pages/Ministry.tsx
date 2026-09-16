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
import { RoomChat } from "../components/ui/RoomChat";
import { WinCelebration } from "../components/ui/WinCelebration";
import { IconMinistry, IconLock } from "../components/icons";
import { formatCredits, cn } from "../lib/format";
import { xpForPayout } from "../lib/xp";
import { tierFromMultiplier, type WinTier } from "../lib/winTiers";
import {
  MINISTRIES, drawMinistry, randomDecoyMinistry, type Ministry as MinistryDef,
  UNLOCK_TOTAL_WON, ENTRY_COST, MANDATE_LENGTH, START_POPULARITY,
  drawMandateEvents, type MandateEvent, CATEGORY_LABEL,
  billsForYear, resolveVote, resolveBribeLeak, type Bill, type VoteChoice,
  bribeCost, resolveBribe, resolveChaos, resolveCensureMotion, computeOutcome,
} from "../lib/ministryEngine";

const ITEM_WIDTH = 128;
const ITEM_GAP = 8;
const TRACK_PAD = 8;
const ITEM_STEP = ITEM_WIDTH + ITEM_GAP;
const REEL_LENGTH = 60;
const WINNING_INDEX = 50;
const SPIN_DURATION = 5.5;

type View = "mandat" | "palmares" | "salon";
type Phase = "idle" | "spinning" | "votes" | "event" | "recap";

interface MandateState {
  ministry: MinistryDef;
  turn: number;
  popularity: number;
  treasury: number;
  events: MandateEvent[];
  startYear: number;
  bills: Bill[];
  billIndex: number;
}

interface RoundResult {
  ministry: MinistryDef;
  popularity: number;
  treasury: number;
  payout: number;
  label: string;
  censured: boolean;
}

const CATEGORY_TONE: Record<MandateEvent["category"], "danger" | "gold" | "electric" | "neutral" | "success"> = {
  polemique: "danger",
  derive: "gold",
  fun: "electric",
  serieux: "neutral",
  vote: "success",
  election: "gold",
};

function MiniStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-white/10 bg-white/[0.03] p-2.5 text-center">
      <p className="text-[10px] uppercase tracking-wide text-ice-200/40">{label}</p>
      <p className="mt-0.5 font-display text-sm font-bold text-white">{value}</p>
    </div>
  );
}

function ReelTile({ ministry }: { ministry: MinistryDef }) {
  return (
    <div className={cn("flex h-32 w-32 shrink-0 flex-col items-center justify-center gap-1 rounded-xl border-2 border-white/15 bg-gradient-to-br p-2 text-center", ministry.accent)}>
      <span className="text-4xl">{ministry.glyph}</span>
      <p className="text-[11px] font-semibold leading-tight text-white">{ministry.label}</p>
    </div>
  );
}

export function Ministry() {
  const totalWon = useCasinoStore((s) => s.totalWon);
  const credits = useCasinoStore((s) => s.credits);
  const placeBet = useCasinoStore((s) => s.placeBet);
  const award = useCasinoStore((s) => s.award);
  const addXp = useCasinoStore((s) => s.addXp);
  const recordRound = useCasinoStore((s) => s.recordRound);
  const push = useToastStore((s) => s.push);
  const winBias = useGameStatusStore((s) => s.statuses.ministry?.winBias ?? 1);
  const account = useAuthStore((s) => s.account);

  const [view, setView] = useState<View>("mandat");
  const [phase, setPhase] = useState<Phase>("idle");
  const [reel, setReel] = useState<MinistryDef[]>(() => Array.from({ length: 10 }, randomDecoyMinistry));
  const [offset, setOffset] = useState(0);
  const [spinning, setSpinning] = useState(false);
  const [mandate, setMandate] = useState<MandateState | null>(null);
  const [resolving, setResolving] = useState(false);
  const [lastOutcome, setLastOutcome] = useState<string | null>(null);
  const [chaosActive, setChaosActive] = useState(false);
  const [celebration, setCelebration] = useState<{ tier: WinTier; payout: number } | null>(null);
  const [result, setResult] = useState<RoundResult | null>(null);
  const trackRef = useRef<HTMLDivElement>(null);
  const pendingWinnerRef = useRef<MinistryDef | null>(null);

  const unlocked = totalWon >= UNLOCK_TOTAL_WON;

  function finalizeRound(ministry: MinistryDef, popularity: number, treasury: number, outcome: { payout: number; label: string }, censured: boolean) {
    award(outcome.payout);
    addXp(xpForPayout(outcome.payout));
    const tier = tierFromMultiplier(outcome.payout / ENTRY_COST);
    recordRound({ game: "Ministry", label: `${ministry.label} — ${outcome.label}`, bet: ENTRY_COST, payout: outcome.payout, tier });
    if (tier === "megaWin" || tier === "gigaWin" || tier === "maxWin") {
      setCelebration({ tier, payout: outcome.payout });
    } else {
      push({ kind: "success", title: `+${formatCredits(outcome.payout)} crédits` });
    }

    if (account) {
      supabase.from("ministry_records").insert({
        user_id: account.id,
        ministry_id: ministry.id,
        ministry_label: ministry.label,
        outcome_label: outcome.label,
        popularity,
        treasury,
        payout: outcome.payout,
        censured,
      });
    }

    setResult({ ministry, popularity, treasury, payout: outcome.payout, label: outcome.label, censured });
    setMandate(null);
    setLastOutcome(null);
    setResolving(false);
    setPhase("recap");
  }

  function appoint(ministry: MinistryDef) {
    setSpinning(false);
    if (ministry.tier === 0) {
      finalizeRound(ministry, 0, 0, computeOutcome(ministry, 0, 0, false), false);
      return;
    }
    const startYear = new Date().getFullYear();
    setMandate({
      ministry, turn: 0, popularity: START_POPULARITY, treasury: 0,
      events: drawMandateEvents(startYear), startYear,
      bills: billsForYear(ministry), billIndex: 0,
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

    const winner = drawMinistry(winBias);
    const strip = Array.from({ length: REEL_LENGTH }, (_, i) => (i === WINNING_INDEX ? winner : randomDecoyMinistry()));
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
    if (!mandate || resolving) return;
    const bill = mandate.bills[mandate.billIndex];
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
        extraPenalty = leak.popularityPenalty;
      }
    }

    const result = resolveVote(bill, vote, winBias);
    const newPopularity = Math.max(0, Math.min(100, mandate.popularity + result.popularity - extraPenalty));
    const newTreasury = mandate.treasury + result.treasury;

    setResolving(true);
    setLastOutcome(result.narrative + extraText);

    setTimeout(() => {
      if (newPopularity <= 0) {
        finalizeRound(mandate.ministry, newPopularity, newTreasury, computeOutcome(mandate.ministry, newPopularity, newTreasury, true), true);
        return;
      }
      const nextBillIndex = mandate.billIndex + 1;
      if (nextBillIndex < mandate.bills.length) {
        setMandate({ ...mandate, billIndex: nextBillIndex, popularity: newPopularity, treasury: newTreasury });
        setLastOutcome(null);
        setResolving(false);
      } else {
        setMandate({ ...mandate, popularity: newPopularity, treasury: newTreasury });
        setLastOutcome(null);
        setResolving(false);
        setPhase("event");
      }
    }, 1100);
  }

  function choose(choice: "a" | "b" | "bribe") {
    if (!mandate || resolving) return;
    const event = mandate.events[mandate.turn];
    let popDelta = 0;
    let treasuryDelta = 0;
    let outcomeText = "";

    if (choice === "bribe") {
      const cost = bribeCost(mandate.ministry);
      if (credits < cost) {
        push({ kind: "info", title: "Crédits insuffisants pour soudoyer" });
        return;
      }
      placeBet(cost);
      const r = resolveBribe(winBias);
      popDelta = r.popularity;
      treasuryDelta = r.treasury;
      outcomeText = r.outcome;
      push({ kind: r.success ? "success" : "info", title: r.success ? "Soudoiement réussi" : "Soudoiement éventé" });
    } else {
      const picked = choice === "a" ? event.choices[0] : event.choices[1];
      if (picked.chaos) {
        const r = resolveChaos();
        popDelta = r.popularity;
        treasuryDelta = r.treasury;
        outcomeText = r.outcome;
        setChaosActive(true);
        setTimeout(() => setChaosActive(false), 2400);
      } else {
        popDelta = picked.popularity;
        treasuryDelta = picked.treasury;
        outcomeText = picked.outcome;
      }
    }

    let newPopularity = Math.max(0, Math.min(100, mandate.popularity + popDelta));
    const newTreasury = mandate.treasury + treasuryDelta;
    let censured = newPopularity <= 0;
    const nextTurn = mandate.turn + 1;

    // A motion de censure is only ever tabled once popularity has already survived the choice
    // above (a hard zero is a total collapse, no vote needed) — the lower it is, the more likely
    // it fails.
    if (!censured && newPopularity <= 30) {
      const cm = resolveCensureMotion(newPopularity, winBias);
      outcomeText += `\n\n${cm.narrative}`;
      if (cm.survived) {
        newPopularity = Math.max(0, newPopularity - cm.popularityPenalty);
        censured = newPopularity <= 0;
      } else {
        censured = true;
      }
    }

    setResolving(true);
    setLastOutcome(outcomeText);

    setTimeout(() => {
      if (censured || nextTurn >= MANDATE_LENGTH) {
        finalizeRound(mandate.ministry, newPopularity, newTreasury, computeOutcome(mandate.ministry, newPopularity, newTreasury, censured), censured);
      } else {
        setMandate({
          ...mandate, turn: nextTurn, popularity: newPopularity, treasury: newTreasury,
          bills: billsForYear(mandate.ministry), billIndex: 0,
        });
        setLastOutcome(null);
        setResolving(false);
        setPhase("votes");
      }
    }, outcomeText.includes("Motion de censure") ? 3200 : 2000);
  }

  function reset() {
    setPhase("idle");
    setResult(null);
  }

  if (!unlocked) {
    return (
      <div className="mx-auto max-w-lg px-4 py-16 text-center">
        <IconLock className="mx-auto mb-4 h-10 w-10 text-ice-200/40" />
        <h1 className="font-display text-2xl font-bold text-white">Ministère verrouillé</h1>
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
  const currentBill = mandate?.bills[mandate.billIndex] ?? null;

  return (
    <div className="mx-auto max-w-4xl px-4 py-8 sm:px-6">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-2">
          <IconMinistry className="h-6 w-6 text-gold-400" />
          <div>
            <h1 className="font-display text-2xl font-bold text-white sm:text-3xl">Ministère</h1>
            <p className="text-sm text-ice-200/60">Roulette de nomination, puis un mandat de {MANDATE_LENGTH} ans à ta sauce. 100% fictif, open bar.</p>
          </div>
        </div>
        <div className="flex items-center gap-1 rounded-xl border border-white/10 bg-white/[0.03] p-1">
          {(["mandat", "palmares", "salon"] as View[]).map((v) => (
            <button key={v} onClick={() => setView(v)} className={cn("rounded-lg px-3 py-1.5 text-xs font-semibold capitalize", view === v ? "bg-electric-500 text-white" : "text-ice-200/60")}>
              {v === "mandat" ? "Mandat" : v === "palmares" ? "Palmarès" : "Salon"}
            </button>
          ))}
        </div>
      </div>

      {view === "mandat" && (
        <motion.div
          animate={chaosActive ? { filter: ["hue-rotate(0deg) saturate(1)", "hue-rotate(210deg) saturate(2.6)", "hue-rotate(330deg) saturate(2.2)", "hue-rotate(0deg) saturate(1)"] } : { filter: "hue-rotate(0deg) saturate(1)" }}
          transition={chaosActive ? { duration: 2.2, ease: "easeInOut" } : { duration: 0.4 }}
        >
          {phase === "idle" && (
            <Card className="p-4 text-center sm:p-6" glow>
              <div className="mx-auto flex max-w-md flex-wrap justify-center gap-1.5">
                {MINISTRIES.map((m) => (
                  <span key={m.id} className="text-xl" title={m.label}>{m.glyph}</span>
                ))}
              </div>
              <p className="mt-4 text-sm text-ice-200/60">
                Tourne la roulette de nomination. Selon la case, tu prends un portefeuille pour {MANDATE_LENGTH} ans —
                15 à 20 votes de lois de finances par année, un grand événement, et une motion de censure jamais loin
                si ta popularité s'effondre.
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
                  {reel.map((m, i) => (
                    <ReelTile key={i} ministry={m} />
                  ))}
                </div>
              </div>
            </Card>
          )}

          {(phase === "votes" || phase === "event") && mandate && (
            <div className="flex flex-col gap-4">
              <Card className="p-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="flex items-center gap-2">
                    <span className="text-2xl">{mandate.ministry.glyph}</span>
                    <div>
                      <p className="text-sm font-semibold text-white">{mandate.ministry.label}</p>
                      <p className="text-xs text-ice-200/40">Année {mandate.turn + 1}/{MANDATE_LENGTH} · {mandate.startYear + mandate.turn}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-4">
                    <div className="w-36">
                      <p className="mb-1 text-[10px] uppercase tracking-wide text-ice-200/40">Popularité</p>
                      <ProgressBar value={mandate.popularity} max={100} />
                    </div>
                    <div className="text-right">
                      <p className="text-[10px] uppercase tracking-wide text-ice-200/40">Trésorerie</p>
                      <p className={cn("font-display text-sm font-bold", mandate.treasury >= 0 ? "text-emerald-400" : "text-red-400")}>
                        {mandate.treasury >= 0 ? "+" : ""}{mandate.treasury}
                      </p>
                    </div>
                  </div>
                </div>
              </Card>

              {phase === "votes" && currentBill && (
                <Card className="p-4 sm:p-6" glow>
                  <div className="mb-3 flex items-center justify-between gap-2">
                    <Badge tone={currentBill.direction === "hausse" ? "danger" : "success"}>
                      {currentBill.direction === "hausse" ? "Hausse" : "Baisse"}
                    </Badge>
                    <span className="text-xs text-ice-200/40">Vote {mandate.billIndex + 1}/{mandate.bills.length}</span>
                  </div>
                  <h2 className="font-display text-lg font-bold text-white">{currentBill.title}</h2>
                  <p className="mt-2 text-sm text-ice-200/70">
                    Impact estimé : {currentBill.amountMdEur} Md€ — touche surtout {currentBill.topic.affected}.
                  </p>

                  {currentBill.bribeOffer && lastOutcome === null && (
                    <p className="mt-3 rounded-lg border border-gold-400/30 bg-gold-500/10 p-2.5 text-xs text-gold-300">
                      💰 Le Premier ministre te propose {formatCredits(currentBill.bribeOffer.amount)} crédits pour voter{" "}
                      {currentBill.bribeOffer.direction === "pour" ? "POUR" : "CONTRE"}.
                    </p>
                  )}

                  {lastOutcome !== null ? (
                    <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} className="mt-4 whitespace-pre-line rounded-xl border border-white/10 bg-white/[0.03] p-4 text-sm text-ice-200/80">
                      {lastOutcome}
                    </motion.div>
                  ) : (
                    <div className="mt-5 flex gap-2">
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
                      <Button variant="gold" onClick={() => choose("bribe")} disabled={resolving || credits < bribeCost(mandate.ministry)} className="w-full">
                        💰 Soudoyer — {formatCredits(bribeCost(mandate.ministry))}
                      </Button>
                    </div>
                  )}
                </Card>
              )}
            </div>
          )}

          {phase === "recap" && result && (
            <Card className="p-4 text-center sm:p-6" glow>
              <span className="text-5xl">{result.censured ? "⚖️" : result.ministry.tier === 0 ? "🚪" : "🏛️"}</span>
              <h2 className="mt-3 font-display text-xl font-bold text-white">{result.label}</h2>
              <p className="mt-1 text-sm text-ice-200/60">{result.ministry.label}</p>
              {result.ministry.tier > 0 && (
                <div className="mx-auto mt-4 grid max-w-xs grid-cols-2 gap-2">
                  <MiniStat label="Popularité finale" value={`${result.popularity}/100`} />
                  <MiniStat label="Trésorerie" value={`${result.treasury >= 0 ? "+" : ""}${result.treasury}`} />
                </div>
              )}
              <p className="mt-4 font-display text-2xl font-bold text-gold-400">+{formatCredits(result.payout)}</p>
              <Button size="lg" className="mt-6" onClick={reset}>Nouveau mandat</Button>
            </Card>
          )}
        </motion.div>
      )}

      {view === "palmares" && <Palmares />}
      {view === "salon" && <RoomChat table="ministry_messages" title="Conseil des Ministres" />}

      <WinCelebration tier={celebration?.tier ?? "none"} payout={celebration?.payout ?? 0} onClose={() => setCelebration(null)} />
    </div>
  );
}

interface RecordRow {
  id: string;
  ministryLabel: string;
  outcomeLabel: string;
  popularity: number;
  payout: number;
  censured: boolean;
  username: string;
  avatar: string;
}

async function fetchRecords(): Promise<RecordRow[]> {
  const { data } = await supabase
    .from("ministry_records")
    .select("id, ministry_label, outcome_label, popularity, payout, censured, profile:profiles(username, avatar)")
    .order("payout", { ascending: false })
    .limit(50);
  return (data ?? []).map((r: any) => ({
    id: r.id,
    ministryLabel: r.ministry_label,
    outcomeLabel: r.outcome_label,
    popularity: r.popularity,
    payout: r.payout,
    censured: r.censured,
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
      .channel("ministry-records-changes")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "ministry_records" }, refresh)
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
        <p className="px-5 py-8 text-center text-sm text-ice-200/40">Aucun mandat terminé pour l'instant.</p>
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
                  {r.username} <span className="font-normal text-ice-200/40">— {r.ministryLabel}</span>
                </p>
                <p className="text-xs text-ice-200/40">{r.outcomeLabel} · Popularité {r.popularity}/100</p>
              </div>
              <Badge tone={r.censured ? "danger" : "success"}>{r.censured ? "Censuré" : "Réélu"}</Badge>
              <span className="font-display text-sm font-bold text-gold-400">{formatCredits(r.payout)}</span>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}
