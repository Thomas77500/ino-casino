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
import { IconTicketBet } from "../components/icons";
import { formatCredits, cn } from "../lib/format";
import { maxBetFor } from "../lib/betting";
import { xpForPayout } from "../lib/xp";
import {
  HORSES, raceWinner, type Horse,
  LOTO_POOL_SIZE, LOTO_PICK_COUNT, LOTO_TICKET_PRICE, drawLoto, type LotoResult,
  EURO_MAIN_POOL, EURO_MAIN_COUNT, EURO_STAR_POOL, EURO_STAR_COUNT, EURO_TICKET_PRICE, drawEuromillions, type EuroResult,
} from "../lib/pmuEngine";
import { tierFromMultiplier, type WinTier } from "../lib/winTiers";

type View = "chevaux" | "loto" | "euromillions";

function useResolveRound() {
  const award = useCasinoStore((s) => s.award);
  const addXp = useCasinoStore((s) => s.addXp);
  const recordRound = useCasinoStore((s) => s.recordRound);
  const push = useToastStore((s) => s.push);

  return function resolve(label: string, bet: number, payout: number, onCelebrate: (tier: WinTier, payout: number) => void) {
    if (payout > 0) {
      award(payout);
      addXp(xpForPayout(payout));
    }
    const tier = tierFromMultiplier(payout / bet);
    recordRound({ game: "Pmu", label, bet, payout, tier });
    if (tier === "megaWin" || tier === "gigaWin" || tier === "maxWin") {
      onCelebrate(tier, payout);
    } else if (payout > bet) {
      push({ kind: "success", title: `+${formatCredits(payout)} crédits` });
    } else {
      push({ kind: "info", title: payout > 0 ? `+${formatCredits(payout)} crédits` : "Pas de gain cette fois" });
    }
  };
}

