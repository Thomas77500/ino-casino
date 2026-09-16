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
import { pick } from "../lib/rng";
import { RARITY_LABEL, RARITY_STYLE, type CardRarity } from "../lib/tcgCards";
import { COLLECTIONS, UNLOCK_TOTAL_WON, type BlackmarketItem } from "../lib/blackmarketEngine";

type View = "boutique" | "collection" | "marche" | "salon";

// Reveal intensity scales with rarity — a commune barely flashes, a secrète shakes the screen and
// rains particles like WinCelebration's big-win tiers. `color` drives both the flash and particles.
const BURST_BY_RARITY: Record<CardRarity, { particles: number; shake: boolean; flash: boolean; color: string }> = {
  commune: { particles: 6, shake: false, flash: false, color: "bg-ice-200/60" },
  peuCommune: { particles: 12, shake: false, flash: false, color: "bg-emerald-400" },
  rare: { particles: 20, shake: false, flash: true, color: "bg-electric-400" },
  rareHolo: { particles: 32, shake: true, flash: true, color: "bg-electric-300" },
  ultraRare: { particles: 48, shake: true, flash: true, color: "bg-gold-400" },
  secrete: { particles: 72, shake: true, flash: true, color: "bg-gold-300" },
};

const SPIN_MS = 1500;

