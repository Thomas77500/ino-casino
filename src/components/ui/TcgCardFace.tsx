import { useMemo, type PointerEvent } from "react";
import { motion, useMotionValue, useSpring, useTransform, useMotionTemplate } from "framer-motion";
import { cn, formatCredits } from "../../lib/format";
import { RARITY_LABEL, type CardRarity, type TcgCard } from "../../lib/tcgCards";

// Metallic frame per rarity — the outer 3px ring every real TCG card has, here doubling as the
// first read of how good the pull is.
const FRAME: Record<CardRarity, string> = {
  commune: "linear-gradient(135deg,#8a94a3,#d6dce4 45%,#7b8592)",
  peuCommune: "linear-gradient(135deg,#0f8a5f,#7ff0c3 45%,#0b6b4a)",
  rare: "linear-gradient(135deg,#1467e8,#9fd4ff 45%,#0b4bc0)",
  rareHolo: "linear-gradient(135deg,#5fb8ff,#e0b3ff 30%,#7ff0c3 60%,#ffd77a)",
  ultraRare: "linear-gradient(135deg,#a8741a,#fff1c1 40%,#f6bf4b 60%,#7a5a16)",
  secrete: "linear-gradient(135deg,#ff6ad5,#ffd77a 25%,#7ff0c3 50%,#5fb8ff 75%,#c774ff)",
};

const SYMBOL: Record<CardRarity, string> = {
  commune: "●",
  peuCommune: "◆",
  rare: "★",
  rareHolo: "★ H",
  ultraRare: "★★",
  secrete: "★★★",
};

const TELL: Partial<Record<CardRarity, string>> = {
  rare: "rgba(95,184,255,0.75)",
  rareHolo: "rgba(199,116,255,0.85)",
  ultraRare: "rgba(246,191,75,0.9)",
  secrete: "rgba(255,106,213,0.95)",
};

function SparkleBurst() {
  const sparks = useMemo(() => Array.from({ length: 12 }, (_, i) => ({ angle: (360 / 12) * i, dist: 50 + Math.random() * 40 })), []);
  return (
    <div className="pointer-events-none absolute inset-0 z-30 grid place-items-center">
      {sparks.map((s, i) => (
        <motion.span
          key={i}
          className="absolute h-1.5 w-1.5 rounded-full bg-white shadow-[0_0_8px_rgba(255,255,255,0.9)]"
          initial={{ x: 0, y: 0, opacity: 1, scale: 1 }}
          animate={{ x: Math.cos((s.angle * Math.PI) / 180) * s.dist, y: Math.sin((s.angle * Math.PI) / 180) * s.dist, opacity: 0, scale: 0.3 }}
          transition={{ duration: 0.8, ease: "easeOut", delay: 0.15 }}
        />
      ))}
    </div>
  );
}

// Card back — also used face-down during pack reveals. `tell` makes it glow in the rarity's colour
// just before the flip, the same anticipation trick TCG Pocket uses for its rare pulls.
export function CardBack({ sm, tell, className }: { sm?: boolean; tell?: CardRarity; className?: string }) {
  const glow = tell ? TELL[tell] : undefined;
  return (
    <motion.div
      className={cn("relative overflow-hidden rounded-2xl p-[3px]", sm ? "w-32" : "w-44", className)}
      style={{ background: "linear-gradient(135deg,#1467e8,#5fb8ff 50%,#0b4bc0)" }}
      animate={glow ? { boxShadow: [`0 0 0px ${glow}`, `0 0 38px ${glow}`, `0 0 12px ${glow}`] } : {}}
      transition={glow ? { duration: 1.1, repeat: Infinity, repeatType: "mirror" } : {}}
    >
      <div
        className={cn("relative grid place-items-center overflow-hidden rounded-[13px]", sm ? "aspect-[5/7]" : "aspect-[5/7]")}
        style={{
          background:
            "radial-gradient(circle at 50% 50%, rgba(95,184,255,0.35), transparent 55%), repeating-conic-gradient(from 0deg at 50% 50%, #0b1530 0deg 10deg, #0f1c40 10deg 20deg)",
        }}
      >
        <div className="grid h-14 w-14 place-items-center rounded-full border-2 border-gold-400/70 bg-ink-950/80 font-display text-xs font-black tracking-widest text-gold-400 shadow-glow-gold">
          INO
        </div>
        {glow && (
          <motion.div
            className="absolute inset-0 mix-blend-screen"
            style={{ background: `radial-gradient(circle, ${glow}, transparent 70%)` }}
            animate={{ opacity: [0.2, 0.7, 0.2] }}
            transition={{ duration: 0.9, repeat: Infinity }}
          />
        )}
      </div>
    </motion.div>
  );
}

