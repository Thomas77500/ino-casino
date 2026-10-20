import { motion } from "framer-motion";
import { Badge } from "../ui/Badge";
import { cn, formatCredits } from "../../lib/format";
import { UNLOCKS } from "../../lib/unlocks";
import type { GAMES } from "../../lib/navigation";

type Game = (typeof GAMES)[number];

// Cover art per game: background gradient, hero glyph, two floating props. The roulette gets a
// real spinning mini-wheel instead of an emoji.
const ART: Record<string, { bg: string; glyph: string; props: [string, string] }> = {
  slots: { bg: "from-fuchsia-600 via-purple-700 to-indigo-900", glyph: "🎰", props: ["🍒", "7️⃣"] },
  blackjack: { bg: "from-emerald-600 via-emerald-800 to-emerald-950", glyph: "🃏", props: ["♠️", "♥️"] },
  roulette: { bg: "from-red-700 via-rose-900 to-black", glyph: "", props: ["🎲", "💰"] },
  chickenroad: { bg: "from-amber-400 via-orange-600 to-red-800", glyph: "🐔", props: ["🚗", "🌾"] },
  plinko: { bg: "from-pink-500 via-rose-600 to-purple-900", glyph: "🔮", props: ["✨", "💎"] },
  crash: { bg: "from-sky-500 via-indigo-700 to-slate-950", glyph: "🚀", props: ["⭐", "💥"] },
  scratch: { bg: "from-teal-400 via-cyan-700 to-slate-900", glyph: "🎟️", props: ["🍀", "💰"] },
  braquage: { bg: "from-zinc-500 via-slate-800 to-black", glyph: "💰", props: ["🔐", "💎"] },
  laundering: { bg: "from-lime-500 via-green-700 to-emerald-950", glyph: "💸", props: ["🫧", "🧼"] },
  boosters: { bg: "from-violet-500 via-fuchsia-700 to-indigo-950", glyph: "🎴", props: ["🦄", "🐉"] },
  cases: { bg: "from-orange-500 via-red-700 to-zinc-950", glyph: "📦", props: ["💎", "⭐"] },
  bourse: { bg: "from-emerald-400 via-teal-700 to-slate-950", glyph: "📈", props: ["🐂", "💹"] },
  ministry: { bg: "from-blue-500 via-indigo-800 to-slate-950", glyph: "🏛️", props: ["📜", "🎖️"] },
  club: { bg: "from-green-500 via-emerald-800 to-black", glyph: "⚽", props: ["🏆", "🧤"] },
  blackmarket: { bg: "from-red-900 via-zinc-900 to-black", glyph: "🕶️", props: ["💼", "🔒"] },
  darktable: { bg: "from-red-700 via-red-950 to-black", glyph: "🎲", props: ["🃏", "🥃"] },
  sect: { bg: "from-purple-600 via-violet-950 to-black", glyph: "👁️", props: ["🕯️", "🔮"] },
  startup: { bg: "from-pink-400 via-fuchsia-600 to-cyan-700", glyph: "🦄", props: ["💸", "📊"] },
  bookmaker: { bg: "from-amber-500 via-stone-700 to-stone-950", glyph: "🎫", props: ["⚽", "📒"] },
  mafia: { bg: "from-stone-600 via-red-950 to-black", glyph: "🎩", props: ["🌹", "🍝"] },
  area51: { bg: "from-lime-400 via-emerald-900 to-black", glyph: "🛸", props: ["👽", "📡"] },
};

function MiniRoulette() {
  return (
    <div className="relative h-24 w-24 sm:h-28 sm:w-28">
      <div
        className="absolute inset-0 animate-[spin_6s_linear_infinite] rounded-full border-4 border-amber-500 shadow-[0_8px_24px_rgba(0,0,0,0.6)]"
        style={{ background: "repeating-conic-gradient(#b91c1c 0deg 9.73deg, #111827 9.73deg 19.46deg)" }}
      >
        <div className="absolute inset-[30%] rounded-full border-2 border-amber-400 bg-gradient-to-br from-amber-300 to-amber-700" />
      </div>
      <div className="absolute left-1/2 top-2 h-2.5 w-2.5 -translate-x-1/2 rounded-full bg-white shadow-[0_0_6px_white]" />
    </div>
  );
}

