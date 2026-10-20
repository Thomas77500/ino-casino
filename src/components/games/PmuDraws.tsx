import { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import type { Horse } from "../../lib/pmuEngine";
import { cn } from "../../lib/format";
import { playSound } from "../../lib/sounds";

// ============================================================================
// Horse race. Each horse follows f(u) = u + Σ a_k·sin(kπu)/(kπ): f(0)=0, f(1)=1, and since
// Σ|a_k| < 1 the derivative stays positive — so horses surge and fade (real lead changes) but
// never run backwards, and the drawn winner is guaranteed to hit the post first, exactly at T.
// ============================================================================
export const RACE_MS = 7000;
const FINISH = 100;

interface Runner {
  id: string;
  a: number[];
  final: number; // where this horse is when the winner crosses
}

function buildRace(horses: Horse[], winnerId: string): Runner[] {
  const losers = horses.filter((h) => h.id !== winnerId).sort(() => Math.random() - 0.5);
  const gaps = [0.4 + Math.random() * 1.4, 2 + Math.random() * 2, 4 + Math.random() * 3, 7 + Math.random() * 3, 10 + Math.random() * 4];
  return [winnerId, ...losers.map((h) => h.id)].map((id, rank) => ({
    id,
    a: [1, 2, 3].map(() => (Math.random() - 0.5) * 0.6),
    final: FINISH - (rank === 0 ? 0 : gaps[rank - 1]),
  }));
}

function posAt(r: Runner, u: number): number {
  const f = u + r.a.reduce((s, a, k) => s + (a * Math.sin((k + 1) * Math.PI * u)) / ((k + 1) * Math.PI), 0);
  return r.final * f;
}

export function HorseRace({
  horses,
  winnerId,
  raceKey,
  pickedId,
}: {
  horses: Horse[];
  winnerId: string | null;
  raceKey: number;
  pickedId: string | null;
}) {
  const [u, setU] = useState(0);
  const [runners, setRunners] = useState<Runner[] | null>(null);
  const [call, setCall] = useState("Les chevaux sont dans les stalles…");
  const leaderRef = useRef<string | null>(null);

  useEffect(() => {
    if (!winnerId || raceKey === 0) return;
    const rs = buildRace(horses, winnerId);
    setRunners(rs);
    setU(0);
    setCall("Et c'est parti !");
    leaderRef.current = null;
    playSound("bigwin");
    const start = performance.now();
    let raf = 0;
    const tick = (now: number) => {
      const v = Math.min(1, (now - start) / RACE_MS);
      setU(v);
      const leader = rs.reduce((best, r) => (posAt(r, v) > posAt(best, v) ? r : best));
      if (v > 0.08 && leader.id !== leaderRef.current) {
        leaderRef.current = leader.id;
        const name = horses.find((h) => h.id === leader.id)!.name;
        setCall(v > 0.85 ? `${name} dans la dernière ligne droite !` : `${name} prend la tête !`);
      }
      if (v < 1) raf = requestAnimationFrame(tick);
      else {
        const margin = rs[0].final - rs[1].final;
        setCall(margin < 1 ? "PHOTO-FINISH !" : `${horses.find((h) => h.id === winnerId)!.name} l'emporte !`);
      }
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [raceKey]);

  const done = u >= 1;
  const order = runners ? [...runners].sort((a, b) => posAt(b, u) - posAt(a, u)).map((r) => r.id) : [];
  const photo = done && runners && runners[0].final - runners[1].final < 1;

  return (
    <div className="relative mb-6 overflow-hidden rounded-2xl border-4 border-white/80 bg-[repeating-linear-gradient(90deg,#1f6b35_0px,#1f6b35_40px,#22743a_40px,#22743a_80px)] shadow-[inset_0_0_30px_rgba(0,0,0,0.5)]">
      <div className="flex items-center justify-between bg-black/50 px-3 py-1.5">
        <AnimatePresence mode="wait">
          <motion.p
            key={call}
            initial={{ opacity: 0, y: -6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className={cn("text-xs font-bold uppercase tracking-wide", photo ? "text-gold-300" : "text-white")}
          >
            🎙️ {call}
          </motion.p>
        </AnimatePresence>
        {runners && !done && <span className="text-[10px] font-semibold text-white/60">{Math.round(u * 2400)} m</span>}
      </div>
      <div className="relative py-2">
        {/* finish post, checkered */}
        <div className="pointer-events-none absolute inset-y-0 right-[6%] w-2 bg-[repeating-linear-gradient(0deg,#fff_0_6px,#111_6px_12px)]" />
        {photo && (
          <motion.div
            className="pointer-events-none absolute inset-0 z-20 bg-white"
            initial={{ opacity: 0.9 }}
            animate={{ opacity: 0 }}
            transition={{ duration: 0.6 }}
          />
        )}
        {horses.map((h, i) => {
          const r = runners?.find((x) => x.id === h.id);
          const p = r ? posAt(r, u) : 0;
          const rank = order.indexOf(h.id) + 1;
          return (
            <div key={h.id} className="relative h-9 border-b border-dashed border-white/20 last:border-0">
              <span className="absolute left-1 top-1/2 -translate-y-1/2 text-[10px] font-bold text-white/40">{i + 1}</span>
              <div
                className="absolute top-1/2 flex -translate-y-1/2 items-center"
                style={{ left: `calc(${(p / FINISH) * 88}% + 4px)` }}
              >
                <motion.span
                  className="block text-2xl"
                  style={{ scaleX: -1 }} // the emoji faces left — mirror it so they run toward the post
                  animate={r && !done ? { y: [0, -3, 0, -1, 0] } : { y: 0 }}
                  transition={{ duration: 0.32, repeat: Infinity, delay: i * 0.05 }}
                >
                  {h.glyph}
                </motion.span>
                <span
                  className={cn(
                    "ml-0.5 rounded px-1 text-[9px] font-black",
                    h.id === pickedId ? "bg-gold-400 text-ink-950" : "bg-white/85 text-ink-950"
                  )}
                >
                  {i + 1}
                </span>
                {done && rank <= 3 && (
                  <motion.span initial={{ scale: 0 }} animate={{ scale: 1 }} className="ml-1 text-sm">
                    {["🥇", "🥈", "🥉"][rank - 1]}
                  </motion.span>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ============================================================================
// Lottery machine: balls tumble in a sphere, then each drawn ball rolls out into the tray one by
// one. Matches against the player's ticket light up gold as they land.
// ============================================================================
export const BALL_GAP_MS = 750;
const MIX_MS = 900;
export const drawDurationMs = (balls: number) => MIX_MS + balls * BALL_GAP_MS + 200;

const TUMBLERS = Array.from({ length: 18 }, (_, i) => ({
  hue: (i * 47) % 360,
  path: Array.from({ length: 5 }, (_, k) => ({ x: Math.sin(i * 3.1 + k * 2.3) * 38, y: Math.cos(i * 1.7 + k * 2.9) * 38 })),
}));

export function LotteryMachine({
  balls,
  ticket,
  drawKey,
  stars = 0,
}: {
  balls: number[]; // drawn in order; the last `stars` are stars
  ticket: { main: number[]; stars: number[] };
  drawKey: number;
  stars?: number;
}) {
  const [shown, setShown] = useState(0);
  const mixing = drawKey > 0 && shown < balls.length;

  useEffect(() => {
    if (drawKey === 0) return;
    setShown(0);
    const timers = balls.map((_, i) =>
      setTimeout(() => {
        setShown(i + 1);
        playSound("chip");
      }, MIX_MS + i * BALL_GAP_MS)
    );
    return () => timers.forEach(clearTimeout);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [drawKey]);

  if (drawKey === 0) return null;
  const mainCount = balls.length - stars;

  return (
    <div className="mt-4 flex flex-col items-center gap-4 rounded-xl border border-white/10 bg-white/[0.03] p-4 sm:flex-row">
      <div className="relative h-28 w-28 shrink-0 rounded-full border-2 border-white/30 bg-[radial-gradient(circle_at_35%_30%,rgba(255,255,255,0.25),rgba(255,255,255,0.03)_60%)] shadow-[inset_0_0_20px_rgba(255,255,255,0.15)]">
        {TUMBLERS.map((b, i) => (
          <motion.span
            key={i}
            className="absolute left-1/2 top-1/2 -ml-2 -mt-2 h-4 w-4 rounded-full"
            style={{ background: `radial-gradient(circle at 35% 30%, #fff, hsl(${b.hue} 80% 55%) 60%)` }}
            animate={mixing ? { x: b.path.map((p) => p.x), y: b.path.map((p) => p.y) } : { x: b.path[0].x * 0.6, y: 30 + (i % 3) * 3 }}
            transition={mixing ? { duration: 0.9, repeat: Infinity, ease: "easeInOut", repeatType: "mirror" } : { duration: 0.6 }}
          />
        ))}
        <div className="absolute -bottom-2 left-1/2 h-3 w-6 -translate-x-1/2 rounded-b-md bg-white/30" />
      </div>

      <div className="flex flex-1 flex-wrap items-center justify-center gap-2 sm:justify-start">
        {balls.map((n, i) => {
          const isStar = i >= mainCount;
          const hit = isStar ? ticket.stars.includes(n) : ticket.main.includes(n);
          return (
            <div key={`${drawKey}-${i}`} className="flex items-center">
              {isStar && i === mainCount && <span className="mx-1 text-ice-200/30">+</span>}
              {i < shown ? (
                <motion.span
                  initial={{ x: -80, rotate: -360, opacity: 0 }}
                  animate={{ x: 0, rotate: 0, opacity: 1, scale: hit ? [1, 1.3, 1.1] : 1 }}
                  transition={{ type: "spring", stiffness: 140, damping: 14 }}
                  className={cn(
                    "grid h-10 w-10 place-items-center rounded-full text-sm font-black shadow-lg",
                    hit
                      ? isStar
                        ? "bg-[radial-gradient(circle_at_35%_30%,#fff,#5fb8ff_60%)] text-ink-950 ring-2 ring-white"
                        : "bg-[radial-gradient(circle_at_35%_30%,#fff,#f6bf4b_60%)] text-ink-950 ring-2 ring-white shadow-glow-gold"
                      : "bg-[radial-gradient(circle_at_35%_30%,#fff,#9aa3ad_70%)] text-ink-950"
                  )}
                >
                  {isStar ? `★${n}` : n}
                </motion.span>
              ) : (
                <span className="h-10 w-10 rounded-full border border-dashed border-white/15" />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
