import { useEffect, useMemo, useRef, useState } from "react";
import { motion } from "framer-motion";
import { useAuthStore } from "../store/authStore";
import { useCasinoStore } from "../store/casinoStore";
import { useGameStatusStore } from "../store/gameStatusStore";
import { useToastStore } from "../store/toastStore";
import { useDarktableStore, roundDurationMs, BETTING_WINDOW_MS } from "../store/darktableStore";
import { useDebtsStore } from "../store/debtsStore";
import { multiplierAt } from "../lib/crashEngine";
import { colorOf } from "../lib/rouletteEngine";
import { rouletteChoiceWins, diceChoiceWins, ROULETTE_PAYOUT, DICE_PAYOUT, type RouletteChoice, type DiceChoice, type DarktableGameType } from "../lib/darktableGames";
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

const GAME_LABEL: Record<DarktableGameType, string> = { crash: "Crash", roulette: "Roulette Partagée", dice: "Duel de Dés" };
const GAME_ICON: Record<DarktableGameType, string> = { crash: "🎰", roulette: "🎡", dice: "🎲" };

function choiceLabel(gameType: DarktableGameType, choice: string | null): string {
  if (!choice) return "—";
  if (gameType === "roulette") return choice === "rouge" ? "Rouge" : choice === "noir" ? "Noir" : "Vert";
  return choice === "sous" ? "Sous 50" : "Sur 50";
}

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
  const [choice, setChoice] = useState<string | null>(null);
  const [now, setNow] = useState(Date.now());
  const [spinDisplay, setSpinDisplay] = useState(0);
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

  useEffect(() => setChoice(null), [round?.id]);

  const gameType = round?.gameType ?? "crash";
  const resolvesAt = round ? round.startsAt + roundDurationMs(round) : 0;
  const phase: Phase = !round ? "waiting" : now < round.startsAt ? "betting" : now < resolvesAt ? "running" : "ended";
  const rate = !round || gameType !== "crash" ? 1 : phase === "running" ? multiplierAt(now - round.startsAt) : round.crashPoint ?? 1;
  const secondsLeft = round ? Math.max(0, Math.ceil((round.startsAt - now) / 1000)) : 0;

  // Cycling "wheel/dice" ticker while roulette/dice are resolving — pure visual flourish, freezes
  // on the real outcome the instant the phase flips to "ended".
  useEffect(() => {
    if (!round || phase !== "running" || gameType === "crash") return;
    const max = gameType === "roulette" ? 36 : 100;
    const id = setInterval(() => setSpinDisplay(Math.random() * max), 70);
    return () => clearInterval(id);
  }, [phase, round?.id, gameType]);

  const myBet = useMemo(() => bets.find((b) => b.userId === account?.id), [bets, account?.id]);

  // Resolves my own bet once the round ends: Crash losses were already implicitly final (no
  // cash-out in time); roulette/dice are resolved here against the shared outcome. A winning
  // roulette/dice bet self-writes its payout (same self-write model as Crash's cash-out); a losing
  // one is simply left null forever — recorded locally as a loss, same convention as Crash.
  useEffect(() => {
    if (phase !== "ended" || !round || !myBet || myBet.cashedOutMultiplier !== null) return;
    if (resolvedRoundRef.current === round.id) return;
    resolvedRoundRef.current = round.id;

    if (gameType !== "crash" && myBet.choice) {
      const won = gameType === "roulette"
        ? rouletteChoiceWins(myBet.choice as RouletteChoice, round.outcome ?? -1)
        : diceChoiceWins(myBet.choice as DiceChoice, round.outcome ?? -1);
      if (won) {
        const multiplier = gameType === "roulette" ? ROULETTE_PAYOUT[myBet.choice as RouletteChoice] : DICE_PAYOUT;
        const payout = Math.round(myBet.amount * multiplier);
        cashOutBet(myBet.id, multiplier, payout);
        award(payout);
        addXp(xpForPayout(payout));
        const tier = tierFromMultiplier(multiplier);
        recordRound({ game: "Darktable", label: `Table Clandestine — ${GAME_LABEL[gameType]}`, bet: myBet.amount, payout, tier });
        if (tier === "megaWin" || tier === "gigaWin" || tier === "maxWin") setCelebration({ tier, payout });
        else push({ kind: "success", title: `Gagné — +${formatCredits(payout)} crédits` });
        return;
      }
    }
    recordRound({ game: "Darktable", label: `Table Clandestine — ${GAME_LABEL[gameType]}`, bet: myBet.amount, payout: 0, tier: "none" });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, round?.id, myBet?.cashedOutMultiplier]);

  async function handleBet() {
    if (!account || !round || phase !== "betting" || myBet || credits < bet) {
      if (credits < bet) push({ kind: "info", title: "Crédits insuffisants" });
      return;
    }
    if (gameType !== "crash" && !choice) {
      push({ kind: "info", title: "Choisis d'abord ton camp" });
      return;
    }
    placeBet(bet);
    await storePlaceBet(account.id, account.username, account.avatar, bet, gameType === "crash" ? null : choice);
  }

  async function handleCashOut() {
    if (!myBet || phase !== "running" || gameType !== "crash" || cashingOut) return;
    setCashingOut(true);
    const payout = Math.round(myBet.amount * rate);
    await cashOutBet(myBet.id, rate, payout);
    award(payout);
    addXp(xpForPayout(payout));
    const tier = tierFromMultiplier(rate);
    recordRound({ game: "Darktable", label: "Table Clandestine — Crash", bet: myBet.amount, payout, tier });
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

  const busted = phase === "ended" && gameType === "crash";
  const spinNumber = Math.floor(phase === "ended" && round?.outcome != null ? round.outcome : spinDisplay);
  const rouletteColor = gameType === "roulette" ? colorOf(Math.min(36, spinNumber)) : null;

  return (
    <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6">
      <div className="mb-6 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <IconDice className="h-6 w-6 text-gold-400" />
          <div>
            <h1 className="font-display text-2xl font-bold text-white sm:text-3xl">Table Clandestine</h1>
            <p className="text-sm text-ice-200/60">Une seule table, tout le monde y joue en même temps — {GAME_LABEL[gameType]} cette manche.</p>
          </div>
        </div>
        <Badge tone="gold">{presence.length} à la table</Badge>
      </div>

      <div className="grid gap-4 lg:grid-cols-[1fr_280px]">
        <div className="flex flex-col gap-4">
          <NeonFrame>
            <Card className="p-4 sm:p-8" glow>
              <div className="mb-3 flex justify-center">
                <Badge tone="neutral">{GAME_ICON[gameType]} {GAME_LABEL[gameType]}</Badge>
              </div>
              <motion.div
                animate={busted ? { x: [0, -8, 8, -5, 5, 0] } : {}}
                transition={{ duration: 0.4 }}
                className={cn(
                  "relative flex h-56 flex-col items-center justify-center overflow-hidden rounded-2xl border",
                  busted ? "border-red-500/40 bg-red-950/20" :
                  gameType === "roulette" && phase === "ended" ? (rouletteColor === "red" ? "border-red-500/40 bg-red-950/20" : rouletteColor === "black" ? "border-white/20 bg-ink-950/60" : "border-emerald-500/40 bg-emerald-950/20") :
                  "border-white/10 bg-gradient-to-b from-ink-900/60 to-ink-950/60"
                )}
              >
                {gameType === "crash" && (
                  <>
                    <span className="text-4xl">{phase === "betting" ? "🃏" : phase === "running" ? "🎰" : phase === "ended" ? "💀" : "⏳"}</span>
                    <motion.p
                      animate={phase === "running" ? { scale: [1, 1.03, 1] } : {}}
                      transition={{ duration: 0.5, repeat: Infinity }}
                      className={cn("mt-2 font-display text-4xl font-bold sm:text-5xl", busted ? "text-red-400" : "text-white")}
                    >
                      {phase === "betting" ? `Mises ouvertes — ${secondsLeft}s` : `x${rate.toFixed(2)}`}
                    </motion.p>
                    {busted && <p className="mt-1 text-sm font-semibold text-red-400">CRASH</p>}
                  </>
                )}

                {gameType === "roulette" && (
                  <>
                    <motion.span
                      className="text-4xl"
                      animate={phase === "running" ? { rotate: 360 } : {}}
                      transition={phase === "running" ? { duration: 0.5, repeat: Infinity, ease: "linear" } : {}}
                    >
                      🎡
                    </motion.span>
                    <p className={cn(
                      "mt-2 font-display text-4xl font-bold sm:text-5xl",
                      phase === "ended" ? (rouletteColor === "red" ? "text-red-400" : rouletteColor === "black" ? "text-white" : "text-emerald-400") : "text-white"
                    )}>
                      {phase === "betting" ? `Mises ouvertes — ${secondsLeft}s` : String(spinNumber).padStart(2, "0")}
                    </p>
                    {phase === "ended" && (
                      <p className={cn("mt-1 text-sm font-semibold uppercase", rouletteColor === "red" ? "text-red-400" : rouletteColor === "black" ? "text-ice-200/70" : "text-emerald-400")}>
                        {rouletteColor === "red" ? "Rouge" : rouletteColor === "black" ? "Noir" : "Vert"}
                      </p>
                    )}
                  </>
                )}

                {gameType === "dice" && (
                  <>
                    <motion.span
                      className="text-4xl"
                      animate={phase === "running" ? { rotate: [0, -20, 20, -15, 15, 0] } : {}}
                      transition={phase === "running" ? { duration: 0.35, repeat: Infinity } : {}}
                    >
                      🎲
                    </motion.span>
                    <p className="mt-2 font-display text-4xl font-bold text-white sm:text-5xl">
                      {phase === "betting" ? `Mises ouvertes — ${secondsLeft}s` : (phase === "ended" ? (round?.outcome ?? 0) : spinDisplay).toFixed(2)}
                    </p>
                    {phase === "ended" && (
                      <p className="mt-1 text-sm font-semibold text-ice-200/60">{(round?.outcome ?? 0) < 50 ? "Sous 50" : "Sur 50"}</p>
                    )}
                  </>
                )}
              </motion.div>

              <div className="mt-6 flex flex-wrap items-center justify-between gap-4">
                {phase === "betting" && !myBet && gameType === "roulette" && (
                  <div className="flex w-full flex-wrap items-center gap-2">
                    {(["rouge", "noir", "vert"] as RouletteChoice[]).map((c) => (
                      <button
                        key={c}
                        onClick={() => setChoice(c)}
                        className={cn(
                          "rounded-xl border px-3 py-2 text-xs font-semibold capitalize transition-colors",
                          choice === c ? (c === "rouge" ? "border-red-400 bg-red-500/20 text-red-300" : c === "noir" ? "border-white/40 bg-white/10 text-white" : "border-emerald-400 bg-emerald-500/20 text-emerald-300") : "border-white/10 text-ice-200/50 hover:text-white"
                        )}
                      >
                        {c} · x{ROULETTE_PAYOUT[c]}
                      </button>
                    ))}
                  </div>
                )}
                {phase === "betting" && !myBet && gameType === "dice" && (
                  <div className="flex w-full flex-wrap items-center gap-2">
                    {(["sous", "sur"] as DiceChoice[]).map((c) => (
                      <button
                        key={c}
                        onClick={() => setChoice(c)}
                        className={cn(
                          "rounded-xl border px-3 py-2 text-xs font-semibold capitalize transition-colors",
                          choice === c ? "border-gold-400 bg-gold-500/20 text-gold-300" : "border-white/10 text-ice-200/50 hover:text-white"
                        )}
                      >
                        {c === "sous" ? "Sous 50" : "Sur 50"} · x{DICE_PAYOUT}
                      </button>
                    ))}
                  </div>
                )}
                {phase === "betting" && !myBet && (
                  <>
                    <BetInput value={bet} onChange={setBet} max={maxBet} min={Math.min(10, maxBet)} />
                    <Button size="lg" onClick={handleBet} disabled={credits < bet || (gameType !== "crash" && !choice)}>
                      Miser ({formatCredits(bet)})
                    </Button>
                  </>
                )}
                {phase === "betting" && myBet && (
                  <p className="text-sm text-ice-200/60">
                    Mise placée : {formatCredits(myBet.amount)}{myBet.choice ? ` sur ${choiceLabel(gameType, myBet.choice)}` : ""} — en attente du lancement.
                  </p>
                )}
                {phase === "running" && gameType === "crash" && myBet && myBet.cashedOutMultiplier === null && (
                  <div className="flex w-full items-center justify-between gap-4">
                    <p className="text-sm text-ice-200/60">Gain potentiel : {formatCredits(Math.round(myBet.amount * rate))}</p>
                    <Button variant="gold" size="lg" onClick={handleCashOut} disabled={cashingOut}>Extraire</Button>
                  </div>
                )}
                {phase === "running" && gameType !== "crash" && myBet && (
                  <p className="text-sm text-ice-200/60">Manche en cours — tu as misé sur {choiceLabel(gameType, myBet.choice)}.</p>
                )}
                {phase === "running" && (!myBet || (gameType === "crash" && myBet.cashedOutMultiplier !== null)) && (
                  <p className="text-sm text-ice-200/60">
                    {myBet && gameType === "crash" ? `Encaissé à x${myBet.cashedOutMultiplier?.toFixed(2)}.` : "Tu regardes la manche en spectateur — mise à la prochaine."}
                  </p>
                )}
                {phase === "ended" && myBet && (
                  <p className="text-sm text-ice-200/60">
                    {(myBet.payout ?? 0) > 0 ? <span className="font-semibold text-emerald-400">Gagné — +{formatCredits(myBet.payout ?? 0)}</span> : <span className="text-red-400">💀 Perdu</span>}
                    {" "}— la prochaine manche s'ouvre dans quelques secondes.
                  </p>
                )}
                {phase === "ended" && !myBet && (
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
                    <span className="text-ice-200/70">
                      {b.avatar} {b.username} — {formatCredits(b.amount)}
                      {b.choice && <span className="text-ice-200/40"> · {choiceLabel(gameType, b.choice)}</span>}
                    </span>
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
