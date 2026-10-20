import { useEffect, useRef, useState } from "react";
import { animate, motion, useMotionValue } from "framer-motion";
import { cn } from "../../lib/format";
import { playSound } from "../../lib/sounds";

export interface WheelSegmentDisplay {
  label: string;
  highlight?: boolean;
}

const V = 300;
const C = V / 2;
const R_OUT = 138;
const R_IN = 34;
const SEG_COLORS = ["#1467e8", "#0f1c40", "#2e8fff", "#0b1530"];

function pt(deg: number, r: number): [number, number] {
  const a = (deg * Math.PI) / 180;
  return [C + r * Math.sin(a), C - r * Math.cos(a)];
}

// Segment i is a wedge CENTRED on i*STEP (0° = under the pointer), so rotating the wheel by
// -i*STEP lands exactly mid-segment — the old conic version drew segments offset by half a step.
function wedge(center: number, step: number): string {
  const [x0, y0] = pt(center - step / 2, R_OUT);
  const [x1, y1] = pt(center + step / 2, R_OUT);
  const large = step > 180 ? 1 : 0;
  return `M${C},${C} L${x0},${y0} A${R_OUT},${R_OUT} 0 ${large} 1 ${x1},${y1} Z`;
}

export function BonusWheel({
  segments,
  resultIndex,
  spinTrigger,
  spinning,
  centerLabel = "Roue Bonus",
  ringClassName,
  size = 260,
  durationMs = 3200,
}: {
  segments: WheelSegmentDisplay[];
  resultIndex: number | null;
  spinTrigger: number;
  spinning: boolean;
  centerLabel?: string;
  ringClassName?: string;
  size?: number;
  durationMs?: number;
}) {
  const STEP = 360 / segments.length;
  const rotation = useMotionValue(0);
  const [kick, setKick] = useState(0);
  const [landed, setLanded] = useState<number | null>(null);
  const lastSeg = useRef(0);

  useEffect(() => {
    if (resultIndex === null || spinTrigger === 0) return;
    setLanded(null);
    const current = rotation.get();
    const target = -resultIndex * STEP;
    const norm = (((current - target) % 360) + 360) % 360;
    // a little random offset inside the segment so it doesn't always stop dead centre — but
    // always well inside it, never near a boundary
    const jitter = (Math.random() - 0.5) * STEP * 0.5;
    const to = current - norm - 360 * 5 + jitter;
    const controls = animate(rotation, to, {
      duration: durationMs / 1000,
      ease: [0.12, 0.75, 0.15, 1],
      onUpdate: (r) => {
        const seg = Math.floor((r + STEP / 2) / STEP);
        if (seg !== lastSeg.current) {
          lastSeg.current = seg;
          setKick((k) => k + 1); // pointer flapper hits a peg
          playSound("tick");
        }
      },
      onComplete: () => setLanded(resultIndex),
    });
    return () => controls.stop();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [spinTrigger]);

  return (
    <div className={cn("relative mx-auto rounded-full", ringClassName)} style={{ width: size, height: size }}>
      <svg viewBox={`0 0 ${V} ${V}`} className="h-full w-full overflow-visible">
        <defs>
          <linearGradient id="bwGold" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#fff1c1" />
            <stop offset="50%" stopColor="#d4a537" />
            <stop offset="100%" stopColor="#7a5a16" />
          </linearGradient>
          <radialGradient id="bwShade" cx="50%" cy="50%" r="50%">
            <stop offset="60%" stopColor="rgba(0,0,0,0)" />
            <stop offset="100%" stopColor="rgba(0,0,0,0.45)" />
          </radialGradient>
        </defs>

        {/* outer rim with marquee bulbs */}
        <circle cx={C} cy={C} r={149} fill="url(#bwGold)" />
        <circle cx={C} cy={C} r={143} fill="#0b1530" />
        {Array.from({ length: 24 }, (_, i) => {
          const [x, y] = pt(i * 15, 146);
          return (
            <circle
              key={i}
              cx={x}
              cy={y}
              r={2.6}
              fill="#ffe9a8"
              className={spinning ? (i % 2 ? "animate-pulse" : "") : ""}
              style={{ filter: "drop-shadow(0 0 3px rgba(255,215,122,0.9))", opacity: spinning && i % 2 ? 0.5 : 1 }}
            />
          );
        })}

        <motion.g style={{ rotate: rotation, originX: "50%", originY: "50%" }}>
          <g>
            {segments.map((seg, i) => {
              const center = i * STEP;
              const fill = seg.highlight ? "#f6bf4b" : SEG_COLORS[i % SEG_COLORS.length];
              const won = landed === i;
              const [lx, ly] = pt(center, R_OUT - 30);
              return (
                <g key={i}>
                  <path d={wedge(center, STEP)} fill={fill} stroke="url(#bwGold)" strokeWidth={1.2} opacity={landed !== null && !won ? 0.55 : 1} />
                  <text
                    x={lx}
                    y={ly}
                    transform={`rotate(${center} ${lx} ${ly})`}
                    textAnchor="middle"
                    dominantBaseline="central"
                    fontSize={segments.length > 10 ? 12 : 14}
                    fontWeight={900}
                    fill={seg.highlight ? "#3a2604" : "white"}
                    style={{ paintOrder: "stroke", stroke: seg.highlight ? "none" : "rgba(0,0,0,0.5)", strokeWidth: 3 }}
                  >
                    {seg.label}
                  </text>
                </g>
              );
            })}
            <circle cx={C} cy={C} r={R_OUT} fill="url(#bwShade)" pointerEvents="none" />
            {segments.map((_, i) => {
              const [x, y] = pt(i * STEP + STEP / 2, R_OUT - 4);
              return <circle key={i} cx={x} cy={y} r={3} fill="url(#bwGold)" />;
            })}
          </g>
        </motion.g>

        {/* hub */}
        <circle cx={C} cy={C} r={R_IN + 4} fill="url(#bwGold)" />
        <circle cx={C} cy={C} r={R_IN} fill="#070d1f" />
        <text x={C} y={C} textAnchor="middle" dominantBaseline="central" fontSize={landed !== null ? 15 : 10} fontWeight={800} fill={landed !== null ? "#ffd77a" : "rgba(219,233,255,0.7)"}>
          {spinning && landed === null ? "…" : landed !== null ? segments[landed].label : centerLabel}
        </text>
      </svg>

      {/* pointer flapper, kicked by every peg */}
      <motion.div
        key={kick}
        className="absolute left-1/2 top-0 z-10 -ml-3 origin-top"
        initial={{ rotate: -14 }}
        animate={{ rotate: 0 }}
        transition={{ type: "spring", stiffness: 700, damping: 12 }}
        style={{ marginTop: -size * 0.04 }}
      >
        <svg width="24" height="30" viewBox="0 0 24 30">
          <path d="M2 0 H22 L12 28 Z" fill="url(#bwGoldPtr)" stroke="#7a5a16" strokeWidth="1.5" />
          <defs>
            <linearGradient id="bwGoldPtr" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%" stopColor="#fff1c1" />
              <stop offset="100%" stopColor="#d4a537" />
            </linearGradient>
          </defs>
        </svg>
      </motion.div>
    </div>
  );
}
