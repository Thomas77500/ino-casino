import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useCasinoStore } from "../store/casinoStore";
import { useTcgStore, type PulledCard, type DuelResult } from "../store/tcgStore";
import { useToastStore } from "../store/toastStore";
import { Card } from "../components/ui/Card";
import { Button } from "../components/ui/Button";
import { Badge } from "../components/ui/Badge";
import { ProgressBar } from "../components/ui/ProgressBar";
import { TcgCardFace } from "../components/ui/TcgCardFace";
import { Modal } from "../components/ui/Modal";
import { playSound } from "../lib/sounds";
import { IconPack } from "../components/icons";
import { formatCredits, cn } from "../lib/format";
import { TCG_EDITIONS, RARITY_ORDER, RARITY_LABEL, TRADE_IN_COST, type TcgEdition, type CardRarity, type TcgCard } from "../lib/tcgCards";
import { currentCardValue } from "../lib/tcgMarket";

type View = "lobby" | "pack" | "opening" | "collection" | "duel";
type PendingOpen = { edition: TcgEdition; kind: "booster" | "display" | "free" };
type OpeningResult = { pulls: PulledCard[]; isPerfectPack: boolean };

function formatMs(ms: number): string {
  const totalSec = Math.ceil(ms / 1000);
  const m = Math.floor(totalSec / 60);
  const s = totalSec % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

const DRAMATIC_RARITIES: CardRarity[] = ["rare", "rareHolo", "ultraRare", "secrete"];

export function Boosters() {
  const level = useCasinoStore((s) => s.level);
  const [view, setView] = useState<View>("lobby");
  const [pending, setPending] = useState<PendingOpen | null>(null);
  const [result, setResult] = useState<OpeningResult | null>(null);
  const openBooster = useTcgStore((s) => s.openBooster);
  const openDisplay = useTcgStore((s) => s.openDisplay);
  const claimFreeBooster = useTcgStore((s) => s.claimFreeBooster);
  const push = useToastStore((s) => s.push);

  function choosePack(edition: TcgEdition, kind: "booster" | "display" | "free") {
    setPending({ edition, kind });
    setView("pack");
  }

  function tapToOpen() {
    if (!pending) return;
    const opened =
      pending.kind === "booster" ? openBooster(pending.edition.id) : pending.kind === "display" ? openDisplay(pending.edition.id) : claimFreeBooster(pending.edition.id);
    if (!opened) {
      push({ kind: "info", title: "Crédits insuffisants" });
      setView("lobby");
      setPending(null);
      return;
    }
    const asResult: OpeningResult = Array.isArray(opened) ? { pulls: opened, isPerfectPack: false } : opened;
    setResult(asResult);
    setView("opening");
  }

  return (
    <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6">
      <div className="mb-6 flex items-center justify-between gap-4">
        <div className="flex items-center gap-2">
          <IconPack className="h-6 w-6 text-gold-400" />
          <div>
            <h1 className="font-display text-2xl font-bold text-white sm:text-3xl">Boosters</h1>
            <p className="text-sm text-ice-200/60">Ouvre des boosters ou des displays, révèle tes cartes une par une, vends-les au prix du marché.</p>
          </div>
        </div>
        {(view === "lobby" || view === "collection" || view === "duel") && (
          <div className="flex items-center gap-1 rounded-xl border border-white/10 bg-white/[0.03] p-1">
            <button onClick={() => setView("lobby")} className={cn("rounded-lg px-3 py-1.5 text-xs font-semibold", view === "lobby" ? "bg-electric-500 text-white" : "text-ice-200/60")}>
              Boutique
            </button>
            <button onClick={() => setView("collection")} className={cn("rounded-lg px-3 py-1.5 text-xs font-semibold", view === "collection" ? "bg-electric-500 text-white" : "text-ice-200/60")}>
              Ma collection
            </button>
            <button onClick={() => setView("duel")} className={cn("rounded-lg px-3 py-1.5 text-xs font-semibold", view === "duel" ? "bg-electric-500 text-white" : "text-ice-200/60")}>
              Duel
            </button>
          </div>
        )}
      </div>

      {view === "lobby" && <Lobby level={level} onOpen={choosePack} />}
      {view === "collection" && <Collection />}
      {view === "duel" && <Duel />}
      {view === "pack" && pending && <PackReveal pending={pending} onTap={tapToOpen} />}
      {view === "opening" && pending && result && (
        <Opening
          edition={pending.edition}
          result={result}
          onDone={() => {
            setView("lobby");
            setPending(null);
            setResult(null);
          }}
        />
      )}
    </div>
  );
}

function Lobby({ level, onOpen }: { level: number; onOpen: (e: TcgEdition, kind: "booster" | "display" | "free") => void }) {
  const canClaimFree = useTcgStore((s) => s.canClaimFreeBooster());
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      {TCG_EDITIONS.map((e) => {
        const locked = level < e.minLevel;
        return (
          <Card key={e.id} className={cn("flex flex-col p-5", locked && "opacity-50")}>
            <div className="mb-3 flex items-center justify-between">
              <PackArt edition={e} small />
              {locked && <Badge tone="neutral">Niveau {e.minLevel} requis</Badge>}
            </div>
            <h3 className="font-display text-lg font-bold text-white">{e.name}</h3>
            <p className="mt-1 flex-1 text-sm text-ice-200/60">{e.theme}</p>
            <div className="mt-4 flex flex-col gap-2">
              {!locked && (
                <Button variant={canClaimFree ? "gold" : "secondary"} disabled={!canClaimFree} onClick={() => onOpen(e, "free")}>
                  {canClaimFree ? "🎁 Booster gratuit du jour" : "Booster gratuit déjà réclamé"}
                </Button>
              )}
              <Button disabled={locked} onClick={() => onOpen(e, "booster")}>
                Ouvrir un booster — {formatCredits(e.boosterPrice)}
              </Button>
              <Button variant="gold" disabled={locked} onClick={() => onOpen(e, "display")}>
                Ouvrir une display — {formatCredits(e.displayPrice)}
              </Button>
            </div>
          </Card>
        );
      })}
    </div>
  );
}

