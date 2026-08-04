import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { cn } from "../../lib/format";

export interface WheelSegmentDisplay {
  label: string;
  highlight?: boolean;
}

export function BonusWheel({
  segments,
  resultIndex,
  spinTrigger,
  spinning,
  centerLabel = "Roue Bonus",
  ringClassName = "border-electric-500/30 shadow-glow",
  size = 260,
}: {
  segments: WheelSegmentDisplay[];
  resultIndex: number | null;
  spinTrigger: number;
  spinning: boolean;
  centerLabel?: string;
  ringClassName?: string;
  size?: number;
}) {
  const STEP = 360 / segments.length;
  const [rotation, setRotation] = useState(0);
  const hubInset = size * 0.12;
  const labelOffset = size * 0.092;
  const markerSize = Math.max(10, size * 0.06);

  useEffect(() => {
    if (resultIndex === null || spinTrigger === 0) return;
    // pointer sits at top (0deg); segment i is centered at i*STEP, so rotate wheel backwards to bring it under the pointer.
    const targetAngle = 360 - resultIndex * STEP;
    setRotation((prev) => {
      const current = ((prev % 360) + 360) % 360;
      const delta = (targetAngle - current + 360) % 360;
      return prev + 360 * 5 + delta;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [spinTrigger]);

  return (
    <div className="relative mx-auto" style={{ width: size, height: size }}>
      <div
        className="absolute left-1/2 z-10 -translate-x-1/2 rotate-45 bg-gold-400 shadow-glow-gold"
        style={{ top: -markerSize / 2, width: markerSize, height: markerSize }}
      />
      <motion.div
        className={cn("absolute inset-0 rounded-full border-4", ringClassName)}
        style={{
          background: `conic-gradient(${segments.map((seg, i) => `${i % 2 === 0 ? "#0f1c40" : "#1467e8"} ${i * STEP}deg ${(i + 1) * STEP}deg`).join(",")})`,
        }}
        animate={{ rotate: rotation }}
        transition={{ duration: 3.2, ease: [0.11, 0.8, 0.2, 1] }}
      >
        {segments.map((seg, i) => (
          <div
            key={i}
            className="absolute left-1/2 top-1/2 h-1/2 w-0 origin-top"
            style={{ transform: `rotate(${i * STEP + STEP / 2}deg)` }}
          >
            <span
              className={cn("absolute -translate-x-1/2 text-[11px] font-bold", seg.highlight ? "text-gold-400" : "text-white/90")}
              style={{ top: labelOffset }}
            >
              {seg.label}
            </span>
          </div>
        ))}
      </motion.div>
      <div
        className="absolute rounded-full border border-white/10 bg-ink-950/90"
        style={{ left: hubInset, top: hubInset, right: hubInset, bottom: hubInset }}
      >
        <div className="flex h-full w-full items-center justify-center">
          <span className="font-display text-xs font-semibold text-ice-200/60">{spinning ? "..." : centerLabel}</span>
        </div>
      </div>
    </div>
  );
}
