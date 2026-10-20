import { useEffect, useRef, useState } from "react";
import { colorOf } from "../../lib/rouletteEngine";
import { playSound } from "../../lib/sounds";

export const WHEEL_ORDER = [
  0, 32, 15, 19, 4, 21, 2, 25, 17, 34, 6, 27, 13, 36, 11, 30, 8, 23, 10, 5, 24, 16, 33, 1, 20, 14, 31, 9, 22, 18, 29, 7, 28, 12, 35, 3, 26,
];

// Total spin length, and the moment the ball drops into its pocket for good — pages wait for
// SETTLE_MS before announcing the number, like a croupier waits for the ball to stop.
export const SPIN_MS = 7000;
export const SETTLE_MS = 5200;
const DROP_MS = 3000; // ball leaves the outer track and starts falling toward the pockets

// SVG viewBox scales natively — no JS measurement, always centered.
const VIEW = 300;
const C = VIEW / 2;
const STEP = 360 / WHEEL_ORDER.length;
const R_RIM = 149;
const R_TRACK_IN = 124;
const BALL_TRACK = 136;
const R_DEFLECT = 117;
const R_NUM_OUT = 111;
const R_NUM_IN = 97;
const R_POCKET_IN = 76;
const BALL_POCKET = 87;
const IDLE_DEG_PER_MS = 0.012; // a real wheel never fully stops between spins

function pt(deg: number, r: number): [number, number] {
  const a = (deg * Math.PI) / 180;
  return [C + r * Math.sin(a), C - r * Math.cos(a)];
}

function wedge(center: number, r1: number, r2: number): string {
  const a0 = center - STEP / 2;
  const a1 = center + STEP / 2;
  const [x0, y0] = pt(a0, r2);
  const [x1, y1] = pt(a1, r2);
  const [x2, y2] = pt(a1, r1);
  const [x3, y3] = pt(a0, r1);
  return `M${x0},${y0} A${r2},${r2} 0 0 1 ${x1},${y1} L${x2},${y2} A${r1},${r1} 0 0 0 ${x3},${y3} Z`;
}

const norm180 = (d: number) => ((((d + 180) % 360) + 360) % 360) - 180;
const easeOutCubic = (u: number) => 1 - (1 - u) ** 3;
const smooth = (u: number) => u * u * (3 - 2 * u);

interface Spin {
  start: number;
  spinMs: number;
  settleMs: number;
  W0: number;
  A: number; // total wheel rotation over SPIN_MS (clockwise)
  B0: number;
  Bt: number; // total free ball travel until settle (counter-clockwise)
  corr: number; // spread over the free flight so the ball lands exactly in the drawn pocket
  pocket: number;
  r0: number;
  lastBounce: number;
}

