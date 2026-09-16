import { create } from "zustand";
import { supabase } from "../lib/supabase";
import { useGiftsStore } from "./giftsStore";

// Simple ardoise entre joueurs : aucun blocage de mise, purement indicatif. Les crédits eux-mêmes
// sont déjà déplacés par send_gift() (via useGiftsStore) au moment du prêt — cette table ne fait
// que garder la trace de "qui doit combien à qui" pour l'afficher (Table Clandestine, Amis).
export interface Debt {
  id: string;
  lenderId: string;
  borrowerId: string;
  lenderUsername: string;
  borrowerUsername: string;
  amount: number;
  settled: boolean;
  createdAt: string;
}

interface DebtsState {
  debts: Debt[];
  fetchAll: (userId: string) => Promise<void>;
  subscribe: (userId: string) => () => void;
  lend: (lenderId: string, borrowerId: string, amount: number) => Promise<{ ok: boolean; message: string }>;
  settle: (debtId: string) => Promise<void>;
  reset: () => void;
}

function mapDebt(r: any): Debt {
  return {
    id: r.id,
    lenderId: r.lender_id,
    borrowerId: r.borrower_id,
    lenderUsername: r.lender?.username ?? "?",
    borrowerUsername: r.borrower?.username ?? "?",
    amount: r.amount,
    settled: r.settled,
    createdAt: r.created_at,
  };
}

export const useDebtsStore = create<DebtsState>((set, get) => ({
  debts: [],

  fetchAll: async (userId) => {
    const { data } = await supabase
      .from("debts")
      .select("id, lender_id, borrower_id, amount, settled, created_at, lender:profiles!debts_lender_id_fkey(username), borrower:profiles!debts_borrower_id_fkey(username)")
      .or(`lender_id.eq.${userId},borrower_id.eq.${userId}`)
      .order("created_at", { ascending: false });
    set({ debts: (data ?? []).map(mapDebt) });
  },

  subscribe: (userId) => {
    const channel = supabase
      .channel(`debts-changes:${userId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "debts" }, () => get().fetchAll(userId))
      .subscribe();
    return () => supabase.removeChannel(channel);
  },

  lend: async (lenderId, borrowerId, amount) => {
    const rounded = Math.round(amount);
    if (rounded <= 0) return { ok: false, message: "Montant invalide." };
    const result = await useGiftsStore.getState().sendGift(borrowerId, rounded);
    if (!result.ok) return result;
    await supabase.from("debts").insert({ lender_id: lenderId, borrower_id: borrowerId, amount: rounded });
    return { ok: true, message: `${rounded} crédits prêtés — ardoise ouverte.` };
  },

  settle: async (debtId) => {
    await supabase.from("debts").update({ settled: true }).eq("id", debtId);
  },

  reset: () => set({ debts: [] }),
}));