export function GameTile({
  game,
  totalWon,
  maintenance,
  index = 0,
  onPlay,
}: {
  game: Game;
  totalWon: number;
  maintenance?: boolean;
  index?: number;
  onPlay: () => void;
}) {
  const art = ART[game.id] ?? { bg: "from-electric-500 to-ink-900", glyph: "🎮", props: ["✨", "⭐"] };
  const unlockAt = (UNLOCKS as Record<string, number>)[game.id];
  const locked = unlockAt !== undefined && totalWon < unlockAt;

  return (
    <motion.button
      onClick={onPlay}
      initial={{ opacity: 0, y: 24 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.45, delay: Math.min(index, 12) * 0.04 }}
      whileHover={{ y: -6 }}
      className="group relative flex h-full flex-col overflow-hidden rounded-2xl border border-white/10 bg-ink-900/80 text-left shadow-[0_10px_30px_-12px_rgba(0,0,0,0.8)] transition-shadow hover:border-white/25 hover:shadow-glow"
    >
      {/* cover */}
      <div className={cn("relative grid aspect-[16/9] place-items-center overflow-hidden bg-gradient-to-br", art.bg)}>
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_40%,rgba(255,255,255,0.28),transparent_60%)]" />
        <div className="absolute inset-0 opacity-25 [background-image:radial-gradient(rgba(255,255,255,0.5)_1px,transparent_1px)] [background-size:14px_14px]" />
        <span className="absolute left-[12%] top-[18%] text-2xl opacity-80 drop-shadow-lg transition-transform duration-500 group-hover:-translate-y-1 group-hover:-rotate-12 animate-float">
          {art.props[0]}
        </span>
        <span className="absolute bottom-[14%] right-[12%] text-2xl opacity-80 drop-shadow-lg transition-transform duration-500 group-hover:translate-y-1 group-hover:rotate-12 animate-float [animation-delay:-2.5s]">
          {art.props[1]}
        </span>
        <div className={cn("relative transition-transform duration-500 group-hover:scale-110", locked && "blur-[2px] grayscale")}>
          {game.id === "roulette" ? (
            <MiniRoulette />
          ) : (
            <span className="block text-6xl drop-shadow-[0_10px_18px_rgba(0,0,0,0.55)] sm:text-7xl">{art.glyph}</span>
          )}
        </div>
        {/* sheen sweep on hover */}
        <div className="pointer-events-none absolute inset-0 -translate-x-full bg-[linear-gradient(110deg,transparent_30%,rgba(255,255,255,0.35)_50%,transparent_70%)] transition-transform duration-700 group-hover:translate-x-full" />
        <div className="absolute inset-x-0 bottom-0 h-1/3 bg-gradient-to-t from-ink-900/90 to-transparent" />

        <div className="absolute right-3 top-3">
          {maintenance ? <Badge tone="danger">Maintenance</Badge> : locked ? <Badge tone="neutral">🔒 Secret</Badge> : <Badge tone="gold">{game.tag}</Badge>}
        </div>

        {locked && (
          <div className="absolute inset-x-4 bottom-3">
            <div className="h-1.5 overflow-hidden rounded-full bg-black/50">
              <div className="h-full rounded-full bg-gradient-to-r from-gold-500 to-gold-400" style={{ width: `${Math.min(100, (totalWon / unlockAt!) * 100)}%` }} />
            </div>
            <p className="mt-1 text-[10px] font-semibold text-white/80">
              {formatCredits(totalWon)} / {formatCredits(unlockAt!)} gagnés
            </p>
          </div>
        )}
      </div>

      {/* body */}
      <div className="flex flex-1 flex-col p-4">
        <div className="flex items-center gap-2">
          <game.icon className="h-4 w-4 shrink-0 text-electric-400" />
          <h3 className="font-display text-base font-bold text-white">{game.label}</h3>
        </div>
        <p className="mt-1 flex-1 text-xs leading-relaxed text-ice-200/60">{game.blurb}</p>
        <span className="mt-3 inline-flex items-center gap-1 text-xs font-bold uppercase tracking-wider text-gold-400 transition-all group-hover:gap-2">
          {locked ? "Voir les conditions" : "Jouer"} <span aria-hidden>→</span>
        </span>
      </div>
    </motion.button>
  );
}

