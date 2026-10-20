import { useEffect, useRef, useState } from "react";
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
import { playSound } from "../lib/sounds";

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

  const gridRef = useRef<HTMLDivElement>(null);
  const cellRefs = useRef<(HTMLDivElement | null)[]>([]);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [foilKey, setFoilKey] = useState(0);
  const [foilGone, setFoilGone] = useState(false);

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
    setFoilGone(false);
    setFoilKey((k) => k + 1);
    setPhase("scratching");
  }

  function revealAll() {
    if (phase !== "scratching") return;
    setFoilGone(true);
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
    setFoilGone(false);
    setFoilKey((k) => k + 1);
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
        <div className="relative mx-auto max-w-xs rounded-2xl border-2 border-gold-500/40 bg-gradient-to-br from-electric-900/60 to-ink-950 p-3 shadow-glow">
          <p className="mb-2 text-center font-display text-xs font-bold uppercase tracking-[0.25em] text-gold-300">Ino Millions</p>
          <div ref={gridRef} className="relative grid grid-cols-3 gap-2">
            {Array.from({ length: CARD_SIZE }, (_, i) => {
              const isRevealed = phase !== "idle" && revealed[i];
              const symbolId = card?.cells[i];
              const isWinningCell = phase === "done" && card?.winningSymbol && symbolId === card.winningSymbol;
              return (
                <div
                  key={i}
                  ref={(el) => {
                    cellRefs.current[i] = el;
                  }}
                  className={cn(
                    "relative flex aspect-square items-center justify-center overflow-hidden rounded-xl border bg-gradient-to-b from-white/[0.08] to-white/[0.02] text-3xl transition-shadow",
                    isWinningCell ? "border-gold-400 shadow-glow-gold ring-2 ring-gold-400" : "border-white/10"
                  )}
                >
                  {symbolId && phase !== "idle" && (
                    <motion.span
                      animate={isRevealed && isWinningCell ? { scale: [1, 1.25, 1] } : { scale: 1 }}
                      transition={isWinningCell ? { duration: 0.7, repeat: Infinity } : { duration: 0.2 }}
                    >
                      {symbolGlyph(symbolId)}
                    </motion.span>
                  )}
                </div>
              );
            })}
            <ScratchFoil
              key={foilKey}
              canvasRef={canvasRef}
              gridRef={gridRef}
              cellRefs={cellRefs}
              enabled={phase === "scratching"}
              gone={foilGone || phase === "done"}
              revealed={revealed}
              onReveal={(i) => setRevealed((prev) => (prev[i] ? prev : prev.map((r, idx) => (idx === i ? true : r))))}
            />
          </div>
          {phase === "scratching" && revealed.every((r) => !r) && (
            <p className="pointer-events-none mt-2 text-center text-[11px] text-ice-200/60">Gratte avec le doigt ou la souris 🪙</p>
          )}
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

const BRUSH = 18;

// One foil canvas over the whole ticket, scratched with destination-out strokes. Each cell is
// revealed once more than half of its own area is scratched away — measured on the real pixels.
function ScratchFoil({
  canvasRef,
  gridRef,
  cellRefs,
  enabled,
  gone,
  revealed,
  onReveal,
}: {
  canvasRef: React.RefObject<HTMLCanvasElement>;
  gridRef: React.RefObject<HTMLDivElement>;
  cellRefs: React.MutableRefObject<(HTMLDivElement | null)[]>;
  enabled: boolean;
  gone: boolean;
  revealed: boolean[];
  onReveal: (i: number) => void;
}) {
  const last = useRef<{ x: number; y: number } | null>(null);
  const moves = useRef(0);
  const lastSound = useRef(0);
  const revealedRef = useRef(revealed);
  revealedRef.current = revealed;
  const [flakes, setFlakes] = useState<{ id: number; x: number; y: number }[]>([]);

  useEffect(() => {
    const canvas = canvasRef.current;
    const grid = gridRef.current;
    if (!canvas || !grid) return;
    const dpr = window.devicePixelRatio || 1;
    const g = grid.getBoundingClientRect();
    canvas.width = g.width * dpr;
    canvas.height = g.height * dpr;
    const ctx = canvas.getContext("2d")!;
    ctx.scale(dpr, dpr);
    cellRefs.current.forEach((cell) => {
      if (!cell) return;
      const r = cell.getBoundingClientRect();
      const x = r.left - g.left;
      const y = r.top - g.top;
      const grad = ctx.createLinearGradient(x, y, x + r.width, y + r.height);
      grad.addColorStop(0, "#d9dde3");
      grad.addColorStop(0.45, "#9aa3ad");
      grad.addColorStop(0.55, "#eef1f4");
      grad.addColorStop(1, "#8a929c");
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.roundRect(x, y, r.width, r.height, 12);
      ctx.fill();
      for (let k = 0; k < 140; k++) {
        ctx.fillStyle = `rgba(${Math.random() > 0.5 ? "255,255,255" : "60,66,74"},${Math.random() * 0.25})`;
        ctx.fillRect(x + Math.random() * r.width, y + Math.random() * r.height, 1.5, 1.5);
      }
      ctx.fillStyle = "rgba(60,66,74,0.55)";
      ctx.font = "bold 22px system-ui";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText("★", x + r.width / 2, y + r.height / 2);
    });
    ctx.globalCompositeOperation = "destination-out";
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.lineWidth = BRUSH * 2;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function measure() {
    const canvas = canvasRef.current;
    const grid = gridRef.current;
    if (!canvas || !grid) return;
    const ctx = canvas.getContext("2d")!;
    const dpr = window.devicePixelRatio || 1;
    const g = grid.getBoundingClientRect();
    cellRefs.current.forEach((cell, i) => {
      if (!cell || revealedRef.current[i]) return;
      const r = cell.getBoundingClientRect();
      const x = r.left - g.left;
      const y = r.top - g.top;
      const data = ctx.getImageData(x * dpr, y * dpr, r.width * dpr, r.height * dpr).data;
      let clear = 0;
      let total = 0;
      for (let p = 3; p < data.length; p += 4 * 16) {
        total++;
        if (data[p] < 40) clear++;
      }
      if (clear / total > 0.5) {
        ctx.fillRect(x - 2, y - 2, r.width + 4, r.height + 4); // destination-out: wipes the leftovers
        playSound("chip");
        onReveal(i);
      }
    });
  }

  function scratch(e: React.PointerEvent<HTMLCanvasElement>) {
    if (!enabled || e.buttons === 0) return;
    const ctx = e.currentTarget.getContext("2d")!;
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const from = last.current ?? { x: x - 0.1, y };
    ctx.beginPath();
    ctx.moveTo(from.x, from.y);
    ctx.lineTo(x, y);
    ctx.stroke();
    last.current = { x, y };
    const now = performance.now();
    if (now - lastSound.current > 70) {
      lastSound.current = now;
      playSound("scratch");
      setFlakes((f) => [...f.slice(-14), { id: now, x, y }]);
    }
    if (++moves.current % 5 === 0) measure();
  }

  return (
    <>
      <canvas
        ref={canvasRef}
        className={cn(
          "absolute inset-0 h-full w-full touch-none rounded-xl transition-opacity duration-500",
          enabled ? "cursor-crosshair" : "pointer-events-none",
          gone && "opacity-0"
        )}
        onPointerDown={(e) => {
          e.currentTarget.setPointerCapture(e.pointerId);
          last.current = null;
          scratch(e);
        }}
        onPointerMove={scratch}
        onPointerUp={() => {
          last.current = null;
          measure();
        }}
      />
      {flakes.map((f) => (
        <motion.span
          key={f.id}
          className="pointer-events-none absolute h-1.5 w-1.5 rounded-sm bg-ice-200"
          style={{ left: f.x, top: f.y }}
          initial={{ opacity: 1, y: 0, x: 0, rotate: 0 }}
          animate={{ opacity: 0, y: 40, x: (f.id % 2 ? 1 : -1) * 14, rotate: 180 }}
          transition={{ duration: 0.7, ease: "easeIn" }}
        />
      ))}
    </>
  );
}
