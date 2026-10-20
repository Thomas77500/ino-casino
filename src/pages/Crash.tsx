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
import { formatCredits, cn } from "../lib/format";
import { maxBetFor } from "../lib/betting";
import { xpForPayout } from "../lib/xp";
import { rollCrashPoint, multiplierAt, timeForMultiplier } from "../lib/crashEngine";
import { tierFromMultiplier, type WinTier } from "../lib/winTiers";
import { playSound } from "../lib/sounds";

type Phase = "idle" | "running" | "ended";

// Graph geometry (SVG units). Axes rescale every frame like real crash games: the curve always
// fills the chart instead of flying off it past some fixed max multiplier.
const W = 600;
const H = 300;
const PL = 44;
const PR = 16;
const PT = 16;
const PB = 24;
const NICE = [0.1, 0.2, 0.5, 1, 2, 5, 10, 20, 50, 100, 200, 500, 1000, 2000, 5000];
const niceStep = (range: number, lines: number) => NICE.find((s) => range / s <= lines) ?? NICE[NICE.length - 1];

const STARS = Array.from({ length: 40 }, (_, i) => ({ x: (i * 37) % 100, y: (i * 61) % 100, s: (i % 3) + 1 }));
const DEBRIS = Array.from({ length: 18 }, (_, i) => {
  const a = (i / 18) * Math.PI * 2;
  const d = 40 + (i % 4) * 22;
  return { x: Math.cos(a) * d, y: Math.sin(a) * d };
});

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
  const live = useRef({ bet, cashed: null as number | null, auto: 0 });

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

  function start() {
    if (phase === "running" || credits < bet) {
      if (credits < bet) push({ kind: "info", title: "Crédits insuffisants" });
      return;
    }
    placeBet(bet);
    const auto = Number(autoCash.replace(",", "."));
    live.current = { bet, cashed: null, auto: Number.isFinite(auto) ? auto : 0 };
    setElapsed(0);
    setCashedAt(null);
    setCrashPoint(rollCrashPoint(winBias));
    setPhase("running");
    playSound("spin");
  }

  function endRound(point: number) {
    setPhase("ended");
    playSound("boom");
    const L = live.current;
    const label = `Crash x${point.toFixed(2)}`;
    if (L.cashed === null) {
      recordRound({ game: "Crash", label, bet: L.bet, payout: 0, tier: "none" });
      push({ kind: "info", title: `Ça a explosé à x${point.toFixed(2)}`, description: "Manche perdue." });
    } else {
      const payout = Math.round(L.bet * L.cashed);
      recordRound({ game: "Crash", label, bet: L.bet, payout, tier: tierFromMultiplier(L.cashed) });
    }
  }

  function cashOutAt(m: number) {
    const L = live.current;
    if (L.cashed !== null) return;
    L.cashed = m;
    setCashedAt(m);
    playSound("win");
    const payout = Math.round(L.bet * m);
    award(payout);
    addXp(xpForPayout(payout));
    const tier = tierFromMultiplier(m);
    if (tier === "megaWin" || tier === "gigaWin" || tier === "maxWin") {
      setCelebration({ tier, payout });
    } else {
      push({ kind: "success", title: `Encaissé à x${m.toFixed(2)} — +${formatCredits(payout)} crédits` });
    }
  }

  // --- graph ---
  const crashed = phase === "ended";
  const tSec = elapsed / 1000;
  const xMax = Math.max(8, tSec * 1.15);
  const yMax = Math.max(2, multiplier * 1.25);
  const X = (s: number) => PL + (s / xMax) * (W - PL - PR);
  const Y = (m: number) => H - PB - ((m - 1) / (yMax - 1)) * (H - PB - PT);
  const SAMPLES = 80;
  const curve = Array.from({ length: SAMPLES + 1 }, (_, i) => {
    const s = (tSec * i) / SAMPLES;
    return [X(s), Y(Math.min(multiplier, multiplierAt(s * 1000)))] as const;
  });
  const linePath = curve.map(([x, y], i) => `${i ? "L" : "M"}${x.toFixed(1)},${y.toFixed(1)}`).join(" ");
  const areaPath = `${linePath} L${X(tSec).toFixed(1)},${H - PB} L${PL},${H - PB} Z`;
  const [tipX, tipY] = curve[curve.length - 1];
  const ahead = [X(tSec + 0.15), Y(multiplierAt(elapsed + 150))];
  const angle = phase === "idle" ? -35 : (Math.atan2(ahead[1] - tipY, ahead[0] - tipX) * 180) / Math.PI;
  const yStep = niceStep(yMax - 1, 5);
  const yTicks = Array.from({ length: Math.floor((yMax - 1) / yStep) + 1 }, (_, i) => 1 + i * yStep);
  const xStep = niceStep(xMax, 6);
  const xTicks = Array.from({ length: Math.floor(xMax / xStep) + 1 }, (_, i) => i * xStep);
  const cashMark = cashedAt !== null ? { x: X(timeForMultiplier(cashedAt) / 1000), y: Y(cashedAt) } : null;
  const stroke = crashed ? "#ef4444" : "#f6bf4b";

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
        <motion.div
          animate={crashed && cashedAt === null ? { x: [0, -10, 10, -6, 6, -2, 0] } : { x: 0 }}
          transition={{ duration: 0.45 }}
          className={cn(
            "relative aspect-[2/1] overflow-hidden rounded-2xl border transition-colors duration-300",
            crashed ? "border-red-500/40 bg-red-950/25" : "border-white/10 bg-gradient-to-b from-ink-900/70 to-ink-950/80"
          )}
        >
          {/* parallax starfield — speeds up with the multiplier */}
          <motion.div
            className="absolute inset-0"
            animate={phase === "running" ? { x: ["0%", "-50%"] } : { x: "0%" }}
            transition={{ duration: Math.max(0.6, 6 / multiplier), repeat: Infinity, ease: "linear" }}
            style={{ width: "200%" }}
          >
            {[0, 50].map((off) =>
              STARS.map((s, i) => (
                <span
                  key={`${off}-${i}`}
                  className="absolute rounded-full bg-white"
                  style={{ left: `${off + s.x / 2}%`, top: `${s.y}%`, width: s.s, height: s.s, opacity: 0.15 + s.s * 0.12 }}
                />
              ))
            )}
          </motion.div>

          <svg viewBox={`0 0 ${W} ${H}`} className="absolute inset-0 h-full w-full">
            <defs>
              <linearGradient id="crashArea" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={stroke} stopOpacity={0.35} />
                <stop offset="100%" stopColor={stroke} stopOpacity={0} />
              </linearGradient>
            </defs>
            {yTicks.map((m) => (
              <g key={`y${m}`}>
                <line x1={PL} x2={W - PR} y1={Y(m)} y2={Y(m)} stroke="rgba(255,255,255,0.06)" />
                <text x={PL - 6} y={Y(m)} textAnchor="end" dominantBaseline="central" fontSize={10} fill="rgba(200,215,255,0.45)">
                  {m.toFixed(yStep < 1 ? 1 : 0)}x
                </text>
              </g>
            ))}
            {xTicks.map((s) => (
              <text key={`x${s}`} x={X(s)} y={H - 8} textAnchor="middle" fontSize={10} fill="rgba(200,215,255,0.45)">
                {s}s
              </text>
            ))}
            {phase !== "idle" && (
              <>
                <path d={areaPath} fill="url(#crashArea)" />
                <path d={linePath} fill="none" stroke={stroke} strokeWidth={3} strokeLinecap="round" style={{ filter: `drop-shadow(0 0 6px ${stroke})` }} />
              </>
            )}
            {cashMark && (
              <g>
                <circle cx={cashMark.x} cy={cashMark.y} r={5} fill="#34d399" stroke="white" strokeWidth={1.5} />
                <text x={cashMark.x} y={cashMark.y - 12} textAnchor="middle" fontSize={11} fontWeight="bold" fill="#34d399">
                  Toi · x{cashedAt!.toFixed(2)}
                </text>
              </g>
            )}
          </svg>

          {/* rocket rides the tangent of the curve */}
          {!crashed && (
            <div
              className="absolute text-3xl"
              style={{
                left: `${((phase === "idle" ? PL + 20 : tipX) / W) * 100}%`,
                top: `${((phase === "idle" ? H - PB - 20 : tipY) / H) * 100}%`,
                transform: `translate(-50%,-50%) rotate(${angle + 45}deg)`,
              }}
            >
              <motion.span
                className="block"
                animate={phase === "running" ? { x: [0, 0.8, -0.8, 0], y: [0, -0.8, 0.8, 0] } : {}}
                transition={{ duration: 0.12, repeat: Infinity }}
              >
                🚀
              </motion.span>
            </div>
          )}
          {crashed && (
            <div className="absolute" style={{ left: `${(tipX / W) * 100}%`, top: `${(tipY / H) * 100}%` }}>
              <motion.span
                className="absolute -translate-x-1/2 -translate-y-1/2 text-5xl"
                initial={{ scale: 0.2, opacity: 1 }}
                animate={{ scale: [0.2, 1.8, 1.3], opacity: [1, 1, 0.85] }}
                transition={{ duration: 0.5 }}
              >
                💥
              </motion.span>
              {DEBRIS.map((d, i) => (
                <motion.span
                  key={i}
                  className={cn("absolute h-1.5 w-1.5 rounded-full", i % 2 ? "bg-orange-400" : "bg-red-500")}
                  initial={{ x: 0, y: 0, opacity: 1 }}
                  animate={{ x: d.x, y: d.y + 30, opacity: 0 }}
                  transition={{ duration: 0.9, ease: "easeOut" }}
                />
              ))}
            </div>
          )}

          <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
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
          </div>
        </motion.div>

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
