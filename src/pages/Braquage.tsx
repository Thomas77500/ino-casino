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
import { IconVaultDoor } from "../components/icons";
import { formatCredits, cn } from "../lib/format";
import { maxBetFor } from "../lib/betting";
import { xpForPayout } from "../lib/xp";
import { GRID_SIZE, ALARM_COUNTS, RISK_LABEL, buildHeistMultiplier, safeTileCount, drawGrid, type RiskLevel } from "../lib/heistEngine";
import { tierFromMultiplier, type WinTier } from "../lib/winTiers";
import { playSound } from "../lib/sounds";

type Phase = "idle" | "playing" | "busted" | "extracted";

const RISKS: RiskLevel[] = ["faible", "moyen", "eleve"];
const LOOT_GLYPHS = ["💰", "💎", "👑", "🪙", "🧨"];

export function Braquage() {
  const credits = useCasinoStore((s) => s.credits);
  const level = useCasinoStore((s) => s.level);
  const placeBet = useCasinoStore((s) => s.placeBet);
  const award = useCasinoStore((s) => s.award);
  const addXp = useCasinoStore((s) => s.addXp);
  const recordRound = useCasinoStore((s) => s.recordRound);
  const history = useCasinoStore((s) => s.history);
  const push = useToastStore((s) => s.push);
  const winBias = useGameStatusStore((s) => s.statuses.braquage?.winBias ?? 1);

  const maxBet = maxBetFor(credits, level);
  const [risk, setRisk] = useState<RiskLevel>("moyen");
  const [bet, setBet] = useState(Math.min(50, maxBet));
  const [phase, setPhase] = useState<Phase>("idle");
  const [grid, setGrid] = useState<boolean[]>([]);
  const [revealed, setRevealed] = useState<boolean[]>(Array(GRID_SIZE).fill(false));
  const [picks, setPicks] = useState(0);
  const [bustedIndex, setBustedIndex] = useState<number | null>(null);
  const [celebration, setCelebration] = useState<{ tier: WinTier; payout: number } | null>(null);

  const heistHistory = history.filter((h) => h.game === "Braquage").slice(0, 8);
  const multiplier = buildHeistMultiplier(risk, picks);

  function start() {
    if (phase === "playing" || credits < bet) {
      if (credits < bet) push({ kind: "info", title: "Crédits insuffisants" });
      return;
    }
    placeBet(bet);
    setGrid(drawGrid(risk, winBias));
    setRevealed(Array(GRID_SIZE).fill(false));
    setPicks(0);
    setBustedIndex(null);
    setPhase("playing");
  }

  function pick(index: number) {
    if (phase !== "playing" || revealed[index]) return;
    const nextRevealed = revealed.map((r, i) => (i === index ? true : r));
    setRevealed(nextRevealed);

    if (grid[index]) {
      playSound("boom");
      setBustedIndex(index);
      setPhase("busted");
      recordRound({ game: "Braquage", label: RISK_LABEL[risk], bet, payout: 0, tier: "none" });
      push({ kind: "info", title: "Alarme déclenchée !", description: "Le braquage a échoué." });
      return;
    }

    const nextPicks = picks + 1;
    playSound("chip");
    setPicks(nextPicks);
    if (nextPicks >= safeTileCount(risk)) {
      extract(nextPicks);
    }
  }

  function extract(atPicks = picks) {
    if (atPicks === 0) return;
    const finalMultiplier = buildHeistMultiplier(risk, atPicks);
    const payout = Math.round(bet * finalMultiplier);
    award(payout);
    addXp(xpForPayout(payout));
    const tier = tierFromMultiplier(finalMultiplier);
    recordRound({ game: "Braquage", label: RISK_LABEL[risk], bet, payout, tier });
    setPhase("extracted");

    if (tier === "megaWin" || tier === "gigaWin" || tier === "maxWin") {
      setCelebration({ tier, payout });
    } else {
      push({ kind: "success", title: `Extraction réussie : +${formatCredits(payout)} crédits (x${finalMultiplier})` });
    }
  }

  function reset() {
    setPhase("idle");
    setGrid([]);
    setRevealed(Array(GRID_SIZE).fill(false));
    setPicks(0);
    setBustedIndex(null);
  }

  return (
    <div className="mx-auto max-w-2xl px-4 py-8 sm:px-6">
      <div className="mb-6 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <IconVaultDoor className="h-6 w-6 text-gold-400" />
          <div>
            <h1 className="font-display text-2xl font-bold text-white sm:text-3xl">Braquage</h1>
            <p className="text-sm text-ice-200/60">Prends du butin, évite les alarmes, extrais-toi avant qu'il soit trop tard.</p>
          </div>
        </div>
        <Badge tone="gold">Crédits virtuels uniquement</Badge>
      </div>

      <Card className="p-4 sm:p-8" glow>
        <motion.div
          className="relative mx-auto max-w-md overflow-hidden rounded-2xl border-2 border-zinc-600/60 bg-[linear-gradient(180deg,#1c1f26,#0b0d12)] p-3 shadow-[inset_0_0_40px_rgba(0,0,0,0.8)]"
          animate={phase === "busted" ? { x: [0, -12, 12, -8, 8, -3, 0] } : { x: 0 }}
          transition={{ duration: 0.5 }}
        >
          {/* siren lights once the alarm trips */}
          {phase === "busted" && (
            <motion.div
              className="pointer-events-none absolute inset-0 z-20 mix-blend-screen"
              initial={{ opacity: 1 }}
              animate={{
                backgroundColor: ["rgba(239,68,68,0.4)", "rgba(59,130,246,0.35)", "rgba(239,68,68,0.4)", "rgba(59,130,246,0.35)", "rgba(239,68,68,0.4)"],
                opacity: [1, 1, 1, 1, 0],
              }}
              transition={{ duration: 2.2 }}
            />
          )}
          <div className="mb-2 flex items-center justify-between px-1 text-[10px] font-bold uppercase tracking-[0.25em] text-zinc-500">
            <span>Salle des coffres</span>
            <span className={phase === "busted" ? "text-red-400" : "text-emerald-400/80"}>{phase === "busted" ? "● Alarme" : "● Silence"}</span>
          </div>
          <div className="grid grid-cols-5 gap-1.5" style={{ perspective: 700 }}>
            {Array.from({ length: GRID_SIZE }, (_, i) => {
              const isRevealed = revealed[i];
              const isAlarm = grid[i];
              const isBustedTile = bustedIndex === i;
              const showContent = isRevealed || (phase !== "playing" && phase !== "idle");
              return (
                <button
                  key={i}
                  onClick={() => pick(i)}
                  disabled={phase !== "playing" || isRevealed}
                  className="group relative aspect-square overflow-hidden rounded-md"
                >
                  {/* box interior */}
                  <div
                    className={cn(
                      "absolute inset-0 grid place-items-center rounded-md border text-xl",
                      showContent && isAlarm ? "border-red-500/70 bg-[radial-gradient(circle,rgba(239,68,68,0.45),rgba(60,0,0,0.9))]" : "border-gold-400/40 bg-[radial-gradient(circle,rgba(246,191,75,0.35),rgba(30,20,0,0.95))]",
                      !isRevealed && phase !== "playing" && "opacity-45"
                    )}
                  >
                    {showContent && (
                      <motion.span
                        initial={{ scale: 0.3, y: 6 }}
                        animate={{ scale: isBustedTile ? [1, 1.5, 1.2] : 1, y: 0 }}
                        transition={{ type: "spring", stiffness: 300, damping: 14, delay: isRevealed ? 0.15 : 0.02 * i }}
                        className={cn("drop-shadow-[0_0_8px_rgba(246,191,75,0.8)]", isAlarm && "drop-shadow-[0_0_10px_rgba(239,68,68,0.9)]")}
                      >
                        {isAlarm ? "🚨" : LOOT_GLYPHS[i % LOOT_GLYPHS.length]}
                      </motion.span>
                    )}
                  </div>
                  {/* door swings open on its hinge */}
                  <motion.div
                    className="absolute inset-0 origin-left rounded-md border border-zinc-400/40 bg-[linear-gradient(135deg,#a1a1aa_0%,#52525b_45%,#71717a_55%,#3f3f46_100%)] shadow-[inset_0_1px_0_rgba(255,255,255,0.35)]"
                    style={{ backfaceVisibility: "hidden" }}
                    animate={showContent ? { rotateY: -110, opacity: isRevealed ? 1 : 0 } : { rotateY: 0, opacity: 1 }}
                    transition={{ duration: isRevealed ? 0.45 : 0.3, ease: [0.3, 0.7, 0.3, 1], delay: isRevealed ? 0 : 0.015 * i }}
                  >
                    <div className="absolute inset-[3px] rounded-[4px] border border-black/30" />
                    <span className="absolute left-1 top-0.5 font-mono text-[8px] font-bold text-zinc-800/80">{String(i + 1).padStart(2, "0")}</span>
                    <span className="absolute left-1/2 top-1/2 h-3 w-3 -translate-x-1/2 -translate-y-1/2 rounded-full border border-zinc-800/60 bg-zinc-800/80 shadow-[inset_0_1px_2px_rgba(0,0,0,0.8)] transition-transform group-hover:rotate-90">
                      <span className="absolute left-1/2 top-1/2 h-1.5 w-0.5 -translate-x-1/2 -translate-y-1/2 bg-zinc-400" />
                    </span>
                    {phase === "playing" && <span className="absolute inset-0 rounded-md bg-gold-400/0 transition-colors group-hover:bg-gold-400/15" />}
                  </motion.div>
                </button>
              );
            })}
          </div>
        </motion.div>

        <div className="mt-6 flex flex-col gap-4">
          {phase === "idle" ? (
            <>
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-xs uppercase tracking-wide text-ice-200/50">Difficulté</span>
                {RISKS.map((r) => (
                  <button
                    key={r}
                    onClick={() => setRisk(r)}
                    className={cn(
                      "rounded-lg px-3 py-1.5 text-sm font-semibold transition-colors",
                      risk === r ? "bg-electric-500 text-white shadow-glow" : "bg-white/[0.03] text-ice-200/60 hover:text-white"
                    )}
                  >
                    {RISK_LABEL[r]} ({ALARM_COUNTS[r]} alarmes)
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
          ) : phase === "playing" ? (
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div className="flex gap-6">
                <div>
                  <p className="text-[11px] uppercase tracking-wide text-ice-200/50">Multiplicateur actuel</p>
                  <motion.p key={picks} initial={{ scale: 1.4 }} animate={{ scale: 1 }} className="font-display text-2xl font-bold text-gold-400">x{multiplier}</motion.p>
                </div>
                {picks < safeTileCount(risk) && (
                  <div>
                    <p className="text-[11px] uppercase tracking-wide text-ice-200/50">Coffre suivant</p>
                    <p className="font-display text-2xl font-bold text-ice-200/70">x{buildHeistMultiplier(risk, picks + 1)}</p>
                  </div>
                )}
              </div>
              <Button variant="gold" onClick={() => extract()} disabled={picks === 0}>
                Extraire {picks > 0 && `(${formatCredits(Math.round(bet * multiplier))})`}
              </Button>
            </div>
          ) : (
            <div className="flex items-center justify-between">
              <p className="text-sm text-ice-200/60">
                {phase === "busted" ? "L'alarme a coupé la fuite." : "Butin extrait avec succès."}
              </p>
              <Button size="lg" onClick={reset}>Nouveau braquage</Button>
            </div>
          )}
        </div>
      </Card>

      {heistHistory.length > 0 && (
        <Card className="mt-6 p-4">
          <h3 className="mb-3 font-display text-sm font-semibold text-white">Historique récent</h3>
          <ul className="flex flex-col gap-2">
            {heistHistory.map((h) => (
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