// A sealed foil pack: crimped edges, the edition's chase card on the front, a sheen sweeping
// across. Shared by the shop tiles and the tear-open screen.
function PackArt({ edition, small, torn }: { edition: TcgEdition; small?: boolean; torn?: boolean }) {
  const chase = edition.cards[edition.cards.length - 1];
  const crimp = "repeating-linear-gradient(90deg, rgba(255,255,255,0.35) 0 3px, rgba(0,0,0,0.25) 3px 6px)";
  return (
    <div className={cn("relative overflow-hidden rounded-md shadow-[0_12px_30px_-8px_rgba(0,0,0,0.8)]", small ? "h-20 w-14" : "h-64 w-44 sm:h-72 sm:w-48")}>
      <div className={cn("absolute inset-0 bg-gradient-to-br", edition.accent)} />
      <div className="absolute inset-0 bg-[linear-gradient(160deg,rgba(255,255,255,0.35),transparent_35%,transparent_65%,rgba(0,0,0,0.35))]" />
      <div className="absolute inset-x-0 top-0" style={{ height: small ? 5 : 12, backgroundImage: crimp, opacity: torn ? 0 : 1 }} />
      <div className="absolute inset-x-0 bottom-0" style={{ height: small ? 5 : 12, backgroundImage: crimp }} />
      <div className="absolute inset-0 grid place-items-center">
        <span className={cn("drop-shadow-[0_6px_14px_rgba(0,0,0,0.6)]", small ? "text-2xl" : "text-7xl")}>{chase.glyph}</span>
      </div>
      {!small && (
        <>
          <p className="absolute inset-x-0 top-6 text-center font-display text-[10px] font-black uppercase tracking-[0.35em] text-white/90">Ino TCG</p>
          <p className="absolute inset-x-2 bottom-6 text-center font-display text-sm font-bold text-white drop-shadow">{edition.name}</p>
        </>
      )}
      <div
        className="pointer-events-none absolute inset-0 animate-shimmer opacity-60"
        style={{ backgroundImage: "linear-gradient(115deg, transparent 35%, rgba(255,255,255,0.55) 48%, transparent 60%)", backgroundSize: "250% 250%" }}
      />
    </div>
  );
}

