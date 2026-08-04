import { useEffect, useState } from "react";
import { motion, animate, useMotionValue } from "framer-motion";
import { colorOf } from "../../lib/rouletteEngine";

export const WHEEL_ORDER = [
  0, 32, 15, 19, 4, 21, 2, 25, 17, 34, 6, 27, 13, 36, 11, 30, 8, 23, 10, 5, 24, 16, 33, 1, 20, 14, 31, 9, 22, 18, 29, 7, 28, 12, 35, 3, 26,
];

// Plain HTML + a JS-measured `transform: scale()` was fighting ResizeObserver timing and
// could render a frame un-scaled (clipped, looking off-center) before it settled. An SVG
// viewBox scales natively and synchronously — no JS measurement, no race, always centered.
const VIEW = 300;
const CENTER = VIEW / 2;
const NUMBER_RADIUS = 130;
const BALL_RADIUS = NUMBER_RADIUS;
const HUB_RADIUS = 64;
const STEP = 360 / WHEEL_ORDER.length;

export function RouletteWheel({ winningNumber, spinTrigger, spinning }: { winningNumber: number | null; spinTrigger: number; spinning: boolean }) {
  // Tracked as a plain motion value (not a CSS transform) so the ball's position is driven by
  // real angle math each frame — rotating an SVG <g> via CSS transform-origin was unreliable
  // and could render the ball "stuck" instead of sweeping around the rim.
  const rotationValue = useMotionValue(0);
  const [ballAngle, setBallAngle] = useState(0);

  useEffect(() => {
    const unsubscribe = rotationValue.on("change", setBallAngle);
    return unsubscribe;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (winningNumber === null || spinTrigger === 0) return;
    const idx = WHEEL_ORDER.indexOf(winningNumber);
    const targetAngle = idx * STEP;
    const current = ((rotationValue.get() % 360) + 360) % 360;
    const delta = (targetAngle - current + 360) % 360;
    const nextValue = rotationValue.get() + 360 * 5 + delta;
    const controls = animate(rotationValue, nextValue, { duration: 3, ease: [0.11, 0.8, 0.2, 1] });
    return () => controls.stop();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [spinTrigger]);

  const showResult = !spinning && winningNumber !== null;
  const ballRad = (ballAngle * Math.PI) / 180;
  const ballX = CENTER + BALL_RADIUS * Math.sin(ballRad);
  const ballY = CENTER - BALL_RADIUS * Math.cos(ballRad);

  return (
    <svg viewBox={`0 0 ${VIEW} ${VIEW}`} className="mx-auto block w-full" style={{ maxWidth: VIEW }}>
      <defs>
        <linearGradient id="wheelBg" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#0f1c40" />
          <stop offset="100%" stopColor="#050914" />
        </linearGradient>
        <linearGradient id="hubButton" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#5fb8ff" />
          <stop offset="100%" stopColor="#1467e8" />
        </linearGradient>
      </defs>

      <circle cx={CENTER} cy={CENTER} r={CENTER - 2} fill="url(#wheelBg)" stroke="rgba(46,143,255,0.35)" strokeWidth={4} />

      {WHEEL_ORDER.map((n, i) => {
        const angle = i * STEP;
        const color = colorOf(n);
        const isWinner = showResult && n === winningNumber;
        const fill = color === "red" ? "#dc2626" : color === "black" ? "#334155" : "#059669";
        return (
          <g key={n} transform={`rotate(${angle} ${CENTER} ${CENTER})`}>
            <circle
              cx={CENTER}
              cy={CENTER - NUMBER_RADIUS}
              r={isWinner ? 12.5 : 10}
              fill={fill}
              stroke={isWinner ? "#f6bf4b" : color === "black" ? "rgba(255,255,255,0.3)" : "none"}
              strokeWidth={isWinner ? 2 : 1}
            />
            <text
              x={CENTER}
              y={CENTER - NUMBER_RADIUS}
              textAnchor="middle"
              dominantBaseline="central"
              fontSize={isWinner ? 11 : 10}
              fontWeight="bold"
              fill="white"
            >
              {n}
            </text>
          </g>
        );
      })}

      {showResult && (
        <motion.line
          key={winningNumber}
          x1={CENTER}
          y1={CENTER - HUB_RADIUS}
          x2={CENTER}
          y2={CENTER - NUMBER_RADIUS}
          stroke="#f6bf4b"
          strokeWidth={2}
          strokeLinecap="round"
          transform={`rotate(${WHEEL_ORDER.indexOf(winningNumber!) * STEP} ${CENTER} ${CENTER})`}
          initial={{ opacity: 0 }}
          animate={{ opacity: 0.9 }}
          transition={{ duration: 0.3 }}
        />
      )}

      <circle cx={CENTER} cy={CENTER} r={HUB_RADIUS} fill="rgba(11,21,48,0.85)" stroke="rgba(255,255,255,0.1)" />
      <circle
        cx={CENTER}
        cy={CENTER}
        r={showResult ? 30 : 27}
        fill="url(#hubButton)"
        stroke={showResult ? "#f6bf4b" : "none"}
        strokeWidth={showResult ? 3 : 0}
      />
      <text
        x={CENTER}
        y={CENTER}
        textAnchor="middle"
        dominantBaseline="central"
        fontSize={showResult ? 20 : 16}
        fontWeight="bold"
        fill="white"
      >
        {spinning ? "..." : winningNumber ?? "?"}
      </text>

      <circle
        cx={ballX}
        cy={ballY}
        r={showResult ? 6 : 5}
        fill="white"
        style={{ filter: `drop-shadow(0 0 6px ${showResult ? "rgba(255,215,120,0.9)" : "rgba(255,255,255,0.85)"})` }}
      />

      <polygon points={`${CENTER - 6},2 ${CENTER + 6},2 ${CENTER},12`} fill="#f6bf4b" />
    </svg>
  );
}
