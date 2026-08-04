import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { useCasinoStore } from "../store/casinoStore";
import { useToastStore } from "../store/toastStore";
import { useGameStatusStore } from "../store/gameStatusStore";
import { Card } from "../components/ui/Card";
import { Button } from "../components/ui/Button";
import { Badge } from "../components/ui/Badge";
import { BetInput } from "../components/ui/BetInput";
import { WinCelebration } from "../components/ui/WinCelebration";
import { formatCredits, cn } from "../lib/format";
import { maxBetFor } from "../lib/betting";
import { xpForPayout } from "../lib/xp";
import { ROWS, BUCKET_MULTIPLIERS, RISK_LABEL, dropBall, type RiskLevel, type DropResult } from "../lib/plinkoEngine";
import { tierFromMultiplier, type WinTier } from "../lib/winTiers";

const RISKS: RiskLevel[] = ["low", "medium", "high", "extreme"];
const BALL_COUNTS = [1, 3, 5, 10];
// BOARD_WIDTH is only a reference used to turn peg/ball positions into percentages — the board
// itself renders at 100% of its (responsive, max 560px) container width, never a fixed pixel size.
const BOARD_WIDTH = 560;
const ROW_HEIGHT = 24;
const STAGGER = 0.12;

interface Batch {
  bet: number;
  results: DropResult[];
}

function ballPath(result: DropResult) {
  const displacements = result.path.reduce<number[]>((acc, r) => [...acc, acc[acc.length - 1] + (r ? 1 : -1)], [0]);
  return {
    xs: displacements.map((d) => ((d + ROWS) / (2 * ROWS)) * 100),
    ys: displacements.map((_, i) => i * ROW_HEIGHT),
  };
}

