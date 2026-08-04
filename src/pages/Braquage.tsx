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
      setBustedIndex(index);
      setPhase("busted");
      recordRound({ game: "Braquage", label: RISK_LABEL[risk], bet, payout: 0, tier: "none" });
      push({ kind: "info", title: "Alarme déclenchée !", description: "Le braquage a échoué." });
      return;
    }

    const nextPicks = picks + 1;
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
        <div className="mx-auto grid max-w-md grid-cols-5 gap-1.5 rounded-2xl border border-white/10 bg-ink-950/60 p-3">
          {Array.from({ length: GRID_SIZE }, (_, i) => {
            const isRevealed = revealed[i];
            const isAlarm = isRevealed && grid[i];
            const isBustedTile = bustedIndex === i;
            return (
              <button
                key={i}
                onClick={() => pick(i)}
                disabled={phase !== "playing" || isRevealed}
                className={cn(
                  "relative flex aspect-square items-center justify-center overflow-hidden rounded-lg border text-lg transition-all",
                  isRevealed
                    ? isAlarm
                      ? "border-red-500 bg-red-500/20"
                      : "border-emerald-500/40 bg-emerald-500/10"
                    : "border-white/10 bg-gradient-to-br from-electric-600/30 to-electric-800/30 hover:from-electric-500/40 hover:to-electric-700/40"
                )}
              >
                {isRevealed ? (
                  <motion.span initial={{ scale: 0 }} animate={{ scale: isBustedTile ? [1, 1.4, 1] : 1 }} transition={{ type: "spring", stiffness: 300, damping: 16 }}>
                    {isAlarm ? "🚨" : LOOT_GLYPHS[i % LOOT_GLYPHS.length]}
                  </motion.span>
                ) : (
                  <span className="text-white/20">🔒</span>
                )}
              </button>
            );
          })}
        </div>

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
              <div>
                <p className="text-[11px] uppercase tracking-wide text-ice-200/50">Multiplicateur actuel</p>
                <p className="font-display text-2xl font-bold text-gold-400">x{multiplier}</p>
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
