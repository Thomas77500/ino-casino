import { useRef, useState } from "react";
import { motion } from "framer-motion";
import { useCasinoStore } from "../store/casinoStore";
import { useToastStore } from "../store/toastStore";
import { useGameStatusStore } from "../store/gameStatusStore";
import { Card } from "../components/ui/Card";
import { Button } from "../components/ui/Button";
import { Badge } from "../components/ui/Badge";
import { WinCelebration } from "../components/ui/WinCelebration";
import { IconCrate } from "../components/icons";
import { formatCredits, cn } from "../lib/format";
import { xpForPayout } from "../lib/xp";
import { CASES, RARITY_LABEL, RARITY_STYLE, drawItem, randomDecoyItem, type DrawnItem, type CaseDef } from "../lib/caseEngine";
import { tierFromMultiplier, type WinTier } from "../lib/winTiers";

const ITEM_WIDTH = 128; // px (w-32) — fixed regardless of screen width, the strip scrolls inside an overflow-hidden viewport
const ITEM_GAP = 8; // px, matches the track's `gap-2`
const TRACK_PAD = 8; // px, matches the track's `px-2` leading padding
const ITEM_STEP = ITEM_WIDTH + ITEM_GAP; // real distance between two cards' left edges
const REEL_LENGTH = 60;
const WINNING_INDEX = 50;
const SPIN_DURATION = 5.5;

function ItemCard({ item, size = "lg" }: { item: DrawnItem; size?: "lg" | "sm" }) {
  const style = RARITY_STYLE[item.rarity];
  const sm = size === "sm";
  return (
    <div
      className={cn(
        "flex shrink-0 flex-col items-center justify-between rounded-xl border-2 p-2 text-center",
        style.border,
        style.bg,
        style.glow && "shadow-glow-gold",
        sm ? "h-28 w-28" : "h-32 w-32"
      )}
    >
      <span className={sm ? "text-3xl" : "text-4xl"}>{item.glyph}</span>
      <div>
        <p className={cn("truncate font-semibold leading-tight", style.text, sm ? "text-[10px]" : "text-xs")}>{item.name}</p>
        <p className="text-[10px] text-ice-200/40">{formatCredits(item.value)}</p>
      </div>
    </div>
  );
}