export function Plinko() {
  const credits = useCasinoStore((s) => s.credits);
  const level = useCasinoStore((s) => s.level);
  const placeBet = useCasinoStore((s) => s.placeBet);
  const award = useCasinoStore((s) => s.award);
  const addXp = useCasinoStore((s) => s.addXp);
  const recordRound = useCasinoStore((s) => s.recordRound);
  const history = useCasinoStore((s) => s.history);
  const push = useToastStore((s) => s.push);
  const winBias = useGameStatusStore((s) => s.statuses.plinko?.winBias ?? 1);

  const maxBet = maxBetFor(credits, level);
  const [risk, setRisk] = useState<RiskLevel>("medium");
  const [ballCount, setBallCount] = useState(1);
  const [bet, setBet] = useState(Math.min(50, maxBet));
  const [dropping, setDropping] = useState(false);
  const [batch, setBatch] = useState<Batch | null>(null);
  const [landedCount, setLandedCount] = useState(0);
  const [dropKey, setDropKey] = useState(0);
  const [celebration, setCelebration] = useState<{ tier: WinTier; payout: number } | null>(null);

  const plinkoHistory = history.filter((h) => h.game === "Plinko").slice(0, 8);
  const totalBet = bet * ballCount;

  function launch() {
    if (dropping || credits < totalBet) {
      if (credits < totalBet) push({ kind: "info", title: "Crédits insuffisants" });
      return;
    }
    placeBet(totalBet);
    const results = Array.from({ length: ballCount }, () => dropBall(risk, winBias));
    setBatch({ bet, results });
    setLandedCount(0);
    setDropKey((k) => k + 1);
    setDropping(true);
  }

  function onBallLanded() {
    setLandedCount((c) => c + 1);
  }

  useEffect(() => {
    if (dropping && batch && landedCount === batch.results.length) {
      finalize(batch);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [landedCount]);

  function finalize(finished: Batch) {
    const payout = finished.results.reduce((sum, r) => sum + Math.round(finished.bet * r.multiplier), 0);
    const totalStaked = finished.bet * finished.results.length;
    if (payout > 0) {
      award(payout);
      addXp(xpForPayout(payout));
    }
    const tier = tierFromMultiplier(payout / totalStaked);
    const label = finished.results.length > 1 ? `${RISK_LABEL[risk]} — ${finished.results.length} billes` : RISK_LABEL[risk];
    recordRound({ game: "Plinko", label, bet: totalStaked, payout, tier });
    setDropping(false);
    if (tier === "megaWin" || tier === "gigaWin" || tier === "maxWin") {
      setCelebration({ tier, payout });
    } else if (payout > bet) {
      push({ kind: "success", title: `+${formatCredits(payout)} crédits` });
    } else {
      push({ kind: "info", title: payout > 0 ? `+${formatCredits(payout)} crédits` : "Pas de gain cette fois" });
    }
  }

  const finalBuckets = !dropping && batch ? new Set(batch.results.map((r) => r.bucket)) : new Set<number>();

  return (
    <div className="mx-auto max-w-3xl px-4 py-8 sm:px-6">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="font-display text-2xl font-bold text-white sm:text-3xl">Plinko</h1>
          <p className="text-sm text-ice-200/60">Lâche une ou plusieurs billes, elles rebondissent jusqu'à un multiplicateur final.</p>
        </div>
        <Badge tone="gold">Crédits virtuels uniquement</Badge>
      </div>

      <Card className="p-4 sm:p-8" glow>
        <div className="relative mx-auto w-full overflow-hidden rounded-2xl border border-white/10 bg-ink-950/60 pt-6" style={{ maxWidth: BOARD_WIDTH }}>
          <div className="relative" style={{ height: ROWS * ROW_HEIGHT + 20 }}>
            {Array.from({ length: ROWS }, (_, r) => {
              const count = r + 3;
              const spacing = 100 / (count + 1);
              return Array.from({ length: count }, (_, p) => (
                <span
                  key={`${r}-${p}`}
                  className="absolute h-1.5 w-1.5 -translate-x-1/2 rounded-full bg-white/20"
                  style={{ left: `${spacing * (p + 1)}%`, top: r * ROW_HEIGHT + 8 }}
                />
              ));
            })}

            {batch?.results.map((result, i) => {
              const { xs, ys } = ballPath(result);
              return (
                <motion.div
                  key={`${dropKey}-${i}`}
                  className="absolute h-3 w-3 -translate-x-1/2 rounded-full bg-gold-400 shadow-glow-gold"
                  initial={{ left: `${xs[0]}%`, top: -10, opacity: 1 }}
                  animate={{ left: xs.map((v) => `${v}%`), top: ys }}
                  transition={{
                    duration: ROWS * 0.15,
                    delay: i * STAGGER,
                    ease: "easeIn",
                    times: xs.map((_, k) => k / (xs.length - 1)),
                  }}
                  onAnimationComplete={onBallLanded}
                />
              );
            })}
          </div>

          <div className="flex w-full">
            {BUCKET_MULTIPLIERS[risk].map((m, i) => {
              const isWinner = finalBuckets.has(i);
              return (
                <div
                  key={i}
                  className={cn(
                    "flex flex-1 items-center justify-center border-t py-2 text-[9px] font-bold sm:text-xs",
                    isWinner ? "border-gold-400 bg-gold-500/20 text-gold-300" : "border-white/10 text-ice-200/60",
                    m >= 5 ? "text-red-400" : ""
                  )}
                >
                  x{m}
                </div>
              );
            })}
          </div>
        </div>

        <div className="mt-6 flex flex-col gap-4">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs uppercase tracking-wide text-ice-200/50">Risque</span>
            {RISKS.map((r) => (
              <button
                key={r}
                onClick={() => setRisk(r)}
                disabled={dropping}
                className={cn(
                  "rounded-lg px-3 py-1.5 text-sm font-semibold transition-colors disabled:opacity-40",
                  risk === r ? "bg-electric-500 text-white shadow-glow" : "bg-white/[0.03] text-ice-200/60 hover:text-white"
                )}
              >
                {RISK_LABEL[r]}
              </button>
            ))}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs uppercase tracking-wide text-ice-200/50">Billes</span>
            {BALL_COUNTS.map((n) => (
              <button
                key={n}
                onClick={() => setBallCount(n)}
                disabled={dropping}
                className={cn(
                  "rounded-lg px-3 py-1.5 text-sm font-semibold transition-colors disabled:opacity-40",
                  ballCount === n ? "bg-electric-500 text-white shadow-glow" : "bg-white/[0.03] text-ice-200/60 hover:text-white"
                )}
              >
                x{n}
              </button>
            ))}
          </div>
          <div className="flex flex-wrap items-center justify-between gap-4">
            <BetInput value={bet} onChange={setBet} max={maxBet} min={Math.min(10, maxBet)} disabled={dropping} />
            <Button size="lg" onClick={launch} disabled={dropping || credits < totalBet}>
              {dropping ? "..." : `Lancer (${formatCredits(totalBet)})`}
            </Button>
          </div>
        </div>
      </Card>

      {plinkoHistory.length > 0 && (
        <Card className="mt-6 p-4">
          <h3 className="mb-3 font-display text-sm font-semibold text-white">Historique récent</h3>
          <ul className="flex flex-col gap-2">
            {plinkoHistory.map((h) => (
              <li key={h.id} className="flex items-center justify-between text-xs">
                <span className="text-ice-200/60">{h.label} — Mise {formatCredits(h.bet)}</span>
                <span className={h.payout > h.bet ? "font-semibold text-emerald-400" : "text-ice-200/40"}>
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
