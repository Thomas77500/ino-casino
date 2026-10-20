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
import { Modal } from "../components/ui/Modal";
import { formatCredits, cn } from "../lib/format";
import { maxBetFor } from "../lib/betting";
import { xpForPayout } from "../lib/xp";
import { spinGrid, evaluateSpin, symbolGlyph, PAYLINES, type SpinResult, type Grid } from "../lib/slotsEngine";
import { SLOT_MACHINES, VOLATILITY_LABEL, type SlotMachineConfig } from "../lib/slotMachines";
import type { WinTier } from "../lib/winTiers";
import { playSound } from "../lib/sounds";

type SlotSymbolList = SlotMachineConfig["symbols"];

// Reel strip for one column: what's currently showing, a run of filler symbols, then the
// landing symbols — scrolled through in one motion so the stop is a real reel, not a swap.
function buildStrip(from: Grid, to: Grid, col: number, filler: number, symbols: SlotSymbolList): string[] {
  const column = (g: Grid) => [0, 1, 2].map((r) => g[r][col]);
  const extra = Array.from({ length: filler }, () => symbols[Math.floor(Math.random() * symbols.length)].id);
  return [...column(from), ...extra, ...column(to)];
}

// Two matching symbols on the first two reels of any line → the last reel keeps spinning longer.
function teases(g: Grid): boolean {
  return PAYLINES.some(([a, b]) => g[a[0]][a[1]] === g[b[0]][b[1]]);
}

const CELL_CENTER = [50, 150, 250];

export function Slots() {
  const level = useCasinoStore((s) => s.level);
  const [machineId, setMachineId] = useState<string | null>(null);
  const machine = SLOT_MACHINES.find((m) => m.id === machineId) ?? null;

  return machine ? (
    <SlotMachineGame machine={machine} onBack={() => setMachineId(null)} />
  ) : (
    <SlotLobby level={level} onSelect={setMachineId} />
  );
}

function SlotLobby({ level, onSelect }: { level: number; onSelect: (id: string) => void }) {
  return (
    <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6">
      <div className="mb-6">
        <h1 className="font-display text-2xl font-bold text-white sm:text-3xl">Machines à sous</h1>
        <p className="text-sm text-ice-200/60">Choisis ta machine — chacune a sa propre volatilité et ses propres symboles.</p>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        {SLOT_MACHINES.map((m) => {
          const locked = level < m.minLevel;
          return (
            <motion.div key={m.id} whileHover={locked ? undefined : { y: -4 }}>
              <Card
                className={cn("flex h-full flex-col p-5", locked ? "opacity-50" : "cursor-pointer hover:shadow-glow")}
                onClick={() => !locked && onSelect(m.id)}
              >
                <div className="mb-3 flex items-center justify-between">
                  <div className={cn("grid h-12 w-12 place-items-center rounded-xl bg-gradient-to-br text-2xl", m.accent)}>
                    {m.symbols[m.symbols.length - 1].glyph}
                  </div>
                  <Badge tone="electric">{VOLATILITY_LABEL[m.volatility]}</Badge>
                </div>
                <h3 className="font-display text-lg font-bold text-white">{m.name}</h3>
                <p className="mt-1 flex-1 text-sm text-ice-200/60">{m.theme}</p>
                {locked ? (
                  <p className="mt-3 text-xs font-semibold text-ice-200/40">Débloqué au niveau {m.minLevel}</p>
                ) : (
                  <span className="mt-3 text-sm font-semibold text-electric-400">Jouer →</span>
                )}
              </Card>
            </motion.div>
          );
        })}
      </div>
    </div>
  );
}

