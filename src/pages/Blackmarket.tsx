import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useAuthStore } from "../store/authStore";
import { useCasinoStore } from "../store/casinoStore";
import { useGameStatusStore } from "../store/gameStatusStore";
import { useToastStore } from "../store/toastStore";
import { useBlackmarketStore, type Listing } from "../store/blackmarketStore";
import { Card } from "../components/ui/Card";
import { Button } from "../components/ui/Button";
import { Badge } from "../components/ui/Badge";
import { ProgressBar } from "../components/ui/ProgressBar";
import { NeonFrame } from "../components/ui/NeonFrame";
import { RoomChat } from "../components/ui/RoomChat";
import { IconMask, IconLock } from "../components/icons";
import { formatCredits, cn } from "../lib/format";
import { RARITY_LABEL, RARITY_STYLE } from "../lib/tcgCards";
import { COLLECTIONS, UNLOCK_TOTAL_WON, type BlackmarketItem } from "../lib/blackmarketEngine";

type View = "boutique" | "collection" | "marche" | "salon";

export function Blackmarket() {
  const account = useAuthStore((s) => s.account);
  const totalWon = useCasinoStore((s) => s.totalWon);
  const credits = useCasinoStore((s) => s.credits);
  const winBias = useGameStatusStore((s) => s.statuses.blackmarket?.winBias ?? 1);
  const push = useToastStore((s) => s.push);
  const inventory = useBlackmarketStore((s) => s.inventory);
  const listings = useBlackmarketStore((s) => s.listings);
  const fetchInventory = useBlackmarketStore((s) => s.fetchInventory);
  const fetchListings = useBlackmarketStore((s) => s.fetchListings);
  const subscribe = useBlackmarketStore((s) => s.subscribe);
  const storeOpenLot = useBlackmarketStore((s) => s.openLot);
  const listItem = useBlackmarketStore((s) => s.listItem);
  const cancelListing = useBlackmarketStore((s) => s.cancelListing);
  const buyListing = useBlackmarketStore((s) => s.buyListing);

  const [view, setView] = useState<View>("boutique");
  const [opening, setOpening] = useState(false);
  const [reveal, setReveal] = useState<BlackmarketItem | null>(null);
  const [sellingId, setSellingId] = useState<string | null>(null);
  const [sellPrice, setSellPrice] = useState("");

  const unlocked = totalWon >= UNLOCK_TOTAL_WON;

  useEffect(() => {
    if (!unlocked || !account) return;
    fetchInventory(account.id);
    fetchListings();
    const unsub = subscribe(account.id);
    return unsub;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [unlocked, account?.id]);

  async function openLot(collectionId: string, price: number) {
    if (!account || opening || credits < price) {
      if (credits < price) push({ kind: "info", title: "Crédits insuffisants" });
      return;
    }
    useCasinoStore.getState().placeBet(price);
    setOpening(true);
    const item = await storeOpenLot(collectionId, account.id, winBias);
    setTimeout(() => {
      setOpening(false);
      setReveal(item);
    }, 900);
  }

  async function sell(item: BlackmarketItem) {
    const price = Number(sellPrice);
    if (!account || !price || price <= 0) return;
    const result = await listItem(account.id, item, Math.round(price));
    push({ kind: result.ok ? "success" : "info", title: result.message });
    if (result.ok) {
      setSellingId(null);
      setSellPrice("");
    }
  }

  async function buy(listing: Listing) {
    const result = await buyListing(listing);
    push({ kind: result.ok ? "success" : "info", title: result.message });
  }

  if (!unlocked) {
    return (
      <div className="mx-auto max-w-lg px-4 py-16 text-center">
        <IconLock className="mx-auto mb-4 h-10 w-10 text-ice-200/40" />
        <h1 className="font-display text-2xl font-bold text-white">Marché Noir verrouillé</h1>
        <p className="mt-2 text-sm text-ice-200/60">
          Débloque ce réseau en cumulant {formatCredits(UNLOCK_TOTAL_WON)} crédits gagnés au total.
        </p>
        <Card className="mt-6 p-4">
          <p className="mb-2 text-xs text-ice-200/50">{formatCredits(totalWon)} / {formatCredits(UNLOCK_TOTAL_WON)}</p>
          <ProgressBar value={totalWon} max={UNLOCK_TOTAL_WON} />
        </Card>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-4xl px-4 py-8 sm:px-6">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-2">
          <IconMask className="h-6 w-6 text-gold-400" />
          <div>
            <h1 className="font-display text-2xl font-bold text-white sm:text-3xl">Marché Noir</h1>
            <p className="text-sm text-ice-200/60">Contrebande, intel & chantage, cybercrime — 100% fictif, open bar.</p>
          </div>
        </div>
        <div className="flex items-center gap-1 rounded-xl border border-white/10 bg-white/[0.03] p-1">
          {(["boutique", "collection", "marche", "salon"] as View[]).map((v) => (
            <button key={v} onClick={() => setView(v)} className={cn("rounded-lg px-3 py-1.5 text-xs font-semibold capitalize", view === v ? "bg-electric-500 text-white" : "text-ice-200/60")}>
              {v === "boutique" ? "Boutique" : v === "collection" ? "Collection" : v === "marche" ? "Marché" : "Le Réseau"}
            </button>
          ))}
        </div>
      </div>

      {view === "boutique" && (
        <div className="grid gap-4 sm:grid-cols-3">
          {COLLECTIONS.map((c) => (
            <NeonFrame key={c.id}>
              <Card className={cn("flex flex-col items-center gap-3 bg-gradient-to-br p-5 text-center", c.accent)} glow>
                <span className="text-4xl">{c.glyph}</span>
                <div>
                  <h2 className="font-display text-lg font-bold text-white">{c.label}</h2>
                  <p className="mt-1 text-xs text-white/70">{c.tagline}</p>
                </div>
                <Button variant="gold" onClick={() => openLot(c.id, c.lotPrice)} disabled={opening || credits < c.lotPrice} className="w-full">
                  Ouvrir un lot — {formatCredits(c.lotPrice)}
                </Button>
              </Card>
            </NeonFrame>
          ))}
        </div>
      )}

      {view === "collection" && (
        <div className="flex flex-col gap-6">
          {COLLECTIONS.map((c) => (
            <Card key={c.id} className="p-4 sm:p-6">
              <div className="mb-3 flex items-center gap-2">
                <span className="text-xl">{c.glyph}</span>
                <h2 className="font-display text-base font-bold text-white">{c.label}</h2>
              </div>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                {c.items.map((item) => {
                  const owned = inventory[item.id] ?? 0;
                  const style = RARITY_STYLE[item.rarity];
                  return (
                    <div key={item.id} className={cn("flex flex-col items-center gap-1 rounded-xl border p-3 text-center", owned > 0 ? style.ring : "border-white/5 opacity-40")}>
                      <span className="text-2xl">{item.glyph}</span>
                      <p className={cn("text-[11px] font-semibold leading-tight", owned > 0 ? "text-white" : "text-ice-200/40")}>{item.label}</p>
                      <span className={cn("text-[10px] font-semibold uppercase", style.text)}>{RARITY_LABEL[item.rarity]}</span>
                      <span className="text-[10px] text-ice-200/40">×{owned}</span>
                      {owned > 0 && (
                        sellingId === item.id ? (
                          <div className="mt-1 flex w-full flex-col gap-1">
                            <input
                              type="number" min={1} placeholder="Prix"
                              value={sellPrice} onChange={(e) => setSellPrice(e.target.value)}
                              className="input h-7 px-2 text-xs"
                            />
                            <div className="flex gap-1">
                              <Button size="sm" className="flex-1 !px-1 !py-1 text-[10px]" onClick={() => sell(item)}>OK</Button>
                              <Button size="sm" variant="ghost" className="flex-1 !px-1 !py-1 text-[10px]" onClick={() => setSellingId(null)}>X</Button>
                            </div>
                          </div>
                        ) : (
                          <Button size="sm" variant="secondary" className="mt-1 w-full !px-1 !py-1 text-[10px]" onClick={() => { setSellingId(item.id); setSellPrice(""); }}>
                            Vendre
                          </Button>
                        )
                      )}
                    </div>
                  );
                })}
              </div>
            </Card>
          ))}
        </div>
      )}

      {view === "marche" && (
        <Card className="overflow-hidden">
          {listings.length === 0 ? (
            <p className="px-5 py-8 text-center text-sm text-ice-200/40">Aucune annonce active pour l'instant.</p>
          ) : (
            <ul className="divide-y divide-white/5">
              {listings.map((l) => {
                const style = RARITY_STYLE[l.itemRarity as keyof typeof RARITY_STYLE];
                const mine = l.sellerId === account?.id;
                return (
                  <li key={l.id} className="flex items-center gap-3 px-5 py-3.5">
                    <span className="text-2xl">{l.itemGlyph}</span>
                    <div className="flex-1">
                      <p className="text-sm font-semibold text-white">
                        {l.itemLabel} <span className={cn("text-xs font-normal", style?.text)}>· {RARITY_LABEL[l.itemRarity as keyof typeof RARITY_LABEL] ?? l.itemRarity}</span>
                      </p>
                      <p className="text-xs text-ice-200/40">{l.sellerAvatar} {mine ? "Toi" : l.sellerUsername}</p>
                    </div>
                    <span className="font-display text-sm font-bold text-gold-400">{formatCredits(l.price)}</span>
                    {mine ? (
                      <Button size="sm" variant="ghost" onClick={() => account && cancelListing(account.id, l.id)}>Annuler</Button>
                    ) : (
                      <Button size="sm" variant="gold" disabled={credits < l.price} onClick={() => buy(l)}>Acheter</Button>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </Card>
      )}

      {view === "salon" && <RoomChat table="blackmarket_messages" title="Le Réseau" />}

      <AnimatePresence>
        {reveal && (
          <motion.div
            className="fixed inset-0 z-[150] flex items-center justify-center bg-ink-950/85 backdrop-blur-sm"
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            onClick={() => setReveal(null)}
          >
            <NeonFrame>
              <motion.div
                initial={{ scale: 0.5, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ type: "spring", stiffness: 260, damping: 16 }}
                className={cn("flex flex-col items-center gap-3 rounded-2xl border bg-ink-900/95 p-10 text-center", RARITY_STYLE[reveal.rarity].ring)}
                onClick={(e) => e.stopPropagation()}
              >
                <span className="text-6xl">{reveal.glyph}</span>
                <p className={cn("font-display text-sm font-bold uppercase tracking-widest", RARITY_STYLE[reveal.rarity].text)}>{RARITY_LABEL[reveal.rarity]}</p>
                <h3 className="font-display text-xl font-bold text-white">{reveal.label}</h3>
                <Button variant="gold" className="mt-2" onClick={() => setReveal(null)}>Continuer</Button>
              </motion.div>
            </NeonFrame>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