// Slow-pulsing background glow blobs behind the boutique grid — pure ambience, no interaction.
const AMBIENT_BLOBS = [
  { color: "bg-amber-600", left: "5%", top: "10%", size: "220px" },
  { color: "bg-electric-600", left: "60%", top: "0%", size: "260px" },
  { color: "bg-emerald-600", left: "30%", top: "55%", size: "200px" },
  { color: "bg-gold-500", left: "80%", top: "60%", size: "180px" },
];

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
  const [spinning, setSpinning] = useState<{ collectionId: string; glyph: string } | null>(null);
  const [reveal, setReveal] = useState<BlackmarketItem | null>(null);
  const [sellingId, setSellingId] = useState<string | null>(null);
  const [sellPrice, setSellPrice] = useState("");
  const opening = spinning !== null;

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
    const collection = COLLECTIONS.find((c) => c.id === collectionId);
    if (!account || !collection || opening || credits < price) {
      if (credits < price) push({ kind: "info", title: "Crédits insuffisants" });
      return;
    }
    useCasinoStore.getState().placeBet(price);
    setReveal(null);
    setSpinning({ collectionId, glyph: collection.items[0].glyph });
    const spinTimer = setInterval(() => {
      setSpinning((s) => (s ? { ...s, glyph: pick(collection.items).glyph } : s));
    }, 90);

    const [item] = await Promise.all([
      storeOpenLot(collectionId, account.id, winBias),
      new Promise((resolve) => setTimeout(resolve, SPIN_MS)),
    ]);
    clearInterval(spinTimer);
    setSpinning(null);
    setReveal(item);
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
        <div className="relative">
          <div className="pointer-events-none absolute inset-0 -z-10 overflow-hidden">
            {AMBIENT_BLOBS.map((b, i) => (
              <motion.div
                key={i}
                className={cn("absolute rounded-full blur-3xl", b.color)}
                style={{ left: b.left, top: b.top, width: b.size, height: b.size }}
                animate={{ opacity: [0.08, 0.22, 0.08], scale: [1, 1.15, 1] }}
                transition={{ duration: 6 + i * 1.3, repeat: Infinity, ease: "easeInOut", delay: i * 0.6 }}
              />
            ))}
          </div>
          <div className="grid gap-4 sm:grid-cols-3">
            {COLLECTIONS.map((c) => (
              <NeonFrame key={c.id}>
                <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
                  <Card className={cn("flex flex-col items-center gap-3 bg-gradient-to-br p-5 text-center", c.accent)} glow>
                    <motion.span className="text-4xl" animate={{ y: [0, -4, 0] }} transition={{ duration: 2.4, repeat: Infinity, ease: "easeInOut" }}>
                      {c.glyph}
                    </motion.span>
                    <div>
                      <h2 className="font-display text-lg font-bold text-white">{c.label}</h2>
                      <p className="mt-1 text-xs text-white/70">{c.tagline}</p>
                    </div>
                    <Button variant="gold" onClick={() => openLot(c.id, c.lotPrice)} disabled={opening || credits < c.lotPrice} className="w-full">
                      Ouvrir un lot — {formatCredits(c.lotPrice)}
                    </Button>
                  </Card>
                </motion.div>
              </NeonFrame>
            ))}
          </div>
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
        {spinning && (
          <motion.div
            className="fixed inset-0 z-[150] flex items-center justify-center bg-ink-950/85 backdrop-blur-sm"
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
          >
            <NeonFrame>
              <div className="flex flex-col items-center gap-3 rounded-2xl border border-white/10 bg-ink-900/95 p-10 text-center">
                <AnimatePresence mode="popLayout">
                  <motion.span
                    key={spinning.glyph}
                    className="text-6xl"
                    initial={{ scale: 0.6, rotate: -12, opacity: 0.4 }}
                    animate={{ scale: 1, rotate: 0, opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.08 }}
                  >
                    {spinning.glyph}
                  </motion.span>
                </AnimatePresence>
                <p className="font-display text-xs font-bold uppercase tracking-widest text-ice-200/50">Ouverture en cours...</p>
              </div>
            </NeonFrame>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {reveal && (() => {
          const burst = BURST_BY_RARITY[reveal.rarity];
          return (
            <motion.div
              className="fixed inset-0 z-[150] flex items-center justify-center overflow-hidden bg-ink-950/85 backdrop-blur-sm"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1, x: burst.shake ? [0, -8, 8, -5, 5, 0] : 0 }}
              exit={{ opacity: 0 }}
              transition={{ x: { duration: 0.5 } }}
              onClick={() => setReveal(null)}
            >
              {burst.flash && (
                <motion.div
                  className="pointer-events-none absolute inset-0 bg-white"
                  initial={{ opacity: 0.9 }}
                  animate={{ opacity: 0 }}
                  transition={{ duration: 0.6, ease: "easeOut" }}
                />
              )}

              <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
                {Array.from({ length: burst.particles }, (_, i) => {
                  const angle = (360 / burst.particles) * i + Math.random() * 10;
                  const dist = 90 + Math.random() * 170;
                  return (
                    <motion.span
                      key={i}
                      className={cn("absolute rounded-full", burst.color)}
                      style={{ width: 4 + Math.random() * 5, height: 4 + Math.random() * 5 }}
                      initial={{ x: 0, y: 0, opacity: 1 }}
                      animate={{ x: Math.cos((angle * Math.PI) / 180) * dist, y: Math.sin((angle * Math.PI) / 180) * dist, opacity: 0 }}
                      transition={{ duration: 1.1, delay: Math.random() * 0.25, ease: "easeOut" }}
                    />
                  );
                })}
              </div>

              <NeonFrame>
                <motion.div
                  initial={{ scale: 0.5, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ type: "spring", stiffness: 260, damping: 16 }}
                  className={cn("flex flex-col items-center gap-3 rounded-2xl border bg-ink-900/95 p-10 text-center", RARITY_STYLE[reveal.rarity].ring)}
                  onClick={(e) => e.stopPropagation()}
                >
                  <motion.span className="text-6xl" animate={{ scale: [1, 1.12, 1] }} transition={{ duration: 0.8, repeat: Infinity }}>
                    {reveal.glyph}
                  </motion.span>
                  <p className={cn("font-display text-sm font-bold uppercase tracking-widest", RARITY_STYLE[reveal.rarity].text)}>{RARITY_LABEL[reveal.rarity]}</p>
                  <h3 className="font-display text-xl font-bold text-white">{reveal.label}</h3>
                  <Button variant="gold" className="mt-2" onClick={() => setReveal(null)}>Continuer</Button>
                </motion.div>
              </NeonFrame>
            </motion.div>
          );
        })()}
      </AnimatePresence>
    </div>
  );
}
