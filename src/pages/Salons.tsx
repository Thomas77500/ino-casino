import { useEffect, useRef, useState } from "react";
import { useAuthStore } from "../store/authStore";
import { useSalonsStore, type Salon } from "../store/salonsStore";
import { subscribeSalonPresence } from "../store/presenceStore";
import { useToastStore } from "../store/toastStore";
import { supabase } from "../lib/supabase";
import { Card } from "../components/ui/Card";
import { Button } from "../components/ui/Button";
import { Badge } from "../components/ui/Badge";
import { IconDoor } from "../components/icons";
import { AvatarBubble } from "../components/ui/AvatarBubble";
import { cn } from "../lib/format";

interface Member {
  id: string;
  username: string;
  avatar: string;
}

interface Message {
  id: string;
  userId: string;
  content: string;
  createdAt: string;
}

interface LobbyMessage {
  id: string;
  userId: string;
  username: string;
  avatar: string;
  content: string;
}

function LobbyChat() {
  const account = useAuthStore((s) => s.account);
  const [messages, setMessages] = useState<LobbyMessage[]>([]);
  const [draft, setDraft] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      const { data } = await supabase
        .from("lobby_messages")
        .select("id, user_id, content, profile:profiles(username, avatar)")
        .order("created_at", { ascending: true })
        .limit(50);
      if (cancelled || !data) return;
      setMessages(
        (data as any[]).map((r) => ({ id: r.id, userId: r.user_id, content: r.content, username: r.profile?.username ?? "?", avatar: r.profile?.avatar ?? "🎲" }))
      );
    }
    load();

    const channel = supabase
      .channel("lobby-messages")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "lobby_messages" }, async (payload) => {
        const r = payload.new as any;
        const { data: profile } = await supabase.from("profiles").select("username, avatar").eq("id", r.user_id).maybeSingle();
        setMessages((prev) => [...prev, { id: r.id, userId: r.user_id, content: r.content, username: profile?.username ?? "?", avatar: profile?.avatar ?? "🎲" }]);
      })
      .subscribe();

    return () => {
      cancelled = true;
      supabase.removeChannel(channel);
    };
  }, []);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight });
  }, [messages]);

  async function send(e: React.FormEvent) {
    e.preventDefault();
    if (!draft.trim() || !account) return;
    const content = draft.trim();
    setDraft("");
    await supabase.from("lobby_messages").insert({ user_id: account.id, content });
  }

  return (
    <Card className="mb-6 flex flex-col p-4" glow>
      <h2 className="mb-3 font-display text-sm font-semibold text-white">Chat public</h2>
      <div ref={scrollRef} className="mb-3 flex h-60 flex-col gap-2 overflow-y-auto">
        {messages.length === 0 && <p className="text-xs text-ice-200/40">Aucun message pour l'instant — dis bonjour !</p>}
        {messages.map((m) => {
          const isMe = m.userId === account?.id;
          return (
            <div key={m.id} className={cn("flex max-w-[85%] items-end gap-2", isMe ? "self-end flex-row-reverse" : "self-start")}>
              <AvatarBubble avatar={m.avatar} size="sm" />
              <div className={cn("rounded-xl px-3 py-2 text-sm", isMe ? "bg-electric-500/20 text-white" : "bg-white/[0.05] text-ice-200/90")}>
                {!isMe && <p className="mb-0.5 text-[11px] font-semibold text-electric-400">{m.username}</p>}
                {m.content}
              </div>
            </div>
          );
        })}
      </div>
      <form onSubmit={send} className="flex gap-2">
        <input value={draft} onChange={(e) => setDraft(e.target.value)} placeholder="Écrire un message..." className="input" maxLength={500} />
        <Button type="submit" disabled={!draft.trim()}>Envoyer</Button>
      </form>
    </Card>
  );
}

