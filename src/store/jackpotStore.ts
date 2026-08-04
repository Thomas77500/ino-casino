import { create } from "zustand";
import type { RealtimeChannel } from "@supabase/supabase-js";
import { supabase } from "../lib/supabase";
import { useCasinoStore } from "./casinoStore";
import { useCelebrationStore } from "./celebrationStore";
import { xpForPayout } from "../lib/xp";

const HIT_CHANCE = 1 / 4000;

interface JackpotState {
  pot: number;
  fetchAll: () => Promise<void>;
  subscribe: () => () => void;
  contribute: (betAmount: number) => void;
  tryHit: () => void;
}

export const useJackpotStore = create<JackpotState>((set, get) => ({
  pot: 1000,

  fetchAll: async () => {
    const { data } = await supabase.from("jackpot").select("pot").eq("id", "main").maybeSingle();
    if (data) set({ pot: data.pot });
  },

  subscribe: () => {
    const channel: RealtimeChannel = supabase
      .channel("jackpot-changes")
      .on("postgres_changes", { event: "*", schema: "public", table: "jackpot" }, (payload) => {
        const row = payload.new as { pot?: number } | null;
        if (row?.pot != null) set({ pot: row.pot });
      })
      .subscribe();
    return () => supabase.removeChannel(channel);
  },

  // Best-effort, fire-and-forget: a Supabase hiccup should never block placing a bet.
  contribute: (betAmount) => {
    const amount = Math.max(1, Math.round(betAmount * 0.01));
    supabase.rpc("increment_jackpot", { p_amount: amount }).then(() => get().fetchAll());
  },

  tryHit: () => {
    if (Math.random() > HIT_CHANCE) return;
    supabase.rpc("claim_jackpot").then(({ data, error }) => {
      if (error || typeof data !== "number" || data <= 0) return;
      useCasinoStore.getState().award(data);
      useCasinoStore.getState().addXp(xpForPayout(data));
      useCelebrationStore.getState().trigger("maxWin", data, "Jackpot");
      set({ pot: 1000 });
    });
  },
}));
