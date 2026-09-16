import { create } from "zustand";
import type { RealtimeChannel } from "@supabase/supabase-js";
import { supabase } from "../lib/supabase";
import { rollCrashPoint, timeForMultiplier } from "../lib/crashEngine";

// La table clandestine est unique et partagée par tout le monde (pas de salons multiples) — le
// premier arbitrage produit demandé pour le multijoueur. Chaque manche est vue par tous les
// clients à partir des mêmes `crash_point`/`starts_at` : voir schema_darktable.sql pour le détail
// du modèle de confiance (identique à tous les autres RNG de ce casino, résolus côté client).
export const BETTING_WINDOW_MS = 12_000;
const END_DISPLAY_MS = 4_000;

export interface DarktableRound {
  id: string;
  crashPoint: number;
  startsAt: number; // epoch ms
}

export interface DarktableBet {
  id: string;
  userId: string;
  username: string;
  avatar: string;
  amount: number;
  cashedOutMultiplier: number | null;
  payout: number | null;
}

export interface TablePresence {
  userId: string;
  username: string;
  avatar: string;
}

interface DarktableState {
  round: DarktableRound | null;
  bets: DarktableBet[];
  presence: TablePresence[];

  ensureRound: (bias?: number) => Promise<void>;
  fetchBets: (roundId: string) => Promise<void>;
  placeBet: (userId: string, username: string, avatar: string, amount: number) => Promise<string | null>;
  cashOutBet: (betId: string, multiplier: number, payout: number) => Promise<void>;
  subscribe: (userId: string, username: string, avatar: string) => () => void;
  reset: () => void;
}

function mapRound(r: any): DarktableRound {
  return { id: r.id, crashPoint: Number(r.crash_point), startsAt: new Date(r.starts_at).getTime() };
}

function mapBet(r: any): DarktableBet {
  return {
    id: r.id,
    userId: r.user_id,
    username: r.profile?.username ?? "Joueur",
    avatar: r.profile?.avatar ?? "🎲",
    amount: r.amount,
    cashedOutMultiplier: r.cashed_out_multiplier === null ? null : Number(r.cashed_out_multiplier),
    payout: r.payout,
  };
}

let roundsChannel: RealtimeChannel | null = null;
let betsChannel: RealtimeChannel | null = null;
let presenceChannel: RealtimeChannel | null = null;

export const useDarktableStore = create<DarktableState>((set, get) => ({
  round: null,
  bets: [],
  presence: [],

  // Reuses whatever round is still "current" (mid-betting or mid-flight); once one has fully run
  // its course, rolls a fresh crash point and schedules the next start a few seconds out so latecomers
  // have time to see the betting window open.
  ensureRound: async (bias = 1) => {
    const { data } = await supabase.from("darktable_rounds").select("id, crash_point, starts_at").order("created_at", { ascending: false }).limit(1).maybeSingle();
    const now = Date.now();
    if (data) {
      const round = mapRound(data);
      const endsAt = round.startsAt + timeForMultiplier(round.crashPoint) + END_DISPLAY_MS;
      if (now < endsAt) {
        set({ round });
        get().fetchBets(round.id);
        return;
      }
    }
    const crashPoint = rollCrashPoint(bias);
    const startsAt = new Date(now + BETTING_WINDOW_MS).toISOString();
    const { data: created } = await supabase.from("darktable_rounds").insert({ crash_point: crashPoint, starts_at: startsAt }).select("id, crash_point, starts_at").single();
    if (created) {
      const round = mapRound(created);
      set({ round, bets: [] });
    }
  },

  fetchBets: async (roundId) => {
    const { data } = await supabase
      .from("darktable_bets")
      .select("id, user_id, amount, cashed_out_multiplier, payout, profile:profiles(username, avatar)")
      .eq("round_id", roundId)
      .order("created_at", { ascending: true });
    set({ bets: (data ?? []).map(mapBet) });
  },

  placeBet: async (userId, username, avatar, amount) => {
    const round = get().round;
    if (!round) return null;
    const { data, error } = await supabase
      .from("darktable_bets")
      .insert({ round_id: round.id, user_id: userId, amount })
      .select("id")
      .single();
    if (error || !data) return null;
    set((s) => ({ bets: [...s.bets, { id: data.id, userId, username, avatar, amount, cashedOutMultiplier: null, payout: null }] }));
    return data.id;
  },

  cashOutBet: async (betId, multiplier, payout) => {
    await supabase.from("darktable_bets").update({ cashed_out_multiplier: multiplier, payout }).eq("id", betId);
    set((s) => ({ bets: s.bets.map((b) => (b.id === betId ? { ...b, cashedOutMultiplier: multiplier, payout } : b)) }));
  },

  subscribe: (userId, username, avatar) => {
    roundsChannel = supabase
      .channel("darktable-rounds-changes")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "darktable_rounds" }, (payload) => {
        const round = mapRound(payload.new);
        set({ round, bets: [] });
      })
      .subscribe();

    betsChannel = supabase
      .channel("darktable-bets-changes")
      .on("postgres_changes", { event: "*", schema: "public", table: "darktable_bets" }, () => {
        const round = get().round;
        if (round) get().fetchBets(round.id);
      })
      .subscribe();

    presenceChannel = supabase.channel("darktable-presence", { config: { presence: { key: userId } } });
    presenceChannel
      .on("presence", { event: "sync" }, () => {
        const state = presenceChannel!.presenceState<{ username: string; avatar: string }>();
        const presence: TablePresence[] = Object.entries(state).map(([id, entries]) => ({
          userId: id,
          username: entries[0]?.username ?? "Joueur",
          avatar: entries[0]?.avatar ?? "🎲",
        }));
        set({ presence });
      })
      .subscribe(async (status) => {
        if (status === "SUBSCRIBED") await presenceChannel!.track({ username, avatar });
      });

    return () => {
      if (roundsChannel) supabase.removeChannel(roundsChannel);
      if (betsChannel) supabase.removeChannel(betsChannel);
      if (presenceChannel) supabase.removeChannel(presenceChannel);
      roundsChannel = null;
      betsChannel = null;
      presenceChannel = null;
    };
  },

  reset: () => set({ round: null, bets: [], presence: [] }),
}));
