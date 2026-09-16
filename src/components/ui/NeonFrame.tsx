import { motion } from "framer-motion";
import type { ReactNode } from "react";
import { cn } from "../../lib/format";

const DOTS_PER_SIDE = 10;

// Vegas-style chasing marquee lights around whatever's inside — same visual idea as the border on
// WinCelebration's big-win card, reused here as an always-on ambient frame instead of a one-off
// celebration, for pages that want to feel like a flashy casino floor rather than a quiet menu.
export function NeonFrame({ children, className }: { children: ReactNode; className?: string }) {
  const total = DOTS_PER_SIDE * 4;
  const dots = Array.from({ length: DOTS_PER_SIDE }, (_, i) => i);
  return (
    <div className={cn("relative", className)}>
      <div className="pointer-events-none absolute -inset-2 z-10">
        <div className="absolute inset-x-1 top-0 flex justify-between">
          {dots.map((i) => <Dot key={`t${i}`} index={i} total={total} />)}
        </div>
        <div className="absolute inset-x-1 bottom-0 flex justify-between">
          {dots.map((i) => <Dot key={`b${i}`} index={i + DOTS_PER_SIDE} total={total} />)}
        </div>
        <div className="absolute inset-y-1 left-0 flex flex-col justify-between">
          {dots.map((i) => <Dot key={`l${i}`} index={i + DOTS_PER_SIDE * 2} total={total} />)}
        </div>
        <div className="absolute inset-y-1 right-0 flex flex-col justify-between">
          {dots.map((i) => <Dot key={`r${i}`} index={i + DOTS_PER_SIDE * 3} total={total} />)}
        </div>
      </div>
      {children}
    </div>
  );
}

function Dot({ index, total }: { index: number; total: number }) {
  return (
    <motion.span
      className="h-1.5 w-1.5 rounded-full bg-gold-400 shadow-[0_0_6px_2px_rgba(246,191,75,0.8)]"
      animate={{ opacity: [0.2, 1, 0.2] }}
      transition={{ duration: 1.2, repeat: Infinity, delay: (index / total) * 1.2, ease: "easeInOut" }}
    />
  );
}
