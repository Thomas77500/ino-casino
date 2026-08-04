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
import { spinGrid, evaluateSpin, symbolGlyph, PAYLINES, type SpinResult } from "../lib/slotsEngine";
import { SLOT_MACHINES, VOLATILITY_LABEL, type SlotMachineConfig } from "../lib/slotMachines";
import type { WinTier } from "../lib/winTiers";
import { playSound } from "../lib/sounds";

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

    const spinDurationMs = turbo ? 350 : 900;
    const finalGrid = spinGrid(machine.symbols, winBias);

    setTimeout(() => {
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
          <div className="relative mx-auto grid max-w-md grid-cols-3 gap-2 rounded-2xl border border-white/10 bg-ink-950/60 p-3 sm:gap-3 sm:p-5">
            {grid.map((row, r) =>
              row.map((symbolId, c) => {
                const key = `${r}-${c}`;
                const isWinning = winningCells.has(key) && !spinning;
                return (
                  <div
                    key={key}
                    className={cn(
                      "relative flex aspect-square items-center justify-center overflow-hidden rounded-xl border bg-gradient-to-b from-white/[0.06] to-transparent text-4xl sm:text-5xl",
                      isWinning ? "border-gold-400 shadow-glow-gold" : "border-white/10"
                    )}
                  >
                    <AnimatePresence mode="popLayout">
                      <motion.span
                        key={spinning ? `spin-${r}-${c}-${Date.now()}` : `${symbolId}-${r}-${c}`}
                        initial={{ y: spinning ? -60 : -20, opacity: 0 }}
                        animate={{
                          y: 0,
                          opacity: 1,
                          transition: spinning
                            ? { repeat: Infinity, duration: 0.12, ease: "linear" }
                            : { type: "spring", stiffness: 260, damping: 16, delay: c * 0.08 },
                        }}
                        className="select-none"
                      >
                        {spinning
                          ? symbolGlyph(machine.symbols[Math.floor(Math.random() * machine.symbols.length)].id, machine.symbols)
                          : symbolGlyph(symbolId, machine.symbols)}
                      </motion.span>
                    </AnimatePresence>
                    {isWinning && (
                      <motion.div
                        className="absolute inset-0 bg-gold-400/10"
                        animate={{ opacity: [0.2, 0.5, 0.2] }}
                        transition={{ duration: 1.2, repeat: Infinity }}
                      />
                    )}
                  </div>
                );
              })
            )}
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
