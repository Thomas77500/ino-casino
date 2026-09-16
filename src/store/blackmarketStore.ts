import { create } from "zustand";
import { supabase } from "../lib/supabase";
import { useCasinoStore } from "./casinoStore";
import { useToastStore } from "./toastStore";
import { sendNotification } from "./notificationStore";
import { openLot as rollBlackmarketItem, findItem, type BlackmarketItem } from "../lib/blackmarketEngine";

export interface Listing {
  id: string;
  sellerId: string;
  sellerUsername: string;
  sellerAvatar: string;
  itemId: string;
  itemLabel: string;
  itemGlyph: string;
  itemRarity: string;
  price: number;
  status: "active" | "sold" | "cancelled";
  createdAt: string;
}

interface BlackmarketState {
  inventory: Record<string, number>;
  listings: Listing[];
  loading: boolean;

  fetchInventory: (userId: string) => Promise<void>;
  fetchListings: () => Promise<void>;
  subscribe: (userId: string) => () => void;

  openLot: (collectionId: string, userId: string, bias?: number) => Promise<BlackmarketItem>;
  listItem: (userId: string, item: BlackmarketItem, price: number) => Promise<{ ok: boolean; message: string }>;
  cancelListing: (userId: string, listingId: string) => Promise<void>;
  buyListing: (listing: Listing) => Promise<{ ok: boolean; message: string }>;
  reset: () => void;
}

function mapListing(r: any): Listing {
  return {
    id: r.id,
    sellerId: r.seller_id,
    sellerUsername: r.profile?.username ?? "?",
    sellerAvatar: r.profile?.avatar ?? "🎲",
    itemId: r.item_id,
    itemLabel: r.item_label,
    itemGlyph: r.item_glyph,
    itemRarity: r.item_rarity,
    price: r.price,
    status: r.status,
    createdAt: r.created_at,
  };
}

export const useBlackmarketStore = create<BlackmarketState>((set, get) => ({
  inventory: {},
  listings: [],
  loading: false,

  fetchInventory: async (userId) => {
    const { data } = await supabase.from("blackmarket_inventory").select("item_id, qty").eq("user_id", userId);
    const inventory: Record<string, number> = {};
    (data ?? []).forEach((r: any) => { inventory[r.item_id] = r.qty; });
    set({ inventory });
  },

  fetchListings: async () => {
    set({ loading: true });
    // blackmarket_listings has two FKs into profiles (seller_id and buyer_id) — the embed must
    // name the constraint explicitly or PostgREST rejects it as ambiguous.
    const { data } = await supabase
      .from("blackmarket_listings")
      .select("id, seller_id, item_id, item_label, item_glyph, item_rarity, price, status, created_at, profile:profiles!blackmarket_listings_seller_id_fkey(username, avatar)")
      .eq("status", "active")
      .order("created_at", { ascending: false })
      .limit(100);
    set({ listings: (data ?? []).map(mapListing), loading: false });
  },

  subscribe: (userId) => {
    const invChannel = supabase
      .channel(`blackmarket-inventory:${userId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "blackmarket_inventory", filter: `user_id=eq.${userId}` }, () => get().fetchInventory(userId))
      .subscribe();

    const listingsChannel = supabase
      .channel("blackmarket-listings-changes")
      .on("postgres_changes", { event: "*", schema: "public", table: "blackmarket_listings" }, (payload) => {
        get().fetchListings();
        const row = payload.new as any;
        if (payload.eventType === "UPDATE" && row?.status === "sold" && row?.seller_id === userId) {
          // The actual credit bump is applied by casinoStore's own casino_progress subscription
          // (single source of truth for out-of-band credit changes) — this handler is toast/notification only.
          useToastStore.getState().push({ kind: "success", title: `💰 Annonce vendue — +${row.price} crédits` });
          sendNotification(userId, "blackmarket_sale", "💰 Annonce vendue", `Ton objet a trouvé preneur pour ${row.price} crédits.`);
        }
      })
      .subscribe();

    return () => {
      supabase.removeChannel(invChannel);
      supabase.removeChannel(listingsChannel);
    };
  },

  openLot: async (collectionId, userId, bias = 1) => {
    const item = rollBlackmarketItem(collectionId, bias);
    const current = get().inventory[item.id] ?? 0;
    set((s) => ({ inventory: { ...s.inventory, [item.id]: current + 1 } }));
    await supabase.from("blackmarket_inventory").upsert({ user_id: userId, item_id: item.id, qty: current + 1, updated_at: new Date().toISOString() });
    return item;
  },

  listItem: async (userId, item, price) => {
    const owned = get().inventory[item.id] ?? 0;
    if (owned <= 0) return { ok: false, message: "Tu ne possèdes pas cet objet." };
    if (price <= 0) return { ok: false, message: "Prix invalide." };

    const nextQty = owned - 1;
    set((s) => ({ inventory: { ...s.inventory, [item.id]: nextQty } }));
    await supabase.from("blackmarket_inventory").update({ qty: nextQty, updated_at: new Date().toISOString() }).eq("user_id", userId).eq("item_id", item.id);
    const { error } = await supabase.from("blackmarket_listings").insert({
      seller_id: userId, item_id: item.id, item_label: item.label, item_glyph: item.glyph, item_rarity: item.rarity, price,
    });
    if (error) {
      // roll back the local optimistic decrement if the listing itself failed to insert
      set((s) => ({ inventory: { ...s.inventory, [item.id]: owned } }));
      await supabase.from("blackmarket_inventory").update({ qty: owned, updated_at: new Date().toISOString() }).eq("user_id", userId).eq("item_id", item.id);
      return { ok: false, message: "Échec de la mise en vente." };
    }
    get().fetchListings();
    return { ok: true, message: "Objet mis en vente." };
  },

  cancelListing: async (userId, listingId) => {
    const listing = get().listings.find((l) => l.id === listingId);
    if (!listing) return;
    await supabase.from("blackmarket_listings").update({ status: "cancelled" }).eq("id", listingId).eq("seller_id", userId);
    const current = get().inventory[listing.itemId] ?? 0;
    set((s) => ({ inventory: { ...s.inventory, [listing.itemId]: current + 1 } }));
    await supabase.from("blackmarket_inventory").upsert({ user_id: userId, item_id: listing.itemId, qty: current + 1, updated_at: new Date().toISOString() });
    get().fetchListings();
  },

  buyListing: async (listing) => {
    if (useCasinoStore.getState().credits < listing.price) return { ok: false, message: "Crédits insuffisants." };
    const { error } = await supabase.rpc("buy_blackmarket_listing", { p_listing_id: listing.id });
    if (error) return { ok: false, message: error.message.includes("disponible") || error.message.includes("Crédits") ? error.message : "Échec de l'achat." };

    useCasinoStore.setState((s) => ({ credits: s.credits - listing.price }));
    const item = findItem(listing.itemId);
    set((s) => ({ inventory: { ...s.inventory, [listing.itemId]: (s.inventory[listing.itemId] ?? 0) + 1 } }));
    get().fetchListings();
    return { ok: true, message: `${item?.label ?? "Objet"} acheté pour ${listing.price} crédits.` };
  },

  reset: () => set({ inventory: {}, listings: [], loading: false }),
}));