export function Cases() {
  const credits = useCasinoStore((s) => s.credits);
  const placeBet = useCasinoStore((s) => s.placeBet);
  const award = useCasinoStore((s) => s.award);
  const addXp = useCasinoStore((s) => s.addXp);
  const recordRound = useCasinoStore((s) => s.recordRound);
  const history = useCasinoStore((s) => s.history);
  const push = useToastStore((s) => s.push);
  const winBias = useGameStatusStore((s) => s.statuses.cases?.winBias ?? 1);

  const [activeCase, setActiveCase] = useState<CaseDef>(CASES[0]);
  const [reel, setReel] = useState<DrawnItem[]>(() => Array.from({ length: 10 }, () => randomDecoyItem(CASES[0].price)));
  const [spinning, setSpinning] = useState(false);
  const [offset, setOffset] = useState(0);
  const [won, setWon] = useState<DrawnItem | null>(null);
  const [celebration, setCelebration] = useState<{ tier: WinTier; payout: number } | null>(null);
  const trackRef = useRef<HTMLDivElement>(null);

  const casesHistory = history.filter((h) => h.game === "Cases").slice(0, 8);

  function open() {
    if (spinning || credits < activeCase.price) {
      if (credits < activeCase.price) push({ kind: "info", title: "Crédits insuffisants" });
      return;
    }
    placeBet(activeCase.price);
    setWon(null);
    setCelebration(null);

    const winner = drawItem(activeCase.price, winBias);
    const strip = Array.from({ length: REEL_LENGTH }, (_, i) => (i === WINNING_INDEX ? winner : randomDecoyItem(activeCase.price)));
    setReel(strip);

    const containerWidth = trackRef.current?.parentElement?.getBoundingClientRect().width ?? 320;
    const jitter = (Math.random() - 0.5) * (ITEM_WIDTH * 0.6); // land slightly off-center, more organic
    const target = -(TRACK_PAD + WINNING_INDEX * ITEM_STEP + ITEM_WIDTH / 2 - containerWidth / 2) + jitter;
    setOffset(0);
    requestAnimationFrame(() => setOffset(target));
    setSpinning(true);

    setTimeout(() => finalize(winner), SPIN_DURATION * 1000);
  }

  function finalize(item: DrawnItem) {
    setSpinning(false);
    setWon(item);
    if (item.value > 0) {
      award(item.value);
      addXp(xpForPayout(item.value));
    }
    const tier = tierFromMultiplier(item.value / activeCase.price);
    recordRound({ game: "Cases", label: `${activeCase.name} — ${item.name}`, bet: activeCase.price, payout: item.value, tier });
    if (tier === "megaWin" || tier === "gigaWin" || tier === "maxWin") {
      setCelebration({ tier, payout: item.value });
    } else if (item.value > activeCase.price) {
      push({ kind: "success", title: `+${formatCredits(item.value)} crédits` });
    } else {
      push({ kind: "info", title: `+${formatCredits(item.value)} crédits` });
    }
  }

  return (
    <div className="mx-auto max-w-4xl px-4 py-8 sm:px-6">
      <div className="mb-6 flex items-center justify-between gap-4">
        <div className="flex items-center gap-2">
          <IconCrate className="h-6 w-6 text-gold-400" />
          <div>
            <h1 className="font-display text-2xl font-bold text-white sm:text-3xl">Ouverture de caisses</h1>
            <p className="text-sm text-ice-200/60">Ouvre une caisse, l'objet tiré est automatiquement échangé contre des crédits.</p>
          </div>
        </div>
        <Badge tone="gold">Crédits virtuels uniquement</Badge>
      </div>

      <div className="mb-4 flex flex-wrap gap-2">
        {CASES.map((c) => (
          <button
            key={c.id}
            onClick={() => !spinning && setActiveCase(c)}
            disabled={spinning}
            className={cn(
              "flex items-center gap-2 rounded-xl border px-3 py-2 text-sm font-semibold transition-colors disabled:opacity-40",
              activeCase.id === c.id ? "border-electric-400 bg-electric-500/10 text-white" : "border-white/10 text-ice-200/60 hover:text-white"
            )}
          >
            <span className={cn("grid h-7 w-7 place-items-center rounded-lg bg-gradient-to-br text-sm", c.accent)}>📦</span>
            {c.name}
            <span className="text-ice-200/40">{formatCredits(c.price)}</span>
          </button>
        ))}
      </div>

      <Card className="p-4 sm:p-6" glow>
        <div className="relative mx-auto w-full max-w-2xl overflow-hidden rounded-2xl border border-white/10 bg-ink-950/60 py-4">
          <div className="pointer-events-none absolute inset-y-0 left-1/2 z-10 w-0.5 -translate-x-1/2 bg-gold-400 shadow-glow-gold" />
          <div ref={trackRef} className="flex gap-2 px-2" style={{ transform: `translateX(${offset}px)`, transition: spinning ? `transform ${SPIN_DURATION}s cubic-bezier(0.15, 0.85, 0.2, 1)` : "none" }}>
            {reel.map((item, i) => (
              <ItemCard key={i} item={item} />
            ))}
          </div>
        </div>

        {won && !spinning && (
          <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} className="mt-4 flex items-center justify-between gap-3 rounded-xl border border-white/10 bg-white/[0.03] p-3">
            <div className="flex items-center gap-3">
              <span className="text-2xl">{won.glyph}</span>
              <div>
                <p className={cn("text-sm font-semibold", RARITY_STYLE[won.rarity].text)}>{won.name}</p>
                <p className="text-xs text-ice-200/40">{RARITY_LABEL[won.rarity]}</p>
              </div>
            </div>
            <span className="font-display text-lg font-bold text-gold-400">+{formatCredits(won.value)}</span>
          </motion.div>
        )}

        <div className="mt-6 flex items-center justify-center">
          <Button size="lg" onClick={open} disabled={spinning || credits < activeCase.price}>
            {spinning ? "Ouverture..." : `Ouvrir ${activeCase.name} — ${formatCredits(activeCase.price)}`}
          </Button>
        </div>
      </Card>

      {casesHistory.length > 0 && (
        <Card className="mt-6 p-4">
          <h3 className="mb-3 font-display text-sm font-semibold text-white">Historique récent</h3>
          <ul className="flex flex-col gap-2">
            {casesHistory.map((h) => (
              <li key={h.id} className="flex items-center justify-between text-xs">
                <span className="text-ice-200/60">{h.label}</span>
                <span className={h.payout > h.bet ? "font-semibold text-emerald-400" : "text-ice-200/40"}>+{formatCredits(h.payout)}</span>
              </li>
            ))}
          </ul>
        </Card>
      )}

      <WinCelebration tier={celebration?.tier ?? "none"} payout={celebration?.payout ?? 0} onClose={() => setCelebration(null)} />
    </div>
  );
}