export function TcgCardFace({
  card,
  accent,
  size = "lg",
  foil,
  value,
  isNew,
  locked,
  showEffects,
  revealed = true,
  dramatic,
  tell,
  tilt = true,
}: {
  card: TcgCard;
  accent: string;
  size?: "sm" | "lg";
  foil?: boolean;
  value?: number;
  isNew?: boolean;
  locked?: boolean;
  showEffects?: boolean;
  revealed?: boolean;
  dramatic?: boolean;
  tell?: CardRarity;
  tilt?: boolean;
}) {
  const sm = size === "sm";
  const holo = foil || card.rarity === "rareHolo" || card.rarity === "ultraRare" || card.rarity === "secrete";
  const sparkleTex = card.rarity === "ultraRare" || card.rarity === "secrete";
  const fullArt = card.rarity === "ultraRare" || card.rarity === "secrete";

  // Pointer-driven tilt + glare. px/py are 0..1 across the card; springs smooth the motion.
  const px = useMotionValue(0.5);
  const py = useMotionValue(0.5);
  const sx = useSpring(px, { stiffness: 220, damping: 20 });
  const sy = useSpring(py, { stiffness: 220, damping: 20 });
  const rotateY = useTransform(sx, [0, 1], [-16, 16]);
  const rotateX = useTransform(sy, [0, 1], [14, -14]);
  const gx = useTransform(sx, (v) => `${v * 100}%`);
  const gy = useTransform(sy, (v) => `${v * 100}%`);
  const holoPos = useTransform(sx, (v) => `${v * 100}% ${50 + (v - 0.5) * 40}%`);
  const glare = useMotionTemplate`radial-gradient(circle at ${gx} ${gy}, rgba(255,255,255,0.55), rgba(255,255,255,0.08) 35%, transparent 60%)`;

  function onMove(e: PointerEvent<HTMLDivElement>) {
    if (!tilt) return;
    const r = e.currentTarget.getBoundingClientRect();
    px.set((e.clientX - r.left) / r.width);
    py.set((e.clientY - r.top) / r.height);
  }
  function onLeave() {
    px.set(0.5);
    py.set(0.5);
  }

  if (locked) {
    return (
      <div className={cn("relative overflow-hidden rounded-2xl border border-white/10 bg-ink-900/60 p-[3px]", sm ? "w-32" : "w-44")}>
        <div className="relative grid aspect-[5/7] place-items-center rounded-[13px] bg-[radial-gradient(circle,rgba(255,255,255,0.05),transparent_70%)]">
          <span className={cn("select-none opacity-40", sm ? "text-5xl" : "text-7xl")} style={{ filter: "brightness(0) invert(0.25)" }}>
            {card.glyph}
          </span>
          <span className="absolute bottom-2 inset-x-0 text-center text-[10px] font-semibold uppercase tracking-wider text-ice-200/30">
            ??? · {SYMBOL[card.rarity]}
          </span>
        </div>
      </div>
    );
  }

  if (!revealed) return <CardBack sm={sm} tell={tell} />;

  return (
    <motion.div
      initial={{ rotateY: 180, opacity: 0, scale: dramatic ? 0.85 : 1 }}
      animate={{ rotateY: 0, opacity: 1, scale: 1 }}
      transition={{ type: "spring", stiffness: dramatic ? 110 : 200, damping: dramatic ? 16 : 18 }}
      className={cn("relative", sm ? "w-32" : "w-44")}
      style={{ perspective: 900 }}
    >
      {showEffects && (card.rarity === "rare" || holo) && <SparkleBurst />}
      <motion.div
        onPointerMove={onMove}
        onPointerLeave={onLeave}
        style={{ rotateX: tilt ? rotateX : 0, rotateY: tilt ? rotateY : 0, transformStyle: "preserve-3d", background: FRAME[card.rarity] }}
        className={cn(
          "relative overflow-hidden rounded-2xl p-[3px] shadow-[0_10px_30px_-8px_rgba(0,0,0,0.7)]",
          card.rarity === "secrete" && "animate-hue",
          (card.rarity === "ultraRare" || card.rarity === "secrete") && "shadow-glow-gold"
        )}
      >
        <div className="relative flex flex-col overflow-hidden rounded-[13px] bg-gradient-to-b from-ink-800 to-ink-950">
          {/* name bar */}
          <div className={cn("relative z-10 flex min-w-0 items-center gap-1 px-2 pt-1.5", fullArt && "absolute inset-x-0 top-0 bg-gradient-to-b from-black/80 to-transparent pb-4")}>
            {isNew && <span className="shrink-0 rounded-full bg-electric-500 px-1.5 py-0.5 text-[8px] font-black text-white">NEW</span>}
            <span className={cn("min-w-0 flex-1 truncate font-display font-bold text-white", sm ? "text-[10px]" : "text-xs")}>{card.name}</span>
            <span className={cn("shrink-0 font-display font-black text-red-400", sm ? "text-[9px]" : "text-[11px]")}>
              <span className="text-[8px] font-bold text-red-300/80">PV</span>
              {card.hp}
            </span>
          </div>

          {/* art window */}
          <div
            className={cn(
              "relative mx-1.5 mt-1 grid place-items-center overflow-hidden bg-gradient-to-br",
              accent,
              fullArt ? "mx-0 mt-0 aspect-[5/7] rounded-none" : "aspect-[4/3] rounded-md border border-black/40 shadow-[inset_0_0_14px_rgba(0,0,0,0.5)]"
            )}
          >
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_35%,rgba(255,255,255,0.35),transparent_60%)]" />
            <span
              className={cn(
                "relative select-none drop-shadow-[0_6px_10px_rgba(0,0,0,0.5)]",
                sm ? (fullArt ? "text-6xl" : "text-4xl") : fullArt ? "text-8xl" : "text-6xl",
                foil && "drop-shadow-[0_0_12px_rgba(246,191,75,0.9)]"
              )}
            >
              {card.glyph}
            </span>
          </div>

          {/* attack + footer */}
          <div className={cn("relative z-10 flex flex-col gap-1 px-2 pb-1.5 pt-1.5", fullArt && "absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/90 via-black/60 to-transparent pt-8")}>
            <div className="flex items-center justify-between gap-1 border-t border-white/10 pt-1">
              <span className={cn("truncate text-ice-200/85", sm ? "text-[9px]" : "text-[11px]")}>⚔️ {card.attackName}</span>
              <span className={cn("shrink-0 font-display font-black text-white", sm ? "text-[10px]" : "text-sm")}>{card.attackDamage}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className={cn("font-bold tracking-wider text-ice-200/60", sm ? "text-[8px]" : "text-[9px]")}>
                {SYMBOL[card.rarity]} · {RARITY_LABEL[card.rarity]}
              </span>
              {value !== undefined && (
                <span className={cn("font-display font-bold text-gold-400", sm ? "text-[9px]" : "text-[11px]")}>
                  {formatCredits(value)}
                  {foil && " ✦"}
                </span>
              )}
            </div>
          </div>
        </div>

        {/* holo foil: rainbow bands that slide with the tilt, blended over the whole card */}
        {holo && (
          <motion.div
            className="pointer-events-none absolute inset-0 rounded-2xl mix-blend-color-dodge"
            style={{
              opacity: fullArt ? 0.22 : foil ? 0.45 : 0.32,
              backgroundImage:
                "repeating-linear-gradient(110deg, #ff6ad5 0%, #ffd77a 7%, #7ff0c3 14%, #5fb8ff 21%, #c774ff 28%, #ff6ad5 35%)",
              backgroundSize: "300% 300%",
              backgroundPosition: holoPos,
            }}
          />
        )}
        {sparkleTex && (
          <div
            className="pointer-events-none absolute inset-0 rounded-2xl opacity-30 mix-blend-overlay"
            style={{
              backgroundImage:
                "radial-gradient(circle at 20% 30%, #fff 0.8px, transparent 1.4px), radial-gradient(circle at 70% 60%, #fff 0.8px, transparent 1.4px), radial-gradient(circle at 40% 80%, #fff 0.6px, transparent 1.2px)",
              backgroundSize: "18px 18px, 23px 23px, 13px 13px",
            }}
          />
        )}
        {/* glare follows the pointer */}
        {tilt && <motion.div className="pointer-events-none absolute inset-0 rounded-2xl mix-blend-overlay" style={{ backgroundImage: glare }} />}
        {/* idle sweep so holos still shimmer on touch screens / when not hovered */}
        {holo && (
          <div
            className="pointer-events-none absolute inset-0 animate-shimmer rounded-2xl opacity-40"
            style={{
              backgroundImage: "linear-gradient(115deg, transparent 35%, rgba(255,255,255,0.5) 48%, transparent 60%)",
              backgroundSize: "250% 250%",
            }}
          />
        )}
      </motion.div>
    </motion.div>
  );
}