function NumberGrid({ pool, picks, onToggle, max, label }: { pool: number; picks: number[]; onToggle: (n: number) => void; max: number; label: string }) {
  return (
    <div>
      <p className="mb-2 text-xs text-ice-200/50">{label} — {picks.length}/{max}</p>
      <div className="flex flex-wrap gap-1.5">
        {Array.from({ length: pool }, (_, i) => i + 1).map((n) => {
          const active = picks.includes(n);
          return (
            <button
              key={n}
              onClick={() => onToggle(n)}
              disabled={!active && picks.length >= max}
              className={cn(
                "grid h-8 w-8 place-items-center rounded-lg text-xs font-semibold transition-colors disabled:opacity-30",
                active ? "bg-electric-500 text-white shadow-glow" : "bg-white/[0.04] text-ice-200/60 hover:text-white"
              )}
            >
              {n}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function quickPick(pool: number, count: number): number[] {
  const all = Array.from({ length: pool }, (_, i) => i + 1);
  const picked: number[] = [];
  while (picked.length < count) picked.push(all.splice(Math.floor(Math.random() * all.length), 1)[0]);
  return picked.sort((a, b) => a - b);
}

export function Pmu() {
  const [view, setView] = useState<View>("chevaux");
  const [celebration, setCelebration] = useState<{ tier: WinTier; payout: number } | null>(null);

  return (
    <div className="mx-auto max-w-4xl px-4 py-8 sm:px-6">
      <div className="mb-6 flex items-center justify-between gap-4">
        <div className="flex items-center gap-2">
          <IconTicketBet className="h-6 w-6 text-gold-400" />
          <div>
            <h1 className="font-display text-2xl font-bold text-white sm:text-3xl">Bar PMU</h1>
            <p className="text-sm text-ice-200/60">Courses de chevaux, Loto et Euromillions fictifs.</p>
          </div>
        </div>
        <div className="flex items-center gap-1 rounded-xl border border-white/10 bg-white/[0.03] p-1">
          {(["chevaux", "loto", "euromillions"] as View[]).map((v) => (
            <button key={v} onClick={() => setView(v)} className={cn("rounded-lg px-3 py-1.5 text-xs font-semibold capitalize", view === v ? "bg-electric-500 text-white" : "text-ice-200/60")}>
              {v === "chevaux" ? "Chevaux" : v === "loto" ? "Loto" : "Euromillions"}
            </button>
          ))}
        </div>
      </div>

      {view === "chevaux" && <Chevaux onCelebrate={(tier, payout) => setCelebration({ tier, payout })} />}
      {view === "loto" && <Loto onCelebrate={(tier, payout) => setCelebration({ tier, payout })} />}
      {view === "euromillions" && <Euromillions onCelebrate={(tier, payout) => setCelebration({ tier, payout })} />}

      <WinCelebration tier={celebration?.tier ?? "none"} payout={celebration?.payout ?? 0} onClose={() => setCelebration(null)} />
    </div>
  );
}

function Chevaux({ onCelebrate }: { onCelebrate: (tier: WinTier, payout: number) => void }) {
  const credits = useCasinoStore((s) => s.credits);
  const level = useCasinoStore((s) => s.level);
  const placeBet = useCasinoStore((s) => s.placeBet);
  const winBias = useGameStatusStore((s) => s.statuses.pmu?.winBias ?? 1);
  const resolve = useResolveRound();
  const maxBet = maxBetFor(credits, level);

  const [selected, setSelected] = useState<Horse | null>(null);
  const [bet, setBet] = useState(Math.min(50, maxBet));
  const [racing, setRacing] = useState(false);
  const [winner, setWinner] = useState<Horse | null>(null);
  const [positions, setPositions] = useState<Record<string, number>>({});

  function race() {
    if (!selected || racing || credits < bet) return;
    placeBet(bet);
    setWinner(null);
    setRacing(true);

    const theWinner = raceWinner(winBias);
    const finalPositions: Record<string, number> = {};
    HORSES.forEach((h) => {
      finalPositions[h.id] = h.id === theWinner.id ? 92 : 55 + Math.random() * 30;
    });
    setPositions({});
    requestAnimationFrame(() => setPositions(finalPositions));

    setTimeout(() => {
      setRacing(false);
      setWinner(theWinner);
      const won = theWinner.id === selected.id;
      const payout = won ? Math.round(bet * theWinner.odds) : 0;
      resolve(`Chevaux — ${selected.name}`, bet, payout, onCelebrate);
    }, 2600);
  }

  return (
    <Card className="p-4 sm:p-6" glow>
      <div className="relative mb-6 overflow-hidden rounded-2xl border border-white/10 bg-ink-950/60 p-4">
        <div className="pointer-events-none absolute inset-y-0 right-6 w-0.5 bg-gold-400" />
        <div className="flex flex-col gap-3">
          {HORSES.map((h) => (
            <div key={h.id} className="relative h-8">
              <motion.span
                className="absolute text-2xl"
                style={{ left: `${positions[h.id] ?? 0}%` }}
                animate={{ left: `${positions[h.id] ?? 0}%` }}
                transition={{ duration: 2.4, ease: "easeOut" }}
              >
                {h.glyph}
              </motion.span>
            </div>
          ))}
        </div>
      </div>

      {winner && !racing && (
        <div className="mb-4 rounded-xl border border-gold-400/40 bg-gold-500/10 p-3 text-center">
          <p className="text-sm font-semibold text-gold-400">🏆 {winner.name} remporte la course !</p>
        </div>
      )}

      <div className="mb-4 grid grid-cols-2 gap-2 sm:grid-cols-3">
        {HORSES.map((h) => (
          <button
            key={h.id}
            onClick={() => !racing && setSelected(h)}
            disabled={racing}
            className={cn(
              "flex flex-col items-center gap-1 rounded-xl border p-3 transition-colors disabled:opacity-40",
              selected?.id === h.id ? "border-electric-400 bg-electric-500/10" : "border-white/10 hover:border-white/20"
            )}
          >
            <span className="text-2xl">{h.glyph}</span>
            <span className="text-xs font-semibold text-white">{h.name}</span>
            <span className="text-[11px] text-gold-400">cote {h.odds}</span>
          </button>
        ))}
      </div>

      <div className="flex flex-wrap items-center justify-between gap-4">
        <BetInput value={bet} onChange={setBet} max={maxBet} min={Math.min(10, maxBet)} disabled={racing} />
        <Button size="lg" onClick={race} disabled={racing || !selected || credits < bet}>
          {racing ? "Course en cours..." : "Parier"}
        </Button>
      </div>
    </Card>
  );
}

function Loto({ onCelebrate }: { onCelebrate: (tier: WinTier, payout: number) => void }) {
  const credits = useCasinoStore((s) => s.credits);
  const winBias = useGameStatusStore((s) => s.statuses.pmu?.winBias ?? 1);
  const placeBet = useCasinoStore((s) => s.placeBet);
  const resolve = useResolveRound();

  const [picks, setPicks] = useState<number[]>([]);
  const [result, setResult] = useState<LotoResult | null>(null);
  const [playing, setPlaying] = useState(false);

  function toggle(n: number) {
    setPicks((p) => (p.includes(n) ? p.filter((x) => x !== n) : p.length < LOTO_PICK_COUNT ? [...p, n] : p));
  }

  function play() {
    if (picks.length !== LOTO_PICK_COUNT || credits < LOTO_TICKET_PRICE || playing) return;
    placeBet(LOTO_TICKET_PRICE);
    setPlaying(true);
    setResult(null);
    setTimeout(() => {
      const r = drawLoto(picks, winBias);
      setResult(r);
      setPlaying(false);
      const payout = Math.round(LOTO_TICKET_PRICE * r.multiplier);
      resolve(`Loto — ${r.matches}/5`, LOTO_TICKET_PRICE, payout, onCelebrate);
      setPicks([]);
    }, 1400);
  }

  return (
    <Card className="p-4 sm:p-6" glow>
      <div className="mb-4 flex items-center justify-between">
        <p className="text-sm text-ice-200/60">Ticket — {formatCredits(LOTO_TICKET_PRICE)} crédits</p>
        <Button size="sm" variant="ghost" onClick={() => setPicks(quickPick(LOTO_POOL_SIZE, LOTO_PICK_COUNT))} disabled={playing}>
          Grille au hasard
        </Button>
      </div>

      <NumberGrid pool={LOTO_POOL_SIZE} picks={picks} onToggle={toggle} max={LOTO_PICK_COUNT} label="Tes numéros" />

      {result && !playing && (
        <div className="mt-4 rounded-xl border border-white/10 bg-white/[0.03] p-4">
          <p className="mb-2 text-xs text-ice-200/50">Tirage :</p>
          <div className="flex flex-wrap gap-1.5">
            {result.draw.map((n) => (
              <span key={n} className={cn("grid h-8 w-8 place-items-center rounded-lg text-xs font-bold", picks.includes(n) ? "bg-gold-400 text-ink-950" : "bg-white/10 text-white")}>
                {n}
              </span>
            ))}
          </div>
          <p className="mt-3 text-sm font-semibold text-white">{result.matches} bon{result.matches > 1 ? "s" : ""} numéro{result.matches > 1 ? "s" : ""}{result.multiplier > 0 ? ` — x${result.multiplier}` : ""}</p>
        </div>
      )}

      <div className="mt-6 flex justify-center">
        <Button size="lg" onClick={play} disabled={playing || picks.length !== LOTO_PICK_COUNT || credits < LOTO_TICKET_PRICE}>
          {playing ? "Tirage..." : "Jouer"}
        </Button>
      </div>
    </Card>
  );
}

function Euromillions({ onCelebrate }: { onCelebrate: (tier: WinTier, payout: number) => void }) {
  const credits = useCasinoStore((s) => s.credits);
  const winBias = useGameStatusStore((s) => s.statuses.pmu?.winBias ?? 1);
  const placeBet = useCasinoStore((s) => s.placeBet);
  const resolve = useResolveRound();

  const [mains, setMains] = useState<number[]>([]);
  const [stars, setStars] = useState<number[]>([]);
  const [result, setResult] = useState<EuroResult | null>(null);
  const [playing, setPlaying] = useState(false);

  const ready = mains.length === EURO_MAIN_COUNT && stars.length === EURO_STAR_COUNT;

  function toggleMain(n: number) {
    setMains((p) => (p.includes(n) ? p.filter((x) => x !== n) : p.length < EURO_MAIN_COUNT ? [...p, n] : p));
  }
  function toggleStar(n: number) {
    setStars((p) => (p.includes(n) ? p.filter((x) => x !== n) : p.length < EURO_STAR_COUNT ? [...p, n] : p));
  }

  function play() {
    if (!ready || credits < EURO_TICKET_PRICE || playing) return;
    placeBet(EURO_TICKET_PRICE);
    setPlaying(true);
    setResult(null);
    setTimeout(() => {
      const r = drawEuromillions(mains, stars, winBias);
      setResult(r);
      setPlaying(false);
      const payout = Math.round(EURO_TICKET_PRICE * r.multiplier);
      resolve(`Euromillions — ${r.mainMatches}+${r.starMatches}`, EURO_TICKET_PRICE, payout, onCelebrate);
      setMains([]);
      setStars([]);
    }, 1400);
  }

  return (
    <Card className="p-4 sm:p-6" glow>
      <div className="mb-4 flex items-center justify-between">
        <p className="text-sm text-ice-200/60">Ticket — {formatCredits(EURO_TICKET_PRICE)} crédits</p>
        <Button
          size="sm"
          variant="ghost"
          onClick={() => {
            setMains(quickPick(EURO_MAIN_POOL, EURO_MAIN_COUNT));
            setStars(quickPick(EURO_STAR_POOL, EURO_STAR_COUNT));
          }}
          disabled={playing}
        >
          Grille au hasard
        </Button>
      </div>

      <div className="flex flex-col gap-4">
        <NumberGrid pool={EURO_MAIN_POOL} picks={mains} onToggle={toggleMain} max={EURO_MAIN_COUNT} label="Numéros" />
        <NumberGrid pool={EURO_STAR_POOL} picks={stars} onToggle={toggleStar} max={EURO_STAR_COUNT} label="Étoiles" />
      </div>

      {result && !playing && (
        <div className="mt-4 rounded-xl border border-white/10 bg-white/[0.03] p-4">
          <p className="mb-2 text-xs text-ice-200/50">Tirage :</p>
          <div className="flex flex-wrap items-center gap-1.5">
            {result.drawMain.map((n) => (
              <span key={`m${n}`} className={cn("grid h-8 w-8 place-items-center rounded-lg text-xs font-bold", mains.includes(n) ? "bg-gold-400 text-ink-950" : "bg-white/10 text-white")}>
                {n}
              </span>
            ))}
            <span className="mx-1 text-ice-200/30">+</span>
            {result.drawStars.map((n) => (
              <span key={`s${n}`} className={cn("grid h-8 w-8 place-items-center rounded-full text-xs font-bold", stars.includes(n) ? "bg-electric-400 text-ink-950" : "bg-white/10 text-white")}>
                {n}
              </span>
            ))}
          </div>
          <p className="mt-3 text-sm font-semibold text-white">
            {result.mainMatches} numéro{result.mainMatches > 1 ? "s" : ""} + {result.starMatches} étoile{result.starMatches > 1 ? "s" : ""}
            {result.multiplier > 0 ? ` — x${result.multiplier}` : ""}
          </p>
        </div>
      )}

      <div className="mt-6 flex justify-center">
        <Button size="lg" onClick={play} disabled={playing || !ready || credits < EURO_TICKET_PRICE}>
          {playing ? "Tirage..." : "Jouer"}
        </Button>
      </div>
    </Card>
  );
}
