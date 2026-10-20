import type { ReactNode } from "react";
import { motion } from "framer-motion";
import { multiplierAt, timeForMultiplier } from "../../lib/crashEngine";
import { cn } from "../../lib/format";

// Graph geometry (SVG units). Axes rescale every frame like real crash games: the curve always
// fills the chart instead of flying off it past some fixed max multiplier.
const W = 600;
const H = 300;
const PL = 44;
const PR = 16;
const PT = 16;
const PB = 24;
const NICE = [0.1, 0.2, 0.5, 1, 2, 5, 10, 20, 50, 100, 200, 500, 1000, 2000, 5000];
const niceStep = (range: number, lines: number) => NICE.find((s) => range / s <= lines) ?? NICE[NICE.length - 1];

const STARS = Array.from({ length: 40 }, (_, i) => ({ x: (i * 37) % 100, y: (i * 61) % 100, s: (i % 3) + 1 }));
const DEBRIS = Array.from({ length: 18 }, (_, i) => {
  const a = (i / 18) * Math.PI * 2;
  const d = 40 + (i % 4) * 22;
  return { x: Math.cos(a) * d, y: Math.sin(a) * d };
});

export interface CrashMarker {
  key: string;
  m: number;
  label: string;
  mine?: boolean;
}

export function CrashChart({
  phase,
  elapsedMs,
  multiplier,
  markers = [],
  shake = true,
  children,
}: {
  phase: "idle" | "running" | "ended";
  elapsedMs: number;
  multiplier: number;
  markers?: CrashMarker[];
  shake?: boolean;
  children?: ReactNode;
}) {
  const crashed = phase === "ended";
  const tSec = elapsedMs / 1000;
  const xMax = Math.max(8, tSec * 1.15);
  const yMax = Math.max(2, multiplier * 1.25);
  const X = (s: number) => PL + (s / xMax) * (W - PL - PR);
  const Y = (m: number) => H - PB - ((m - 1) / (yMax - 1)) * (H - PB - PT);
  const SAMPLES = 80;
  const curve = Array.from({ length: SAMPLES + 1 }, (_, i) => {
    const s = (tSec * i) / SAMPLES;
    return [X(s), Y(Math.min(multiplier, multiplierAt(s * 1000)))] as const;
  });
  const linePath = curve.map(([x, y], i) => `${i ? "L" : "M"}${x.toFixed(1)},${y.toFixed(1)}`).join(" ");
  const areaPath = `${linePath} L${X(tSec).toFixed(1)},${H - PB} L${PL},${H - PB} Z`;
  const [tipX, tipY] = curve[curve.length - 1];
  const ahead = [X(tSec + 0.15), Y(multiplierAt(elapsedMs + 150))];
  const angle = phase === "idle" ? -35 : (Math.atan2(ahead[1] - tipY, ahead[0] - tipX) * 180) / Math.PI;
  const yStep = niceStep(yMax - 1, 5);
  const yTicks = Array.from({ length: Math.floor((yMax - 1) / yStep) + 1 }, (_, i) => 1 + i * yStep);
  const xStep = niceStep(xMax, 6);
  const xTicks = Array.from({ length: Math.floor(xMax / xStep) + 1 }, (_, i) => i * xStep);
  const stroke = crashed ? "#ef4444" : "#f6bf4b";

  return (
    <motion.div
      animate={crashed && shake ? { x: [0, -10, 10, -6, 6, -2, 0] } : { x: 0 }}
      transition={{ duration: 0.45 }}
      className={cn(
        "relative aspect-[2/1] overflow-hidden rounded-2xl border transition-colors duration-300",
        crashed ? "border-red-500/40 bg-red-950/25" : "border-white/10 bg-gradient-to-b from-ink-900/70 to-ink-950/80"
      )}
    >
      {/* parallax starfield — speeds up with the multiplier */}
      <motion.div
        className="absolute inset-0"
        animate={phase === "running" ? { x: ["0%", "-50%"] } : { x: "0%" }}
        transition={{ duration: Math.max(0.6, 6 / multiplier), repeat: Infinity, ease: "linear" }}
        style={{ width: "200%" }}
      >
        {[0, 50].map((off) =>
          STARS.map((s, i) => (
            <span
              key={`${off}-${i}`}
              className="absolute rounded-full bg-white"
              style={{ left: `${off + s.x / 2}%`, top: `${s.y}%`, width: s.s, height: s.s, opacity: 0.15 + s.s * 0.12 }}
            />
          ))
        )}
      </motion.div>

      <svg viewBox={`0 0 ${W} ${H}`} className="absolute inset-0 h-full w-full">
        <defs>
          <linearGradient id="crashArea" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={stroke} stopOpacity={0.35} />
            <stop offset="100%" stopColor={stroke} stopOpacity={0} />
          </linearGradient>
        </defs>
        {yTicks.map((m) => (
          <g key={`y${m}`}>
            <line x1={PL} x2={W - PR} y1={Y(m)} y2={Y(m)} stroke="rgba(255,255,255,0.06)" />
            <text x={PL - 6} y={Y(m)} textAnchor="end" dominantBaseline="central" fontSize={10} fill="rgba(200,215,255,0.45)">
              {m.toFixed(yStep < 1 ? 1 : 0)}x
            </text>
          </g>
        ))}
        {xTicks.map((s) => (
          <text key={`x${s}`} x={X(s)} y={H - 8} textAnchor="middle" fontSize={10} fill="rgba(200,215,255,0.45)">
            {s}s
          </text>
        ))}
        {phase !== "idle" && (
          <>
            <path d={areaPath} fill="url(#crashArea)" />
            <path d={linePath} fill="none" stroke={stroke} strokeWidth={3} strokeLinecap="round" style={{ filter: `drop-shadow(0 0 6px ${stroke})` }} />
          </>
        )}
        {markers.map((mk) => {
          const x = X(timeForMultiplier(mk.m) / 1000);
          const y = Y(mk.m);
          return (
            <g key={mk.key}>
              <circle cx={x} cy={y} r={mk.mine ? 5 : 3.5} fill={mk.mine ? "#34d399" : "#93c5fd"} stroke="white" strokeWidth={1.2} />
              <text x={x} y={y - 10} textAnchor="middle" fontSize={mk.mine ? 11 : 9} fontWeight="bold" fill={mk.mine ? "#34d399" : "#bfdbfe"}>
                {mk.label}
              </text>
            </g>
          );
        })}
      </svg>

      {/* rocket rides the tangent of the curve */}
      {!crashed && (
        <div
          className="absolute text-3xl"
          style={{
            left: `${((phase === "idle" ? PL + 20 : tipX) / W) * 100}%`,
            top: `${((phase === "idle" ? H - PB - 20 : tipY) / H) * 100}%`,
            transform: `translate(-50%,-50%) rotate(${angle + 45}deg)`,
          }}
        >
          <motion.span
            className="block"
            animate={phase === "running" ? { x: [0, 0.8, -0.8, 0], y: [0, -0.8, 0.8, 0] } : {}}
            transition={{ duration: 0.12, repeat: Infinity }}
          >
            🚀
          </motion.span>
        </div>
      )}
      {crashed && (
        <div className="absolute" style={{ left: `${(tipX / W) * 100}%`, top: `${(tipY / H) * 100}%` }}>
          <motion.span
            className="absolute -translate-x-1/2 -translate-y-1/2 text-5xl"
            initial={{ scale: 0.2, opacity: 1 }}
            animate={{ scale: [0.2, 1.8, 1.3], opacity: [1, 1, 0.85] }}
            transition={{ duration: 0.5 }}
          >
            💥
          </motion.span>
          {DEBRIS.map((d, i) => (
            <motion.span
              key={i}
              className={cn("absolute h-1.5 w-1.5 rounded-full", i % 2 ? "bg-orange-400" : "bg-red-500")}
              initial={{ x: 0, y: 0, opacity: 1 }}
              animate={{ x: d.x, y: d.y + 30, opacity: 0 }}
              transition={{ duration: 0.9, ease: "easeOut" }}
            />
          ))}
        </div>
      )}

      <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">{children}</div>
    </motion.div>
  );
}
