import { useMemo } from "react";
import { motion } from "framer-motion";
import { HoloSweep } from "./HoloSweep";
import { Badge } from "./Badge";
import { cn, formatCredits } from "../../lib/format";
import { RARITY_LABEL, RARITY_STYLE, type TcgCard } from "../../lib/tcgCards";

function SparkleBurst() {
  const sparks = useMemo(() => Array.from({ length: 8 }, (_, i) => ({ angle: (360 / 8) * i, dist: 30 + Math.random() * 20 })), []);
  return (
    <div className="pointer-events-none absolute inset-0 grid place-items-center">
      {sparks.map((s, i) => (
        <motion.span
          key={i}
          className="absolute h-1 w-1 rounded-full bg-electric-300"
          initial={{ x: 0, y: 0, opacity: 1 }}
          animate={{ x: Math.cos((s.angle * Math.PI) / 180) * s.dist, y: Math.sin((s.angle * Math.PI) / 180) * s.dist, opacity: 0 }}
          transition={{ duration: 0.6, ease: "easeOut" }}
        />
      ))}
    </div>
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
}) {
  const style = RARITY_STYLE[card.rarity];
  const isHolo = card.rarity === "rareHolo" || card.rarity === "ultraRare";
  const isRare = card.rarity === "rare";
  // The two rarest tiers get a "full art" treatment — illustration bleeds edge to edge, text
  // floats over gradient-faded bands instead of sitting in solid header/footer blocks.
  const fullArt = card.rarity === "ultraRare" || card.rarity === "secrete";
  const sm = size === "sm";
  const glyphSize = sm ? "text-3xl" : fullArt ? "text-8xl" : "text-6xl";

  if (locked) {
    return (
      <div className={cn("flex flex-col overflow-hidden rounded-2xl border border-white/10 bg-white/[0.02] opacity-40", sm ? "w-32" : "w-44")}>
        <div className={cn("grid place-items-center bg-white/5 text-3xl text-white/20", sm ? "aspect-square" : "aspect-[4/5]")}>?</div>
        <div className="p-2 text-center">
          <p className="text-xs font-semibold text-ice-200/50">Non obtenue</p>
          <p className="text-[10px] text-ice-200/30">{RARITY_LABEL[card.rarity]}</p>
        </div>
      </div>
    );
  }

  if (!revealed) {
    return (
      <div className={cn("grid place-items-center rounded-2xl border border-white/10 bg-gradient-to-br from-electric-600/40 to-electric-800/40", sm ? "aspect-square w-32" : "aspect-[4/5] w-44")}>
        <span className="text-2xl text-white/30">?</span>
      </div>
    );
  }

  const nameRow = (
    <div className={cn("flex min-w-0 items-center gap-1.5", fullArt ? "text-white" : "")}>
      {isNew && <span className="shrink-0 rounded-full bg-electric-500 px-1.5 py-0.5 text-[9px] font-bold text-white">NOUVEAU</span>}
      <span className={cn("min-w-0 flex-1 truncate font-semibold", sm ? "text-[10px]" : "text-xs")}>{card.name}</span>
      <span className="shrink-0 rounded-full bg-red-600/90 px-1.5 py-0.5 text-[10px] font-bold text-white">PV {card.hp}</span>
    </div>
  );

  const attackRow = (
    <div className="flex items-center justify-between">
      <span className={cn("truncate text-ice-200/80", sm ? "text-[10px]" : "text-xs")}>⚔️ {card.attackName}</span>
      <span className={cn("shrink-0 font-display font-bold text-gold-400", sm ? "text-[10px]" : "text-xs")}>{card.attackDamage}</span>
    </div>
  );

  const footerRow = (
    <div className="flex items-center justify-between">
      <Badge tone={card.rarity === "secrete" ? "gold" : "neutral"} className={cn(style.text, sm && "px-1.5 py-0.5 text-[9px]")}>
        {RARITY_LABEL[card.rarity]}
      </Badge>
      {value !== undefined && (
        <span className={cn("font-display font-bold text-gold-400", sm ? "text-[10px]" : "text-xs")}>
          {formatCredits(value)}{foil && " ✦"}
        </span>
      )}
    </div>
  );

  const artLayer = (
    <>
      {((showEffects && isHolo) || foil) && <HoloSweep />}
      {showEffects && isRare && <SparkleBurst />}
      <span className={cn("select-none drop-shadow", glyphSize, foil && "drop-shadow-[0_0_10px_rgba(246,191,75,0.8)]")}>{card.glyph}</span>
    </>
  );

  return (
    <motion.div
      initial={{ rotateY: 180, opacity: 0 }}
      animate={{ rotateY: 0, opacity: 1 }}
      transition={{ type: "spring", stiffness: dramatic ? 140 : 200, damping: dramatic ? 22 : 18 }}
      className={cn(
        "relative flex flex-col overflow-hidden rounded-2xl border-2 bg-ink-900/90 text-left",
        style.ring,
        style.glow && "shadow-glow-gold",
        sm ? "w-32" : "w-44"
      )}
    >
      {fullArt ? (
        <div className={cn("relative grid place-items-center bg-gradient-to-br", accent, sm ? "aspect-square" : "aspect-[4/5]")}>
          {artLayer}
          <div className="absolute inset-x-0 top-0 bg-gradient-to-b from-black/85 to-transparent px-2 pb-6 pt-1.5">{nameRow}</div>
          <div className="absolute inset-x-0 bottom-0 flex flex-col gap-1 bg-gradient-to-t from-black/90 via-black/50 to-transparent px-2 pb-1.5 pt-8">
            {attackRow}
            {footerRow}
          </div>
        </div>
      ) : (
        <>
          <div className={cn("border-b border-white/10 bg-ink-950/60 px-2 py-1.5", sm && "px-1.5 py-1")}>{nameRow}</div>
          <div className={cn("relative grid place-items-center bg-gradient-to-br", accent, sm ? "aspect-square" : "aspect-[4/5]")}>{artLayer}</div>
          <div className={cn("border-t border-white/10 bg-white/[0.03] px-2 py-1.5", sm && "px-1.5 py-1")}>{attackRow}</div>
          <div className={cn("px-2 py-1.5", sm && "px-1.5 py-1")}>{footerRow}</div>
        </>
      )}
    </motion.div>
  );
}
