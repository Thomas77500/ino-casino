import { useEffect, useMemo, useRef, useState } from "react";
import { motion } from "framer-motion";
import { useAuthStore } from "../store/authStore";
import { useCasinoStore } from "../store/casinoStore";
import { useGameStatusStore } from "../store/gameStatusStore";
import { useToastStore } from "../store/toastStore";
import { useDarktableStore, BETTING_WINDOW_MS } from "../store/darktableStore";
import { useDebtsStore } from "../store/debtsStore";
import { multiplierAt, timeForMultiplier } from "../lib/crashEngine";
import { xpForPayout } from "../lib/xp";
import { tierFromMultiplier, type WinTier } from "../lib/winTiers";
import { Card } from "../components/ui/Card";
import { Button } from "../components/ui/Button";
import { Badge } from "../components/ui/Badge";
import { BetInput } from "../components/ui/BetInput";
import { NeonFrame } from "../components/ui/NeonFrame";
import { RoomChat } from "../components/ui/RoomChat";
import { WinCelebration } from "../components/ui/WinCelebration";
import { IconDice } from "../components/icons";
import { maxBetFor } from "../lib/betting";
import { formatCredits, cn } from "../lib/format";

type Phase = "waiting" | "betting" | "running" | "ended";

export function Darktable() {
  const account = useAuthStore((s) => s.account);
  const credits = useCasinoStore((s) => s.credits);
  const level = useCasinoStore((s) => s.level);
  const placeBet = useCasinoStore((s) => s.placeBet);
  const award = useCasinoStore((s) => s.award);
  const addXp = useCasinoStore((s) => s.addXp);
  const recordRound = useCasinoStore((s) => s.recordRound);
  const push = useToastStore((s) => s.push);
  const winBias = useGameStatusStore((s) => s.statuses.darktable?.winBias ?? 1);

  const round = useDarktableStore((s) => s.round);
  const bets = useDarktableStore((s) => s.bets);
  const presence = useDarktableStore((s) => s.presence);
  const ensureRound = useDarktableStore((s) => s.ensureRound);
  const storePlaceBet = useDarktableStore((s) => s.placeBet);
  const cashOutBet = useDarktableStore((s) => s.cashOutBet);
  const subscribe = useDarktableStore((s) => s.subscribe);

  const debts = useDebtsStore((s) => s.debts);
  const fetchDebts = useDebtsStore((s) => s.fetchAll);
  const subscribeDebts = useDebtsStore((s) => s.subscribe);
  const lend = useDebtsStore((s) => s.lend);

  const maxBet = maxBetFor(credits, level);
  const [bet, setBet] = useState(Math.min(100, maxBet));
  const [now, setNow] = useState(Date.now());
  const [cashingOut, setCashingOut] = useState(false);
  const [lendTarget, setLendTarget] = useState<string | null>(null);
  const [lendAmount, setLendAmount] = useState("");
  const [celebration, setCelebration] = useState<{ tier: WinTier; payout: number } | null>(null);
  const resolvedRoundRef = useRef<string | null>(null);

  useEffect(() => {
    if (!account) return;
    ensureRound(winBias);
    fetchDebts(account.id);
    const unsubTable = subscribe(account.id, account.username, account.avatar);
    const unsubDebts = subscribeDebts(account.id);
    const interval = setInterval(() => ensureRound(winBias), 3000);
    return () => {
      unsubTable();
      unsubDebts();
      clearInterval(interval);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [account?.id]);

  useEffect(() => {
    let raf: number;
    function tick() {
      setNow(Date.now());
      raf = requestAnimationFrame(tick);
    }
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, []);

  const crashAt = round ? round.startsAt + timeForMultiplier(round.crashPoint) : 0;
  const phase: Phase = !round ? "waiting" : now < round.startsAt ? "betting" : now < crashAt ? "running" : "ended";
  const rate = !round ? 1 : phase === "betting" ? 1 : phase === "running" ? multiplierAt(now - round.startsAt) : round.crashPoint;
  const secondsLeft = round ? Math.max(0, Math.ceil((round.startsAt - now) / 1000)) : 0;

  const myBet = useMemo(() => bets.find((b) => b.userId === account?.id), [bets, account?.id]);

  // A round that crashed while I still had a live bet is a loss — record it once per round.
  useEffect(() => {
    if (phase !== "ended" || !round || !myBet || myBet.cashedOutMultiplier !== null) return;
    if (resolvedRoundRef.current === round.id) return;
    resolvedRoundRef.current = round.id;
    recordRound({ game: "Darktable", label: "Table Clandestine", bet: myBet.amount, payout: 0, tier: "none" });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, round?.id, myBet?.cashedOutMultiplier]);

  async function handleBet() {
    if (!account || !round || phase !== "betting" || myBet || credits < bet) {
      if (credits < bet) push({ kind: "info", title: "Crédits insuffisants" });
      return;
    }
    placeBet(bet);
    await storePlaceBet(account.id, account.username, account.avatar, bet);
  }

  async function handleCashOut() {
    if (!myBet || phase !== "running" || cashingOut) return;
    setCashingOut(true);
    const payout = Math.round(myBet.amount * rate);
    await cashOutBet(myBet.id, rate, payout);
    award(payout);
    addXp(xpForPayout(payout));
    const tier = tierFromMultiplier(rate);
    recordRound({ game: "Darktable", label: "Table Clandestine", bet: myBet.amount, payout, tier });
    if (tier === "megaWin" || tier === "gigaWin" || tier === "maxWin") {
      setCelebration({ tier, payout });
    } else {
      push({ kind: "success", title: `Encaissé à x${rate.toFixed(2)} — +${formatCredits(payout)} crédits` });
    }
    setCashingOut(false);
  }

  async function handleLend(borrowerId: string) {
    if (!account) return;
    const amount = Number(lendAmount);
    if (!amount || amount <= 0) return;
    const result = await lend(account.id, borrowerId, amount);
    push({ kind: result.ok ? "success" : "info", title: result.message });
    if (result.ok) {
      setLendTarget(null);
      setLendAmount("");
    }
  }

  const busted = phase === "ended";

  return (
    <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6">
      <div className="mb-6 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <IconDice className="h-6 w-6 text-gold-400" />
          <div>
            <h1 className="font-display text-2xl font-bold text-white sm:text-3xl">Table Clandestine</h1>
            <p className="text-sm text-ice-200/60">Une seule table, tout le monde y joue en même temps — extrais avant que ça tourne mal.</p>
          </div>
        </div>
        <Badge tone="gold">{presence.length} à la table</Badge>
      </div>

      <div className="grid gap-4 lg:grid-cols-[1fr_280px]">
        <div className="flex flex-col gap-4">
          <NeonFrame>
            <Card className="p-4 sm:p-8" glow>
              <motion.div
                animate={busted ? { x: [0, -8, 8, -5, 5, 0] } : {}}
                transition={{ duration: 0.4 }}
                className={cn(
                  "relative flex h-56 flex-col items-center justify-center overflow-hidden rounded-2xl border",
                  busted ? "border-red-500/40 bg-red-950/20" : "border-white/10 bg-gradient-to-b from-ink-900/60 to-ink-950/60"
                )}
              >
                <span className="text-4xl">{phase === "betting" ? "🃏" : phase === "running" ? "🎰" : phase === "ended" ? "💀" : "⏳"}</span>
                <motion.p
                  animate={phase === "running" ? { scale: [1, 1.03, 1] } : {}}
                  transition={{ duration: 0.5, repeat: Infinity }}
                  className={cn("mt-2 font-display text-4xl font-bold sm:text-5xl", busted ? "text-red-400" : "text-white")}
                >
                  {phase === "betting" ? `Mises ouvertes — ${secondsLeft}s` : `x${rate.toFixed(2)}`}
                </motion.p>
                {busted && <p className="mt-1 text-sm font-semibold text-red-400">CRASH</p>}
              </motion.div>

              <div className="mt-6 flex flex-wrap items-center justify-between gap-4">
                {phase === "betting" && !myBet && (
                  <>
                    <BetInput value={bet} onChange={setBet} max={maxBet} min={Math.min(10, maxBet)} />
                    <Button size="lg" onClick={handleBet} disabled={credits < bet}>
                      Miser ({formatCredits(bet)})
                    </Button>
                  </>
                )}
                {phase === "betting" && myBet && (
                  <p className="text-sm text-ice-200/60">Mise placée : {formatCredits(myBet.amount)} — en attente du lancement.</p>
                )}
                {phase === "running" && myBet && myBet.cashedOutMultiplier === null && (
                  <div className="flex w-full items-center justify-between gap-4">
                    <p className="text-sm text-ice-200/60">Gain potentiel : {formatCredits(Math.round(myBet.amount * rate))}</p>
                    <Button variant="gold" size="lg" onClick={handleCashOut} disabled={cashingOut}>Extraire</Button>
                  </div>
                )}
                {phase === "running" && (!myBet || myBet.cashedOutMultiplier !== null) && (
                  <p className="text-sm text-ice-200/60">
                    {myBet ? `Encaissé à x${myBet.cashedOutMultiplier?.toFixed(2)}.` : "Tu regardes la manche en spectateur — mise à la prochaine."}
                  </p>
                )}
                {phase === "ended" && (
                  <p className="text-sm text-ice-200/60">La manche est terminée — la suivante s'ouvre dans quelques secondes.</p>
                )}
              </div>
            </Card>
          </NeonFrame>

          <Card className="p-4">
            <h3 className="mb-3 font-display text-sm font-semibold text-white">Mises de la manche</h3>
            {bets.length === 0 ? (
              <p className="text-xs text-ice-200/40">Personne n'a encore misé.</p>
            ) : (
              <ul className="flex flex-col gap-2">
                {bets.map((b) => (
                  <li key={b.id} className="flex items-center justify-between text-xs">
                    <span className="text-ice-200/70">{b.avatar} {b.username} — {formatCredits(b.amount)}</span>
                    {b.cashedOutMultiplier !== null ? (
                      <span className="font-semibold text-emerald-400">x{b.cashedOutMultiplier.toFixed(2)} · +{formatCredits(b.payout ?? 0)}</span>
                    ) : phase === "ended" ? (
                      <span className="text-red-400">💀 perdu</span>
                    ) : (
                      <span className="text-ice-200/40">en jeu</span>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </Card>

          <RoomChat table="darktable_messages" title="Table Clandestine" />
        </div>

        <div className="flex flex-col gap-4">
          <Card className="p-4">
            <h3 className="mb-3 font-display text-sm font-semibold text-white">À la table</h3>
            {presence.length === 0 ? (
              <p className="text-xs text-ice-200/40">Table vide pour l'instant.</p>
            ) : (
              <ul className="flex flex-col gap-2">
                {presence.filter((p) => p.userId !== account?.id).map((p) => (
                  <li key={p.userId} className="rounded-lg border border-white/10 bg-white/[0.03] p-2">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-xs font-medium text-white">{p.avatar} {p.username}</span>
                      <Button size="sm" variant="ghost" className="text-[10px]" onClick={() => setLendTarget(lendTarget === p.userId ? null : p.userId)}>
                        Prêter
                      </Button>
                    </div>
                    {lendTarget === p.userId && (
                      <div className="mt-2 flex gap-1">
                        <input type="number" min={1} placeholder="Montant" value={lendAmount} onChange={(e) => setLendAmount(e.target.value)} className="input h-7 flex-1 px-2 text-xs" />
                        <Button size="sm" className="!px-2 !py-1 text-[10px]" onClick={() => handleLend(p.userId)}>OK</Button>
                      </div>
                    )}
                  </li>
                ))}
                {presence.filter((p) => p.userId !== account?.id).length === 0 && (
                  <p className="text-xs text-ice-200/40">Tu es seul·e à la table pour l'instant.</p>
                )}
              </ul>
            )}
          </Card>

          {debts.length > 0 && (
            <Card className="p-4">
              <h3 className="mb-3 font-display text-sm font-semibold text-white">Ardoises</h3>
              <ul className="flex flex-col gap-2">
                {debts.filter((d) => !d.settled).map((d) => (
                  <li key={d.id} className="text-xs text-ice-200/60">
                    {d.lenderId === account?.id
                      ? <span><span className="text-white">{d.borrowerUsername}</span> te doit {formatCredits(d.amount)}</span>
                      : <span>Tu dois {formatCredits(d.amount)} à <span className="text-white">{d.lenderUsername}</span></span>}
                  </li>
                ))}
                {debts.every((d) => d.settled) && <p className="text-xs text-ice-200/40">Toutes les ardoises sont soldées.</p>}
              </ul>
            </Card>
          )}
        </div>
      </div>

      <WinCelebration tier={celebration?.tier ?? "none"} payout={celebration?.payout ?? 0} onClose={() => setCelebration(null)} game="Table Clandestine" />
    </div>
  );
}
