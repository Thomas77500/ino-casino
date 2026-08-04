import { AnimatePresence, motion } from "framer-motion";
import { useEffect, useMemo, useRef } from "react";
import type { WinTier } from "../../lib/winTiers";
import { TIER_LABEL } from "../../lib/winTiers";
import { AnimatedNumber } from "./AnimatedNumber";
import { Button } from "./Button";
import { cn } from "../../lib/format";
import { playSound } from "../../lib/sounds";
import { useAuthStore } from "../../store/authStore";
import { useGlobalFeedStore } from "../../store/globalFeedStore";
import { MlgOverlay } from "./MlgOverlay";

const TIER_STYLE: Record<
  Exclude<WinTier, "none">,
  { gradient: string; ring: string; particles: number; fireworks: number; scale: number; shakeAmp: number; rays: boolean }
> = {
  win: { gradient: "from-electric-500 to-electric-400", ring: "shadow-glow", particles: 16, fireworks: 3, scale: 1, shakeAmp: 3, rays: false },
  superWin: { gradient: "from-electric-400 to-ice-100", ring: "shadow-glow", particles: 26, fireworks: 5, scale: 1.05, shakeAmp: 4, rays: false },
  megaWin: { gradient: "from-gold-500 to-electric-400", ring: "shadow-glow-gold", particles: 40, fireworks: 7, scale: 1.1, shakeAmp: 6, rays: true },
  gigaWin: { gradient: "from-gold-400 via-electric-400 to-gold-500", ring: "shadow-glow-gold", particles: 60, fireworks: 10, scale: 1.18, shakeAmp: 9, rays: true },
  maxWin: { gradient: "from-gold-400 via-white to-gold-500", ring: "shadow-glow-gold", particles: 90, fireworks: 16, scale: 1.28, shakeAmp: 17, rays: true },
};

const PARTICLE_COLORS = ["bg-gold-400", "bg-white", "bg-electric-400"];
const FIREWORK_PALETTES = [
  ["bg-gold-400", "bg-gold-500"],
  ["bg-electric-400", "bg-electric-500"],
  ["bg-white", "bg-ice-100"],
  ["bg-red-400", "bg-rose-400"],
  ["bg-emerald-400", "bg-teal-400"],
  ["bg-fuchsia-400", "bg-purple-400"],
];
const MARQUEE_DOTS = 8;

