import { type HTMLAttributes } from "react";
import { cn } from "../../lib/format";

export function Card({ className, glow, ...props }: HTMLAttributes<HTMLDivElement> & { glow?: boolean }) {
  return (
    <div
      className={cn(
        "glass relative rounded-2xl border border-white/10 bg-gradient-to-b from-white/[0.06] to-white/[0.025] backdrop-blur-xl shadow-inner-glass",
        glow && "shadow-glow",
        className
      )}
      {...props}
    />
  );
}
