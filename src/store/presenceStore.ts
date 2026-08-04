import { create } from "zustand";
import type { RealtimeChannel } from "@supabase/supabase-js";
import { supabase } from "../lib/supabase";

interface PresenceState {
  onlineIds: Set<string>;
  start: (userId: string) => void;
  stop: () => void;
}

// Kept outside the store since a RealtimeChannel isn't serializable/comparable state —
// the store only exposes the derived `onlineIds` set.
let globalChannel: RealtimeChannel | null = null;

export const usePresenceStore = create<PresenceState>((set) => ({
  onlineIds: new Set(),

  start: (userId) => {
    if (globalChannel) return;
    const channel = supabase.channel("online-users", { config: { presence: { key: userId } } });
    globalChannel = channel;
    channel
      .on("presence", { event: "sync" }, () => {
        set({ onlineIds: new Set(Object.keys(channel.presenceState())) });
      })
      .subscribe(async (status) => {
        if (status === "SUBSCRIBED") await channel.track({ online_at: new Date().toISOString() });
      });
  },

  stop: () => {
    if (globalChannel) {
      supabase.removeChannel(globalChannel);
      globalChannel = null;
    }
    set({ onlineIds: new Set() });
  },
}));

// Per-salon presence — a lightweight, standalone subscription (not part of the global store)
// since it's scoped to whichever salon detail view is currently open.
export function subscribeSalonPresence(salonId: string, userId: string, username: string, onSync: (ids: Set<string>) => void) {
  const channel = supabase.channel(`salon-presence:${salonId}`, { config: { presence: { key: userId } } });
  channel
    .on("presence", { event: "sync" }, () => {
      onSync(new Set(Object.keys(channel.presenceState())));
    })
    .subscribe(async (status) => {
      if (status === "SUBSCRIBED") await channel.track({ username });
    });
  return () => {
    supabase.removeChannel(channel);
  };
}
