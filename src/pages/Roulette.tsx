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
import { RouletteWheel } from "../components/games/RouletteWheel";
import { BonusWheel } from "../components/games/BonusWheel";
import { formatCredits, cn } from "../lib/format";
import { maxBetFor } from "../lib/betting";
import { xpForPayout } from "../lib/xp";
import { colorOf, spinWheel, betWins, betLabel, PAYOUT_MULTIPLIER, type BetKind, type SpinOutcome } from "../lib/rouletteEngine";
import { DARK_BONUS_MULTIPLIERS, drawLuckyNumbers, type LuckyNumber } from "../lib/darkRouletteEngine";
import { tierFromMultiplier, type WinTier } from "../lib/winTiers";

const DARK_WHEEL_SEGMENTS = DARK_BONUS_MULTIPLIERS.map((m) => ({ label: `x${m}`, highlight: m >= 300 }));
type DrawPhase = "idle" | "wheel" | "reveal" | "ready";
const REVEAL_STAGGER_MS = 260;
const WHEEL_SPIN_MS = 1800;

function betKey(bet: BetKind): string {
  return JSON.stringify(bet);
}

interface SlipEntry {
  key: string;
  bet: BetKind;
  amount: number;
}

export function Roulette() {
  const credits = useCasinoStore((s) => s.credits);
  const level = useCasinoStore((s) => s.level);
  const placeBet = useCasinoStore((s) => s.placeBet);
  const award = useCasinoStore((s) => s.award);
  const addXp = useCasinoStore((s) => s.addXp);
  const recordRound = useCasinoStore((s) => s.recordRound);
  const history = useCasinoStore((s) => s.history);
  const push = useToastStore((s) => s.push);
  const winBias = useGameStatusStore((s) => s.statuses.roulette?.winBias ?? 1);

  const maxChip = maxBetFor(credits, level);
  const [darkMode, setDarkMode] = useState(false);
  const [chip, setChip] = useState(Math.min(25, maxChip));
  const [slip, setSlip] = useState<SlipEntry[]>([]);
  const [spinning, setSpinning] = useState(false);
  const [spinTrigger, setSpinTrigger] = useState(0);
  const [outcome, setOutcome] = useState<SpinOutcome | null>(null);
  const [celebration, setCelebration] = useState<{ tier: WinTier; payout: number } | null>(null);

  const [drawPhase, setDrawPhase] = useState<DrawPhase>("idle");
  const [luckyNumbers, setLuckyNumbers] = useState<LuckyNumber[]>([]);
  const [revealedCount, setRevealedCount] = useState(0);
  const [wheelTrigger, setWheelTrigger] = useState(0);
  const [wheelIndex, setWheelIndex] = useState<number | null>(null);

  const rouletteHistory = history.filter((h) => h.game === "Roulette").slice(0, 8);
  const staked = slip.reduce((sum, s) => sum + s.amount, 0);
  const busy = spinning || (darkMode && drawPhase !== "ready");

  function startLuckyDraw() {
    setLuckyNumbers([]);
    setRevealedCount(0);
    setDrawPhase("wheel");
    setWheelIndex(Math.floor(Math.random() * DARK_WHEEL_SEGMENTS.length));
    setWheelTrigger((n) => n + 1);

    setTimeout(() => {
      const drawn = drawLuckyNumbers(undefined, winBias);
      setLuckyNumbers(drawn);
      setDrawPhase("reveal");
      drawn.forEach((_, i) => {
        setTimeout(() => setRevealedCount((c) => c + 1), i * REVEAL_STAGGER_MS);
      });
      setTimeout(() => setDrawPhase("ready"), drawn.length * REVEAL_STAGGER_MS + 400);
    }, WHEEL_SPIN_MS);
  }

  function selectClassic() {
    if (busy) return;
    setDarkMode(false);
    setDrawPhase("idle");
    setLuckyNumbers([]);
  }

  function selectDark() {
    if (busy) return;
    setDarkMode(true);
    startLuckyDraw();
  }

  function addBet(bet: BetKind) {
    if (busy) return;
    const key = betKey(bet);
    setSlip((prev) => {
      const existing = prev.find((s) => s.key === key);
      if (existing) return prev.map((s) => (s.key === key ? { ...s, amount: s.amount + chip } : s));
      return [...prev, { key, bet, amount: chip }];
    });
  }

  function clearSlip() {
    if (!busy) setSlip([]);
  }

  function spin() {
    if (busy || slip.length === 0 || credits < staked) {
      if (credits < staked) push({ kind: "info", title: "Crédits insuffisants pour cette mise" });
      return;
    }
    setSpinning(true);
    setOutcome(null);
    placeBet(staked);

    setTimeout(() => {
      const result = spinWheel(staked, slip, winBias);
      setOutcome(result);
      setSpinTrigger((n) => n + 1);

      setTimeout(() => {
        let payout = 0;
        let luckyHit: LuckyNumber | null = null;
        slip.forEach((entry) => {
          const bet = entry.bet;
          if (betWins(bet, result)) {
            let mult = PAYOUT_MULTIPLIER[bet.kind];
            if (darkMode && bet.kind === "straight") {
              const lucky = luckyNumbers.find((l) => l.number === bet.number);
              if (lucky) {
                mult = lucky.multiplier - 1;
                luckyHit = lucky;
              }
            }
            let winAmount = entry.amount * (mult + 1);
            if (result.luckyZone) winAmount *= 2;
            payout += winAmount;
          }
        });
        payout += result.bonusAmount;
        setSpinning(false);
        finalize(result, payout, luckyHit);
      }, 3100);
    }, 50);
  }

  function finalize(result: SpinOutcome, payout: number, luckyHit: LuckyNumber | null) {
    if (payout > 0) {
      award(payout);
      addXp(xpForPayout(payout));
    }
    const tier = payout > 0 ? tierFromMultiplier(payout / staked) : "none";
    const label = luckyHit ? `Numéro ${result.number} (Bonus x${luckyHit.multiplier})` : `Numéro ${result.number}`;
    recordRound({ game: "Roulette", label, bet: staked, payout, tier });

    if (result.bonusSpin) {
      push({ kind: "bonus", title: "Bonus Spin déclenché !", description: `+${formatCredits(result.bonusAmount)} crédits offerts` });
    }
    if (luckyHit) {
      push({ kind: "bonus", title: `Numéro chanceux frappé : x${luckyHit.multiplier} !` });
    }
    if (tier === "megaWin" || tier === "gigaWin" || tier === "maxWin") {
      setCelebration({ tier, payout });
    } else if (payout > 0) {
      push({ kind: "success", title: `Numéro ${result.number} — +${formatCredits(payout)} crédits` });
    } else {
      push({ kind: "info", title: `Numéro ${result.number} — pas de gain cette fois` });
    }
    setSlip([]);
    if (darkMode) startLuckyDraw();
  }

  const columns = Array.from({ length: 12 }, (_, c) => ({
    top: 3 * (c + 1),
    mid: 3 * (c + 1) - 1,
    bottom: 3 * (c + 1) - 2,
  }));

  function chipOn(bet: BetKind) {
    const entry = slip.find((s) => s.key === betKey(bet));
    return entry?.amount;
  }

  function luckyOn(n: number): LuckyNumber | undefined {
    if (drawPhase !== "ready") return undefined;
    return luckyNumbers.find((l) => l.number === n);
  }

  return (
    <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-bold text-white sm:text-3xl">
            {darkMode ? "Dark Roulette" : "Roulette Électrique"}
          </h1>
          <p className="text-sm text-ice-200/60">
            {darkMode
              ? `5 numéros chanceux tirés chaque manche, de x${DARK_BONUS_MULTIPLIERS[0]} à x${DARK_BONUS_MULTIPLIERS[DARK_BONUS_MULTIPLIERS.length - 1]} — mise pleine dessus pour décrocher le bonus`
              : "Roulette européenne — Zone Chanceuse & Bonus Spin fictifs"}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1 rounded-xl border border-white/10 bg-white/[0.03] p-1">
            <button
              onClick={selectClassic}
              disabled={busy}
              className={cn("rounded-lg px-3 py-1.5 text-sm font-semibold transition-colors disabled:opacity-40", !darkMode ? "bg-electric-500 text-white shadow-glow" : "text-ice-200/60 hover:text-white")}
            >
              Classique
            </button>
            <button
              onClick={selectDark}
              disabled={busy}
              className={cn("rounded-lg px-3 py-1.5 text-sm font-semibold transition-colors disabled:opacity-40", darkMode ? "bg-red-600 text-white shadow-glow-red" : "text-ice-200/60 hover:text-white")}
            >
              Dark Roulette
            </button>
          </div>
          <Badge tone={darkMode ? "danger" : "gold"}>{darkMode ? "Mode Dark actif" : "Crédits virtuels uniquement"}</Badge>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[360px_1fr]">
        <Card className={cn("flex min-w-0 flex-col items-center gap-4 p-5", darkMode ? "border-red-500/30 shadow-glow-red" : "shadow-glow")}>
          <RouletteWheel winningNumber={outcome?.number ?? null} spinTrigger={spinTrigger} spinning={spinning} />
          {outcome && !spinning && (
            <div className="flex items-center gap-2">
              <Badge tone={outcome.color === "red" ? "neutral" : outcome.color === "black" ? "neutral" : "success"}>
                {outcome.color === "red" ? "Rouge" : outcome.color === "black" ? "Noir" : "Zéro"}
              </Badge>
              {outcome.luckyZone && <Badge tone="gold">Zone chanceuse x2</Badge>}
            </div>
          )}

          {darkMode && (
            <div className="w-full rounded-xl border border-red-500/20 bg-red-500/[0.04] p-3">
              <p className="mb-2 text-center text-[11px] uppercase tracking-wide text-red-300/70">Numéros bonus</p>
              {drawPhase === "wheel" ? (
                <div className="flex flex-col items-center gap-2">
                  <BonusWheel
                    segments={DARK_WHEEL_SEGMENTS}
                    resultIndex={wheelIndex}
                    spinTrigger={wheelTrigger}
                    spinning
                    size={140}
                    centerLabel="Tirage..."
                    ringClassName="border-red-500/40 shadow-glow-red"
                  />
                  <p className="text-xs text-ice-200/50">La roue des bonus tourne...</p>
                </div>
              ) : (
                <div className="flex flex-wrap justify-center gap-2">
                  {luckyNumbers.map((l, i) => (
                    <motion.div
                      key={l.number}
                      initial={{ scale: 0, opacity: 0 }}
                      animate={i < revealedCount ? { scale: 1, opacity: 1 } : {}}
                      transition={{ type: "spring", stiffness: 320, damping: 16 }}
                      className={cn(
                        "flex flex-col items-center gap-0.5 rounded-lg border px-2 py-1.5",
                        colorOf(l.number) === "red" ? "border-red-500/40 bg-red-500/10" : "border-gold-400/40 bg-gold-500/10"
                      )}
                    >
                      <span className="font-display text-sm font-bold text-white">{l.number}</span>
                      <span className="text-[10px] font-bold text-gold-400">x{l.multiplier}</span>
                    </motion.div>
                  ))}
                </div>
              )}
            </div>
          )}

          <div className="w-full rounded-xl border border-white/10 bg-white/[0.03] p-3 text-center">
            <p className="text-[11px] uppercase tracking-wide text-ice-200/50">Total misé</p>
            <p className="font-display text-xl font-bold text-white">{formatCredits(staked)}</p>
          </div>
          <div className="flex w-full gap-2">
            <Button className="flex-1" size="lg" onClick={spin} disabled={busy || slip.length === 0}>
              {darkMode && drawPhase !== "ready" ? "Tirage en cours..." : "Lancer"}
            </Button>
            <Button variant="secondary" onClick={clearSlip} disabled={busy || slip.length === 0}>
              Effacer
            </Button>
          </div>
        </Card>

        <Card className="p-4 sm:p-6">
          <div className="mb-4 flex flex-wrap items-center gap-2">
            <span className="text-xs uppercase tracking-wide text-ice-200/50">Jeton</span>
            <BetInput value={chip} onChange={setChip} max={maxChip} min={Math.min(5, maxChip)} disabled={busy} />
          </div>

          <div className="overflow-x-auto">
            <div className="flex min-w-[560px] gap-1">
              <button
                onClick={() => addBet({ kind: "straight", number: 0 })}
                className={cn(
                  "relative flex w-10 items-center justify-center rounded-md bg-emerald-700/80 text-sm font-bold text-white hover:bg-emerald-600",
                )}
              >
                0
                {chipOn({ kind: "straight", number: 0 }) && <ChipDot amount={chipOn({ kind: "straight", number: 0 })!} />}
              </button>

              <div className="grid flex-1 grid-cols-12 gap-1">
                {columns.map((col, i) => (
                  <div key={i} className="flex flex-col gap-1">
                    {[col.top, col.mid, col.bottom].map((n) => {
                      const lucky = luckyOn(n);
                      return (
                        <button
                          key={n}
                          onClick={() => addBet({ kind: "straight", number: n })}
                          className={cn(
                            "relative flex h-10 items-center justify-center rounded-md text-sm font-semibold text-white hover:brightness-125",
                            colorOf(n) === "red" ? "bg-red-700/80" : "bg-ink-700/90 border border-white/10",
                            lucky && "ring-2 ring-gold-400 shadow-glow-gold animate-pulse-glow"
                          )}
                        >
                          {n}
                          {lucky && (
                            <span className="absolute -top-2 left-1/2 -translate-x-1/2 rounded-full bg-gold-400 px-1 text-[8px] font-bold text-ink-950">
                              x{lucky.multiplier}
                            </span>
                          )}
                          {chipOn({ kind: "straight", number: n }) && <ChipDot amount={chipOn({ kind: "straight", number: n })!} />}
                        </button>
                      );
                    })}
                  </div>
                ))}
              </div>
            </div>

            <div className="mt-1 grid min-w-[560px] grid-cols-3 gap-1 pl-11">
              {[1, 2, 3].map((d) => (
                <OutsideBet key={d} label={`Douzaine ${d}`} amount={chipOn({ kind: "dozen", dozen: d as 1 | 2 | 3 })} onClick={() => addBet({ kind: "dozen", dozen: d as 1 | 2 | 3 })} />
              ))}
            </div>

            <div className="mt-1 grid min-w-[560px] grid-cols-6 gap-1 pl-11">
              <OutsideBet label="1-18" amount={chipOn({ kind: "low" })} onClick={() => addBet({ kind: "low" })} />
              <OutsideBet label="Pair" amount={chipOn({ kind: "even" })} onClick={() => addBet({ kind: "even" })} />
              <OutsideBet label="Rouge" tone="red" amount={chipOn({ kind: "red" })} onClick={() => addBet({ kind: "red" })} />
              <OutsideBet label="Noir" tone="black" amount={chipOn({ kind: "black" })} onClick={() => addBet({ kind: "black" })} />
              <OutsideBet label="Impair" amount={chipOn({ kind: "odd" })} onClick={() => addBet({ kind: "odd" })} />
              <OutsideBet label="19-36" amount={chipOn({ kind: "high" })} onClick={() => addBet({ kind: "high" })} />
            </div>
          </div>

          {slip.length > 0 && (
            <div className="mt-4 flex flex-wrap gap-2">
              {slip.map((s) => (
                <span key={s.key} className="rounded-full border border-white/10 bg-white/[0.05] px-3 py-1 text-xs text-ice-200/80">
                  {betLabel(s.bet)} — {formatCredits(s.amount)}
                </span>
              ))}
            </div>
          )}
        </Card>
      </div>

      {rouletteHistory.length > 0 && (
        <Card className="mt-6 p-4">
          <h3 className="mb-3 font-display text-sm font-semibold text-white">Historique récent</h3>
          <ul className="flex flex-wrap gap-2">
            {rouletteHistory.map((h) => (
              <li key={h.id} className="rounded-lg bg-white/[0.03] px-3 py-1.5 text-xs">
                <span className="text-ice-200/60">{h.label}</span>{" "}
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

function ChipDot({ amount }: { amount: number }) {
  return (
    <span className="absolute -top-1.5 -right-1.5 grid h-4 w-4 place-items-center rounded-full bg-gold-400 text-[8px] font-bold text-ink-950 shadow-glow-gold">
      {amount >= 1000 ? `${Math.round(amount / 1000)}k` : amount}
    </span>
  );
}

function OutsideBet({ label, amount, onClick, tone }: { label: string; amount?: number; onClick: () => void; tone?: "red" | "black" }) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "relative rounded-md border py-2 text-xs font-semibold text-white hover:brightness-125",
        tone === "red" ? "border-red-800 bg-red-700/60" : tone === "black" ? "border-white/10 bg-ink-700/80" : "border-white/10 bg-white/[0.04]"
      )}
    >
      {label}
      {amount && <ChipDot amount={amount} />}
    </button>
  );
}
