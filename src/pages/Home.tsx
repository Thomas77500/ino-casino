import { motion } from "framer-motion";
import { useCasinoStore } from "../store/casinoStore";
import { useJackpotStore } from "../store/jackpotStore";
import { useGameStatusStore } from "../store/gameStatusStore";
import { Card } from "../components/ui/Card";
import { Button } from "../components/ui/Button";
import { Badge } from "../components/ui/Badge";
import { ProgressBar } from "../components/ui/ProgressBar";
import { AnimatedNumber } from "../components/ui/AnimatedNumber";
import { LiveWinsFeed } from "../components/home/LiveWinsFeed";
import { GameTile } from "../components/games/GameTile";
import { formatCredits, cn } from "../lib/format";
import { displayLevel } from "../lib/levelTitles";
import { GAMES, type AppTab } from "../lib/navigation";

const FEATURED_GAMES = GAMES.slice(0, 6);

// History stores display names ("ScratchCards", "Roulette"…) — map them back to their tab.
const HISTORY_TAB: Record<string, AppTab> = { ScratchCards: "scratch", ChickenRoad: "chickenroad", Pmu: "pmu" };
const historyTab = (game: string) => HISTORY_TAB[game] ?? (game.toLowerCase() as AppTab);

// Decorative props drifting in the hero — positions/timings fixed so they never re-randomize.
const HERO_PROPS = [
  { glyph: "🪙", x: "8%", y: "22%", size: "text-4xl", dur: 7, rot: 20 },
  { glyph: "🃏", x: "86%", y: "18%", size: "text-5xl", dur: 9, rot: -15 },
  { glyph: "🎲", x: "14%", y: "70%", size: "text-4xl", dur: 8, rot: 30 },
  { glyph: "💎", x: "80%", y: "68%", size: "text-4xl", dur: 10, rot: -25 },
  { glyph: "🪙", x: "70%", y: "38%", size: "text-2xl", dur: 6, rot: 40 },
  { glyph: "♠️", x: "24%", y: "40%", size: "text-2xl", dur: 11, rot: -30 },
  { glyph: "🍒", x: "92%", y: "45%", size: "text-2xl", dur: 7.5, rot: 25 },
  { glyph: "7️⃣", x: "4%", y: "48%", size: "text-2xl", dur: 9.5, rot: -20 },
];

