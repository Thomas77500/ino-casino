import { create } from "zustand";
import type { RealtimeChannel } from "@supabase/supabase-js";
import { supabase } from "../lib/supabase";
import type { WinTier } from "../lib/winTiers";

export interface GlobalWinEvent {
  id: string;
  name: string;
  game: string;
  amount: number;
  tier: WinTier;
}

interface GlobalFeedState {
  items: GlobalWinEvent[];
  broadcast: (evt: Omit<GlobalWinEvent, "id">) => void;
  subscribe: () => () => void;
}

// Ephemeral Supabase Realtime Broadcast — no table, no history to persist, every connected
// client just receives the event live. Perfect for a "big win just happened" ticker.
let sharedChannel: RealtimeChannel | null = null;
function channel(): RealtimeChannel {
  if (!sharedChannel) sharedChannel = supabase.channel("global-wins");
  return sharedChannel;
}

export const useGlobalFeedStore = create<GlobalFeedState>((set) => ({
  items: [],

  broadcast: (evt) => {
    channel().send({ type: "broadcast", event: "win", payload: evt });
  },

  subscribe: () => {
    const ch = channel();
    ch.on("broadcast", { event: "win" }, ({ payload }) => {
      set((s) => ({ items: [{ ...(payload as Omit<GlobalWinEvent, "id">), id: crypto.randomUUID() }, ...s.items].slice(0, 8) }));
    }).subscribe();
    return () => {
      supabase.removeChannel(ch);
      sharedChannel = null;
    };
  },
}));
