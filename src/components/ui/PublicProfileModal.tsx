import { useEffect, useState } from "react";
import { supabase } from "../../lib/supabase";
import { computeBadges } from "../../lib/badges";
import { exploitTitleLabel } from "../../lib/exploitTitles";
import { displayLevel } from "../../lib/levelTitles";
import { formatCredits } from "../../lib/format";
import { Modal } from "./Modal";
import { Badge } from "./Badge";
import { AvatarBubble } from "./AvatarBubble";
import { StatTile } from "./StatTile";

interface PublicProfile {
  username: string;
  avatar: string;
  frame: string | null;
  titleLabel: string | null;
  level: number;
  totalWon: number;
  totalWagered: number;
  biggestWin: number;
  badges: { id: string; label: string }[];
}

async function fetchPublicProfile(userId: string): Promise<PublicProfile> {
  const [{ data: profile }, { data: cosmetics }, { data: progress }] = await Promise.all([
    supabase.from("profiles").select("username, avatar").eq("id", userId).maybeSingle(),
    supabase.from("profiles").select("frame, equipped_title").eq("id", userId).maybeSingle(),
    supabase.from("casino_progress").select("state").eq("user_id", userId).maybeSingle(),
  ]);
  const state: any = progress?.state ?? {};
  const stats = {
    level: state.level ?? 1,
    biggestWin: state.biggestWin ?? 0,
    totalWagered: state.totalWagered ?? 0,
    streakCount: state.streakCount ?? 0,
  };
  return {
    username: profile?.username ?? "Joueur",
    avatar: profile?.avatar ?? "🎲",
    frame: cosmetics?.frame ?? null,
    titleLabel: exploitTitleLabel(cosmetics?.equipped_title ?? null),
    level: stats.level,
    totalWon: state.totalWon ?? 0,
    totalWagered: stats.totalWagered,
    biggestWin: stats.biggestWin,
    badges: computeBadges(stats).filter((b) => b.earned),
  };
}

// A lightweight "trophy room" view of another player — only shows what's actually synced to
// Supabase (casino_progress + profiles). TCG collection/duel wins stay local-only per account and
// can't be shown here.
export function PublicProfileModal({ userId, onClose }: { userId: string | null; onClose: () => void }) {
  const [data, setData] = useState<PublicProfile | null>(null);

  useEffect(() => {
    if (!userId) {
      setData(null);
      return;
    }
    let cancelled = false;
    fetchPublicProfile(userId).then((d) => {
      if (!cancelled) setData(d);
    });
    return () => {
      cancelled = true;
    };
  }, [userId]);

  return (
    <Modal open={!!userId} onClose={onClose}>
      {!data ? (
        <p className="py-6 text-center text-sm text-ice-200/40">Chargement...</p>
      ) : (
        <div className="flex flex-col items-center gap-3 text-center">
          <AvatarBubble avatar={data.avatar} frame={data.frame} size="lg" className="shadow-glow" />
          <div>
            <h3 className="font-display text-lg font-bold text-white">{data.username}</h3>
            {data.titleLabel && <Badge tone="gold" className="mt-1">{data.titleLabel}</Badge>}
          </div>
          <p className="text-sm text-ice-200/60">Niveau {displayLevel(data.level)}</p>

          <div className="grid w-full grid-cols-3 gap-2">
            <StatTile label="Total gagné" value={formatCredits(data.totalWon)} />
            <StatTile label="Total misé" value={formatCredits(data.totalWagered)} />
            <StatTile label="Plus gros gain" value={formatCredits(data.biggestWin)} />
          </div>

          <div className="w-full text-left">
            <p className="mb-2 text-xs uppercase tracking-wide text-ice-200/50">Badges ({data.badges.length})</p>
            <div className="flex flex-wrap justify-center gap-1.5">
              {data.badges.map((b) => (
                <Badge key={b.id} tone="gold">{b.label}</Badge>
              ))}
              {data.badges.length === 0 && <p className="text-xs text-ice-200/40">Aucun badge pour l'instant.</p>}
            </div>
          </div>
        </div>
      )}
    </Modal>
  );
}
