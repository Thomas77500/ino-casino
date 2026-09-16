import { create } from "zustand";
import type { RealtimeChannel } from "@supabase/supabase-js";
import { supabase } from "../lib/supabase";

export interface AppNotification {
  id: string;
  kind: string;
  title: string;
  body: string | null;
  read: boolean;
  createdAt: string;
}

interface NotificationState {
  items: AppNotification[];
  fetchAll: (userId: string) => Promise<void>;
  subscribe: (userId: string) => () => void;
  markAllRead: (userId: string) => Promise<void>;
  reset: () => void;
}

function mapRow(r: any): AppNotification {
  return { id: r.id, kind: r.kind, title: r.title, body: r.body, read: r.read, createdAt: r.created_at };
}

export const useNotificationStore = create<NotificationState>((set, get) => ({
  items: [],

  fetchAll: async (userId) => {
    const { data } = await supabase
      .from("notifications")
      .select("id, kind, title, body, read, created_at")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(30);
    set({ items: (data ?? []).map(mapRow) });
  },

  subscribe: (userId) => {
    const channel: RealtimeChannel = supabase
      .channel(`notifications:${userId}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "notifications", filter: `user_id=eq.${userId}` }, (payload) => {
        set((s) => ({ items: [mapRow(payload.new), ...s.items].slice(0, 30) }));
      })
      .subscribe();
    return () => supabase.removeChannel(channel);
  },

  markAllRead: async (userId) => {
    if (!get().items.some((n) => !n.read)) return;
    set((s) => ({ items: s.items.map((n) => ({ ...n, read: true })) }));
    await supabase.from("notifications").update({ read: true }).eq("user_id", userId).eq("read", false);
  },

  reset: () => set({ items: [] }),
}));

// Fire-and-forget helper for other stores to drop a notification into a user's own feed — always
// self-targeted (userId must be the caller's own id, enforced by notifications_insert_own).
export async function sendNotification(userId: string, kind: string, title: string, body?: string) {
  await supabase.from("notifications").insert({ user_id: userId, kind, title, body: body ?? null });
}