function SlotMachineGame({ machine, onBack }: { machine: SlotMachineConfig; onBack: () => void }) {
  const credits = useCasinoStore((s) => s.credits);
  const level = useCasinoStore((s) => s.level);
  const placeBet = useCasinoStore((s) => s.placeBet);
  const award = useCasinoStore((s) => s.award);
  const addXp = useCasinoStore((s) => s.addXp);
  const recordRound = useCasinoStore((s) => s.recordRound);
  const history = useCasinoStore((s) => s.history);
  const push = useToastStore((s) => s.push);
  const winBias = useGameStatusStore((s) => s.statuses.slots?.winBias ?? 1);

  const maxBet = maxBetFor(credits, level);
  const [bet, setBet] = useState(Math.min(50, maxBet));
  const [grid, setGrid] = useState(() => spinGrid(machine.symbols));
  const [spinning, setSpinning] = useState(false);
  const [result, setResult] = useState<SpinResult | null>(null);
  const [celebration, setCelebration] = useState<{ tier: WinTier; payout: number } | null>(null);
  const [autoSpins, setAutoSpins] = useState(0);
  const [showPaytable, setShowPaytable] = useState(false);
  const [strips, setStrips] = useState<{ cells: string[]; duration: number }[] | null>(null);
  const [spinId, setSpinId] = useState(0);
  const [teasing, setTeasing] = useState(false);
  const [turbo, setTurbo] = useState(false);
  const [stopOnWin, setStopOnWin] = useState("");
  const [stopOnLoss, setStopOnLoss] = useState("");
  const autoRef = useRef(autoSpins);
  autoRef.current = autoSpins;
  const stopOnWinRef = useRef(stopOnWin);
  stopOnWinRef.current = stopOnWin;
  const stopOnLossRef = useRef(stopOnLoss);
  stopOnLossRef.current = stopOnLoss;

  const slotHistory = history.filter((h) => h.game === "Slots" && h.label === machine.name).slice(0, 8);

  function runSpin() {
    if (spinning || credits < bet) {
      if (credits < bet) push({ kind: "info", title: "Crédits insuffisants", description: "Réduis ta mise ou reviens plus tard." });
      setAutoSpins(0);
      return;
    }
    setSpinning(true);
    setResult(null);
    placeBet(bet);
    playSound("spin");

    const finalGrid = spinGrid(machine.symbols, winBias);
    const tease = !turbo && teases(finalGrid);
    const nextStrips = [0, 1, 2].map((c) => {
      const duration = (turbo ? 0.45 : 1.1) + c * (turbo ? 0.12 : 0.38) + (c === 2 && tease ? 1.4 : 0);
      return { cells: buildStrip(grid, finalGrid, c, Math.round(duration * 22), machine.symbols), duration };
    });
    setStrips(nextStrips);
    setSpinId((n) => n + 1);
    setTeasing(false);
    if (tease) setTimeout(() => setTeasing(true), nextStrips[1].duration * 1000);
    const spinDurationMs = nextStrips[2].duration * 1000 + 120;

    setTimeout(() => {
      setTeasing(false);
      setGrid(finalGrid);
      const res = evaluateSpin(finalGrid, bet, machine.symbols);
      setResult(res);
      setSpinning(false);

      if (res.payout > 0) {
        award(res.payout);
        addXp(xpForPayout(res.payout));
      }
      recordRound({ game: "Slots", label: machine.name, bet, payout: res.payout, tier: res.tier });

      if (res.tier !== "none" && res.tier !== "win") {
        setCelebration({ tier: res.tier, payout: res.payout });
      } else if (res.payout > 0) {
        push({ kind: "success", title: `Gain : +${formatCredits(res.payout)} crédits` });
      }

      if (autoRef.current > 0) {
        const winThreshold = Number(stopOnWinRef.current);
        const lossThreshold = Number(stopOnLossRef.current);
        const balanceAfter = useCasinoStore.getState().credits;
        const hitWinStop = stopOnWinRef.current && res.payout >= winThreshold;
        const hitLossStop = stopOnLossRef.current && balanceAfter <= lossThreshold;
        setAutoSpins((n) => (hitWinStop || hitLossStop ? 0 : n - 1));
      }
    }, spinDurationMs);
  }

  useEffect(() => {
    if (autoSpins > 0 && !spinning) {
      const t = setTimeout(runSpin, 450);
      return () => clearTimeout(t);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoSpins, spinning]);

  const winningCells = new Set((result?.wins ?? []).flatMap((w) => w.cells.map(([r, c]) => `${r}-${c}`)));
  const shownStrips = strips ?? [0, 1, 2].map((c) => ({ cells: [0, 1, 2].map((r) => grid[r][c]), duration: 0 }));

  return (
    <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <button onClick={onBack} className="mb-1 text-xs text-electric-400 hover:text-electric-300">← Toutes les machines</button>
          <h1 className="font-display text-2xl font-bold text-white sm:text-3xl">{machine.name}</h1>
          <p className="text-sm text-ice-200/60">{machine.theme} — 3x3, 5 lignes de paiement</p>
        </div>
        <Badge tone="gold">Crédits virtuels uniquement</Badge>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
        <Card className="p-4 sm:p-8" glow>
          <div className="relative mx-auto max-w-md rounded-2xl border-4 border-gold-500/40 bg-gradient-to-b from-ink-900 to-ink-950 p-3 shadow-[inset_0_0_30px_rgba(0,0,0,0.8)] sm:p-5">
            <div className="relative grid grid-cols-3 gap-2 sm:gap-3">
              {shownStrips.map((strip, c) => {
                const M = strip.cells.length;
                const endPct = -((M - 3) / M) * 100;
                const overshoot = endPct - (0.18 / M) * 100;
                return (
                  <div
                    key={c}
                    className={cn(
                      "relative aspect-[1/3] overflow-hidden rounded-xl border bg-gradient-to-b from-ice-100/[0.07] via-white/[0.02] to-ice-100/[0.07] transition-shadow",
                      c === 2 && teasing ? "border-gold-400 shadow-glow-gold" : "border-white/10"
                    )}
                  >
                    <motion.div
                      key={`${spinId}-${c}`}
                      className="absolute inset-x-0 top-0 flex flex-col"
                      style={{ height: `${(M / 3) * 100}%` }}
                      initial={{ y: "0%" }}
                      animate={
                        strip.duration
                          ? { y: ["0%", `${overshoot}%`, `${endPct}%`], filter: ["blur(0px)", "blur(3px)", "blur(3px)", "blur(0px)"] }
                          : { y: "0%" }
                      }
                      transition={{
                        y: { duration: strip.duration, times: [0, 0.93, 1], ease: [[0.35, 0.05, 0.25, 1], "easeInOut"] },
                        filter: { duration: strip.duration, times: [0, 0.12, 0.7, 0.9] },
                      }}
                      onAnimationComplete={() => strip.duration && playSound("reel")}
                    >
                      {strip.cells.map((id, i) => (
                        <div key={i} className="flex flex-1 select-none items-center justify-center text-4xl sm:text-5xl">
                          {symbolGlyph(id, machine.symbols)}
                        </div>
                      ))}
                    </motion.div>
                    {/* glass curvature: reels look cylindrical, top/bottom rows darker */}
                    <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(to_bottom,rgba(0,0,0,0.65),transparent_22%,transparent_78%,rgba(0,0,0,0.65))]" />
                    {[0, 1, 2].map((r) =>
                      winningCells.has(`${r}-${c}`) && !spinning ? (
                        <motion.div
                          key={r}
                          className="absolute inset-x-1 rounded-lg border-2 border-gold-400 bg-gold-400/10"
                          style={{ top: `calc(${r * 33.333}% + 4px)`, height: "calc(33.333% - 8px)" }}
                          initial={{ scale: 0.6, opacity: 0 }}
                          animate={{ scale: [1, 1.06, 1], opacity: 1 }}
                          transition={{ scale: { duration: 0.8, repeat: Infinity }, opacity: { duration: 0.2 } }}
                        />
                      ) : null
                    )}
                  </div>
                );
              })}
              {!spinning && result && result.wins.length > 0 && (
                <svg viewBox="0 0 300 300" preserveAspectRatio="none" className="pointer-events-none absolute inset-0 h-full w-full">
                  {result.wins.map((w, k) => (
                    <motion.polyline
                      key={w.lineIndex}
                      points={w.cells.map(([r, c]) => `${CELL_CENTER[c]},${CELL_CENTER[r]}`).join(" ")}
                      fill="none"
                      stroke="#f6bf4b"
                      strokeWidth={5}
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      vectorEffect="non-scaling-stroke"
                      style={{ filter: "drop-shadow(0 0 6px rgba(246,191,75,0.9))" }}
                      initial={{ pathLength: 0, opacity: 0 }}
                      animate={{ pathLength: 1, opacity: [0, 1, 1, 0.7] }}
                      transition={{ duration: 0.5, delay: k * 0.35 }}
                    />
                  ))}
                </svg>
              )}
            </div>
            {/* payline arrows on the cabinet */}
            <div className="pointer-events-none absolute inset-y-3 -left-2 flex flex-col justify-around sm:inset-y-5">
              {[0, 1, 2].map((r) => (
                <span key={r} className="h-0 w-0 border-y-[6px] border-l-[8px] border-y-transparent border-l-gold-400/70" />
              ))}
            </div>
            <AnimatePresence>
              {!spinning && result && result.payout > 0 && (
                <motion.div
                  key={spinId}
                  initial={{ scale: 0.3, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ type: "spring", stiffness: 300, damping: 14, delay: 0.2 }}
                  className="pointer-events-none absolute inset-x-0 -bottom-4 mx-auto w-max rounded-full border border-gold-400 bg-ink-950 px-4 py-1 font-display text-sm font-bold text-gold-300 shadow-glow-gold"
                >
                  +{formatCredits(result.payout)}
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          <div className="mt-6 flex flex-wrap items-center justify-between gap-4">
            <BetInput value={bet} onChange={setBet} max={maxBet} min={Math.min(10, maxBet)} disabled={spinning || autoSpins > 0} />

            <div className="flex items-center gap-3">
              <div className="text-right">
                <p className="text-[11px] uppercase tracking-wide text-ice-200/50">Mise</p>
                <p className="font-display text-lg font-bold text-white">{formatCredits(bet)}</p>
              </div>
              <Button size="lg" onClick={runSpin} disabled={spinning || (autoSpins === 0 && credits < bet)} className="min-w-[140px]">
                {spinning ? "..." : autoSpins > 0 ? `Auto (${autoSpins})` : "Spin"}
              </Button>
              {autoSpins > 0 ? (
                <Button variant="secondary" size="lg" onClick={() => setAutoSpins(0)}>Stop</Button>
              ) : (
                <Button variant="secondary" size="lg" onClick={() => setAutoSpins(25)} disabled={spinning || credits < bet}>
                  Auto x25
                </Button>
              )}
            </div>
          </div>

          <div className="mt-4 flex flex-wrap items-center gap-4">
            <button
              onClick={() => setTurbo((t) => !t)}
              className={cn(
                "flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-semibold transition-colors",
                turbo ? "border-gold-400 bg-gold-500/10 text-gold-400" : "border-white/10 text-ice-200/50 hover:text-white"
              )}
            >
              ⚡ Turbo {turbo ? "activé" : "désactivé"}
            </button>
            <label className="flex items-center gap-1.5 text-xs text-ice-200/50">
              Stop si gain ≥
              <input
                type="number"
                value={stopOnWin}
                onChange={(e) => setStopOnWin(e.target.value)}
                placeholder="—"
                className="input w-20 py-1 text-xs"
                disabled={autoSpins > 0}
              />
            </label>
            <label className="flex items-center gap-1.5 text-xs text-ice-200/50">
              Stop si solde ≤
              <input
                type="number"
                value={stopOnLoss}
                onChange={(e) => setStopOnLoss(e.target.value)}
                placeholder="—"
                className="input w-20 py-1 text-xs"
                disabled={autoSpins > 0}
              />
            </label>
          </div>

          <button onClick={() => setShowPaytable(true)} className="mt-4 text-xs text-electric-400 hover:text-electric-300 underline underline-offset-2">
            Voir la table des gains
          </button>
        </Card>

        <div className="flex flex-col gap-4">
          <Card className="p-4">
            <h3 className="mb-3 font-display text-sm font-semibold text-white">Historique récent</h3>
            {slotHistory.length === 0 && <p className="text-xs text-ice-200/50">Aucune partie pour l'instant.</p>}
            <ul className="flex flex-col gap-2">
              {slotHistory.map((h) => (
                <li key={h.id} className="flex items-center justify-between text-xs">
                  <span className="text-ice-200/60">Mise {formatCredits(h.bet)}</span>
                  <span className={h.payout > 0 ? "font-semibold text-emerald-400" : "text-ice-200/40"}>
                    {h.payout > 0 ? `+${formatCredits(h.payout)}` : "—"}
                  </span>
                </li>
              ))}
            </ul>
          </Card>
        </div>
      </div>

      <Modal open={showPaytable} onClose={() => setShowPaytable(false)}>
        <h3 className="mb-4 font-display text-lg font-bold text-white">Table des gains — {machine.name}</h3>
        <ul className="flex flex-col gap-2">
          {machine.symbols.slice().reverse().map((s) => (
            <li key={s.id} className="flex items-center justify-between rounded-lg bg-white/[0.03] px-3 py-2 text-sm">
              <span className="text-xl">{s.glyph}</span>
              <span className="text-ice-200/60">3 symboles alignés</span>
              <span className="font-semibold text-gold-400">x{s.pay3}</span>
            </li>
          ))}
        </ul>
        <p className="mt-4 text-xs text-ice-200/50">{PAYLINES.length} lignes actives : 3 lignes horizontales + 2 diagonales. La mise est répartie également entre les lignes.</p>
      </Modal>

      <WinCelebration
        tier={celebration?.tier ?? "none"}
        payout={celebration?.payout ?? 0}
        onClose={() => setCelebration(null)}
      />
    </div>
  );
}
