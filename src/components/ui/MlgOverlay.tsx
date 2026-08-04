import { motion } from "framer-motion";
import { useMemo } from "react";

const STICKERS = [
  "🕶️ SWAG",
  "😂 WASTED",
  "📸 GET THE CAMERA",
  "💯 360 NOSCOPE",
  "🎮 MLG PACK",
  "👽 O MY GOD",
  "🔥 NOSCOPE'D",
  "💨 QUICKSCOPE",
  "🌈 GG EZ",
  "⛽ TURBO",
];

// Pure CSS/emoji parody of the "MLG 360 noscope" meme aesthetic — deliberately no real images,
// logos, or photos (that's exactly what the real meme uses, and none of it is ours to reproduce).
export function MlgOverlay() {
  const stickers = useMemo(
    () =>
      STICKERS.map((label, i) => ({
        label,
        x: 6 + Math.random() * 84,
        y: 6 + Math.random() * 84,
        rotate: -25 + Math.random() * 50,
        delay: i * 0.09 + Math.random() * 0.1,
      })),
    []
  );

  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden">
      {/* spinning green MLG bloom */}
      <motion.div
        className="absolute inset-0 opacity-70"
        style={{
          background:
            "conic-gradient(from 0deg, #0f0 0deg, #0a0 40deg, #0f0 80deg, #060 120deg, #0f0 160deg, #0a0 200deg, #0f0 240deg, #060 280deg, #0f0 320deg, #0a0 360deg)",
          mixBlendMode: "screen",
        }}
        animate={{ rotate: 360, scale: [1, 1.15, 1] }}
        transition={{ rotate: { duration: 3, repeat: Infinity, ease: "linear" }, scale: { duration: 1.2, repeat: Infinity } }}
      />

      {/* WASTED-style banner sweep */}
      <motion.div
        className="absolute inset-x-0 top-1/3 text-center font-display text-5xl font-black tracking-widest text-red-600 sm:text-7xl"
        style={{ WebkitTextStroke: "2px black", textShadow: "0 0 20px rgba(0,0,0,0.9)" }}
        initial={{ opacity: 0, scale: 1.6 }}
        animate={{ opacity: [0, 1, 1, 0], scale: [1.6, 1, 1, 0.9] }}
        transition={{ duration: 2.2, times: [0, 0.15, 0.8, 1] }}
      >
        WASTED
      </motion.div>

      {stickers.map((s, i) => (
        <motion.div
          key={i}
          className="absolute select-none whitespace-nowrap text-sm font-black sm:text-lg"
          style={{ left: `${s.x}%`, top: `${s.y}%` }}
          initial={{ opacity: 0, scale: 0, rotate: s.rotate }}
          animate={
            i % 3 === 0
              ? { opacity: 1, scale: [0, 1.3, 1], rotate: s.rotate, filter: ["hue-rotate(0deg)", "hue-rotate(360deg)"] }
              : { opacity: 1, scale: [0, 1.3, 1], rotate: s.rotate }
          }
          transition={
            i % 3 === 0
              ? { scale: { delay: s.delay, type: "spring", stiffness: 300, damping: 12 }, filter: { duration: 1.5, repeat: Infinity, ease: "linear" } }
              : { delay: s.delay, type: "spring", stiffness: 300, damping: 12 }
          }
        >
          <span
            className={
              i % 3 === 0
                ? "bg-gradient-to-r from-red-500 via-gold-400 via-emerald-400 via-electric-400 to-fuchsia-500 bg-clip-text text-transparent"
                : "text-white drop-shadow-[0_2px_2px_rgba(0,0,0,0.9)]"
            }
          >
            {s.label}
          </span>
        </motion.div>
      ))}
    </div>
  );
}
