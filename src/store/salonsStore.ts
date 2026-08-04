import { create } from "zustand";
import { supabase } from "../lib/supabase";
import { useAuthStore } from "./authStore";

export interface Salon {
  id: string;
  name: string;
  code: string;
  owner: string;
}

interface SalonsState {
  salons: Salon[];
  loading: boolean;
  error: string | null;
  fetchAll: () => Promise<void>;
  create: (name: string) => Promise<Salon | null>;
  joinByCode: (code: string) => Promise<Salon | null>;
  leave: (salonId: string) => Promise<void>;
  remove: (salonId: string) => Promise<void>;
}

export const useSalonsStore = create<SalonsState>((set, get) => ({
  salons: [],
  loading: false,
  error: null,

  fetchAll: async () => {
    const me = useAuthStore.getState().account?.id;
    if (!me) return;
    set({ loading: true });

    const { data, error } = await supabase
      .from("salon_members")
      .select("salon:salons(id,name,code,owner)")
      .eq("user_id", me);

    if (error) {
      set({ loading: false, error: error.message });
      return;
    }

    const salons = (data ?? []).map((row: any) => row.salon).filter(Boolean);
    set({ salons, loading: false, error: null });
  },

  create: async (name) => {
    const trimmed = name.trim();
    if (!trimmed) return null;
    const { data, error } = await supabase.rpc("create_salon", { p_name: trimmed });
    if (error) {
      set({ error: error.message });
      return null;
    }
    await get().fetchAll();
    return data as Salon;
  },

  joinByCode: async (code) => {
    const trimmed = code.trim().toUpperCase();
    if (!trimmed) return null;
    const { data, error } = await supabase.rpc("join_salon_by_code", { p_code: trimmed });
    if (error) {
      set({ error: "Salon introuvable pour ce code." });
      return null;
    }
    await get().fetchAll();
    return data as Salon;
  },

  leave: async (salonId) => {
    const me = useAuthStore.getState().account?.id;
    if (!me) return;
    await supabase.from("salon_members").delete().eq("salon_id", salonId).eq("user_id", me);
    await get().fetchAll();
  },

  remove: async (salonId) => {
    await supabase.from("salons").delete().eq("id", salonId);
    await get().fetchAll();
  },
}));
