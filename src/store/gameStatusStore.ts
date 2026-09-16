import { create } from "zustand";
import { supabase } from "../lib/supabase";

export interface GameStatus {
  id: string;
  enabled: boolean;
  message: string;
  winBias: number;
}

export const GAME_LABELS: Record<string, string> = {
  slots: "Machines à sous",
  blackjack: "Blackjack Royal",
  roulette: "Roulette Électrique",
  chickenroad: "Chicken Road",
  plinko: "Plinko",
  crash: "Crash",
  scratch: "Cartes à gratter",
  bourse: "Bourse",
  braquage: "Braquage",
  boosters: "Boosters",
  cases: "Caisses",
  pmu: "Bar PMU",
  ministry: "Ministère",
  club: "Président de Club",
  laundering: "Blanchiment",
  blackmarket: "Marché Noir",
  darktable: "Table Clandestine",
  sect: "Gourou",
  startup: "Licorne Frauduleuse",
  bookmaker: "Bookmaker Clandestin",
  mafia: "Parrain de Quartier",
  area51: "Zone 51 Clandestine",
};

interface GameStatusState {
  statuses: Record<string, GameStatus>;
  isAdmin: boolean;
  loaded: boolean;
  fetchAll: () => Promise<void>;
  checkAdmin: (userId: string) => Promise<void>;
  setStatus: (id: string, patch: { enabled?: boolean; message?: string; winBias?: number }) => Promise<void>;
  subscribe: () => () => void;
  reset: () => void;
}

export const useGameStatusStore = create<GameStatusState>((set, get) => ({
  statuses: {},
  isAdmin: false,
  loaded: false,

  fetchAll: async () => {
    // win_bias only exists after schema_win_bias.sql runs — select it separately, best-effort,
    // so the maintenance toggle keeps working on a project that hasn't applied that migration yet.
    const [{ data, error }, { data: biasData }] = await Promise.all([
      supabase.from("game_status").select("id, enabled, message"),
      supabase.from("game_status").select("id, win_bias"),
    ]);
    if (error) return;
    const biasById = new Map((biasData ?? []).map((r: any) => [r.id, r.win_bias]));
    const statuses: Record<string, GameStatus> = {};
    (data ?? []).forEach((row) => {
      statuses[row.id] = { ...row, winBias: biasById.get(row.id) ?? 1 };
    });
    set({ statuses, loaded: true });
  },

  checkAdmin: async (userId) => {
    const { data } = await supabase.from("admins").select("user_id").eq("user_id", userId).maybeSingle();
    set({ isAdmin: !!data });
  },

  setStatus: async (id, patch) => {
    const { winBias, ...rest } = patch;
    const dbPatch: Record<string, unknown> = { ...rest, updated_at: new Date().toISOString() };
    if (winBias !== undefined) dbPatch.win_bias = winBias;
    await supabase.from("game_status").update(dbPatch).eq("id", id);
    get().fetchAll();
  },

  subscribe: () => {
    const channel = supabase
      .channel("game-status-changes")
      .on("postgres_changes", { event: "*", schema: "public", table: "game_status" }, () => get().fetchAll())
      .subscribe();
    return () => supabase.removeChannel(channel);
  },

  reset: () => set({ statuses: {}, isAdmin: false, loaded: false }),
}));
