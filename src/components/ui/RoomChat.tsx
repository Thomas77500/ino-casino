import { useEffect, useRef, useState } from "react";
import { useAuthStore } from "../../store/authStore";
import { supabase } from "../../lib/supabase";
import { Card } from "./Card";
import { Button } from "./Button";
import { AvatarBubble } from "./AvatarBubble";
import { cn } from "../../lib/format";

interface RoomMessage {
  id: string;
  userId: string;
  username: string;
  avatar: string;
  content: string;
}

// Generic single-room public chat backed by any table shaped like `lobby_messages`
// (id, user_id, content, created_at) — reused for the global lobby chat and the PMU bar chat.
export function RoomChat({ table, title }: { table: string; title: string }) {
  const account = useAuthStore((s) => s.account);
  const [messages, setMessages] = useState<RoomMessage[]>([]);
  const [draft, setDraft] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      const { data } = await supabase
        .from(table)
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
      .channel(`${table}-changes`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table }, async (payload) => {
        const r = payload.new as any;
        const { data: profile } = await supabase.from("profiles").select("username, avatar").eq("id", r.user_id).maybeSingle();
        setMessages((prev) => [...prev, { id: r.id, userId: r.user_id, content: r.content, username: profile?.username ?? "?", avatar: profile?.avatar ?? "🎲" }]);
      })
      .subscribe();

    return () => {
      cancelled = true;
      supabase.removeChannel(channel);
    };
  }, [table]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight });
  }, [messages]);

  async function send(e: React.FormEvent) {
    e.preventDefault();
    if (!draft.trim() || !account) return;
    const content = draft.trim();
    setDraft("");
    await supabase.from(table).insert({ user_id: account.id, content });
  }

  return (
    <Card className="flex flex-col p-4" glow>
      <h2 className="mb-3 font-display text-sm font-semibold text-white">{title}</h2>
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
