import { useEffect, useState } from "react";
import { useAuthStore } from "../store/authStore";
import { supabase } from "../lib/supabase";
import { Card } from "../components/ui/Card";
import { Badge } from "../components/ui/Badge";
import { AvatarBubble } from "../components/ui/AvatarBubble";
import { PublicProfileModal } from "../components/ui/PublicProfileModal";
import { IconTrophy } from "../components/icons";
import { formatCredits, cn } from "../lib/format";
import { displayLevel } from "../lib/levelTitles";

interface RankedPlayer {
  id: string;
  name: string;
  avatar: string;
  frame: string | null;
  level: number;
  won: number;
}

async function fetchRanking(): Promise<RankedPlayer[]> {
  // frame/banned only exist after their respective migrations — fetched separately and
  // best-effort so the leaderboard still works on a project that hasn't applied them yet.
  const [{ data: base }, { data: framesData }, { data: bannedData }, { data: progressData }] = await Promise.all([
    supabase.from("profiles").select("id, username, avatar"),
    supabase.from("profiles").select("id, frame"),
    supabase.from("profiles").select("id, banned"),
    supabase.from("casino_progress").select("user_id, state"),
  ]);
  const frameById = new Map((framesData ?? []).map((r: any) => [r.id, r.frame]));
  const bannedById = new Map((bannedData ?? []).map((r: any) => [r.id, r.banned]));
  const stateById = new Map((progressData ?? []).map((r: any) => [r.user_id, r.state]));

  return (base ?? [])
    .filter((p) => !bannedById.get(p.id))
    .map((p) => {
      const state = stateById.get(p.id) ?? {};
      return {
        id: p.id,
        name: p.username,
        avatar: p.avatar,
        frame: frameById.get(p.id) ?? null,
        level: state.level ?? 1,
        won: state.totalWon ?? 0,
      };
    })
    .sort((a, b) => b.won - a.won)
    .slice(0, 50);
}

export function Leaderboard() {
  const account = useAuthStore((s) => s.account);
  const [players, setPlayers] = useState<RankedPlayer[]>([]);
  const [loading, setLoading] = useState(true);
  const [viewingId, setViewingId] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    function refresh() {
      fetchRanking().then((ranked) => {
        if (!cancelled) {
          setPlayers(ranked);
          setLoading(false);
        }
      });
    }
    refresh();

    // Dynamic: any new signup or progress change updates the ranking live for everyone watching.
    const channel = supabase
      .channel("leaderboard-changes")
      .on("postgres_changes", { event: "*", schema: "public", table: "casino_progress" }, refresh)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "profiles" }, refresh)
      .subscribe();

    return () => {
      cancelled = true;
      supabase.removeChannel(channel);
    };
  }, []);

  return (
    <div className="mx-auto max-w-3xl px-4 py-8 sm:px-6">
      <div className="mb-6 flex items-center gap-2">
        <IconTrophy className="h-6 w-6 text-gold-400" />
        <div>
          <h1 className="font-display text-2xl font-bold text-white sm:text-3xl">Classement</h1>
          <p className="text-sm text-ice-200/60">Tous les joueurs inscrits, classés par total de crédits gagnés — mis à jour en direct.</p>
        </div>
      </div>

      <Card className="overflow-hidden">
        {loading ? (
          <p className="px-5 py-8 text-center text-sm text-ice-200/40">Chargement du classement...</p>
        ) : players.length === 0 ? (
          <p className="px-5 py-8 text-center text-sm text-ice-200/40">Aucun joueur pour l'instant.</p>
        ) : (
          <ul className="divide-y divide-white/5">
            {players.map((p, i) => {
              const isUser = p.id === account?.id;
              return (
                <li key={p.id} className={cn("flex items-center gap-3 px-5 py-3.5", isUser && "bg-electric-500/10")}>
                  <span
                    className={cn(
                      "grid h-8 w-8 shrink-0 place-items-center rounded-full font-display text-sm font-bold",
                      i === 0 ? "bg-gold-400 text-ink-950" : i === 1 ? "bg-ice-100 text-ink-950" : i === 2 ? "bg-electric-600 text-white" : "bg-white/10 text-ice-200/70"
                    )}
                  >
                    {i + 1}
                  </span>
                  <button onClick={() => setViewingId(p.id)} className="flex flex-1 items-center gap-3 text-left">
                    <AvatarBubble avatar={p.avatar} frame={p.frame} size="sm" />
                    <div className="flex-1">
                      <p className={cn("text-sm font-semibold hover:underline", isUser ? "text-white" : "text-ice-200/90")}>{p.name}</p>
                      <p className="text-xs text-ice-200/40">Niveau {displayLevel(p.level)}</p>
                    </div>
                  </button>
                  {isUser && <Badge tone="electric">Toi</Badge>}
                  <span className="font-display text-sm font-bold text-gold-400">{formatCredits(p.won)}</span>
                </li>
              );
            })}
          </ul>
        )}
      </Card>

      <PublicProfileModal userId={viewingId} onClose={() => setViewingId(null)} />
    </div>
  );
}