export function Home({ onNavigate }: { onNavigate: (t: AppTab) => void }) {
  const credits = useCasinoStore((s) => s.credits);
  const level = useCasinoStore((s) => s.level);
  const missions = useCasinoStore((s) => s.missions);
  const history = useCasinoStore((s) => s.history);
  const totalWon = useCasinoStore((s) => s.totalWon);
  const jackpot = useJackpotStore((s) => s.pot);
  const statuses = useGameStatusStore((s) => s.statuses);

  const previewMissions = missions.filter((m) => !m.claimed).slice(0, 2);
  const recentTabs = Array.from(new Set(history.map((h) => historyTab(h.game))))
    .map((id) => GAMES.find((g) => g.id === id))
    .filter((g): g is (typeof GAMES)[number] => !!g)
    .slice(0, 4);

  return (
    <div>
      <section className="relative overflow-hidden border-b border-white/5">
        <div className="pointer-events-none absolute inset-0">
          <div className="absolute -top-40 left-1/2 h-[520px] w-[960px] -translate-x-1/2 rounded-full bg-electric-500/25 blur-3xl animate-pulse-glow" />
          <div className="absolute right-10 top-20 h-64 w-64 rounded-full bg-gold-500/15 blur-3xl animate-float" />
          <div className="absolute bottom-0 left-10 h-56 w-56 rounded-full bg-fuchsia-500/10 blur-3xl animate-float [animation-delay:-2s]" />
          {HERO_PROPS.map((p, i) => (
            <motion.span
              key={i}
              className={cn("absolute select-none opacity-30 drop-shadow-[0_10px_20px_rgba(0,0,0,0.6)] sm:opacity-60", p.size, i > 3 && "hidden sm:block")}
              style={{ left: p.x, top: p.y }}
              animate={{ y: [0, -18, 0], rotate: [0, p.rot, 0] }}
              transition={{ duration: p.dur, repeat: Infinity, ease: "easeInOut" }}
            >
              {p.glyph}
            </motion.span>
          ))}
        </div>

        <div className="relative mx-auto max-w-6xl px-4 py-16 text-center sm:px-6 sm:py-24">
          <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6 }}>
            <Badge tone="gold" className="mb-5">100% crédits virtuels — aucun argent réel</Badge>
            <h1 className="font-display text-4xl font-black tracking-tight text-white sm:text-7xl">
              Bienvenue sur{" "}
              <span className="bg-[linear-gradient(110deg,#5fb8ff,#f3f8ff_40%,#ffd77a_60%,#5fb8ff)] bg-[length:200%_auto] bg-clip-text text-transparent animate-shimmer">
                Ino Casino
              </span>
            </h1>
            <p className="mx-auto mt-4 max-w-xl text-sm text-ice-200/70 sm:text-lg">
              {GAMES.length} jeux, des tables classiques aux arcs secrets les plus barrés — avec des crédits 100% virtuels.
            </p>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.15 }}
            className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row"
          >
            <Button size="lg" onClick={() => onNavigate("games")}>Explorer les jeux</Button>
            <Button size="lg" variant="gold" onClick={() => onNavigate("bonus")}>🎁 Bonus du jour</Button>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.6, delay: 0.3 }}
            className="glass relative mx-auto mt-12 grid max-w-lg grid-cols-3 items-center rounded-2xl border border-white/10 bg-white/[0.04] p-5 backdrop-blur-xl"
          >
            <div>
              <p className="text-[11px] uppercase tracking-wide text-ice-200/50">Tes crédits</p>
              <AnimatedNumber value={credits} className="font-display text-xl font-bold text-gold-400 sm:text-2xl" />
            </div>
            <div className="border-x border-white/10">
              <p className="text-[11px] uppercase tracking-wide text-ice-200/50">Niveau</p>
              <p className="font-display text-xl font-bold text-white sm:text-2xl">{displayLevel(level)}</p>
            </div>
            <div>
              <p className="text-[11px] uppercase tracking-wide text-ice-200/50">Gagné au total</p>
              <p className="font-display text-xl font-bold text-emerald-300 sm:text-2xl">{formatCredits(totalWon)}</p>
            </div>
          </motion.div>
        </div>
      </section>

      {recentTabs.length > 0 && (
        <section className="mx-auto max-w-6xl px-4 pt-10 sm:px-6">
          <h2 className="mb-3 text-xs font-bold uppercase tracking-[0.2em] text-ice-200/50">Reprendre</h2>
          <div className="flex gap-2 overflow-x-auto pb-1">
            {recentTabs.map((g) => (
              <button
                key={g.id}
                onClick={() => onNavigate(g.id)}
                className="flex shrink-0 items-center gap-2 rounded-full border border-white/10 bg-white/[0.04] px-4 py-2 text-sm font-semibold text-white transition-colors hover:border-electric-400/50 hover:bg-electric-500/10"
              >
                <g.icon className="h-4 w-4 text-electric-400" />
                {g.label}
              </button>
            ))}
          </div>
        </section>
      )}

      <section className="mx-auto max-w-6xl px-4 py-10 sm:px-6">
        <div className="mb-6 flex items-center justify-between">
          <h2 className="font-display text-xl font-bold text-white sm:text-2xl">Jeux à la une</h2>
          <Button size="sm" variant="ghost" onClick={() => onNavigate("games")}>Voir les {GAMES.length} jeux →</Button>
        </div>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {FEATURED_GAMES.map((g, i) => (
            <GameTile key={g.id} game={g} index={i} totalWon={totalWon} maintenance={statuses[g.id] && !statuses[g.id].enabled} onPlay={() => onNavigate(g.id)} />
          ))}
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 pb-12 sm:px-6">
        <div className="grid gap-6 lg:grid-cols-[1.3fr_1fr]">
          <Card className="relative overflow-hidden p-6 sm:p-8" glow>
            <div className="pointer-events-none absolute -right-10 -top-10 h-48 w-48 rounded-full bg-gold-500/25 blur-3xl animate-pulse-glow" />
            <div className="pointer-events-none absolute -bottom-16 -left-10 h-40 w-40 rounded-full bg-electric-500/20 blur-3xl" />
            <div className="relative flex items-center gap-2">
              <span className="relative flex h-2.5 w-2.5">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-gold-400 opacity-75" />
                <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-gold-400" />
              </span>
              <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-gold-300/80">Jackpot progressif partagé</p>
            </div>
            {/* vault counter: each digit in its own lit cell */}
            <div className="relative mt-4 flex flex-wrap gap-1">
              {formatCredits(jackpot)
                .split("")
                .map((ch, i) =>
                  /\d/.test(ch) ? (
                    <motion.span
                      key={`${i}-${ch}`}
                      initial={{ y: -10, opacity: 0 }}
                      animate={{ y: 0, opacity: 1 }}
                      className="grid h-14 w-10 place-items-center rounded-lg border border-gold-400/30 bg-gradient-to-b from-ink-800 to-black font-display text-3xl font-black text-gold-400 shadow-[inset_0_-8px_16px_rgba(0,0,0,0.6),0_0_18px_-6px_rgba(246,191,75,0.6)] sm:h-16 sm:w-12 sm:text-4xl"
                    >
                      {ch}
                    </motion.span>
                  ) : (
                    <span key={i} className="w-1" />
                  )
                )}
            </div>
            <p className="relative mt-4 text-xs text-ice-200/50">Alimenté par les mises de tous les joueurs — décroché au hasard, remis à 1 000 à chaque tirage.</p>
          </Card>
          <LiveWinsFeed />
        </div>
      </section>

      {previewMissions.length > 0 && (
        <section className="mx-auto max-w-6xl px-4 pb-16 sm:px-6">
          <Card className="p-6">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="font-display text-lg font-bold text-white">Missions en cours</h2>
              <Button size="sm" variant="ghost" onClick={() => onNavigate("rewards")}>Voir tout →</Button>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              {previewMissions.map((m) => (
                <div key={m.id} className="rounded-xl border border-white/10 bg-white/[0.03] p-4">
                  <div className="mb-2 flex items-center justify-between text-sm">
                    <span className="font-medium text-white">{m.title}</span>
                    <span className="text-xs text-ice-200/50">{Math.min(m.progress, m.target)}/{m.target}</span>
                  </div>
                  <ProgressBar value={m.progress} max={m.target} />
                  <p className="mt-2 text-xs text-gold-400">Récompense : {formatCredits(m.reward)} crédits</p>
                </div>
              ))}
            </div>
          </Card>
        </section>
      )}
    </div>
  );
}