// Shown instead of a secret game until its total-won threshold is reached: the game's cover art
// sealed behind a vault door, with the progress toward opening it.
export function LockedGame({ gameId, title, totalWon, unlockAt }: { gameId: string; title: string; totalWon: number; unlockAt: number }) {
  const art = ART[gameId] ?? { bg: "from-electric-500 to-ink-900", glyph: "🎮", props: ["✨", "⭐"] };
  const pct = Math.min(100, (totalWon / unlockAt) * 100);
  return (
    <div className="mx-auto max-w-lg px-4 py-12 text-center">
      <div className={cn("relative mx-auto grid aspect-[16/10] place-items-center overflow-hidden rounded-3xl border border-white/10 bg-gradient-to-br shadow-[0_20px_50px_-15px_rgba(0,0,0,0.9)]", art.bg)}>
        <span className="text-8xl opacity-60 blur-[3px] grayscale-[60%]">{art.glyph || "🎡"}</span>
        <div className="absolute inset-0 bg-black/45" />
        {/* vault door */}
        <motion.div
          className="absolute grid h-36 w-36 place-items-center rounded-full border-[6px] border-zinc-400 bg-[radial-gradient(circle_at_35%_30%,#71717a,#27272a_70%)] shadow-[0_0_0_4px_rgba(0,0,0,0.5),0_15px_30px_rgba(0,0,0,0.7)]"
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ type: "spring", stiffness: 180, damping: 16 }}
        >
          {Array.from({ length: 8 }, (_, i) => (
            <span key={i} className="absolute h-3 w-3 rounded-full bg-zinc-300 shadow-inner" style={{ transform: `rotate(${i * 45}deg) translateY(-58px)` }} />
          ))}
          <motion.div
            className="relative h-16 w-16 rounded-full border-4 border-zinc-300 bg-zinc-700"
            animate={{ rotate: [0, 90, 60, 160, 0] }}
            transition={{ duration: 6, repeat: Infinity, ease: "easeInOut" }}
          >
            {[0, 90, 180, 270].map((a) => (
              <span key={a} className="absolute left-1/2 top-1/2 h-1.5 w-9 -translate-y-1/2 origin-left rounded bg-zinc-300" style={{ transform: `rotate(${a}deg)` }} />
            ))}
          </motion.div>
          <span className="absolute -bottom-3 rounded-full border border-gold-400/50 bg-black/80 px-2 py-0.5 text-[10px] font-black tracking-widest text-gold-300">🔒 SECRET</span>
        </motion.div>
      </div>
      <h1 className="mt-8 font-display text-2xl font-bold text-white">{title}</h1>
      <p className="mt-2 text-sm text-ice-200/60">Ce coffre s'ouvre quand tu as gagné {formatCredits(unlockAt)} crédits au total.</p>
      <div className="mt-5 rounded-2xl border border-white/10 bg-white/[0.04] p-4">
        <div className="mb-2 flex justify-between text-xs">
          <span className="text-ice-200/60">{formatCredits(totalWon)}</span>
          <span className="font-bold text-gold-400">{Math.floor(pct)}%</span>
          <span className="text-ice-200/60">{formatCredits(unlockAt)}</span>
        </div>
        <div className="h-3 overflow-hidden rounded-full bg-black/40">
          <motion.div
            className="h-full rounded-full bg-gradient-to-r from-gold-500 via-gold-400 to-[#fff1c1] shadow-glow-gold"
            initial={{ width: 0 }}
            animate={{ width: `${pct}%` }}
            transition={{ duration: 1, ease: "easeOut" }}
          />
        </div>
        <p className="mt-2 text-[11px] text-ice-200/40">Encore {formatCredits(Math.max(0, unlockAt - totalWon))} crédits à gagner.</p>
      </div>
    </div>
  );
}
