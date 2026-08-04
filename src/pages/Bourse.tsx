import { useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import { useCasinoStore } from "../store/casinoStore";
import { useToastStore } from "../store/toastStore";
import { useGameStatusStore } from "../store/gameStatusStore";
import { Card } from "../components/ui/Card";
import { Button } from "../components/ui/Button";
import { Badge } from "../components/ui/Badge";
import { BetInput } from "../components/ui/BetInput";
import { ProgressBar } from "../components/ui/ProgressBar";
import { WinCelebration } from "../components/ui/WinCelebration";
import { IconTrendUp, IconLock } from "../components/icons";
import { formatCredits, cn } from "../lib/format";
import { maxBetFor } from "../lib/betting";
import { xpForPayout } from "../lib/xp";
import { STARTING_PRICE, TICK_MS, HISTORY_LENGTH, UNLOCK_TOTAL_WON, DURATION_PAYOUT, nextPrice, type RoundDuration } from "../lib/stockEngine";
import { tierFromMultiplier, type WinTier } from "../lib/winTiers";

type Direction = "up" | "down";
type Phase = "idle" | "running" | "result";

const DURATIONS: RoundDuration[] = [5, 15, 30];

export function Bourse() {
  const credits = useCasinoStore((s) => s.credits);
  const level = useCasinoStore((s) => s.level);
  const totalWon = useCasinoStore((s) => s.totalWon);
  const placeBet = useCasinoStore((s) => s.placeBet);
  const award = useCasinoStore((s) => s.award);
  const addXp = useCasinoStore((s) => s.addXp);
  const recordRound = useCasinoStore((s) => s.recordRound);
  const history = useCasinoStore((s) => s.history);
  const push = useToastStore((s) => s.push);
  const winBias = useGameStatusStore((s) => s.statuses.bourse?.winBias ?? 1);

  const [price, setPrice] = useState(STARTING_PRICE);
  const [priceHistory, setPriceHistory] = useState<number[]>(() => Array(HISTORY_LENGTH).fill(STARTING_PRICE));

  const maxBet = maxBetFor(credits, level);
  const [bet, setBet] = useState(Math.min(50, maxBet));
  const [duration, setDuration] = useState<RoundDuration>(15);
  const [phase, setPhase] = useState<Phase>("idle");
  const [direction, setDirection] = useState<Direction | null>(null);
  const [entryPrice, setEntryPrice] = useState<number | null>(null);
  const [secondsLeft, setSecondsLeft] = useState(0);
  const [result, setResult] = useState<{ won: boolean; push: boolean; payout: number } | null>(null);
  const [celebration, setCelebration] = useState<{ tier: WinTier; payout: number } | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval>>();
  const betRef = useRef(bet);
  betRef.current = bet;
  const priceRef = useRef(price);
  priceRef.current = price;
  const entryPriceRef = useRef<number | null>(null);

  useEffect(() => {
    const activeDirection = phase === "running" && direction ? (direction === "up" ? 1 : -1) : 0;
    const interval = setInterval(() => {
      setPrice((p) => {
        const next = nextPrice(p, winBias, activeDirection);
        setPriceHistory((h) => [...h.slice(1), next]);
        return next;
      });
    }, TICK_MS);
    return () => clearInterval(interval);
  }, [phase, direction, winBias]);

  const bourseHistory = history.filter((h) => h.game === "Bourse").slice(0, 8);
  const unlocked = totalWon >= UNLOCK_TOTAL_WON;

  function start(dir: Direction) {
    if (phase === "running" || credits < bet) {
      if (credits < bet) push({ kind: "info", title: "Crédits insuffisants" });
      return;
    }
    placeBet(bet);
    setDirection(dir);
    setEntryPrice(price);
    entryPriceRef.current = price;
    setResult(null);
    setPhase("running");
    setSecondsLeft(duration);

    timerRef.current = setInterval(() => {
      setSecondsLeft((s) => {
        if (s <= 1) {
          clearInterval(timerRef.current);
          resolveRound(dir);
          return 0;
        }
        return s - 1;
      });
    }, 1000);
  }

  function resolveRound(dir: Direction) {
    const currentPrice = priceRef.current;
    const entry = entryPriceRef.current;
    if (entry === null) return;

    const won = dir === "up" ? currentPrice > entry : currentPrice < entry;
    const isPush = currentPrice === entry;
    const payout = isPush ? betRef.current : won ? Math.round(betRef.current * DURATION_PAYOUT[duration]) : 0;

    if (payout > 0) {
      award(payout);
      addXp(xpForPayout(payout));
    }
    const tier = won ? tierFromMultiplier(payout / betRef.current) : "none";
    recordRound({ game: "Bourse", label: `${dir === "up" ? "Hausse" : "Baisse"} ${duration}s`, bet: betRef.current, payout, tier });

    setResult({ won, push: isPush, payout });
    setPhase("result");

    if (tier === "megaWin" || tier === "gigaWin" || tier === "maxWin") {
      setCelebration({ tier, payout });
    } else if (isPush) {
      push({ kind: "info", title: "Prix inchangé — mise remboursée" });
    } else if (won) {
      push({ kind: "success", title: `Bonne pioche ! +${formatCredits(payout)} crédits` });
    } else {
      push({ kind: "info", title: "Mauvais sens — manche perdue" });
    }
  }

  function reset() {
    setPhase("idle");
    setDirection(null);
    setEntryPrice(null);
    setResult(null);
  }

  useEffect(() => () => clearInterval(timerRef.current), []);

  if (!unlocked) {
    return (
      <div className="mx-auto max-w-lg px-4 py-16 text-center">
        <IconLock className="mx-auto mb-4 h-10 w-10 text-ice-200/40" />
        <h1 className="font-display text-2xl font-bold text-white">Bourse verrouillée</h1>
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

  const visible = priceHistory;
  const min = Math.min(...visible);
  const max = Math.max(...visible);
  const range = Math.max(0.0001, max - min);
  const points = visible.map((p, i) => `${(i / (visible.length - 1)) * 100},${90 - ((p - min) / range) * 80}`).join(" ");
  const change = price - priceHistory[0];

  return (
    <div className="mx-auto max-w-3xl px-4 py-8 sm:px-6">
      <div className="mb-6 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <IconTrendUp className="h-6 w-6 text-electric-400" />
          <div>
            <h1 className="font-display text-2xl font-bold text-white sm:text-3xl">Bourse</h1>
            <p className="text-sm text-ice-200/60">Mise à la hausse ou à la baisse — le prix évolue en direct.</p>
          </div>
        </div>
        <Badge tone="gold">Crédits virtuels uniquement</Badge>
      </div>

      <Card className="p-4 sm:p-8" glow>
        <div className="mb-4 flex items-baseline justify-between">
          <div>
            <p className="font-display text-3xl font-bold text-white">{price.toFixed(2)}</p>
            <p className={cn("text-xs font-semibold", change >= 0 ? "text-emerald-400" : "text-red-400")}>
              {change >= 0 ? "▲" : "▼"} {Math.abs(change).toFixed(2)}
            </p>
          </div>
          {phase === "running" && (
            <div className="text-right">
              <p className="text-[11px] uppercase tracking-wide text-ice-200/50">Temps restant</p>
              <p className="font-display text-2xl font-bold text-gold-400">{secondsLeft}s</p>
            </div>
          )}
        </div>

        <div className="relative h-48 overflow-hidden rounded-2xl border border-white/10 bg-ink-950/60">
          <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="h-full w-full">
            <polyline points={points} fill="none" stroke={change >= 0 ? "#34d399" : "#ef4444"} strokeWidth="1.2" vectorEffect="non-scaling-stroke" />
          </svg>
          {phase === "running" && entryPrice !== null && (
            <div
              className="absolute left-0 right-0 border-t border-dashed border-gold-400/60"
              style={{ top: `${90 - ((entryPrice - min) / range) * 80}%` }}
            />
          )}
        </div>

        <div className="mt-6 flex flex-col gap-4">
          {phase === "idle" ? (
            <>
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-xs uppercase tracking-wide text-ice-200/50">Durée</span>
                {DURATIONS.map((d) => (
                  <button
                    key={d}
                    onClick={() => setDuration(d)}
                    className={cn(
                      "rounded-lg px-3 py-1.5 text-sm font-semibold transition-colors",
                      duration === d ? "bg-electric-500 text-white shadow-glow" : "bg-white/[0.03] text-ice-200/60 hover:text-white"
                    )}
                  >
                    {d}s · x{DURATION_PAYOUT[d]}
                  </button>
                ))}
              </div>
              <div className="flex flex-wrap items-center justify-between gap-4">
                <BetInput value={bet} onChange={setBet} max={maxBet} min={Math.min(10, maxBet)} />
                <div className="flex gap-2">
                  <Button variant="secondary" className="border border-emerald-500/40 text-emerald-400" onClick={() => start("up")} disabled={credits < bet}>
                    ▲ Hausse
                  </Button>
                  <Button variant="secondary" className="border border-red-500/40 text-red-400" onClick={() => start("down")} disabled={credits < bet}>
                    ▼ Baisse
                  </Button>
                </div>
              </div>
            </>
          ) : phase === "running" ? (
            <div className="flex items-center justify-between">
              <p className="text-sm text-ice-200/60">
                Pari : <span className={direction === "up" ? "text-emerald-400" : "text-red-400"}>{direction === "up" ? "Hausse" : "Baisse"}</span> — mise {formatCredits(bet)}
              </p>
              <motion.p animate={{ opacity: [0.5, 1, 0.5] }} transition={{ duration: 1, repeat: Infinity }} className="text-xs text-ice-200/40">
                Le marché bouge...
              </motion.p>
            </div>
          ) : (
            <div className="flex items-center justify-between">
              <p className="text-sm text-ice-200/60">
                {result?.push ? "Prix inchangé — mise remboursée." : result?.won ? `Gagné : +${formatCredits(result.payout)} crédits.` : "Perdu."}
              </p>
              <Button size="lg" onClick={reset}>Nouvelle position</Button>
            </div>
          )}
        </div>
      </Card>

      {bourseHistory.length > 0 && (
        <Card className="mt-6 p-4">
          <h3 className="mb-3 font-display text-sm font-semibold text-white">Historique récent</h3>
          <ul className="flex flex-col gap-2">
            {bourseHistory.map((h) => (
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
