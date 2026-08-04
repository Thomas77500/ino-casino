import { useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import { useCasinoStore } from "../store/casinoStore";
import { useToastStore } from "../store/toastStore";
import { useGameStatusStore } from "../store/gameStatusStore";
import { Card } from "../components/ui/Card";
import { Button } from "../components/ui/Button";
import { Badge } from "../components/ui/Badge";
import { BetInput } from "../components/ui/BetInput";
import { WinCelebration } from "../components/ui/WinCelebration";
import { formatCredits } from "../lib/format";
import { maxBetFor } from "../lib/betting";
import { xpForPayout } from "../lib/xp";
import { rollCrashPoint, multiplierAt } from "../lib/crashEngine";
import { tierFromMultiplier, type WinTier } from "../lib/winTiers";

type Phase = "idle" | "running" | "crashed" | "cashed";

const MAX_DISPLAY_MS = 5000; // x-axis reaches full width around here; higher rounds just climb straight up
const MAX_DISPLAY_MULTIPLIER = 20; // y-axis reaches full height around here

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
  const [phase, setPhase] = useState<Phase>("idle");
  const [multiplier, setMultiplier] = useState(1);
  const [crashPoint, setCrashPoint] = useState<number | null>(null);
  const [cashedAt, setCashedAt] = useState<number | null>(null);
  const [points, setPoints] = useState<[number, number][]>([[0, 100]]);
  const [celebration, setCelebration] = useState<{ tier: WinTier; payout: number } | null>(null);
  const rafRef = useRef<number>();
  const betRef = useRef(bet);
  betRef.current = bet;

  const crashHistory = history.filter((h) => h.game === "Crash").slice(0, 8);

  useEffect(() => {
    if (phase !== "running" || crashPoint === null) return;
    const start = performance.now();

    function tick(now: number) {
      const elapsed = now - start;
      const m = multiplierAt(elapsed);
      if (m >= crashPoint!) {
        setMultiplier(crashPoint!);
        finalizeCrash(crashPoint!);
        return;
      }
      setMultiplier(m);
      const x = Math.min(100, (elapsed / MAX_DISPLAY_MS) * 100);
      const y = 100 - Math.min(100, (Math.log2(m) / Math.log2(MAX_DISPLAY_MULTIPLIER)) * 100);
      setPoints((prev) => [...prev, [x, y]]);
      rafRef.current = requestAnimationFrame(tick);
    }
    rafRef.current = requestAnimationFrame(tick);
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, crashPoint]);

  function start() {
    if (phase === "running" || credits < bet) {
      if (credits < bet) push({ kind: "info", title: "Crédits insuffisants" });
      return;
    }
    placeBet(bet);
    setPoints([[0, 100]]);
    setMultiplier(1);
    setCashedAt(null);
    setCrashPoint(rollCrashPoint(winBias));
    setPhase("running");
  }

  function finalizeCrash(point: number) {
    setPhase("crashed");
    recordRound({ game: "Crash", label: "Crash", bet: betRef.current, payout: 0, tier: "none" });
    push({ kind: "info", title: `Ça a explosé à x${point.toFixed(2)}`, description: "Manche perdue." });
  }

  function cashOut() {
    if (phase !== "running") return;
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    const m = multiplier;
    setCashedAt(m);
    setPhase("cashed");
    const payout = Math.round(bet * m);
    award(payout);
    addXp(xpForPayout(payout));
    const tier = tierFromMultiplier(m);
    recordRound({ game: "Crash", label: "Crash", bet, payout, tier });
    if (tier === "megaWin" || tier === "gigaWin" || tier === "maxWin") {
      setCelebration({ tier, payout });
    } else {
      push({ kind: "success", title: `Encaissé à x${m.toFixed(2)} — +${formatCredits(payout)} crédits` });
    }
  }

  function reset() {
    setPhase("idle");
    setCrashPoint(null);
    setCashedAt(null);
    setPoints([[0, 100]]);
    setMultiplier(1);
  }

  const svgPoints = points.map(([x, y]) => `${x},${y}`).join(" ");
  const tipX = points[points.length - 1]?.[0] ?? 0;
  const tipY = points[points.length - 1]?.[1] ?? 100;
  const crashed = phase === "crashed";

  return (
    <div className="mx-auto max-w-3xl px-4 py-8 sm:px-6">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="font-display text-2xl font-bold text-white sm:text-3xl">Crash</h1>
          <p className="text-sm text-ice-200/60">Encaisse avant l'explosion — plus tu attends, plus le multiplicateur grimpe.</p>
        </div>
        <Badge tone="gold">Crédits virtuels uniquement</Badge>
      </div>

      <Card className="p-4 sm:p-8" glow>
        <motion.div
          animate={crashed ? { x: [0, -8, 8, -5, 5, 0] } : {}}
          transition={{ duration: 0.4 }}
          className={`relative h-64 overflow-hidden rounded-2xl border ${crashed ? "border-red-500/40 bg-red-950/20" : "border-white/10 bg-gradient-to-b from-ink-900/60 to-ink-950/60"}`}
        >
          <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="absolute inset-0 h-full w-full">
            <polyline
              points={svgPoints}
              fill="none"
              stroke={crashed ? "#ef4444" : "#f6bf4b"}
              strokeWidth="1.2"
              vectorEffect="non-scaling-stroke"
            />
          </svg>
          <div
            className="absolute text-2xl"
            style={{ left: `${tipX}%`, top: `${tipY}%`, transform: "translate(-50%,-50%)" }}
          >
            {crashed ? "💥" : phase === "running" ? "🚀" : "🛰️"}
          </div>

          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <motion.p
              animate={phase === "running" ? { scale: [1, 1.03, 1] } : {}}
              transition={{ duration: 0.5, repeat: Infinity }}
              className={`font-display text-4xl font-bold sm:text-5xl ${crashed ? "text-red-400" : "text-white"}`}
            >
              x{multiplier.toFixed(2)}
            </motion.p>
            {crashed && <p className="mt-1 text-sm font-semibold text-red-400">CRASH</p>}
            {cashedAt && phase === "cashed" && <p className="mt-1 text-sm font-semibold text-emerald-400">Encaissé !</p>}
          </div>
        </motion.div>

        <div className="mt-6 flex flex-wrap items-center justify-between gap-4">
          {phase === "idle" ? (
            <>
              <BetInput value={bet} onChange={setBet} max={maxBet} min={Math.min(10, maxBet)} />
              <Button size="lg" onClick={start} disabled={credits < bet}>
                Miser ({formatCredits(bet)})
              </Button>
            </>
          ) : phase === "running" ? (
            <div className="flex w-full items-center justify-between gap-4">
              <p className="text-sm text-ice-200/60">Gain potentiel : {formatCredits(Math.round(bet * multiplier))}</p>
              <Button variant="gold" size="lg" onClick={cashOut}>Encaisser</Button>
            </div>
          ) : (
            <div className="flex w-full items-center justify-between">
              <p className="text-sm text-ice-200/60">
                {phase === "crashed" ? "Le vaisseau a explosé avant que tu encaisses." : `Tu as encaissé à x${cashedAt?.toFixed(2)}.`}
              </p>
              <Button size="lg" onClick={reset}>Nouvelle manche</Button>
            </div>
          )}
        </div>
      </Card>

      {crashHistory.length > 0 && (
        <Card className="mt-6 p-4">
          <h3 className="mb-3 font-display text-sm font-semibold text-white">Historique récent</h3>
          <ul className="flex flex-col gap-2">
            {crashHistory.map((h) => (
              <li key={h.id} className="flex items-center justify-between text-xs">
                <span className="text-ice-200/60">Mise {formatCredits(h.bet)}</span>
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
