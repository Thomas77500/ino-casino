import { useEffect, useRef, useState } from "react";
import { useGameStatusStore, GAME_LABELS } from "../store/gameStatusStore";
import { useToastStore } from "../store/toastStore";
import { supabase } from "../lib/supabase";
import { Card } from "../components/ui/Card";
import { Button } from "../components/ui/Button";
import { Badge } from "../components/ui/Badge";
import { AvatarBubble } from "../components/ui/AvatarBubble";
import { IconShield } from "../components/icons";
import { formatCredits } from "../lib/format";

interface AdminUser {
  id: string;
  username: string;
  avatar: string;
  createdAt: string;
  banned: boolean;
  credits: number;
  level: number;
  totalWon: number;
}

async function fetchUsers(): Promise<AdminUser[]> {
  const [{ data: base }, { data: bannedData }, { data: progressData }] = await Promise.all([
    supabase.from("profiles").select("id, username, avatar, created_at"),
    supabase.from("profiles").select("id, banned"),
    supabase.from("casino_progress").select("user_id, state"),
  ]);
  const bannedById = new Map((bannedData ?? []).map((r: any) => [r.id, r.banned]));
  const stateById = new Map((progressData ?? []).map((r: any) => [r.user_id, r.state]));
  return (base ?? [])
    .map((p: any) => {
      const state = stateById.get(p.id) ?? {};
      return {
        id: p.id,
        username: p.username,
        avatar: p.avatar,
        createdAt: p.created_at,
        banned: bannedById.get(p.id) ?? false,
        credits: state.credits ?? 0,
        level: state.level ?? 1,
        totalWon: state.totalWon ?? 0,
      };
    })
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export function Admin() {
  const { statuses, isAdmin, fetchAll, setStatus } = useGameStatusStore();
  const push = useToastStore((s) => s.push);
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [biasDrafts, setBiasDrafts] = useState<Record<string, number>>({});
  const biasSaveTimers = useRef<Record<string, ReturnType<typeof setTimeout>>>({});
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [usersLoading, setUsersLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [grantDrafts, setGrantDrafts] = useState<Record<string, string>>({});

  useEffect(() => {
    fetchAll();
    refreshUsers();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function refreshUsers() {
    setUsersLoading(true);
    fetchUsers().then((list) => {
      setUsers(list);
      setUsersLoading(false);
    });
  }

  async function adjustCredits(user: AdminUser, delta: number) {
    if (!delta) return;
    const { data } = await supabase.from("casino_progress").select("state").eq("user_id", user.id).maybeSingle();
    const state = { ...(data?.state ?? {}), credits: Math.max(0, (data?.state?.credits ?? user.credits) + delta) };
    const { error } = await supabase.from("casino_progress").upsert({ user_id: user.id, state, updated_at: new Date().toISOString() });
    if (error) {
      push({ kind: "info", title: "Échec — la migration schema_progress.sql a-t-elle été exécutée ?" });
      return;
    }
    push({ kind: "success", title: `${user.username} — ${delta > 0 ? "+" : ""}${formatCredits(delta)} crédits` });
    refreshUsers();
  }

  async function toggleBan(user: AdminUser) {
    const { error } = await supabase.from("profiles").update({ banned: !user.banned }).eq("id", user.id);
    if (error) {
      push({ kind: "info", title: "Échec — la migration schema_admin_users.sql a-t-elle été exécutée ?" });
      return;
    }
    push({ kind: "info", title: `${user.username} — ${user.banned ? "réactivé" : "banni"}` });
    refreshUsers();
  }

  const filteredUsers = users.filter((u) => u.username.toLowerCase().includes(search.toLowerCase()));

  if (!isAdmin) {
    return (
      <div className="mx-auto max-w-lg px-4 py-16 text-center">
        <p className="text-sm text-ice-200/60">Accès réservé aux administrateurs.</p>
      </div>
    );
  }

  async function toggle(id: string, currentlyEnabled: boolean) {
    await setStatus(id, { enabled: !currentlyEnabled });
    push({ kind: "info", title: `${GAME_LABELS[id]} — ${currentlyEnabled ? "mis en maintenance" : "réactivé"}` });
  }

  async function saveMessage(id: string) {
    const message = drafts[id] ?? statuses[id]?.message ?? "";
    await setStatus(id, { message });
    push({ kind: "success", title: "Message de maintenance mis à jour" });
  }

  async function setBias(id: string, winBias: number) {
    await setStatus(id, { winBias });
  }

  // Committing only on mouseup/touchend misses keyboard-driven slider changes (arrow keys never
  // fire those events) — debounce a save on every change too, so every input method persists.
  function scheduleBiasSave(id: string, winBias: number) {
    setBiasDrafts((d) => ({ ...d, [id]: winBias }));
    clearTimeout(biasSaveTimers.current[id]);
    biasSaveTimers.current[id] = setTimeout(() => setBias(id, winBias), 400);
  }

  return (
    <div className="mx-auto max-w-3xl px-4 py-8 sm:px-6">
      <div className="mb-6 flex items-center gap-2">
        <IconShield className="h-6 w-6 text-gold-400" />
        <div>
          <h1 className="font-display text-2xl font-bold text-white sm:text-3xl">Administration</h1>
          <p className="text-sm text-ice-200/60">Active/désactive chaque jeu et personnalise le message de maintenance.</p>
        </div>
      </div>

      <div className="flex flex-col gap-3">
        {Object.entries(GAME_LABELS).map(([id, label]) => {
          const status = statuses[id];
          const enabled = status?.enabled ?? true;
          return (
            <Card key={id} className="p-4">
              <div className="flex items-center justify-between gap-4">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-semibold text-white">{label}</span>
                  <Badge tone={enabled ? "success" : "danger"}>{enabled ? "Actif" : "Maintenance"}</Badge>
                </div>
                <Button size="sm" variant={enabled ? "secondary" : "gold"} onClick={() => toggle(id, enabled)}>
                  {enabled ? "Mettre en maintenance" : "Réactiver"}
                </Button>
              </div>
              <div className="mt-3 flex gap-2">
                <input
                  className="input"
                  placeholder="Message affiché aux joueurs pendant la maintenance"
                  value={drafts[id] ?? status?.message ?? ""}
                  onChange={(e) => setDrafts((d) => ({ ...d, [id]: e.target.value }))}
                />
                <Button size="sm" variant="secondary" onClick={() => saveMessage(id)}>Enregistrer</Button>
              </div>
              <div className="mt-3 flex items-center gap-3">
                <span className="w-40 shrink-0 text-xs text-ice-200/50">Probabilité de gain</span>
                <input
                  type="range"
                  min={0.5}
                  max={2}
                  step={0.1}
                  value={biasDrafts[id] ?? status?.winBias ?? 1}
                  onChange={(e) => scheduleBiasSave(id, Number(e.target.value))}
                  onMouseUp={(e) => setBias(id, Number((e.target as HTMLInputElement).value))}
                  onTouchEnd={(e) => setBias(id, Number((e.target as HTMLInputElement).value))}
                  className="flex-1"
                />
                <span className="w-12 shrink-0 text-right font-display text-xs font-bold text-gold-400">
                  {(biasDrafts[id] ?? status?.winBias ?? 1).toFixed(1)}×
                </span>
                <Button size="sm" variant="ghost" onClick={() => { setBiasDrafts((d) => ({ ...d, [id]: 1 })); setBias(id, 1); }}>
                  Réinitialiser
                </Button>
              </div>
            </Card>
          );
        })}
      </div>

      <div className="mb-4 mt-10 flex items-center justify-between gap-4">
        <div>
          <h2 className="font-display text-lg font-bold text-white">Joueurs inscrits</h2>
          <p className="text-xs text-ice-200/50">{users.length} compte{users.length > 1 ? "s" : ""} — crédite/retire des crédits ou bannis un compte.</p>
        </div>
        <input
          className="input w-56"
          placeholder="Rechercher un pseudo..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      {usersLoading ? (
        <p className="text-sm text-ice-200/40">Chargement...</p>
      ) : (
        <div className="flex flex-col gap-2">
          {filteredUsers.map((u) => (
            <Card key={u.id} className="p-3">
              <div className="flex flex-wrap items-center gap-3">
                <AvatarBubble avatar={u.avatar} size="sm" />
                <div className="min-w-[120px] flex-1">
                  <p className="text-sm font-semibold text-white">{u.username}</p>
                  <p className="text-[11px] text-ice-200/40">
                    Niveau {u.level} · {formatCredits(u.credits)} crédits · {new Date(u.createdAt).toLocaleDateString("fr-FR")}
                  </p>
                </div>
                <Badge tone={u.banned ? "danger" : "success"}>{u.banned ? "Banni" : "Actif"}</Badge>
                <input
                  type="number"
                  placeholder="Montant"
                  className="input w-28"
                  value={grantDrafts[u.id] ?? ""}
                  onChange={(e) => setGrantDrafts((d) => ({ ...d, [u.id]: e.target.value }))}
                />
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={() => adjustCredits(u, Math.abs(Number(grantDrafts[u.id]) || 0))}
                >
                  Créditer
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => adjustCredits(u, -Math.abs(Number(grantDrafts[u.id]) || 0))}
                >
                  Retirer
                </Button>
                <Button size="sm" variant={u.banned ? "gold" : "secondary"} onClick={() => toggleBan(u)}>
                  {u.banned ? "Réactiver" : "Bannir"}
                </Button>
              </div>
            </Card>
          ))}
          {filteredUsers.length === 0 && <p className="text-sm text-ice-200/40">Aucun joueur ne correspond.</p>}
        </div>
      )}
    </div>
  );
}
