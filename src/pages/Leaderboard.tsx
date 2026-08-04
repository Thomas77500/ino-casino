import { useMemo, useState } from "react";
import { useCasinoStore } from "../store/casinoStore";
import { useTcgStore } from "../store/tcgStore";
import { Card } from "../components/ui/Card";
import { Badge } from "../components/ui/Badge";
import { IconTrophy } from "../components/icons";
import { formatCredits, cn } from "../lib/format";
import { displayLevel } from "../lib/levelTitles";

const FAKE_PLAYERS = [
  { name: "Nova_Lyra", level: 34, won: 182400, duelWins: 41 },
  { name: "BlueFrost", level: 29, won: 145200, duelWins: 33 },
  { name: "KaelDrift", level: 27, won: 128900, duelWins: 27 },
  { name: "IcicleQueen", level: 22, won: 94500, duelWins: 19 },
  { name: "VoltRunner", level: 19, won: 71200, duelWins: 14 },
  { name: "Zephyr9", level: 15, won: 48300, duelWins: 9 },
  { name: "Mira.exe", level: 12, won: 31500, duelWins: 5 },
  { name: "LuckyPanda", level: 9, won: 18700, duelWins: 2 },
];

type SortKey = "won" | "duelWins";

export function Leaderboard() {
  const totalWon = useCasinoStore((s) => s.totalWon);
  const level = useCasinoStore((s) => s.level);
  const duelWins = useTcgStore((s) => s.duelWins);
  const [sortKey, setSortKey] = useState<SortKey>("won");

  const ranked = useMemo(() => {
    const rows = [...FAKE_PLAYERS.map((p) => ({ ...p, isUser: false })), { name: "Toi", level, won: totalWon, duelWins, isUser: true }];
    return rows.sort((a, b) => b[sortKey] - a[sortKey]);
  }, [totalWon, level, duelWins, sortKey]);

  return (
    <div className="mx-auto max-w-3xl px-4 py-8 sm:px-6">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-2">
          <IconTrophy className="h-6 w-6 text-gold-400" />
          <div>
            <h1 className="font-display text-2xl font-bold text-white sm:text-3xl">Classement</h1>
            <p className="text-sm text-ice-200/60">Remis à zéro chaque saison fictive.</p>
          </div>
        </div>
        <div className="flex items-center gap-1 rounded-xl border border-white/10 bg-white/[0.03] p-1">
          <button onClick={() => setSortKey("won")} className={cn("rounded-lg px-3 py-1.5 text-xs font-semibold", sortKey === "won" ? "bg-electric-500 text-white" : "text-ice-200/60")}>
            Crédits gagnés
          </button>
          <button onClick={() => setSortKey("duelWins")} className={cn("rounded-lg px-3 py-1.5 text-xs font-semibold", sortKey === "duelWins" ? "bg-electric-500 text-white" : "text-ice-200/60")}>
            Duels gagnés
          </button>
        </div>
      </div>

      <Card className="overflow-hidden">
        <ul className="divide-y divide-white/5">
          {ranked.map((p, i) => (
            <li
              key={p.name}
              className={cn(
                "flex items-center gap-4 px-5 py-3.5",
                p.isUser && "bg-electric-500/10"
              )}
            >
              <span
                className={cn(
                  "grid h-8 w-8 shrink-0 place-items-center rounded-full font-display text-sm font-bold",
                  i === 0 ? "bg-gold-400 text-ink-950" : i === 1 ? "bg-ice-100 text-ink-950" : i === 2 ? "bg-electric-600 text-white" : "bg-white/10 text-ice-200/70"
                )}
              >
                {i + 1}
              </span>
              <div className="flex-1">
                <p className={cn("text-sm font-semibold", p.isUser ? "text-white" : "text-ice-200/90")}>{p.name}</p>
                <p className="text-xs text-ice-200/40">Niveau {displayLevel(p.level)} · 🏆 {p.duelWins} duels</p>
              </div>
              {p.isUser && <Badge tone="electric">Toi</Badge>}
              <span className="font-display text-sm font-bold text-gold-400">{sortKey === "won" ? formatCredits(p.won) : `${p.duelWins} 🏆`}</span>
            </li>
          ))}
        </ul>
      </Card>
    </div>
  );
}