export function Salons() {
  const account = useAuthStore((s) => s.account);
  const { salons, fetchAll, create, joinByCode, leave, remove } = useSalonsStore();
  const push = useToastStore((s) => s.push);

  const [newSalonName, setNewSalonName] = useState("");
  const [joinCode, setJoinCode] = useState("");
  const [selected, setSelected] = useState<Salon | null>(null);
  const [members, setMembers] = useState<Member[]>([]);
  const [onlineIds, setOnlineIds] = useState<Set<string>>(new Set());
  const [messages, setMessages] = useState<Message[]>([]);
  const [draft, setDraft] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetchAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!selected || !account) return;

    let cancelled = false;

    async function loadRoom() {
      const [{ data: memberRows }, { data: messageRows }] = await Promise.all([
        supabase.from("salon_members").select("user_id, profile:profiles(id,username,avatar)").eq("salon_id", selected!.id),
        supabase.from("salon_messages").select("id, user_id, content, created_at").eq("salon_id", selected!.id).order("created_at", { ascending: true }).limit(100),
      ]);
      if (cancelled) return;
      setMembers((memberRows ?? []).map((r: any) => r.profile).filter(Boolean));
      setMessages((messageRows ?? []).map((r: any) => ({ id: r.id, userId: r.user_id, content: r.content, createdAt: r.created_at })));
    }
    loadRoom();

    const unsubscribePresence = subscribeSalonPresence(selected.id, account.id, account.username, setOnlineIds);

    const channel = supabase
      .channel(`salon-messages:${selected.id}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "salon_messages", filter: `salon_id=eq.${selected.id}` }, (payload) => {
        const r = payload.new as any;
        setMessages((prev) => [...prev, { id: r.id, userId: r.user_id, content: r.content, createdAt: r.created_at }]);
      })
      .subscribe();

    return () => {
      cancelled = true;
      unsubscribePresence();
      supabase.removeChannel(channel);
    };
  }, [selected, account]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight });
  }, [messages]);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!newSalonName.trim()) return;
    const salon = await create(newSalonName.trim());
    if (salon) {
      push({ kind: "success", title: `Salon "${salon.name}" créé`, description: `Code : ${salon.code}` });
      setNewSalonName("");
      setSelected(salon);
    } else {
      push({ kind: "info", title: "Impossible de créer le salon" });
    }
  }

  async function handleJoin(e: React.FormEvent) {
    e.preventDefault();
    if (!joinCode.trim()) return;
    const salon = await joinByCode(joinCode.trim());
    if (salon) {
      push({ kind: "success", title: `Tu as rejoint "${salon.name}"` });
      setJoinCode("");
      setSelected(salon);
    } else {
      push({ kind: "info", title: "Code invalide" });
    }
  }

  async function sendMessage(e: React.FormEvent) {
    e.preventDefault();
    if (!draft.trim() || !selected || !account) return;
    const content = draft.trim();
    setDraft("");
    await supabase.from("salon_messages").insert({ salon_id: selected.id, user_id: account.id, content });
  }

  function memberFor(userId: string): Member | undefined {
    return members.find((m) => m.id === userId);
  }

  if (selected) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-8 sm:px-6">
        <div className="mb-6 flex items-center justify-between">
          <div>
            <button onClick={() => setSelected(null)} className="mb-1 text-xs text-electric-400 hover:text-electric-300">← Tous les salons</button>
            <h1 className="font-display text-2xl font-bold text-white sm:text-3xl">{selected.name}</h1>
            <p className="text-sm text-ice-200/60">Code à partager : <span className="font-mono text-gold-400">{selected.code}</span></p>
          </div>
          {selected.owner === account?.id ? (
            <Button variant="secondary" size="sm" onClick={async () => { await remove(selected.id); setSelected(null); }}>
              Supprimer
            </Button>
          ) : (
            <Button variant="secondary" size="sm" onClick={async () => { await leave(selected.id); setSelected(null); }}>
              Quitter
            </Button>
          )}
        </div>

        <Card className="p-4">
          <h2 className="mb-3 font-display text-sm font-semibold text-white">Membres ({members.length})</h2>
          <div className="flex flex-wrap gap-2">
            {members.map((m) => (
              <div key={m.id} className="flex items-center gap-1.5 rounded-full border border-white/10 bg-white/[0.04] px-2.5 py-1">
                <span className="relative">
                  <AvatarBubble avatar={m.avatar} size="sm" />
                  <span className={cn("absolute -bottom-0.5 -right-0.5 h-2 w-2 rounded-full border border-ink-950", onlineIds.has(m.id) ? "bg-emerald-400" : "bg-ice-200/20")} />
                </span>
                <span className="text-xs font-medium text-white">{m.username}</span>
              </div>
            ))}
          </div>
        </Card>

        <Card className="mt-4 flex flex-col p-4" glow>
          <div ref={scrollRef} className="mb-3 flex h-80 flex-col gap-2 overflow-y-auto">
            {messages.length === 0 && <p className="text-xs text-ice-200/40">Aucun message pour l'instant — dis bonjour !</p>}
            {messages.map((m) => {
              const sender = memberFor(m.userId);
              const isMe = m.userId === account?.id;
              return (
                <div key={m.id} className={cn("max-w-[80%] rounded-xl px-3 py-2 text-sm", isMe ? "self-end bg-electric-500/20 text-white" : "self-start bg-white/[0.05] text-ice-200/90")}>
                  {!isMe && <p className="mb-0.5 text-[11px] font-semibold text-electric-400">{sender?.username ?? "?"}</p>}
                  {m.content}
                </div>
              );
            })}
          </div>
          <form onSubmit={sendMessage} className="flex gap-2">
            <input value={draft} onChange={(e) => setDraft(e.target.value)} placeholder="Écrire un message..." className="input" maxLength={500} />
            <Button type="submit" disabled={!draft.trim()}>Envoyer</Button>
          </form>
        </Card>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl px-4 py-8 sm:px-6">
      <div className="mb-6 flex items-center gap-2">
        <IconDoor className="h-6 w-6 text-electric-400" />
        <div>
          <h1 className="font-display text-2xl font-bold text-white sm:text-3xl">Salons privés</h1>
          <p className="text-sm text-ice-200/60">Crée un salon et partage le code avec tes amis, ou rejoins-en un.</p>
        </div>
      </div>

      <LobbyChat />

      <div className="grid gap-4 sm:grid-cols-2">
        <Card className="p-5">
          <h2 className="mb-3 font-display text-sm font-semibold text-white">Créer un salon</h2>
          <form onSubmit={handleCreate} className="flex flex-col gap-2">
            <input value={newSalonName} onChange={(e) => setNewSalonName(e.target.value)} placeholder="Nom du salon" className="input" />
            <Button type="submit" disabled={!newSalonName.trim()}>Créer</Button>
          </form>
        </Card>
        <Card className="p-5">
          <h2 className="mb-3 font-display text-sm font-semibold text-white">Rejoindre un salon</h2>
          <form onSubmit={handleJoin} className="flex flex-col gap-2">
            <input value={joinCode} onChange={(e) => setJoinCode(e.target.value)} placeholder="Code du salon" className="input" />
            <Button type="submit" variant="secondary" disabled={!joinCode.trim()}>Rejoindre</Button>
          </form>
        </Card>
      </div>

      <Card className="mt-6 p-6">
        <h2 className="mb-4 font-display text-lg font-semibold text-white">Mes salons</h2>
        {salons.length === 0 ? (
          <p className="text-xs text-ice-200/50">Aucun salon pour l'instant.</p>
        ) : (
          <ul className="flex flex-col gap-2">
            {salons.map((s) => (
              <li key={s.id}>
                <button onClick={() => setSelected(s)} className="flex w-full items-center justify-between rounded-xl border border-white/10 bg-white/[0.03] p-3 text-left hover:bg-white/[0.06]">
                  <span className="text-sm font-medium text-white">{s.name}</span>
                  <Badge tone="electric">{s.code}</Badge>
                </button>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