export function WinCelebration({
  tier,
  payout,
  onClose,
  game = "Casino",
}: {
  tier: WinTier;
  payout: number;
  onClose: () => void;
  game?: string;
}) {
  const style = tier !== "none" ? TIER_STYLE[tier] : null;
  const account = useAuthStore((s) => s.account);
  const broadcastWin = useGlobalFeedStore((s) => s.broadcast);

  const lastPlayedTier = useRef<WinTier>("none");
  useEffect(() => {
    if (tier !== "none" && lastPlayedTier.current !== tier) {
      const isBig = tier === "megaWin" || tier === "gigaWin" || tier === "maxWin";
      playSound(isBig ? "bigwin" : "win");
      if (tier === "maxWin") playSound("mlg");
      if (isBig) broadcastWin({ name: account?.username ?? "Joueur Ino", game, amount: payout, tier });
    }
    lastPlayedTier.current = tier;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tier]);

  const particles = useMemo(
    () =>
      !style
        ? []
        : Array.from({ length: style.particles }, (_, i) => ({
            id: i,
            angle: (360 / style.particles) * i + Math.random() * 10,
            dist: 130 + Math.random() * 220,
            delay: Math.random() * 0.3,
            size: 4 + Math.random() * 6,
            color: PARTICLE_COLORS[i % PARTICLE_COLORS.length],
            rect: Math.random() > 0.75,
          })),
    [style]
  );

  const fireworks = useMemo(
    () =>
      !style
        ? []
        : Array.from({ length: style.fireworks }, (_, i) => ({
            id: i,
            x: 8 + Math.random() * 84,
            y: 8 + Math.random() * 58,
            delay: (i / style.fireworks) * 1.4 + Math.random() * 0.25,
            colors: FIREWORK_PALETTES[Math.floor(Math.random() * FIREWORK_PALETTES.length)],
            count: 16 + Math.floor(Math.random() * 12),
          })),
    [style]
  );

  const marquee = useMemo(() => Array.from({ length: MARQUEE_DOTS }, (_, i) => i), []);

  return (
    <AnimatePresence>
      {tier !== "none" && style && (
        <motion.div
          className="fixed inset-0 z-[200] flex items-center justify-center overflow-hidden bg-ink-950/85 backdrop-blur-sm"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1, x: [0, -style.shakeAmp, style.shakeAmp, -style.shakeAmp * 0.6, style.shakeAmp * 0.6, 0] }}
          exit={{ opacity: 0 }}
          transition={{ x: { duration: 0.5 } }}
          onClick={onClose}
        >
          {/* multi-color strobe flash on entry — triple-flash for maxWin */}
          <motion.div
            className="pointer-events-none absolute inset-0"
            initial={{ opacity: 1, backgroundColor: "#ffffff" }}
            animate={
              tier === "maxWin"
                ? { opacity: [1, 0.2, 1, 0.2, 0.9, 0], backgroundColor: ["#ffffff", "#f6bf4b", "#ffffff", "#5fb8ff", "#39ff14", "#5fb8ff"] }
                : { opacity: [1, 0.9, 0], backgroundColor: ["#ffffff", "#f6bf4b", "#5fb8ff"] }
            }
            transition={{ duration: tier === "maxWin" ? 0.9 : 0.6, ease: "easeOut" }}
          />

          {tier === "maxWin" && <MlgOverlay />}

          {/* fireworks layer — bursts scattered across the whole screen */}
          <div className="pointer-events-none absolute inset-0">
            {fireworks.map((fw) => (
              <Firework key={fw.id} {...fw} />
            ))}
          </div>

          <motion.div className="relative flex flex-col items-center">
            {style.rays && (
              <motion.div
                className="pointer-events-none absolute left-1/2 top-1/2 h-[900px] w-[900px] -translate-x-1/2 -translate-y-1/2 opacity-40"
                style={{
                  background:
                    "conic-gradient(from 0deg, transparent 0deg, rgba(246,191,75,0.5) 8deg, transparent 20deg, transparent 40deg, rgba(95,184,255,0.35) 48deg, transparent 60deg, transparent 90deg, rgba(246,191,75,0.5) 98deg, transparent 110deg, transparent 140deg, rgba(95,184,255,0.35) 148deg, transparent 160deg, transparent 220deg, rgba(246,191,75,0.5) 228deg, transparent 240deg, transparent 280deg, rgba(95,184,255,0.35) 288deg, transparent 300deg, transparent 340deg, rgba(246,191,75,0.5) 348deg, transparent 360deg)",
                }}
                animate={{ rotate: 360 }}
                transition={{ duration: 10, repeat: Infinity, ease: "linear" }}
              />
            )}

            {particles.map((p) => (
              <motion.span
                key={p.id}
                className={cn("absolute rounded-sm", p.rect ? "" : "rounded-full", p.color)}
                style={{ width: p.rect ? p.size * 1.6 : p.size, height: p.size }}
                initial={{ x: 0, y: 0, opacity: 1, scale: 1, rotate: 0 }}
                animate={{
                  x: Math.cos((p.angle * Math.PI) / 180) * p.dist,
                  y: Math.sin((p.angle * Math.PI) / 180) * p.dist,
                  opacity: 0,
                  scale: 0.2,
                  rotate: p.rect ? 180 : 0,
                }}
                transition={{ duration: 1.3, delay: p.delay, ease: "easeOut" }}
              />
            ))}

            <motion.div
              initial={{ scale: 0.3, opacity: 0, rotate: -10 }}
              animate={{ scale: [style.scale * 1.15, style.scale], opacity: 1, rotate: 0 }}
              transition={{ type: "spring", stiffness: 260, damping: 13 }}
              className="relative"
            >
              {/* marquee chasing lights around the card border */}
              <div className="pointer-events-none absolute -inset-3">
                <div className="absolute inset-x-2 top-0 flex justify-between">
                  {marquee.map((i) => <MarqueeDot key={`t${i}`} index={i} total={marquee.length} />)}
                </div>
                <div className="absolute inset-x-2 bottom-0 flex justify-between">
                  {marquee.map((i) => <MarqueeDot key={`b${i}`} index={i + marquee.length} total={marquee.length * 2} />)}
                </div>
                <div className="absolute inset-y-2 left-0 flex flex-col justify-between">
                  {marquee.map((i) => <MarqueeDot key={`l${i}`} index={i + marquee.length * 2} total={marquee.length * 3} />)}
                </div>
                <div className="absolute inset-y-2 right-0 flex flex-col justify-between">
                  {marquee.map((i) => <MarqueeDot key={`r${i}`} index={i + marquee.length * 3} total={marquee.length * 4} />)}
                </div>
              </div>

              <div
                className={cn("rounded-3xl border border-white/10 bg-ink-900/90 px-14 py-10 text-center", style.ring)}
                onClick={(e) => e.stopPropagation()}
              >
                <motion.p
                  className={cn("bg-gradient-to-r bg-clip-text font-display text-3xl font-bold uppercase tracking-widest text-transparent sm:text-5xl", style.gradient)}
                  animate={{ scale: [1, 1.1, 1] }}
                  transition={{ duration: 0.7, repeat: Infinity }}
                >
                  {TIER_LABEL[tier]}
                </motion.p>
                <div className="mt-5 font-display text-4xl font-bold text-white sm:text-6xl">
                  +<AnimatedNumber value={payout} duration={1100} />
                </div>
                <p className="mt-1 text-sm text-ice-200/60">crédits virtuels</p>
                <Button variant="gold" size="md" className="mt-7" onClick={onClose}>
                  Continuer
                </Button>
              </div>
            </motion.div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

function MarqueeDot({ index, total }: { index: number; total: number }) {
  return (
    <motion.span
      className="h-1.5 w-1.5 rounded-full bg-gold-400 shadow-[0_0_6px_2px_rgba(246,191,75,0.8)]"
      animate={{ opacity: [0.2, 1, 0.2] }}
      transition={{ duration: 1.2, repeat: Infinity, delay: (index / total) * 1.2, ease: "easeInOut" }}
    />
  );
}

function Firework({
  x,
  y,
  delay,
  colors,
  count,
}: {
  x: number;
  y: number;
  delay: number;
  colors: string[];
  count: number;
}) {
  const particles = useMemo(
    () =>
      Array.from({ length: count }, (_, i) => ({
        angle: (360 / count) * i + Math.random() * 8,
        dist: 60 + Math.random() * 100,
        color: colors[i % colors.length],
      })),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    []
  );

  return (
    <div className="absolute" style={{ left: `${x}%`, top: `${y}%` }}>
      {/* rising trail */}
      <motion.span
        className="absolute h-1 w-1 rounded-full bg-white"
        style={{ boxShadow: "0 0 6px 2px rgba(255,255,255,0.8)" }}
        initial={{ y: 240, opacity: 1 }}
        animate={{ y: 0, opacity: [1, 1, 0] }}
        transition={{ duration: 0.45, delay, ease: "easeOut" }}
      />
      {/* pop flash */}
      <motion.span
        className="absolute h-3 w-3 -translate-x-1/2 -translate-y-1/2 rounded-full bg-white"
        initial={{ scale: 0, opacity: 0 }}
        animate={{ scale: [0, 4, 0], opacity: [0, 1, 0] }}
        transition={{ duration: 0.35, delay: delay + 0.42 }}
      />
      {particles.map((p, i) => (
        <motion.span
          key={i}
          className={cn("absolute h-1.5 w-1.5 -translate-x-1/2 -translate-y-1/2 rounded-full", p.color)}
          initial={{ x: 0, y: 0, opacity: 0, scale: 1 }}
          animate={{
            x: Math.cos((p.angle * Math.PI) / 180) * p.dist,
            y: Math.sin((p.angle * Math.PI) / 180) * p.dist + 45,
            opacity: [0, 1, 1, 0],
            scale: [1, 1, 0.3],
          }}
          transition={{ duration: 1.1, delay: delay + 0.42, ease: "easeOut" }}
        />
      ))}
    </div>
  );
}
