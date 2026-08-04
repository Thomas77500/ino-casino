import { create } from "zustand";
import type { RealtimeChannel } from "@supabase/supabase-js";
import { supabase } from "../lib/supabase";
import { useAuthStore } from "./authStore";

export interface FriendProfile {
  friendshipId: string;
  id: string;
  username: string;
  avatar: string;
}

export interface IncomingRequest {
  friendshipId: string;
  from: FriendProfile;
}

interface FriendsState {
  friends: FriendProfile[];
  incoming: IncomingRequest[];
  outgoing: FriendProfile[];
  loading: boolean;
  error: string | null;
  fetchAll: () => Promise<void>;
  sendRequest: (username: string) => Promise<{ ok: boolean; message: string }>;
  accept: (friendshipId: string) => Promise<void>;
  decline: (friendshipId: string) => Promise<void>;
  remove: (friendshipId: string) => Promise<void>;
  subscribe: () => () => void;
}

const EMBED = "id, status, requester, addressee, requester_profile:profiles!friendships_requester_fkey(id,username,avatar), addressee_profile:profiles!friendships_addressee_fkey(id,username,avatar)";

export const useFriendsStore = create<FriendsState>((set, get) => ({
  friends: [],
  incoming: [],
  outgoing: [],
  loading: false,
  error: null,

  fetchAll: async () => {
    const me = useAuthStore.getState().account?.id;
    if (!me) return;
    set({ loading: true });

    const { data, error } = await supabase
      .from("friendships")
      .select(EMBED)
      .or(`requester.eq.${me},addressee.eq.${me}`);

    if (error) {
      set({ loading: false, error: error.message });
      return;
    }

    const friends: FriendProfile[] = [];
    const incoming: IncomingRequest[] = [];
    const outgoing: FriendProfile[] = [];

    (data ?? []).forEach((row: any) => {
      const iAmRequester = row.requester === me;
      const other = iAmRequester ? row.addressee_profile : row.requester_profile;
      if (!other) return;
      const friendProfile: FriendProfile = { friendshipId: row.id, id: other.id, username: other.username, avatar: other.avatar };

      if (row.status === "accepted") friends.push(friendProfile);
      else if (row.status === "pending" && iAmRequester) outgoing.push(friendProfile);
      else if (row.status === "pending" && !iAmRequester) incoming.push({ friendshipId: row.id, from: friendProfile });
    });

    set({ friends, incoming, outgoing, loading: false, error: null });
  },

  sendRequest: async (username) => {
    const me = useAuthStore.getState().account;
    if (!me) return { ok: false, message: "Non connecté." };

    const trimmed = username.trim();
    if (trimmed.toLowerCase() === me.username.toLowerCase()) {
      return { ok: false, message: "Tu ne peux pas t'ajouter toi-même." };
    }

    const { data: target } = await supabase.from("profiles").select("id").eq("username_lower", trimmed.toLowerCase()).maybeSingle();
    if (!target) return { ok: false, message: "Aucun joueur avec ce pseudo." };

    // If they already sent us a pending request, accept it instead of creating a duplicate.
    const { data: reverse } = await supabase
      .from("friendships")
      .select("id, status")
      .eq("requester", target.id)
      .eq("addressee", me.id)
      .maybeSingle();

    if (reverse) {
      if (reverse.status === "accepted") return { ok: false, message: "Vous êtes déjà amis." };
      await supabase.from("friendships").update({ status: "accepted" }).eq("id", reverse.id);
      get().fetchAll();
      return { ok: true, message: "Vous êtes maintenant amis !" };
    }

    const { error } = await supabase.from("friendships").insert({ requester: me.id, addressee: target.id, status: "pending" });
    if (error) {
      if (error.code === "23505") return { ok: false, message: "Une demande existe déjà entre vous." };
      return { ok: false, message: error.message };
    }
    get().fetchAll();
    return { ok: true, message: "Demande envoyée !" };
  },

  accept: async (friendshipId) => {
    await supabase.from("friendships").update({ status: "accepted" }).eq("id", friendshipId);
    get().fetchAll();
  },

  decline: async (friendshipId) => {
    await supabase.from("friendships").delete().eq("id", friendshipId);
    get().fetchAll();
  },

  remove: async (friendshipId) => {
    await supabase.from("friendships").delete().eq("id", friendshipId);
    get().fetchAll();
  },

  subscribe: () => {
    const me = useAuthStore.getState().account?.id;
    if (!me) return () => {};

    const channels: RealtimeChannel[] = [
      supabase
        .channel(`friendships-requester:${me}`)
        .on("postgres_changes", { event: "*", schema: "public", table: "friendships", filter: `requester=eq.${me}` }, () => get().fetchAll())
        .subscribe(),
      supabase
        .channel(`friendships-addressee:${me}`)
        .on("postgres_changes", { event: "*", schema: "public", table: "friendships", filter: `addressee=eq.${me}` }, () => get().fetchAll())
        .subscribe(),
    ];

    return () => channels.forEach((c) => supabase.removeChannel(c));
  },
}));
