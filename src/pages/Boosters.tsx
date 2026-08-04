import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { useCasinoStore } from "../store/casinoStore";
import { useTcgStore, type PulledCard, type DuelResult } from "../store/tcgStore";
import { useToastStore } from "../store/toastStore";
import { Card } from "../components/ui/Card";
import { Button } from "../components/ui/Button";
import { Badge } from "../components/ui/Badge";
import { ProgressBar } from "../components/ui/ProgressBar";
import { TcgCardFace } from "../components/ui/TcgCardFace";
import { IconPack } from "../components/icons";
import { formatCredits, cn } from "../lib/format";
import { TCG_EDITIONS, RARITY_ORDER, RARITY_LABEL, TRADE_IN_COST, type TcgEdition, type CardRarity } from "../lib/tcgCards";
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
              <div className={cn("grid h-12 w-12 place-items-center rounded-xl bg-gradient-to-br text-2xl", e.accent)}>
                {e.cards[e.cards.length - 1].glyph}
              </div>
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

// Anticipation beat before the reveal — a closed pack the player taps, matching the "hold to
// open" moment real TCG-opener apps lead with, instead of jumping straight to the cards.
function PackReveal({ pending, onTap }: { pending: PendingOpen; onTap: () => void }) {
  const [tapped, setTapped] = useState(false);
  const { edition, kind } = pending;

  function handleTap() {
    if (tapped) return;
    setTapped(true);
    setTimeout(onTap, 650);
  }

  return (
    <div className="flex flex-col items-center justify-center gap-6 py-16">
      <motion.button
        onClick={handleTap}
        className={cn(
          "grid h-56 w-40 place-items-center rounded-2xl bg-gradient-to-br text-6xl shadow-glow sm:h-64 sm:w-44",
          edition.accent
        )}
        animate={
          tapped
            ? { rotate: [0, -4, 4, -4, 4, 0], scale: [1, 1.08, 1.08, 1.08, 1.08, 1.3], opacity: [1, 1, 1, 1, 1, 0] }
            : { y: [0, -8, 0] }
        }
        transition={tapped ? { duration: 0.65, ease: "easeInOut" } : { duration: 2.2, repeat: Infinity, ease: "easeInOut" }}
      >
        {edition.cards[edition.cards.length - 1].glyph}
      </motion.button>
      <div className="text-center">
        <p className="font-display text-lg font-bold text-white">{edition.name}</p>
        <p className="text-sm text-ice-200/50">{kind === "display" ? "Display" : kind === "free" ? "Booster gratuit" : "Booster"} — {tapped ? "Ouverture..." : "Touche le paquet pour l'ouvrir"}</p>
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
    if (!isDisplay && revealedCount < pulls.length) setRevealedCount((n) => n + 1);
  }

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
        <div className={cn("relative flex flex-wrap justify-center gap-3 rounded-xl transition-colors", currentIsDramatic && "bg-ink-950/40 p-3")} onClick={revealNext}>
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

function Collection() {
  const collection = useTcgStore((s) => s.collection);
  const sellCards = useTcgStore((s) => s.sellCards);
  const tradeIn = useTcgStore((s) => s.tradeIn);
  const completionClaimed = useTcgStore((s) => s.completionClaimed);
  const claimCompletionBonus = useTcgStore((s) => s.claimCompletionBonus);
  const push = useToastStore((s) => s.push);
  const [editionId, setEditionId] = useState(TCG_EDITIONS[0].id);
  const edition = TCG_EDITIONS.find((e) => e.id === editionId)!;

  function ownedCount(cardId: string): { normal: number; foil: number } {
    return { normal: collection[cardId] ?? 0, foil: collection[`${cardId}:foil`] ?? 0 };
  }

  function sellOne(cardId: string, foil: boolean, rarity: CardRarity) {
    const value = currentCardValue(rarity, foil);
    sellCards([{ key: foil ? `${cardId}:foil` : cardId, value }]);
    push({ kind: "success", title: `Vendue — +${formatCredits(value)}` });
  }

  function tradeOne(cardId: string, foil: boolean) {
    const won = tradeIn(editionId, cardId, foil);
    if (!won) return;
    push({ kind: won.isNew ? "bonus" : "success", title: `Échangée contre ${won.name} (${RARITY_LABEL[won.rarity]})${won.isNew ? " — NOUVEAU !" : ""}` });
  }

  function claimCompletion() {
    const result = claimCompletionBonus(editionId);
    if (result) push({ kind: "bonus", title: `Édition complétée ! +${formatCredits(result.credits)} crédits + cadre exclusif` });
  }

  const obtainedCount = edition.cards.filter((c) => {
    const { normal, foil } = ownedCount(c.id);
    return normal > 0 || foil > 0;
  }).length;
  const complete = obtainedCount === edition.cards.length;

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center gap-2">
        {TCG_EDITIONS.map((e) => (
          <button
            key={e.id}
            onClick={() => setEditionId(e.id)}
            className={cn(
              "rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors",
              editionId === e.id ? "bg-electric-500 text-white" : "bg-white/[0.03] text-ice-200/60 hover:text-white"
            )}
          >
            {e.name}
          </button>
        ))}
        <span className="ml-auto text-xs text-ice-200/50">{obtainedCount}/{edition.cards.length} obtenues</span>
      </div>

      {complete && !completionClaimed[editionId] && (
        <Card className="mb-4 flex flex-wrap items-center justify-between gap-3 border-gold-400/50 bg-gold-500/10 p-4 shadow-glow-gold">
          <div>
            <p className="font-display text-sm font-bold text-gold-400">✨ Édition complétée !</p>
            <p className="text-xs text-ice-200/60">Réclame 50 000 crédits + un cadre d'avatar exclusif.</p>
          </div>
          <Button variant="gold" onClick={claimCompletion}>Réclamer</Button>
        </Card>
      )}

      <div className="flex flex-wrap gap-4">
        {edition.cards.map((card) => {
          const { normal, foil } = ownedCount(card.id);
          if (normal === 0 && foil === 0) {
            return <TcgCardFace key={card.id} card={card} accent={edition.accent} size="sm" locked />;
          }
          const nextRarity = RARITY_ORDER[RARITY_ORDER.indexOf(card.rarity) + 1];
          const tradeCost = TRADE_IN_COST[card.rarity];
          return (
            <div key={card.id} className="flex flex-col gap-2">
              {normal > 0 && (
                <div>
                  <TcgCardFace card={card} accent={edition.accent} size="sm" value={currentCardValue(card.rarity, false)} />
                  <p className="mt-1 text-center text-[10px] text-ice-200/40">x{normal}</p>
                  <Button size="sm" variant="ghost" className="mt-1 w-full text-[10px]" onClick={() => sellOne(card.id, false, card.rarity)}>Vendre 1</Button>
                  {nextRarity && normal >= tradeCost && (
                    <Button size="sm" variant="secondary" className="mt-1 w-full text-[10px]" onClick={() => tradeOne(card.id, false)}>
                      Échanger {tradeCost} → {RARITY_LABEL[nextRarity]}
                    </Button>
                  )}
                </div>
              )}
              {foil > 0 && (
                <div>
                  <TcgCardFace card={card} accent={edition.accent} size="sm" foil value={currentCardValue(card.rarity, true)} />
                  <p className="mt-1 text-center text-[10px] text-ice-200/40">Foil · x{foil}</p>
                  <Button size="sm" variant="ghost" className="mt-1 w-full text-[10px]" onClick={() => sellOne(card.id, true, card.rarity)}>Vendre 1</Button>
                  {nextRarity && foil >= tradeCost && (
                    <Button size="sm" variant="secondary" className="mt-1 w-full text-[10px]" onClick={() => tradeOne(card.id, true)}>
                      Échanger {tradeCost} → {RARITY_LABEL[nextRarity]}
                    </Button>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
