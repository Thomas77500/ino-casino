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
import { formatCredits, cn } from "../lib/format";
import { maxBetFor } from "../lib/betting";
import { xpForPayout } from "../lib/xp";
import { rollAuditThreshold, rateAt, FRONTS, auditNarrative, type LaunderingFront } from "../lib/launderingEngine";
import { tierFromMultiplier, type WinTier } from "../lib/winTiers";

type Phase = "idle" | "running" | "busted" | "extracted";

export function Laundering() {
  const credits = useCasinoStore((s) => s.credits);
  const level = useCasinoStore((s) => s.level);
  const placeBet = useCasinoStore((s) => s.placeBet);
  const award = useCasinoStore((s) => s.award);
  const addXp = useCasinoStore((s) => s.addXp);
  const recordRound = useCasinoStore((s) => s.recordRound);
  const history = useCasinoStore((s) => s.history);
  const push = useToastStore((s) => s.push);
  const winBias = useGameStatusStore((s) => s.statuses.laundering?.winBias ?? 1);

  const maxBet = maxBetFor(credits, level);
  const [bet, setBet] = useState(Math.min(50, maxBet));
  const [front, setFront] = useState<LaunderingFront>(FRONTS[0]);
  const [phase, setPhase] = useState<Phase>("idle");
  const [rate, setRate] = useState(1);
  const [auditPoint, setAuditPoint] = useState<number | null>(null);
  const [extractedAt, setExtractedAt] = useState<number | null>(null);
  const [plausibility, setPlausibility] = useState(72);
  const [celebration, setCelebration] = useState<{ tier: WinTier; payout: number } | null>(null);
  const rafRef = useRef<number>();
  const betRef = useRef(bet);
  betRef.current = bet;
  const frontRef = useRef(front);
  frontRef.current = front;
  const warnedRef = useRef<{ warn3?: boolean; warn6?: boolean }>({});

  const laundryHistory = history.filter((h) => h.game === "Laundering").slice(0, 8);

  useEffect(() => {
    if (phase !== "running" || auditPoint === null) return;
    const start = performance.now();
    warnedRef.current = {};

    function tick(now: number) {
      const elapsed = now - start;
      const m = rateAt(elapsed);
      if (m >= auditPoint!) {
        setRate(auditPoint!);
        finalizeAudit();
        return;
      }
      setRate(m);
      setPlausibility((p) => Math.max(15, Math.min(96, p + (Math.random() - 0.5) * 14)));
      if (m >= 3 && !warnedRef.current.warn3) {
        warnedRef.current.warn3 = true;
        push({ kind: "info", title: "🔎 Un contrôleur a été aperçu dans le quartier..." });
      }
      if (m >= 6 && !warnedRef.current.warn6) {
        warnedRef.current.warn6 = true;
        push({ kind: "info", title: "🚨 Le fisc s'intéresse de très près à vos comptes." });
      }
      rafRef.current = requestAnimationFrame(tick);
    }
    rafRef.current = requestAnimationFrame(tick);
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, auditPoint]);

  function start() {
    if (phase === "running" || credits < bet) {
      if (credits < bet) push({ kind: "info", title: "Crédits insuffisants" });
      return;
    }
    placeBet(bet);
    setRate(1);
    setExtractedAt(null);
    setPlausibility(72);
    setAuditPoint(rollAuditThreshold(winBias, front.riskMultiplier));
    setPhase("running");
  }

  function finalizeAudit() {
    setPhase("busted");
    recordRound({ game: "Laundering", label: frontRef.current.label, bet: betRef.current, payout: 0, tier: "none" });
    push({ kind: "info", title: "Contrôle fiscal !", description: auditNarrative(frontRef.current.id) });
  }

  function extract() {
    if (phase !== "running") return;
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    const m = rate;
    setExtractedAt(m);
    setPhase("extracted");
    const payout = Math.round(bet * m);
    award(payout);
    addXp(xpForPayout(payout));
    const tier = tierFromMultiplier(m);
    recordRound({ game: "Laundering", label: front.label, bet, payout, tier });
    if (tier === "megaWin" || tier === "gigaWin" || tier === "maxWin") {
      setCelebration({ tier, payout });
    } else {
      push({ kind: "success", title: `Argent blanchi à x${m.toFixed(2)} — +${formatCredits(payout)} crédits` });
    }
  }

  function reset() {
    setPhase("idle");
    setAuditPoint(null);
    setExtractedAt(null);
    setRate(1);
  }

  const busted = phase === "busted";

  return (
    <div className="mx-auto max-w-3xl px-4 py-8 sm:px-6">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="font-display text-2xl font-bold text-white sm:text-3xl">Blanchiment</h1>
          <p className="text-sm text-ice-200/60">Extrais l'argent avant le contrôle fiscal — plus tu attends, plus c'est blanchi.</p>
        </div>
        <Badge tone="gold">Crédits virtuels uniquement</Badge>
      </div>

      {phase === "idle" && (
        <Card className="mb-4 p-4 sm:p-6">
          <p className="mb-3 text-xs uppercase tracking-wide text-ice-200/50">Choisis ta couverture</p>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            {FRONTS.map((f) => (
              <button
                key={f.id}
                onClick={() => setFront(f)}
                className={cn(
                  "flex flex-col items-center gap-1 rounded-xl border p-3 text-center transition",
                  front.id === f.id ? "border-gold-400 bg-gold-500/10" : "border-white/10 bg-white/[0.03]"
                )}
              >
                <span className="text-2xl">{f.glyph}</span>
                <span className="text-[11px] font-semibold leading-tight text-white">{f.label}</span>
              </button>
            ))}
          </div>
          <p className="mt-3 text-xs text-ice-200/50">{front.description}</p>
        </Card>
      )}

      <Card className="p-4 sm:p-8" glow>
        <motion.div
          animate={busted ? { x: [0, -8, 8, -5, 5, 0] } : {}}
          transition={{ duration: 0.4 }}
          className={cn(
            "relative h-64 overflow-hidden rounded-2xl border",
            busted ? "border-red-500/40 bg-red-950/20" : "border-white/10 bg-gradient-to-b from-ink-900/60 to-ink-950/60"
          )}
        >
          <div className="absolute inset-0 flex flex-col items-center justify-center px-6">
            <span className="text-4xl">{busted ? "🚨" : phase === "running" ? front.glyph : "💼"}</span>
            <motion.p
              animate={phase === "running" ? { scale: [1, 1.03, 1] } : {}}
              transition={{ duration: 0.5, repeat: Infinity }}
              className={cn("mt-2 font-display text-4xl font-bold sm:text-5xl", busted ? "text-red-400" : "text-white")}
            >
              x{rate.toFixed(2)}
            </motion.p>
            {busted && <p className="mt-1 text-sm font-semibold text-red-400">CONTRÔLE FISCAL</p>}
            {extractedAt && phase === "extracted" && <p className="mt-1 text-sm font-semibold text-emerald-400">Argent extrait !</p>}
            {phase === "running" && (
              <div className="mt-4 w-48">
                <p className="mb-1 text-center text-[10px] uppercase tracking-wide text-ice-200/40">Rentabilité apparente</p>
                <ProgressBar value={plausibility} max={100} />
              </div>
            )}
          </div>
        </motion.div>

        <div className="mt-6 flex flex-wrap items-center justify-between gap-4">
          {phase === "idle" ? (
            <>
              <BetInput value={bet} onChange={setBet} max={maxBet} min={Math.min(10, maxBet)} />
              <Button size="lg" onClick={start} disabled={credits < bet}>
                Lancer l'opération ({formatCredits(bet)})
              </Button>
            </>
          ) : phase === "running" ? (
            <div className="flex w-full items-center justify-between gap-4">
              <p className="text-sm text-ice-200/60">Montant extractible : {formatCredits(Math.round(bet * rate))}</p>
              <Button variant="gold" size="lg" onClick={extract}>Extraire</Button>
            </div>
          ) : (
            <div className="flex w-full items-center justify-between">
              <p className="text-sm text-ice-200/60">
                {phase === "busted" ? "Le fisc a tout saisi avant que tu extraies." : `Tu as extrait à x${extractedAt?.toFixed(2)}.`}
              </p>
              <Button size="lg" onClick={reset}>Nouvelle opération</Button>
            </div>
          )}
        </div>
      </Card>

      {laundryHistory.length > 0 && (
        <Card className="mt-6 p-4">
          <h3 className="mb-3 font-display text-sm font-semibold text-white">Historique récent</h3>
          <ul className="flex flex-col gap-2">
            {laundryHistory.map((h) => (
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