// Anticipation beat before the reveal: a sealed pack the player tears open — the top strip rips
// off along the crimp, then the pack drops away and the cards come out.
function PackReveal({ pending, onTap }: { pending: PendingOpen; onTap: () => void }) {
  const [tapped, setTapped] = useState(false);
  const { edition, kind } = pending;

  function handleTap() {
    if (tapped) return;
    setTapped(true);
    playSound("scratch");
    setTimeout(() => playSound("card"), 350);
    setTimeout(onTap, 1100);
  }

  return (
    <div className="flex flex-col items-center justify-center gap-6 py-12">
      <motion.button
        onClick={handleTap}
        className="relative"
        style={{ perspective: 800 }}
        animate={tapped ? { y: [0, 0, 0, 260], opacity: [1, 1, 1, 0] } : { y: [0, -10, 0], rotateZ: [-1.5, 1.5, -1.5] }}
        transition={tapped ? { duration: 1.1, times: [0, 0.3, 0.6, 1], ease: "easeIn" } : { duration: 2.6, repeat: Infinity, ease: "easeInOut" }}
      >
        <div className="absolute -inset-8 rounded-full bg-[radial-gradient(circle,rgba(95,184,255,0.35),transparent_65%)] blur-xl" />
        <PackArt edition={edition} torn={tapped} />
        {/* tear strip */}
        <motion.div
          className="absolute inset-x-0 top-0 h-7 overflow-hidden rounded-t-md"
          animate={tapped ? { y: -90, x: 70, rotate: 28, opacity: 0 } : {}}
          transition={{ duration: 0.6, ease: "easeOut" }}
        >
          <div className={cn("absolute inset-0 bg-gradient-to-br", edition.accent)} />
          <div className="absolute inset-x-0 top-0 h-3" style={{ backgroundImage: "repeating-linear-gradient(90deg, rgba(255,255,255,0.35) 0 3px, rgba(0,0,0,0.25) 3px 6px)" }} />
          <div className="absolute inset-x-0 bottom-0 border-b-2 border-dashed border-white/60" />
        </motion.div>
        {/* light spilling out of the opened pack */}
        {tapped && (
          <motion.div
            className="pointer-events-none absolute inset-x-2 top-5 h-24 rounded-full bg-[radial-gradient(ellipse_at_top,rgba(255,241,193,0.95),transparent_70%)]"
            initial={{ opacity: 0, scaleY: 0.2 }}
            animate={{ opacity: [0, 1, 0.8], scaleY: [0.2, 1.4, 1.2] }}
            transition={{ duration: 0.5, delay: 0.25 }}
          />
        )}
      </motion.button>
      <div className="text-center">
        <p className="font-display text-lg font-bold text-white">{edition.name}</p>
        <p className="text-sm text-ice-200/50">
          {kind === "display" ? "Display" : kind === "free" ? "Booster gratuit" : "Booster"} — {tapped ? "Ouverture..." : "Touche le paquet pour le déchirer"}
        </p>
      </div>
    </div>
  );
}