export function RouletteWheel({
  winningNumber,
  spinTrigger,
  spinMs = SPIN_MS,
  settleMs = SETTLE_MS,
}: {
  winningNumber: number | null;
  spinTrigger: number;
  spinMs?: number;
  settleMs?: number;
}) {
  const wheelRef = useRef<SVGGElement>(null);
  const ballRef = useRef<SVGGElement>(null);
  const [highlight, setHighlight] = useState<number | null>(null);
  const st = useRef({ W: 0, pocket: 0, spin: null as Spin | null, last: 0 });

  // One rAF loop drives both bodies by writing SVG attributes directly — no React re-render
  // per frame, so the motion stays at full frame rate even on phones.
  useEffect(() => {
    let raf = 0;
    const frame = (now: number) => {
      const s = st.current;
      const dt = s.last ? now - s.last : 0;
      s.last = now;
      let ballDeg: number;
      let ballR = BALL_POCKET;
      const sp = s.spin;

      if (sp) {
        const t = now - sp.start;
        s.W = sp.W0 + sp.A * easeOutCubic(Math.min(1, t / sp.spinMs));
        const dropMs = sp.settleMs * (DROP_MS / SETTLE_MS);
        if (t < sp.settleMs) {
          const u = t / sp.settleMs;
          const free = sp.B0 - sp.Bt * (1 - (1 - u) ** 2);
          let jitter = 0;
          if (t < 350) {
            // croupier launch: ball climbs from its old pocket up onto the track
            ballR = sp.r0 + (BALL_TRACK - sp.r0) * smooth(t / 350);
          } else if (t < dropMs) {
            ballR = BALL_TRACK;
          } else {
            const p = (t - dropMs) / (sp.settleMs - dropMs);
            const bounce = Math.abs(Math.sin(p * Math.PI * 4.5)) * 13 * (1 - p) ** 2;
            ballR = BALL_POCKET + (BALL_TRACK - BALL_POCKET) * (1 - p) ** 3 + bounce;
            jitter = Math.sin(p * Math.PI * 6) * 7 * (1 - p) ** 2; // deflector kicks
            const k = Math.floor(p * 4.5);
            if (k !== sp.lastBounce && p < 0.85) {
              sp.lastBounce = k;
              playSound("tick");
            }
          }
          ballDeg = free + sp.corr * smooth(u) + jitter;
        } else {
          if (s.pocket !== sp.pocket) {
            s.pocket = sp.pocket;
            setHighlight(sp.pocket);
            playSound("chip");
          }
          ballDeg = s.W + sp.pocket * STEP;
          if (t >= sp.spinMs) s.spin = null;
        }
      } else {
        s.W += IDLE_DEG_PER_MS * dt;
        ballDeg = s.W + s.pocket * STEP;
      }

      wheelRef.current?.setAttribute("transform", `rotate(${s.W % 360} ${C} ${C})`);
      const [bx, by] = pt(ballDeg, ballR);
      ballRef.current?.setAttribute("transform", `translate(${bx} ${by})`);
      raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(raf);
  }, []);

  useEffect(() => {
    if (winningNumber === null || spinTrigger === 0) return;
    const s = st.current;
    const pocket = WHEEL_ORDER.indexOf(winningNumber);
    const A = 360 * 2 + Math.random() * 360;
    const Bt = 360 * 7 + Math.random() * 360;
    const B0 = s.W + s.pocket * STEP;
    const Wsettle = s.W + A * easeOutCubic(settleMs / spinMs);
    const corr = norm180(Wsettle + pocket * STEP - (B0 - Bt));
    s.spin = { start: performance.now(), spinMs, settleMs, W0: s.W, A, B0, Bt, corr, pocket, r0: BALL_POCKET, lastBounce: -1 };
    setHighlight(null);
  }, [spinTrigger]);

  return (
    <svg viewBox={`0 0 ${VIEW} ${VIEW}`} className="mx-auto block w-full" style={{ maxWidth: VIEW }}>
      <defs>
        <radialGradient id="rwRim" cx="50%" cy="45%" r="55%">
          <stop offset="80%" stopColor="#5b3a1e" />
          <stop offset="94%" stopColor="#8a5a2b" />
          <stop offset="100%" stopColor="#2b1a0c" />
        </radialGradient>
        <radialGradient id="rwTrack" cx="50%" cy="50%" r="50%">
          <stop offset="80%" stopColor="#1b1206" />
          <stop offset="100%" stopColor="#3b2810" />
        </radialGradient>
        <radialGradient id="rwCone" cx="45%" cy="40%" r="60%">
          <stop offset="0%" stopColor="#b8862f" />
          <stop offset="60%" stopColor="#6b4a1a" />
          <stop offset="100%" stopColor="#2a1c08" />
        </radialGradient>
        <radialGradient id="rwBall" cx="35%" cy="30%" r="70%">
          <stop offset="0%" stopColor="#ffffff" />
          <stop offset="70%" stopColor="#d7dde6" />
          <stop offset="100%" stopColor="#8892a0" />
        </radialGradient>
        <linearGradient id="rwGold" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#ffe9a8" />
          <stop offset="50%" stopColor="#d4a537" />
          <stop offset="100%" stopColor="#7a5a16" />
        </linearGradient>
      </defs>

      {/* Stator: rim, ball track, diamond deflectors — these never rotate */}
      <circle cx={C} cy={C} r={R_RIM} fill="url(#rwRim)" />
      <circle cx={C} cy={C} r={146} fill="url(#rwTrack)" stroke="rgba(0,0,0,0.6)" strokeWidth={1} />
      <circle cx={C} cy={C} r={R_TRACK_IN} fill="#24170a" stroke="rgba(212,165,55,0.35)" strokeWidth={1} />
      {Array.from({ length: 8 }, (_, i) => {
        const a = i * 45 + 22.5;
        const [x, y] = pt(a, R_DEFLECT + 2);
        return (
          <polygon
            key={i}
            points="0,-4.5 2.2,0 0,4.5 -2.2,0"
            fill="url(#rwGold)"
            transform={`translate(${x} ${y}) rotate(${a})`}
          />
        );
      })}

      {/* Rotor: everything below turns with the cylinder */}
      <g ref={wheelRef}>
        {WHEEL_ORDER.map((n, i) => {
          const color = colorOf(n);
          const fill = color === "red" ? "#b91c1c" : color === "black" ? "#111827" : "#047857";
          const lit = highlight === i;
          return (
            <g key={n}>
              <path d={wedge(i * STEP, R_NUM_IN, R_NUM_OUT)} fill={fill} stroke="url(#rwGold)" strokeWidth={0.6} />
              <path d={wedge(i * STEP, R_POCKET_IN, R_NUM_IN)} fill={lit ? "#f6bf4b" : fill} opacity={lit ? 0.9 : 0.75} stroke="url(#rwGold)" strokeWidth={0.8} />
              <text
                x={C}
                y={C - (R_NUM_IN + R_NUM_OUT) / 2}
                transform={`rotate(${i * STEP} ${C} ${C})`}
                textAnchor="middle"
                dominantBaseline="central"
                fontSize={8}
                fontWeight="bold"
                fill={lit ? "#ffe9a8" : "white"}
              >
                {n}
              </text>
            </g>
          );
        })}
        <circle cx={C} cy={C} r={R_POCKET_IN} fill="url(#rwCone)" stroke="url(#rwGold)" strokeWidth={1.5} />
        <circle cx={C} cy={C} r={40} fill="none" stroke="rgba(255,233,168,0.25)" strokeWidth={1} />
        {/* turret / croisillon */}
        {[0, 90, 180, 270].map((a) => {
          const [x, y] = pt(a, 30);
          return (
            <g key={a}>
              <line x1={C} y1={C} x2={x} y2={y} stroke="url(#rwGold)" strokeWidth={4} strokeLinecap="round" />
              <circle cx={x} cy={y} r={4} fill="url(#rwGold)" />
            </g>
          );
        })}
        <circle cx={C} cy={C} r={9} fill="url(#rwGold)" stroke="#7a5a16" />
      </g>

      <g ref={ballRef}>
        <ellipse cx={1.5} cy={2} rx={4.6} ry={3.4} fill="rgba(0,0,0,0.45)" />
        <circle r={4.6} fill="url(#rwBall)" />
      </g>
    </svg>
  );
}
