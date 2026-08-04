import { motion } from "framer-motion";
import type { Card } from "../../lib/blackjackEngine";
import { cn } from "../../lib/format";

export function PlayingCard({ card, hidden, index = 0 }: { card: Card | null; hidden?: boolean; index?: number }) {
  const isRed = card && (card.suit === "♥" || card.suit === "♦");

  return (
    <motion.div
      initial={{ opacity: 0, y: -30, rotate: -8 }}
      animate={{ opacity: 1, y: 0, rotate: 0 }}
      transition={{ type: "spring", stiffness: 260, damping: 20, delay: index * 0.12 }}
      className={cn(
        "relative flex h-24 w-16 shrink-0 items-center justify-center rounded-lg border shadow-lg sm:h-32 sm:w-[5.5rem]",
        hidden
          ? "border-electric-400/30 bg-gradient-to-br from-electric-700 to-ink-800"
          : "border-white/20 bg-gradient-to-b from-white to-ice-100"
      )}
    >
      {hidden || !card ? (
        <div className="h-full w-full rounded-lg bg-[repeating-linear-gradient(45deg,rgba(95,184,255,0.15)_0px,rgba(95,184,255,0.15)_6px,transparent_6px,transparent_12px)]" />
      ) : (
        <div className={cn("flex flex-col items-center gap-0.5", isRed ? "text-red-600" : "text-ink-950")}>
          <span className="font-display text-lg font-bold sm:text-2xl">{card.rank}</span>
          <span className="text-xl sm:text-3xl">{card.suit}</span>
        </div>
      )}
    </motion.div>
  );
}