function Opening({ edition, result, onDone }: { edition: TcgEdition; result: OpeningResult; onDone: () => void }) {
  const { pulls, isPerfectPack } = result;
  const isDisplay = pulls.length > edition.cardsPerBooster;
  const [revealedCount, setRevealedCount] = useState(isDisplay ? 0 : 0);
  const [skipped, setSkipped] = useState(false);
  const [sold, setSold] = useState<Set<number>>(new Set());
  const sellCards = useTcgStore((s) => s.sellCards);
  const push = useToastStore((s) => s.push);

  const sequenceDone = skipped || revealedCount >= pulls.length;

  // Sequential auto-advance for displays — one card at a time, fast for commons, a longer pause
  // on rare+ so it registers, matching how boosters already reveal one card per tap.
  useEffect(() => {
    if (!isDisplay || skipped || revealedCount >= pulls.length) return;
    const current = pulls[revealedCount];
    const delay = DRAMATIC_RARITIES.includes(current.rarity) ? 650 : 160;
    const t = setTimeout(() => setRevealedCount((n) => n + 1), delay);
    return () => clearTimeout(t);
  }, [isDisplay, revealedCount, skipped, pulls]);

  const allRevealed = !isDisplay && revealedCount >= pulls.length;
  const totalValue = pulls.reduce((sum, p, i) => (sold.has(i) ? sum : sum + p.value), 0);
  const highlights = pulls.filter((p) => p.rarity === "rareHolo" || p.rarity === "ultraRare" || p.rarity === "secrete");
  const currentIsDramatic = !isDisplay && revealedCount > 0 && DRAMATIC_RARITIES.includes(pulls[revealedCount - 1]?.rarity);

  function revealNext() {
    if (isDisplay || revealedCount >= pulls.length) return;
    const r = pulls[revealedCount].rarity;
    playSound(r === "ultraRare" || r === "secrete" ? "bigwin" : DRAMATIC_RARITIES.includes(r) ? "win" : "card");
    setRevealedCount((n) => n + 1);
  }

  const lastRevealed = !isDisplay && revealedCount > 0 ? pulls[revealedCount - 1] : null;
  const flash = lastRevealed && (lastRevealed.rarity === "ultraRare" || lastRevealed.rarity === "secrete");

  function sellOne(i: number) {
    sellCards([{ key: pulls[i].key, value: pulls[i].value }]);
    setSold((s) => new Set(s).add(i));
    push({ kind: "success", title: `Vendue — +${formatCredits(pulls[i].value)}` });
  }

  function sellRemaining() {
    const remaining = pulls.map((p, i) => ({ p, i })).filter(({ i }) => !sold.has(i));
    if (remaining.length === 0) return;
    sellCards(remaining.map(({ p }) => ({ key: p.key, value: p.value })));
    setSold(new Set(pulls.map((_, i) => i)));
    push({ kind: "success", title: `Tout vendu — +${formatCredits(remaining.reduce((s, r) => s + r.p.value, 0))}` });
  }

  return (
    <Card className="p-6" glow>
      <AnimatePresence>
        {flash && (
          <motion.div
            key={revealedCount}
            className="pointer-events-none fixed inset-0 z-[60]"
            style={{ background: lastRevealed!.rarity === "secrete" ? "radial-gradient(circle, rgba(255,106,213,0.55), rgba(255,215,122,0.35) 40%, transparent 75%)" : "radial-gradient(circle, rgba(255,241,193,0.7), rgba(246,191,75,0.3) 40%, transparent 75%)" }}
            initial={{ opacity: 0 }}
            animate={{ opacity: [0, 1, 0] }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.9 }}
          />
        )}
      </AnimatePresence>
      <div className="mb-4 flex items-center justify-between">
        <h2 className="font-display text-lg font-bold text-white">{isDisplay ? `Display — ${edition.name}` : `Booster — ${edition.name}`}</h2>
        {!isDisplay && !allRevealed && (
          <Button size="sm" variant="secondary" onClick={() => setRevealedCount(pulls.length)}>Tout révéler</Button>
        )}
        {isDisplay && !sequenceDone && (
          <Button size="sm" variant="secondary" onClick={() => setSkipped(true)}>Passer</Button>
        )}
      </div>

      {!isDisplay && isPerfectPack && allRevealed && (
        <motion.div
          initial={{ opacity: 0, y: -10, scale: 0.9 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          className="mb-4 rounded-xl border border-gold-400/60 bg-gold-500/10 p-3 text-center shadow-glow-gold"
        >
          <p className="font-display text-lg font-bold text-gold-400">✨ PACK PARFAIT ! ✨</p>
          <p className="text-xs text-ice-200/60">Les 5 cartes sont Rare ou mieux — un tirage extrêmement rare.</p>
        </motion.div>
      )}

      {isDisplay && !sequenceDone && (
        <div className="flex flex-col items-center gap-4 py-6">
          <p className="text-xs text-ice-200/50">Carte {Math.min(revealedCount + 1, pulls.length)} / {pulls.length}</p>
          <TcgCardFace
            card={pulls[Math.min(revealedCount, pulls.length - 1)]}
            accent={edition.accent}
            foil={pulls[Math.min(revealedCount, pulls.length - 1)].foil}
            value={pulls[Math.min(revealedCount, pulls.length - 1)].value}
            isNew={pulls[Math.min(revealedCount, pulls.length - 1)].isNew}
            showEffects
            dramatic={DRAMATIC_RARITIES.includes(pulls[Math.min(revealedCount, pulls.length - 1)]?.rarity)}
          />
          <ProgressBar value={revealedCount} max={pulls.length} className="w-full max-w-sm" />
        </div>
      )}

      {isDisplay && sequenceDone && (
        <>
          <p className="mb-3 text-xs text-ice-200/50">{pulls.length} cartes ouvertes — meilleurs tirages ci-dessous ({highlights.length}) :</p>
          <div className="flex flex-wrap gap-3">
            {highlights.length === 0 && <p className="text-xs text-ice-200/40">Que des communes/peu communes cette fois — le reste est ajouté directement à ta collection.</p>}
            {highlights.map((p, i) => <TcgCardFace key={i} card={p} accent={edition.accent} size="sm" foil={p.foil} value={p.value} isNew={p.isNew} />)}
          </div>
        </>
      )}

      {!isDisplay && (
        <div className={cn("relative flex flex-wrap justify-center gap-3 overflow-hidden rounded-xl transition-colors", currentIsDramatic && "bg-ink-950/40 p-3")} onClick={revealNext}>
          {currentIsDramatic && (
            <motion.div
              className="pointer-events-none absolute inset-0 opacity-30"
              style={{
                background:
                  "conic-gradient(from 0deg, transparent 0deg, rgba(246,191,75,0.5) 10deg, transparent 25deg, transparent 45deg, rgba(95,184,255,0.4) 55deg, transparent 70deg, transparent 90deg, rgba(246,191,75,0.5) 100deg, transparent 115deg, transparent 135deg, rgba(95,184,255,0.4) 145deg, transparent 160deg, transparent 180deg, rgba(246,191,75,0.5) 190deg, transparent 205deg, transparent 225deg, rgba(95,184,255,0.4) 235deg, transparent 250deg, transparent 270deg, rgba(246,191,75,0.5) 280deg, transparent 295deg, transparent 315deg, rgba(95,184,255,0.4) 325deg, transparent 340deg)",
              }}
              animate={{ rotate: 360 }}
              transition={{ duration: 6, repeat: Infinity, ease: "linear" }}
            />
          )}
          {pulls.map((p, i) => (
            <div key={i} onClick={(e) => { e.stopPropagation(); if (i === revealedCount) revealNext(); }}>
              <TcgCardFace
                card={p}
                accent={edition.accent}
                revealed={i < revealedCount}
                tell={i === revealedCount && DRAMATIC_RARITIES.includes(p.rarity) ? p.rarity : undefined}
                dramatic={i === revealedCount - 1 && currentIsDramatic}
                showEffects={i < revealedCount}
                foil={p.foil}
                value={p.value}
                isNew={p.isNew}
              />
              {i < revealedCount && !sold.has(i) && (
                <Button size="sm" variant="ghost" className="mt-1 w-full text-[11px]" onClick={(e) => { e.stopPropagation(); sellOne(i); }}>
                  Vendre
                </Button>
              )}
              {sold.has(i) && <p className="mt-1 text-center text-[11px] text-ice-200/30">Vendue</p>}
            </div>
          ))}
        </div>
      )}

      {(allRevealed || (isDisplay && sequenceDone)) && (
        <div className="mt-6 flex flex-wrap items-center justify-between gap-3 border-t border-white/10 pt-4">
          <p className="text-sm text-ice-200/60">
            Valeur restante en collection : <span className="font-display font-bold text-gold-400">{formatCredits(totalValue)}</span>
          </p>
          <div className="flex gap-2">
            <Button variant="secondary" onClick={sellRemaining} disabled={totalValue === 0}>Tout vendre</Button>
            <Button onClick={onDone}>Garder et continuer</Button>
          </div>
        </div>
      )}
    </Card>
  );
}

function Duel() {
  const duelMsRemaining = useTcgStore((s) => s.duelMsRemaining);
  const fightDuel = useTcgStore((s) => s.fightDuel);
  const collection = useTcgStore((s) => s.collection);
  const push = useToastStore((s) => s.push);
  const [, forceTick] = useState(0);
  const [result, setResult] = useState<DuelResult | null>(null);
  const [revealedLanes, setRevealedLanes] = useState(0);

  useEffect(() => {
    const t = setInterval(() => forceTick((n) => n + 1), 1000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    if (!result || revealedLanes >= result.lanes.length) return;
    const t = setTimeout(() => setRevealedLanes((n) => n + 1), 700);
    return () => clearTimeout(t);
  }, [result, revealedLanes]);

  const msLeft = duelMsRemaining();
  const ownedUniqueCount = new Set(Object.keys(collection).filter((k) => collection[k] > 0).map((k) => k.replace(":foil", ""))).size;
  const notEnoughCards = ownedUniqueCount < 3;

  function fight() {
    const r = fightDuel();
    if (!r) {
      if (notEnoughCards) push({ kind: "info", title: "Il te faut au moins 3 cartes différentes pour combattre" });
      return;
    }
    setResult(r);
    setRevealedLanes(0);
  }

  return (
    <Card className="p-6" glow>
      <h2 className="mb-1 font-display text-lg font-bold text-white">Duel rapide</h2>
      <p className="mb-4 text-xs text-ice-200/50">
        Tes 3 meilleures cartes (par dégâts d'attaque) affrontent 3 cartes tirées au hasard. 2 manches gagnées sur 3 = victoire.
      </p>

      {!result && (
        <div className="flex flex-col items-center gap-4 py-8">
          <Button size="lg" onClick={fight} disabled={msLeft > 0 || notEnoughCards}>
            {msLeft > 0 ? `Disponible dans ${formatMs(msLeft)}` : notEnoughCards ? "Pas assez de cartes (3 minimum)" : "Combattre"}
          </Button>
        </div>
      )}

      {result && (
        <div className="flex flex-col gap-4">
          <div className="grid grid-cols-3 gap-3">
            {result.lanes.map((lane, i) => (
              <div key={i} className="flex flex-col items-center gap-2">
                <TcgCardFace card={lane.player} accent="from-electric-500 to-electric-700" size="sm" />
                <span className="text-xs text-ice-200/50">VS</span>
                {i < revealedLanes ? (
                  <>
                    <TcgCardFace card={lane.ai} accent="from-red-500 to-red-800" size="sm" />
                    <Badge tone={lane.playerWins ? "success" : "danger"}>{lane.playerWins ? "Gagné" : "Perdu"}</Badge>
                  </>
                ) : (
                  <div className="grid aspect-[4/5] w-32 place-items-center rounded-2xl border border-white/10 bg-white/5 text-2xl text-white/20">?</div>
                )}
              </div>
            ))}
          </div>

          {revealedLanes >= result.lanes.length && (
            <div className="flex flex-col items-center gap-2 border-t border-white/10 pt-4 text-center">
              <p className={cn("font-display text-2xl font-bold", result.won ? "text-emerald-400" : "text-red-400")}>
                {result.won ? "Victoire !" : "Défaite"}
              </p>
              {result.won && <p className="text-sm text-gold-400">+{formatCredits(result.reward)} crédits</p>}
              <Button className="mt-2" onClick={() => { setResult(null); }}>Continuer</Button>
            </div>
          )}
        </div>
      )}
    </Card>
  );
}

type CollectionFilter = "all" | "owned" | "missing" | CardRarity;

function Collection() {
  const collection = useTcgStore((s) => s.collection);
  const sellCards = useTcgStore((s) => s.sellCards);
  const tradeIn = useTcgStore((s) => s.tradeIn);
  const completionClaimed = useTcgStore((s) => s.completionClaimed);
  const claimCompletionBonus = useTcgStore((s) => s.claimCompletionBonus);
  const push = useToastStore((s) => s.push);
  const [editionId, setEditionId] = useState(TCG_EDITIONS[0].id);
  const [filter, setFilter] = useState<CollectionFilter>("all");
  const [inspect, setInspect] = useState<{ card: TcgCard; foil: boolean } | null>(null);
  const edition = TCG_EDITIONS.find((e) => e.id === editionId)!;

  function ownedCount(cardId: string): { normal: number; foil: number } {
    return { normal: collection[cardId] ?? 0, foil: collection[`${cardId}:foil`] ?? 0 };
  }
  const owns = (c: TcgCard) => {
    const { normal, foil } = ownedCount(c.id);
    return normal > 0 || foil > 0;
  };

  function sellOne(cardId: string, foil: boolean, rarity: CardRarity) {
    const value = currentCardValue(rarity, foil);
    sellCards([{ key: foil ? `${cardId}:foil` : cardId, value }]);
    playSound("chip");
    push({ kind: "success", title: `Vendue — +${formatCredits(value)}` });
  }

  function tradeOne(cardId: string, foil: boolean) {
    const won = tradeIn(editionId, cardId, foil);
    if (!won) return;
    playSound("win");
    push({ kind: won.isNew ? "bonus" : "success", title: `Échangée contre ${won.name} (${RARITY_LABEL[won.rarity]})${won.isNew ? " — NOUVEAU !" : ""}` });
  }

  function claimCompletion() {
    const result = claimCompletionBonus(editionId);
    if (result) push({ kind: "bonus", title: `Édition complétée ! +${formatCredits(result.credits)} crédits + cadre exclusif` });
  }

  const obtainedCount = edition.cards.filter(owns).length;
  const complete = obtainedCount === edition.cards.length;
  const pct = Math.round((obtainedCount / edition.cards.length) * 100);
  const collectionValue = edition.cards.reduce((sum, c) => {
    const { normal, foil } = ownedCount(c.id);
    return sum + normal * currentCardValue(c.rarity, false) + foil * currentCardValue(c.rarity, true);
  }, 0);
  const shown = edition.cards.filter((c) =>
    filter === "all" ? true : filter === "owned" ? owns(c) : filter === "missing" ? !owns(c) : c.rarity === filter
  );

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center gap-2">
        {TCG_EDITIONS.map((e) => {
          const got = e.cards.filter(owns).length;
          return (
            <button
              key={e.id}
              onClick={() => setEditionId(e.id)}
              className={cn(
                "flex items-center gap-2 rounded-xl border px-3 py-2 text-xs font-semibold transition-colors",
                editionId === e.id ? "border-electric-400/60 bg-electric-500/15 text-white" : "border-white/10 bg-white/[0.03] text-ice-200/60 hover:text-white"
              )}
            >
              <PackArt edition={e} small />
              <span className="flex flex-col items-start">
                {e.name}
                <span className="text-[10px] font-normal text-ice-200/50">{got}/{e.cards.length}</span>
              </span>
            </button>
          );
        })}
      </div>

      {/* binder header: progress, value, per-rarity completion */}
      <Card className="mb-4 overflow-hidden p-4">
        <div className={cn("pointer-events-none absolute inset-0 bg-gradient-to-br opacity-20", edition.accent)} />
        <div className="relative flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="text-[11px] uppercase tracking-wider text-ice-200/50">Classeur</p>
            <p className="font-display text-xl font-bold text-white">{edition.name}</p>
          </div>
          <div className="text-right">
            <p className="font-display text-3xl font-black text-white">{pct}%</p>
            <p className="text-xs text-ice-200/60">
              {obtainedCount}/{edition.cards.length} · valeur <span className="font-semibold text-gold-400">{formatCredits(collectionValue)}</span>
            </p>
          </div>
        </div>
        <div className="relative mt-3 h-2 overflow-hidden rounded-full bg-white/10">
          <motion.div
            className="h-full rounded-full bg-gradient-to-r from-electric-500 via-electric-400 to-gold-400"
            initial={{ width: 0 }}
            animate={{ width: `${pct}%` }}
            transition={{ duration: 0.8, ease: "easeOut" }}
          />
        </div>
        <div className="relative mt-3 flex flex-wrap gap-1.5">
          {(["all", "owned", "missing", ...RARITY_ORDER] as CollectionFilter[]).map((f) => {
            const rarityCards = RARITY_ORDER.includes(f as CardRarity) ? edition.cards.filter((c) => c.rarity === f) : null;
            if (rarityCards && rarityCards.length === 0) return null;
            return (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={cn(
                  "rounded-full border px-2.5 py-1 text-[11px] font-semibold transition-colors",
                  filter === f ? "border-gold-400/60 bg-gold-500/15 text-gold-300" : "border-white/10 text-ice-200/60 hover:text-white"
                )}
              >
                {f === "all" ? "Toutes" : f === "owned" ? "Obtenues" : f === "missing" ? "Manquantes" : RARITY_LABEL[f as CardRarity]}
                {rarityCards && <span className="ml-1 text-ice-200/40">{rarityCards.filter(owns).length}/{rarityCards.length}</span>}
              </button>
            );
          })}
        </div>
      </Card>

      {complete && !completionClaimed[editionId] && (
        <Card className="mb-4 flex flex-wrap items-center justify-between gap-3 border-gold-400/50 bg-gold-500/10 p-4 shadow-glow-gold">
          <div>
            <p className="font-display text-sm font-bold text-gold-400">✨ Édition complétée !</p>
            <p className="text-xs text-ice-200/60">Réclame 50 000 crédits + un cadre d'avatar exclusif.</p>
          </div>
          <Button variant="gold" onClick={claimCompletion}>Réclamer</Button>
        </Card>
      )}

      <motion.div layout className="grid grid-cols-[repeat(auto-fill,minmax(8rem,1fr))] justify-items-center gap-4 rounded-2xl border border-white/5 bg-black/20 p-4">
        <AnimatePresence mode="popLayout">
          {shown.map((card) => {
            const { normal, foil } = ownedCount(card.id);
            if (normal === 0 && foil === 0) {
              return (
                <motion.div key={card.id} layout initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.9 }}>
                  <TcgCardFace card={card} accent={edition.accent} size="sm" locked />
                </motion.div>
              );
            }
            const nextRarity = RARITY_ORDER[RARITY_ORDER.indexOf(card.rarity) + 1];
            const tradeCost = TRADE_IN_COST[card.rarity];
            return (
              <motion.div key={card.id} layout initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.9 }} className="flex flex-col gap-2">
                {[false, true].map((isFoil) => {
                  const count = isFoil ? foil : normal;
                  if (count === 0) return null;
                  return (
                    <div key={String(isFoil)} className="relative w-32">
                      <button className="block" onClick={() => setInspect({ card, foil: isFoil })} title="Inspecter">
                        <TcgCardFace card={card} accent={edition.accent} size="sm" foil={isFoil} value={currentCardValue(card.rarity, isFoil)} />
                      </button>
                      {count > 1 && (
                        <span className="absolute -right-2 -top-2 z-20 grid h-6 min-w-6 place-items-center rounded-full border-2 border-ink-950 bg-gold-400 px-1 text-[10px] font-black text-ink-950">
                          x{count}
                        </span>
                      )}
                      {isFoil && <p className="mt-1 text-center text-[10px] font-semibold text-gold-300">Foil ✦</p>}
                      <Button size="sm" variant="ghost" className="mt-1 w-full text-[10px]" onClick={() => sellOne(card.id, isFoil, card.rarity)}>Vendre 1</Button>
                      {nextRarity && count >= tradeCost && (
                        <Button size="sm" variant="secondary" className="mt-1 w-full !whitespace-normal text-[10px] leading-tight" onClick={() => tradeOne(card.id, isFoil)}>
                          Échanger {tradeCost} → {RARITY_LABEL[nextRarity]}
                        </Button>
                      )}
                    </div>
                  );
                })}
              </motion.div>
            );
          })}
        </AnimatePresence>
      </motion.div>

      <Modal open={inspect !== null} onClose={() => setInspect(null)}>
        {inspect && (
          <div className="flex flex-col items-center gap-3 py-2">
            <div className="my-4 scale-110 sm:my-10 sm:scale-125">
              <TcgCardFace card={inspect.card} accent={edition.accent} foil={inspect.foil} value={currentCardValue(inspect.card.rarity, inspect.foil)} showEffects />
            </div>
            <p className="text-center text-xs text-ice-200/50">Bouge la souris ou le doigt sur la carte pour faire jouer la lumière.</p>
          </div>
        )}
      </Modal>
    </div>
  );
}
