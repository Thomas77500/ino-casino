import { useEffect, useRef } from "react";
import { motion } from "framer-motion";
import type { Card } from "../../lib/blackjackEngine";
import { cn } from "../../lib/format";
import { playSound } from "../../lib/sounds";

const SIZE = "h-24 w-16 sm:h-32 sm:w-[5.5rem]";

// Dealt from the shoe (top-right of the felt): the card slides in face down, then turns over
// with a real 3D flip — the same flip reveals the dealer's hole card when `hidden` drops.
export function PlayingCard({ card, hidden, index = 0, placeholder }: { card: Card | null; hidden?: boolean; index?: number; placeholder?: boolean }) {
  const isRed = card && (card.suit === "♥" || card.suit === "♦");
  const faceDown = hidden || !card;
  const delay = index * 0.18;

  useEffect(() => {
    if (placeholder) return;
    const t = setTimeout(() => playSound("card"), delay * 1000);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const wasHidden = useRef(hidden);
  useEffect(() => {
    if (wasHidden.current && !hidden && !placeholder) playSound("card"); // hole card turned over
    wasHidden.current = hidden;
  }, [hidden, placeholder]);

  return (
    <motion.div
      initial={placeholder ? { opacity: 0 } : { opacity: 0, x: 320, y: -180, rotate: -35 }}
      animate={{ opacity: placeholder ? 0.35 : 1, x: 0, y: 0, rotate: 0 }}
      transition={{ type: "spring", stiffness: 140, damping: 20, delay }}
      className={cn("relative shrink-0", SIZE)}
      style={{ perspective: 900 }}
    >
      <motion.div
        className="absolute inset-0"
        style={{ transformStyle: "preserve-3d" }}
        initial={{ rotateY: 180 }}
        animate={{ rotateY: faceDown ? 180 : 0 }}
        transition={{ duration: 0.45, delay: faceDown ? 0 : delay + 0.25, ease: [0.4, 0, 0.2, 1] }}
      >
        <div
          className="absolute inset-0 rounded-lg border border-black/10 bg-gradient-to-b from-white to-ice-100 shadow-[0_6px_14px_rgba(0,0,0,0.45)]"
          style={{ backfaceVisibility: "hidden" }}
        >
          {card && (
            <div className={cn("relative h-full w-full", isRed ? "text-red-600" : "text-ink-950")}>
              <div className="absolute left-1 top-0.5 flex flex-col items-center leading-none sm:left-1.5 sm:top-1">
                <span className="font-display text-sm font-bold sm:text-lg">{card.rank}</span>
                <span className="text-xs sm:text-sm">{card.suit}</span>
              </div>
              <div className="absolute bottom-0.5 right-1 flex rotate-180 flex-col items-center leading-none sm:bottom-1 sm:right-1.5">
                <span className="font-display text-sm font-bold sm:text-lg">{card.rank}</span>
                <span className="text-xs sm:text-sm">{card.suit}</span>
              </div>
              <span className="absolute inset-0 grid place-items-center text-3xl sm:text-5xl">{card.suit}</span>
            </div>
          )}
        </div>
        <div
          className="absolute inset-0 rounded-lg border-2 border-white/90 bg-gradient-to-br from-red-800 to-red-950 p-1 shadow-[0_6px_14px_rgba(0,0,0,0.45)]"
          style={{ backfaceVisibility: "hidden", transform: "rotateY(180deg)" }}
        >
          <div className="h-full w-full rounded-md border border-gold-400/50 bg-[repeating-linear-gradient(45deg,rgba(246,191,75,0.18)_0px,rgba(246,191,75,0.18)_3px,transparent_3px,transparent_8px),repeating-linear-gradient(-45deg,rgba(246,191,75,0.18)_0px,rgba(246,191,75,0.18)_3px,transparent_3px,transparent_8px)]" />
        </div>
      </motion.div>
    </motion.div>
  );
}

// Physical chip stack on the felt — each chip drops in one after another.
export function ChipStack({ amount, tone = "gold", fromDealer }: { amount: number; tone?: "gold" | "emerald"; fromDealer?: boolean }) {
  const chips = Math.min(8, Math.max(1, Math.ceil(Math.log10(amount + 1) * 1.6)));
  const color = tone === "gold" ? "bg-gold-400 border-gold-200" : "bg-emerald-500 border-emerald-200";
  return (
    <div className="relative flex flex-col items-center">
      <div className="relative h-12 w-10">
        {Array.from({ length: chips }, (_, i) => (
          <motion.span
            key={i}
            initial={{ y: fromDealer ? -160 : 60, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ type: "spring", stiffness: 420, damping: 22, delay: i * 0.05 }}
            onAnimationStart={() => i === chips - 1 && playSound("chip")}
            className={cn("absolute left-0 h-3 w-10 rounded-[50%] border-2 border-dashed shadow-[0_2px_0_rgba(0,0,0,0.5)]", color)}
            style={{ bottom: i * 4 }}
          />
        ))}
      </div>
      <span className="mt-1 text-[10px] font-bold text-white">{amount.toLocaleString("fr-FR")}</span>
    </div>
  );
}
