import { useState } from "react";
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
import { STEPS, DIFFICULTY_LABEL, buildMultiplierTable, rollStepSurvives, type Difficulty } from "../lib/chickenEngine";
import { tierFromMultiplier, type WinTier } from "../lib/winTiers";

type Phase = "idle" | "running" | "result";

const DIFFICULTIES: Difficulty[] = ["easy", "medium", "hard", "extreme"];

export function ChickenRoad() {
  const credits = useCasinoStore((s) => s.credits);
  const level = useCasinoStore((s) => s.level);
  const placeBet = useCasinoStore((s) => s.placeBet);
  const award = useCasinoStore((s) => s.award);
  const addXp = useCasinoStore((s) => s.addXp);
  const recordRound = useCasinoStore((s) => s.recordRound);
  const history = useCasinoStore((s) => s.history);
  const push = useToastStore((s) => s.push);
  const winBias = useGameStatusStore((s) => s.statuses.chickenroad?.winBias ?? 1);

  const maxBet = maxBetFor(credits, level);
  const [difficulty, setDifficulty] = useState<Difficulty>("medium");
  const [bet, setBet] = useState(Math.min(50, maxBet));
  const [phase, setPhase] = useState<Phase>("idle");
  const [step, setStep] = useState(0);
  const [busted, setBusted] = useState(false);
  const [celebration, setCelebration] = useState<{ tier: WinTier; payout: number } | null>(null);
  const [stepping, setStepping] = useState(false);

  const table = buildMultiplierTable(difficulty);
  const crHistory = history.filter((h) => h.game === "ChickenRoad").slice(0, 8);

  function start() {
    if (credits < bet) {
      push({ kind: "info", title: "Crédits insuffisants" });
      return;
    }
    placeBet(bet);
    setPhase("running");
    setStep(0);
    setBusted(false);
  }

  function advance() {
    if (stepping) return;
    setStepping(true);
    setTimeout(() => {
      const survives = rollStepSurvives(difficulty, winBias);
      if (!survives) {
        setBusted(true);
        setPhase("result");
        recordRound({ game: "ChickenRoad", label: DIFFICULTY_LABEL[difficulty], bet, payout: 0, tier: "none" });
        push({ kind: "info", title: "Le poulet s'est fait attraper", description: "Manche perdue." });
      } else {
        const nextStep = step + 1;
        setStep(nextStep);
        if (nextStep >= STEPS) {
          resolveCashout(nextStep);
        }
      }
      setStepping(false);
    }, 550);
  }

  function resolveCashout(atStep: number) {
    const multiplier = table[atStep - 1];
    const payout = Math.round(bet * multiplier);
    award(payout);
    addXp(xpForPayout(payout));
    const tier = tierFromMultiplier(multiplier);
    recordRound({ game: "ChickenRoad", label: DIFFICULTY_LABEL[difficulty], bet, payout, tier });
    setPhase("result");
    if (tier === "megaWin" || tier === "gigaWin" || tier === "maxWin") {
      setCelebration({ tier, payout });
    } else {
      push({ kind: "success", title: `Encaissé : +${formatCredits(payout)} crédits (x${multiplier})` });
    }
  }

  function cashOut() {
    if (step === 0) return;
    resolveCashout(step);
  }

  function reset() {
    setPhase("idle");
    setStep(0);
    setBusted(false);
  }

  return (
    <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="font-display text-2xl font-bold text-white sm:text-3xl">Chicken Road</h1>
          <p className="text-sm text-ice-200/60">Avance de case en case, encaisse avant que le poulet ne se fasse attraper.</p>
        </div>
        <Badge tone="gold">Crédits virtuels uniquement</Badge>
      </div>

      <Card className="p-4 sm:p-8" glow>
        <div className="relative overflow-x-auto rounded-2xl border border-white/10 bg-gradient-to-b from-ink-900/60 to-ink-950/60 p-4 sm:p-6">
          <div className="flex min-w-[820px] items-end gap-1.5">
            {Array.from({ length: STEPS }, (_, i) => {
              const passed = i < step;
              const isCurrent = i === step && phase === "running";
              const isBustedHere = busted && i === step;
              return (
                <div key={i} className="flex flex-1 flex-col items-center gap-1.5">
                  <div
                    className={cn(
                      "relative flex h-44 w-full flex-col items-center justify-end overflow-hidden rounded-lg border sm:h-56",
                      passed ? "border-emerald-500/40 bg-emerald-950/30" : "border-white/10 bg-ink-950/40",
                      isCurrent && "border-gold-400 shadow-glow-gold",
                      isBustedHere && "border-red-500 bg-red-500/20"
                    )}
                  >
                    <div
                      className="pointer-events-none absolute inset-y-0 left-1/2 w-0.5 -translate-x-1/2 opacity-30"
                      style={{ background: "repeating-linear-gradient(white 0 10px, transparent 10px 20px)" }}
                    />

                    {!passed && !isBustedHere && <LaneTraffic index={i} difficulty={difficulty} />}

                    <AnimatePresence>
                      {passed && (
                        <motion.div
                          key="barrier"
                          initial={{ scaleY: 0, opacity: 0 }}
                          animate={{ scaleY: 1, opacity: 1 }}
                          transition={{ type: "spring", stiffness: 260, damping: 18 }}
                          className="absolute top-3 left-1.5 right-1.5 h-2.5 origin-top rounded-full shadow"
                          style={{ background: "repeating-linear-gradient(135deg, #f6bf4b 0 8px, #0b1530 8px 16px)" }}
                        />
                      )}
                    </AnimatePresence>

                    <div className="relative z-10 mb-3 text-2xl">
                      {isBustedHere ? "💥" : isCurrent ? (
                        <motion.span animate={{ y: [0, -4, 0] }} transition={{ duration: 0.6, repeat: Infinity }}>🐔</motion.span>
                      ) : passed ? (
                        "✅"
                      ) : null}
                    </div>
                  </div>
                  <span className={cn("text-[11px] font-semibold", passed || isCurrent ? "text-gold-400" : "text-ice-200/40")}>
                    x{table[i]}
                  </span>
                </div>
              );
            })}
          </div>
        </div>

        <div className="mt-6 flex flex-col gap-4">
          {phase === "idle" && (
            <>
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-xs uppercase tracking-wide text-ice-200/50">Difficulté</span>
                {DIFFICULTIES.map((d) => (
                  <button
                    key={d}
                    onClick={() => setDifficulty(d)}
                    className={cn(
                      "rounded-lg px-3 py-1.5 text-sm font-semibold transition-colors",
                      difficulty === d ? "bg-electric-500 text-white shadow-glow" : "bg-white/[0.03] text-ice-200/60 hover:text-white"
                    )}
                  >
                    {DIFFICULTY_LABEL[d]}
                  </button>
                ))}
              </div>
              <div className="flex flex-wrap items-center justify-between gap-4">
                <BetInput value={bet} onChange={setBet} max={maxBet} min={Math.min(10, maxBet)} />
                <Button size="lg" onClick={start} disabled={credits < bet}>
                  Démarrer ({formatCredits(bet)})
                </Button>
              </div>
            </>
          )}

          {phase === "running" && (
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div>
                <p className="text-[11px] uppercase tracking-wide text-ice-200/50">Multiplicateur actuel</p>
                <p className="font-display text-2xl font-bold text-gold-400">{step === 0 ? "x1.00" : `x${table[step - 1]}`}</p>
              </div>
              <div className="flex gap-2">
                <Button onClick={advance} disabled={stepping}>Avancer</Button>
                <Button variant="gold" onClick={cashOut} disabled={step === 0 || stepping}>
                  Encaisser {step > 0 && `(${formatCredits(Math.round(bet * table[step - 1]))})`}
                </Button>
              </div>
            </div>
          )}

          {phase === "result" && (
            <div className="flex items-center justify-between">
              <p className="text-sm text-ice-200/60">{busted ? "Le poulet n'a pas survécu à cette case." : "Gains encaissés avec succès."}</p>
              <Button size="lg" onClick={reset}>Nouvelle partie</Button>
            </div>
          )}
        </div>
      </Card>

      {crHistory.length > 0 && (
        <Card className="mt-6 p-4">
          <h3 className="mb-3 font-display text-sm font-semibold text-white">Historique récent</h3>
          <ul className="flex flex-col gap-2">
            {crHistory.map((h) => (
              <li key={h.id} className="flex items-center justify-between text-xs">
                <span className="text-ice-200/60">{h.label} — Mise {formatCredits(h.bet)}</span>
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

// Faster traffic on harder difficulties sells the danger even though it never touches the odds.
const TRAFFIC_SPEED_SCALE: Record<Difficulty, number> = { easy: 0.75, medium: 1, hard: 1.35, extreme: 1.8 };
const TRAFFIC_GLYPHS = ["🚗", "🚙", "🚕"];

// Cars fall north-to-south down each lane, like oncoming traffic the chicken has to time its crossing against.
function LaneTraffic({ index, difficulty }: { index: number; difficulty: Difficulty }) {
  const baseDuration = 1.5 + (index % 3) * 0.3;
  const duration = baseDuration / TRAFFIC_SPEED_SCALE[difficulty];
  const glyph = TRAFFIC_GLYPHS[index % TRAFFIC_GLYPHS.length];

  return (
    <>
      <motion.span
        className="pointer-events-none absolute left-1/2 -translate-x-1/2 -rotate-90 text-lg opacity-70"
        animate={{ top: ["-20%", "120%"] }}
        transition={{ duration, delay: (index % 4) * 0.2, repeat: Infinity, ease: "linear" }}
      >
        {glyph}
      </motion.span>
      <motion.span
        className="pointer-events-none absolute left-1/2 -translate-x-1/2 -rotate-90 text-lg opacity-70"
        animate={{ top: ["-20%", "120%"] }}
        transition={{ duration, delay: (index % 4) * 0.2 + duration / 2, repeat: Infinity, ease: "linear" }}
      >
        {glyph}
      </motion.span>
    </>
  );
}
