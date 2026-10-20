import { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useCasinoStore } from "../store/casinoStore";
import { useToastStore } from "../store/toastStore";
import { useGameStatusStore } from "../store/gameStatusStore";
import { Card } from "../components/ui/Card";
import { Button } from "../components/ui/Button";
import { Badge } from "../components/ui/Badge";
import { BetInput } from "../components/ui/BetInput";
import { WinCelebration } from "../components/ui/WinCelebration";
import { CrashChart } from "../components/games/CrashChart";
import { formatCredits, cn } from "../lib/format";
import { maxBetFor } from "../lib/betting";
import { xpForPayout } from "../lib/xp";
import { rollCrashPoint, multiplierAt, timeForMultiplier } from "../lib/crashEngine";
import { tierFromMultiplier, type WinTier } from "../lib/winTiers";
import { playSound } from "../lib/sounds";

type Phase = "idle" | "running" | "ended";

function crashColor(m: number): string {
  return m < 2 ? "bg-red-500/20 text-red-300" : m < 10 ? "bg-emerald-500/20 text-emerald-300" : "bg-gold-500/20 text-gold-300";
}

export function Crash() {
  const credits = useCasinoStore((s) => s.credits);
  const level = useCasinoStore((s) => s.level);
  const placeBet = useCasinoStore((s) => s.placeBet);
  const award = useCasinoStore((s) => s.award);
  const addXp = useCasinoStore((s) => s.addXp);
  const recordRound = useCasinoStore((s) => s.recordRound);
  const history = useCasinoStore((s) => s.history);
  const push = useToastStore((s) => s.push);
  const winBias = useGameStatusStore((s) => s.statuses.crash?.winBias ?? 1);

  const maxBet = maxBetFor(credits, level);
  const [bet, setBet] = useState(Math.min(50, maxBet));
  const [autoCash, setAutoCash] = useState("");
  const [phase, setPhase] = useState<Phase>("idle");
  const [elapsed, setElapsed] = useState(0);
  const [crashPoint, setCrashPoint] = useState<number | null>(null);
  const [cashedAt, setCashedAt] = useState<number | null>(null);
  const [celebration, setCelebration] = useState<{ tier: WinTier; payout: number } | null>(null);
  const live = useRef({ bet, cashed: null as number | null, auto: 0, crash: null as number | null, running: false });

  const crashHistory = history.filter((h) => h.game === "Crash").slice(0, 8);
  const pastCrashes = history
    .filter((h) => h.game === "Crash")
    .map((h) => ({ id: h.id, m: Number(/x([\d.]+)/.exec(h.label)?.[1]) }))
    .filter((p) => !Number.isNaN(p.m))
    .slice(0, 14);

  const multiplier = crashPoint !== null && phase === "ended" ? crashPoint : multiplierAt(elapsed);

  useEffect(() => {
    if (phase !== "running" || crashPoint === null) return;
    const start = performance.now();
    const crashAtMs = timeForMultiplier(crashPoint);
    let raf = 0;
    const tick = (now: number) => {
      const t = now - start;
      const L = live.current;
      if (L.cashed === null && L.auto > 1 && L.auto < crashPoint && t >= timeForMultiplier(L.auto)) cashOutAt(L.auto);
      if (t >= crashAtMs) {
        setElapsed(crashAtMs);
        endRound(crashPoint);
        return;
      }
      setElapsed(t);
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, crashPoint]);

  // Leaving mid-round: the round is already decided, so settle it as it would have played out —
  // the auto cash-out still fires if it was below the crash point, otherwise the bet is lost.
  useEffect(
    () => () => {
      const L = live.current;
      if (!L.running || L.crash === null) return;
      if (L.cashed === null && L.auto > 1 && L.auto < L.crash) cashOutAt(L.auto, true);
      endRound(L.crash, true);
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    []
  );

  function start() {
    if (phase === "running" || credits < bet) {
      if (credits < bet) push({ kind: "info", title: "Crédits insuffisants" });
      return;
    }
    placeBet(bet);
    const auto = Number(autoCash.replace(",", "."));
    const point = rollCrashPoint(winBias);
    live.current = { bet, cashed: null, auto: Number.isFinite(auto) ? auto : 0, crash: point, running: true };
    setElapsed(0);
    setCashedAt(null);
    setCrashPoint(point);
    setPhase("running");
    playSound("spin");
  }

  function endRound(point: number, silent = false) {
    const L = live.current;
    if (!L.running) return;
    L.running = false;
    setPhase("ended");
    if (!silent) playSound("boom");
    const label = `Crash x${point.toFixed(2)}`;
    if (L.cashed === null) {
      recordRound({ game: "Crash", label, bet: L.bet, payout: 0, tier: "none" });
      push({ kind: "info", title: `Ça a explosé à x${point.toFixed(2)}`, description: "Manche perdue." });
    } else {
      recordRound({ game: "Crash", label, bet: L.bet, payout: Math.round(L.bet * L.cashed), tier: tierFromMultiplier(L.cashed) });
    }
  }

  function cashOutAt(m: number, silent = false) {
    const L = live.current;
    if (L.cashed !== null || !L.running) return;
    L.cashed = m;
    setCashedAt(m);
    if (!silent) playSound("win");
    const payout = Math.round(L.bet * m);
    award(payout);
    addXp(xpForPayout(payout));
    const tier = tierFromMultiplier(m);
    if (!silent && (tier === "megaWin" || tier === "gigaWin" || tier === "maxWin")) {
      setCelebration({ tier, payout });
    } else {
      push({ kind: "success", title: `Encaissé à x${m.toFixed(2)} — +${formatCredits(payout)} crédits` });
    }
  }

  const crashed = phase === "ended";

  return (
    <div className="mx-auto max-w-3xl px-4 py-8 sm:px-6">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="font-display text-2xl font-bold text-white sm:text-3xl">Crash</h1>
          <p className="text-sm text-ice-200/60">Encaisse avant l'explosion — plus tu attends, plus le multiplicateur grimpe.</p>
        </div>
        <Badge tone="gold">Crédits virtuels uniquement</Badge>
      </div>

      {pastCrashes.length > 0 && (
        <div className="mb-3 flex gap-1.5 overflow-hidden">
          <AnimatePresence initial={false}>
            {pastCrashes.map((p) => (
              <motion.span
                key={p.id}
                layout
                initial={{ opacity: 0, x: -20, scale: 0.6 }}
                animate={{ opacity: 1, x: 0, scale: 1 }}
                className={cn("shrink-0 rounded-md px-2 py-1 text-[11px] font-bold", crashColor(p.m))}
              >
                x{p.m.toFixed(2)}
              </motion.span>
            ))}
          </AnimatePresence>
        </div>
      )}

      <Card className="p-4 sm:p-8" glow>
        <CrashChart
          phase={phase}
          elapsedMs={elapsed}
          multiplier={multiplier}
          shake={cashedAt === null}
          markers={cashedAt !== null ? [{ key: "me", m: cashedAt, label: `Toi · x${cashedAt.toFixed(2)}`, mine: true }] : []}
        >
          <p
            className={cn(
              "font-display text-5xl font-black tabular-nums sm:text-6xl",
              crashed ? "text-red-400" : cashedAt !== null ? "text-emerald-300" : "text-white"
            )}
            style={{ textShadow: "0 0 24px rgba(0,0,0,0.8)" }}
          >
            x{multiplier.toFixed(2)}
          </p>
          {crashed && (
            <motion.p initial={{ scale: 2, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="mt-1 text-sm font-black tracking-[0.3em] text-red-400">
              CRASH
            </motion.p>
          )}
          {phase === "running" && cashedAt !== null && (
            <p className="mt-1 text-xs font-semibold text-emerald-300">Encaissé à x{cashedAt.toFixed(2)} — regarde jusqu'où ça monte…</p>
          )}
        </CrashChart>

        <div className="mt-6 flex flex-wrap items-center justify-between gap-4">
          {phase === "running" ? (
            <div className="flex w-full items-center justify-between gap-4">
              <p className="text-sm text-ice-200/60">
                {cashedAt === null ? `Gain potentiel : ${formatCredits(Math.round(bet * multiplier))}` : `Gain : +${formatCredits(Math.round(bet * cashedAt))}`}
              </p>
              <Button variant="gold" size="lg" onClick={() => cashOutAt(multiplier)} disabled={cashedAt !== null}>
                {cashedAt === null ? `Encaisser ${formatCredits(Math.round(bet * multiplier))}` : "Encaissé ✓"}
              </Button>
            </div>
          ) : (
            <>
              <div className="flex flex-wrap items-center gap-3">
                <BetInput value={bet} onChange={setBet} max={maxBet} min={Math.min(10, maxBet)} />
                <label className="flex items-center gap-1.5 text-xs text-ice-200/50">
                  Cash-out auto x
                  <input
                    type="number"
                    step="0.1"
                    min="1.01"
                    value={autoCash}
                    onChange={(e) => setAutoCash(e.target.value)}
                    placeholder="—"
                    className="input w-20 py-1 text-xs"
                  />
                </label>
              </div>
              <Button size="lg" onClick={start} disabled={credits < bet}>
                {phase === "ended" ? "Rejouer" : "Miser"} ({formatCredits(bet)})
              </Button>
            </>
          )}
        </div>
      </Card>

      {crashHistory.length > 0 && (
        <Card className="mt-6 p-4">
          <h3 className="mb-3 font-display text-sm font-semibold text-white">Historique récent</h3>
          <ul className="flex flex-col gap-2">
            {crashHistory.map((h) => (
              <li key={h.id} className="flex items-center justify-between text-xs">
                <span className="text-ice-200/60">Mise {formatCredits(h.bet)} · {h.label}</span>
                <span className={h.payout > 0 ? "font-semibold text-emerald-400" : "text-ice-200/40"}>
                  {h.payout > 0 ? `+${formatCredits(h.payout)}` : "—"}
                </span>
              </li>
            ))}
          </ul>
        </Card>
      )}

      <WinCelebration tier={celebration?.tier ?? "none"} payout={celebration?.payout ?? 0} onClose={() => setCelebration(null)} />
    </div>
  );
}
