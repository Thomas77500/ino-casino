import { useState } from "react";
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
import { playSound } from "../lib/sounds";

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

// Real board geometry: one peg spacing = one bucket width, so the ball strikes a peg at every
// row and the last row's gaps are exactly the buckets. d = left/right displacement in half-pegs.
const PEG_SPACING = 100 / (ROWS + 1);
const SEG = 0.14; // seconds per row
const pegX = (r: number, j: number) => 50 + (j - (r + 2) / 2) * PEG_SPACING;
const pegY = (r: number) => r * ROW_HEIGHT + 10;

function displacements(result: DropResult): number[] {
  return result.path.reduce<number[]>((acc, right) => [...acc, acc[acc.length - 1] + (right ? 1 : -1)], [0]);
}

function pegHits(result: DropResult) {
  return displacements(result).slice(0, ROWS).map((d, r) => ({ r, j: (d + r + 2) / 2 }));
}

// Keyframes: drop onto the first peg, then for each row a small hop (apex) and a fall onto the
// next peg — eased out on the way up, eased in on the way down, i.e. a gravity parabola.
function ballPath(result: DropResult) {
  const d = displacements(result);
  const X: number[] = [50, 50];
  const Y: number[] = [-12, pegY(0) - 9];
  for (let r = 0; r < ROWS; r++) {
    const x = 50 + (d[r] * PEG_SPACING) / 2;
    const nx = 50 + (d[r + 1] * PEG_SPACING) / 2;
    const y = pegY(r) - 9;
    X.push(x + (nx - x) * 0.45, nx);
    Y.push(y - 7, r + 1 < ROWS ? pegY(r + 1) - 9 : ROWS * ROW_HEIGHT + 6);
  }
  const total = SEG * (ROWS + 1);
  const at = X.map((_, k) => (k === 0 ? 0 : Math.min(1, (SEG + ((k - 1) / 2) * SEG) / total)));
  const ease = X.slice(1).map((_, k) => (k === 0 ? "easeIn" : k % 2 === 1 ? "easeOut" : "easeIn"));
  return { xs: X, ys: Y, times: { total, at, ease } };
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
  const [dropKey, setDropKey] = useState(0);
  const [bucketHits, setBucketHits] = useState<Record<number, number>>({});
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
    const next = { bet, results };
    setBatch(next);
    // paid on a timer matching the last ball's flight, so leaving the page mid-drop still pays
    setTimeout(() => finalize(next), ((results.length - 1) * STAGGER + SEG * (ROWS + 1)) * 1000 + 80);
    setBucketHits({});
    setDropKey((k) => k + 1);
    displacements(results[0]).slice(0, ROWS).forEach((_, r) => setTimeout(() => playSound("peg"), (r + 1) * SEG * 1000));
    setDropping(true);
  }

  function onBallLanded(bucket: number) {
    playSound("chip");
    setBucketHits((h) => ({ ...h, [bucket]: (h[bucket] ?? 0) + 1 }));
  }

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
            {Array.from({ length: ROWS }, (_, r) =>
              Array.from({ length: r + 3 }, (_, j) => (
                <span
                  key={`${r}-${j}`}
                  className="absolute h-2 w-2 -translate-x-1/2 -translate-y-1/2 rounded-full bg-white/40 shadow-[0_0_4px_rgba(255,255,255,0.3)]"
                  style={{ left: `${pegX(r, j)}%`, top: pegY(r) }}
                />
              ))
            )}

            {batch?.results.map((result, i) =>
              pegHits(result).map(({ r, j }) => (
                <motion.span
                  key={`${dropKey}-${i}-${r}`}
                  className="pointer-events-none absolute h-2 w-2 -translate-x-1/2 -translate-y-1/2 rounded-full bg-gold-300"
                  style={{ left: `${pegX(r, j)}%`, top: pegY(r) }}
                  initial={{ opacity: 0, scale: 1 }}
                  animate={{ opacity: [0, 1, 0], scale: [1, 2.6, 1] }}
                  transition={{ duration: 0.35, delay: i * STAGGER + (r + 1) * SEG }}
                />
              ))
            )}

            {batch?.results.map((result, i) => {
              const { xs, ys, times } = ballPath(result);
              return (
                <motion.div
                  key={`${dropKey}-${i}`}
                  className="absolute h-3 w-3 -translate-x-1/2 rounded-full bg-[radial-gradient(circle_at_35%_30%,#fff6d5,#f6bf4b_55%,#a87512)] shadow-glow-gold"
                  initial={{ left: `${xs[0]}%`, top: ys[0], opacity: 1 }}
                  animate={{ left: xs.map((v) => `${v}%`), top: ys }}
                  transition={{
                    left: { duration: times.total, delay: i * STAGGER, times: times.at, ease: "linear" },
                    top: { duration: times.total, delay: i * STAGGER, times: times.at, ease: times.ease },
                  }}
                  onAnimationComplete={() => onBallLanded(result.bucket)}
                />
              );
            })}
          </div>

          <div className="flex w-full gap-0.5 px-0.5 pb-1">
            {BUCKET_MULTIPLIERS[risk].map((m, i) => {
              const hit = bucketHits[i] ?? 0;
              const edge = Math.abs(i - ROWS / 2) / (ROWS / 2); // 0 center → 1 edge
              return (
                <motion.div
                  key={`${i}-${hit}`}
                  initial={{ y: 0 }}
                  animate={hit ? { y: [0, 7, -2, 0] } : { y: 0 }}
                  transition={{ duration: 0.35 }}
                  className={cn(
                    "flex flex-1 items-center justify-center rounded-md py-2 text-[9px] font-bold text-ink-950 sm:text-xs",
                    hit > 0 && "ring-2 ring-white"
                  )}
                  style={{ background: `hsl(${48 - edge * 48} 95% ${58 - edge * 8}%)`, boxShadow: hit ? "0 0 14px rgba(255,255,255,0.6)" : undefined }}
                >
                  x{m}
                </motion.div>
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
