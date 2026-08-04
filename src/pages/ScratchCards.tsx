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
import { generateCard, symbolGlyph, CARD_SIZE, type ScratchResult } from "../lib/scratchEngine";
import { tierFromMultiplier, type WinTier } from "../lib/winTiers";

type Phase = "idle" | "scratching" | "done";

export function ScratchCards() {
  const credits = useCasinoStore((s) => s.credits);
  const level = useCasinoStore((s) => s.level);
  const placeBet = useCasinoStore((s) => s.placeBet);
  const award = useCasinoStore((s) => s.award);
  const addXp = useCasinoStore((s) => s.addXp);
  const recordRound = useCasinoStore((s) => s.recordRound);
  const history = useCasinoStore((s) => s.history);
  const push = useToastStore((s) => s.push);
  const winBias = useGameStatusStore((s) => s.statuses.scratch?.winBias ?? 1);

  const maxBet = maxBetFor(credits, level);
  const [bet, setBet] = useState(Math.min(25, maxBet));
  const [phase, setPhase] = useState<Phase>("idle");
  const [card, setCardState] = useState<ScratchResult | null>(null);
  const [revealed, setRevealed] = useState<boolean[]>(Array(CARD_SIZE).fill(false));
  const [celebration, setCelebration] = useState<{ tier: WinTier; payout: number } | null>(null);

  const scratchHistory = history.filter((h) => h.game === "ScratchCards").slice(0, 8);

  useEffect(() => {
    if (phase === "scratching" && card && revealed.every(Boolean)) {
      finalize(card);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [revealed]);

  function buy() {
    if (phase === "scratching" || credits < bet) {
      if (credits < bet) push({ kind: "info", title: "Crédits insuffisants" });
      return;
    }
    placeBet(bet);
    setCardState(generateCard(winBias));
    setRevealed(Array(CARD_SIZE).fill(false));
    setPhase("scratching");
  }

  function scratchCell(i: number) {
    if (phase !== "scratching" || revealed[i]) return;
    setRevealed((prev) => prev.map((r, idx) => (idx === i ? true : r)));
  }

  function revealAll() {
    if (phase !== "scratching") return;
    setRevealed(Array(CARD_SIZE).fill(true));
  }

  function finalize(finishedCard: ScratchResult) {
    const payout = finishedCard.multiplier > 0 ? Math.round(bet * finishedCard.multiplier) : 0;
    if (payout > 0) {
      award(payout);
      addXp(xpForPayout(payout));
    }
    const tier = payout > 0 ? tierFromMultiplier(finishedCard.multiplier) : "none";
    const label = finishedCard.winningSymbol
      ? `${finishedCard.pattern === "line" ? "Ligne" : "3x"} ${symbolGlyph(finishedCard.winningSymbol)}`
      : "Perdant";
    recordRound({ game: "ScratchCards", label, bet, payout, tier });
    setPhase("done");

    if (tier === "megaWin" || tier === "gigaWin" || tier === "maxWin") {
      setCelebration({ tier, payout });
    } else if (payout > 0) {
      push({ kind: "success", title: `${label} — +${formatCredits(payout)} crédits` });
    } else {
      push({ kind: "info", title: "Pas de gain cette fois" });
    }
  }

  function newCard() {
    setPhase("idle");
    setCardState(null);
    setRevealed(Array(CARD_SIZE).fill(false));
  }

  return (
    <div className="mx-auto max-w-2xl px-4 py-8 sm:px-6">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="font-display text-2xl font-bold text-white sm:text-3xl">Cartes à Gratter</h1>
          <p className="text-sm text-ice-200/60">3 symboles identiques sur la grille = gain immédiat.</p>
        </div>
        <Badge tone="gold">Crédits virtuels uniquement</Badge>
      </div>

      <Card className="p-4 sm:p-8" glow>
        <div className="mx-auto grid max-w-xs grid-cols-3 gap-2 rounded-2xl border border-white/10 bg-ink-950/60 p-3">
          {Array.from({ length: CARD_SIZE }, (_, i) => {
            const isRevealed = phase !== "idle" && revealed[i];
            const symbolId = card?.cells[i];
            const isWinningCell = phase === "done" && card?.winningSymbol && symbolId === card.winningSymbol;
            return (
              <button
                key={i}
                onClick={() => scratchCell(i)}
                disabled={phase !== "scratching"}
                className={cn(
                  "relative flex aspect-square items-center justify-center overflow-hidden rounded-xl border text-3xl transition-all",
                  isRevealed ? "border-white/10 bg-white/[0.04]" : "border-white/10 bg-gradient-to-br from-electric-600/40 to-electric-800/40",
                  isWinningCell && "border-gold-400 shadow-glow-gold ring-2 ring-gold-400"
                )}
              >
                {isRevealed ? (
                  <motion.span initial={{ scale: 0, rotate: -10 }} animate={{ scale: 1, rotate: 0 }} transition={{ type: "spring", stiffness: 300, damping: 16 }}>
                    {symbolGlyph(symbolId!)}
                  </motion.span>
                ) : (
                  <span className="text-lg text-white/40">?</span>
                )}
              </button>
            );
          })}
        </div>

        <div className="mt-6 flex flex-wrap items-center justify-between gap-4">
          {phase === "idle" ? (
            <>
              <BetInput value={bet} onChange={setBet} max={maxBet} min={Math.min(5, maxBet)} />
              <Button size="lg" onClick={buy} disabled={credits < bet}>
                Acheter une carte ({formatCredits(bet)})
              </Button>
            </>
          ) : phase === "scratching" ? (
            <div className="flex w-full items-center justify-between gap-4">
              <p className="text-sm text-ice-200/60">{revealed.filter(Boolean).length} / {CARD_SIZE} cases grattées</p>
              <Button variant="secondary" onClick={revealAll}>Tout révéler</Button>
            </div>
          ) : (
            <div className="flex w-full items-center justify-between">
              <p className="text-sm text-ice-200/60">
                {card?.winningSymbol
                  ? card.pattern === "line"
                    ? `Ligne gagnante de ${symbolGlyph(card.winningSymbol)} ! (bonus x1.5)`
                    : `Gagné avec 3x ${symbolGlyph(card.winningSymbol)} !`
                  : "Aucune combinaison cette fois."}
              </p>
              <Button size="lg" onClick={newCard}>Nouvelle carte</Button>
            </div>
          )}
        </div>

        <p className="mt-4 text-xs text-ice-200/50">
          Table des gains : 🍒 x2 · 🍀 x3 · 🔔 x5 · 💎 x10 · ⭐ x25 · 👑 x100 — une ligne (ligne/colonne/diagonale) rapporte x1.5 en plus
        </p>
      </Card>

      {scratchHistory.length > 0 && (
        <Card className="mt-6 p-4">
          <h3 className="mb-3 font-display text-sm font-semibold text-white">Historique récent</h3>
          <ul className="flex flex-col gap-2">
            {scratchHistory.map((h) => (
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
