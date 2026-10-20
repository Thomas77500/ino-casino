import { useState } from "react";
import { useGameStatusStore } from "../store/gameStatusStore";
import { useCasinoStore } from "../store/casinoStore";
import { GameTile } from "../components/games/GameTile";
import { IconGamepad } from "../components/icons";
import { GAMES, type AppTab } from "../lib/navigation";
import { cn } from "../lib/format";

const CLASSICS: AppTab[] = ["slots", "blackjack", "roulette", "plinko", "crash", "scratch"];
const FILTERS = [
  { id: "all", label: "Tous" },
  { id: "classics", label: "Classiques" },
  { id: "arcade", label: "Arcade" },
  { id: "secret", label: "Secrets" },
] as const;
type Filter = (typeof FILTERS)[number]["id"];

export function Games({ onNavigate }: { onNavigate: (t: AppTab) => void }) {
  const statuses = useGameStatusStore((s) => s.statuses);
  const totalWon = useCasinoStore((s) => s.totalWon);
  const [filter, setFilter] = useState<Filter>("all");

  const shown = GAMES.filter((g) =>
    filter === "all"
      ? true
      : filter === "classics"
        ? CLASSICS.includes(g.id)
        : filter === "secret"
          ? g.tag === "Secret"
          : !CLASSICS.includes(g.id) && g.tag !== "Secret"
  );

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
      <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div className="flex items-center gap-2">
          <IconGamepad className="h-6 w-6 text-electric-400" />
          <div>
            <h1 className="font-display text-2xl font-bold text-white sm:text-3xl">Jeux</h1>
            <p className="text-sm text-ice-200/60">{GAMES.length} jeux — des classiques du casino aux arcs secrets.</p>
          </div>
        </div>
        <div className="flex gap-1 rounded-xl border border-white/10 bg-white/[0.03] p-1">
          {FILTERS.map((f) => (
            <button
              key={f.id}
              onClick={() => setFilter(f.id)}
              className={cn(
                "rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors",
                filter === f.id ? "bg-electric-500 text-white shadow-glow" : "text-ice-200/60 hover:text-white"
              )}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {shown.map((g, i) => (
          <GameTile
            key={`${filter}-${g.id}`}
            game={g}
            index={i}
            totalWon={totalWon}
            maintenance={statuses[g.id] && !statuses[g.id].enabled}
            onPlay={() => onNavigate(g.id)}
          />
        ))}
      </div>
    </div>
  );
}
