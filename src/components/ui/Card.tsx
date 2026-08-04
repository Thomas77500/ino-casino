import { type HTMLAttributes } from "react";
import { cn } from "../../lib/format";

export function Card({ className, glow, ...props }: HTMLAttributes<HTMLDivElement> & { glow?: boolean }) {
  return (
    <div
      className={cn(
        "relative rounded-2xl border border-white/10 bg-white/[0.04] backdrop-blur-xl shadow-inner-glass",
        glow && "shadow-glow",
        className
      )}
      {...props}
    />
  );
}
