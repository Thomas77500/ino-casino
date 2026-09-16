import { create } from "zustand";
import type { RealtimeChannel } from "@supabase/supabase-js";
import { supabase } from "../lib/supabase";
import { useCasinoStore } from "./casinoStore";
import { useToastStore } from "./toastStore";
import { useFriendsStore } from "./friendsStore";
import { sendNotification } from "./notificationStore";

interface GiftsState {
  sending: boolean;
  sendGift: (toUserId: string, amount: number) => Promise<{ ok: boolean; message: string }>;
  subscribe: (myId: string) => () => void;
}

export const useGiftsStore = create<GiftsState>((set) => ({
  sending: false,

  sendGift: async (toUserId, amount) => {
    const rounded = Math.round(amount);
    if (rounded <= 0) return { ok: false, message: "Montant invalide." };
    if (useCasinoStore.getState().credits < rounded) return { ok: false, message: "Crédits insuffisants." };

    set({ sending: true });
    const { error } = await supabase.rpc("send_gift", { p_to: toUserId, p_amount: rounded });
    set({ sending: false });
    if (error) return { ok: false, message: error.message.includes("Crédits") ? error.message : "Échec du don." };

    // The RPC already moved the credits server-side — mirror it locally so the sender's balance
    // updates immediately instead of waiting on the next cloud sync round-trip.
    useCasinoStore.setState((s) => ({ credits: s.credits - rounded }));
    return { ok: true, message: `Don de ${rounded} crédits envoyé !` };
  },

  subscribe: (myId) => {
    const channel: RealtimeChannel = supabase
      .channel(`gifts-received:${myId}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "gifts", filter: `recipient=eq.${myId}` }, (payload) => {
        const amount = Number((payload.new as { amount?: number }).amount ?? 0);
        const senderId = (payload.new as { sender?: string }).sender;
        if (amount <= 0) return;
        // The actual credit bump is applied by casinoStore's own casino_progress subscription
        // (single source of truth for out-of-band credit changes) — this handler is toast/notification only.
        const senderName = useFriendsStore.getState().friends.find((f) => f.id === senderId)?.username ?? "Un joueur";
        useToastStore.getState().push({ kind: "bonus", title: `🎁 ${senderName} t'a envoyé ${amount} crédits !` });
        sendNotification(myId, "gift", `🎁 Don reçu de ${senderName}`, `+${amount} crédits`);
      })
      .subscribe();
    return () => supabase.removeChannel(channel);
  },
}));
