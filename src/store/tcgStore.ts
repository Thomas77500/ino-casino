import { create } from "zustand";
import { persist } from "zustand/middleware";
import { TCG_EDITIONS, BOOSTER_SLOT_WEIGHTS, DISPLAY_WEIGHTS, PERFECT_PACK_CHANCE, RARITY_ORDER, TRADE_IN_COST, type CardRarity, type TcgCard } from "../lib/tcgCards";
import { currentCardValue } from "../lib/tcgMarket";
import { biasedWeightedPick, biasedChance } from "../lib/rng";
import { useCasinoStore } from "./casinoStore";
import { useCelebrationStore } from "./celebrationStore";
import { useGameStatusStore } from "./gameStatusStore";
import { xpForPayout } from "../lib/xp";
import { tierFromMultiplier } from "../lib/winTiers";

function todayKey(): string {
  return new Date().toISOString().slice(0, 10);
}

const DUEL_COOLDOWN_MS = 20 * 60 * 1000;

export interface PulledCard extends TcgCard {
  key: string; // collection key — cardId, or cardId:foil for display pulls
  foil: boolean;
  value: number;
  isNew: boolean;
}

function collectionKey(cardId: string, foil: boolean): string {
  return foil ? `${cardId}:foil` : cardId;
}

function drawOneCard(edition: (typeof TCG_EDITIONS)[number], weights: Record<CardRarity, number>, bias: number, foil: boolean): PulledCard {
  const weighted = RARITY_ORDER.map((r) => ({ value: r, weight: weights[r] }));
  const rarity = biasedWeightedPick(weighted, bias);
  const pool = edition.cards.filter((c) => c.rarity === rarity);
  const card = pool[Math.floor(Math.random() * pool.length)];
  return { ...card, key: collectionKey(card.id, foil), foil, value: currentCardValue(card.rarity, foil), isNew: false };
}

// isNew reflects ownership *before* this batch was pulled — computed once against a snapshot so
// two copies of a first-ever card in the same pack both correctly show "new".
function markNew(pulls: PulledCard[], collectionBefore: Record<string, number>): PulledCard[] {
  return pulls.map((p) => ({ ...p, isNew: !collectionBefore[p.key] }));
}

function drawCards(editionId: string, count: number, weights: Record<CardRarity, number>, foil: boolean): PulledCard[] {
  const edition = TCG_EDITIONS.find((e) => e.id === editionId);
  if (!edition) return [];
  const bias = useGameStatusStore.getState().statuses.boosters?.winBias ?? 1;
  return Array.from({ length: count }, () => drawOneCard(edition, weights, bias, foil));
}

// Per-slot booster odds, TCG Pocket-style (slots 1-3 common-heavy, 4th better, 5th carries the
// real rare+ floor), plus a vanishingly rare "perfect pack" that forces every slot onto the best
// table instead.
function drawBoosterCards(editionId: string): { pulls: PulledCard[]; isPerfectPack: boolean } {
  const edition = TCG_EDITIONS.find((e) => e.id === editionId);
  if (!edition) return { pulls: [], isPerfectPack: false };
  const bias = useGameStatusStore.getState().statuses.boosters?.winBias ?? 1;
  const isPerfectPack = biasedChance(PERFECT_PACK_CHANCE, bias);
  const bestTable = BOOSTER_SLOT_WEIGHTS[BOOSTER_SLOT_WEIGHTS.length - 1];
  const pulls = BOOSTER_SLOT_WEIGHTS.map((table) => drawOneCard(edition, isPerfectPack ? bestTable : table, bias, false));
  return { pulls, isPerfectPack };
}

export interface DuelLane {
  player: TcgCard;
  ai: TcgCard;
  playerWins: boolean;
}

export interface DuelResult {
  lanes: DuelLane[];
  won: boolean;
  reward: number;
}

function findCardById(id: string): TcgCard | null {
  for (const edition of TCG_EDITIONS) {
    const card = edition.cards.find((c) => c.id === id);
    if (card) return card;
  }
  return null;
}

function allCards(): TcgCard[] {
  return TCG_EDITIONS.flatMap((e) => e.cards);
}

interface TcgState {
  collection: Record<string, number>;
  lastFreeBoosterClaim: string | null;
  lastDuelClaim: number | null;
  completionClaimed: Record<string, boolean>;
  duelWins: number;
  openBooster: (editionId: string) => { pulls: PulledCard[]; isPerfectPack: boolean } | null;
  openDisplay: (editionId: string) => PulledCard[] | null;
  sellCards: (pulls: { key: string; value: number }[]) => void;
  canClaimFreeBooster: () => boolean;
  claimFreeBooster: (editionId: string) => { pulls: PulledCard[]; isPerfectPack: boolean } | null;
  editionOwnedCount: (editionId: string) => number;
  claimCompletionBonus: (editionId: string) => { credits: number; frameId: string } | null;
  duelMsRemaining: () => number;
  fightDuel: () => DuelResult | null;
  tradeIn: (editionId: string, cardId: string, foil: boolean) => PulledCard | null;
}

export const useTcgStore = create<TcgState>()(
  persist(
    (set, get) => ({
      collection: {},
      lastFreeBoosterClaim: null,
      lastDuelClaim: null,
      completionClaimed: {},
      duelWins: 0,

      openBooster: (editionId) => {
        const edition = TCG_EDITIONS.find((e) => e.id === editionId);
        const casino = useCasinoStore.getState();
        if (!edition || !casino.canBet(edition.boosterPrice)) return null;
        casino.placeBet(edition.boosterPrice);

        const { pulls: rawPulls, isPerfectPack } = drawBoosterCards(editionId);
        const pulls = markNew(rawPulls, get().collection);
        addToCollection(set, pulls);
        recordAndCelebrate(edition.name, edition.boosterPrice, pulls);
        return { pulls, isPerfectPack };
      },

      openDisplay: (editionId) => {
        const edition = TCG_EDITIONS.find((e) => e.id === editionId);
        const casino = useCasinoStore.getState();
        if (!edition || !casino.canBet(edition.displayPrice)) return null;
        casino.placeBet(edition.displayPrice);

        const rawPulls = drawCards(editionId, edition.cardsPerBooster * edition.boostersPerDisplay, DISPLAY_WEIGHTS, true);
        const pulls = markNew(rawPulls, get().collection);
        addToCollection(set, pulls);
        recordAndCelebrate(`${edition.name} (Display)`, edition.displayPrice, pulls);
        return pulls;
      },

      sellCards: (pulls) => {
        if (pulls.length === 0) return;
        const total = pulls.reduce((sum, p) => sum + p.value, 0);
        set((s) => {
          const collection = { ...s.collection };
          for (const p of pulls) {
            collection[p.key] = Math.max(0, (collection[p.key] ?? 0) - 1);
            if (collection[p.key] === 0) delete collection[p.key];
          }
          return { collection };
        });
        useCasinoStore.getState().award(total);
        useCasinoStore.getState().addXp(xpForPayout(total));
      },

      canClaimFreeBooster: () => get().lastFreeBoosterClaim !== todayKey(),

      claimFreeBooster: (editionId) => {
        if (!get().canClaimFreeBooster()) return null;
        const edition = TCG_EDITIONS.find((e) => e.id === editionId);
        if (!edition) return null;

        const { pulls: rawPulls, isPerfectPack } = drawBoosterCards(editionId);
        const pulls = markNew(rawPulls, get().collection);
        addToCollection(set, pulls);
        set({ lastFreeBoosterClaim: todayKey() });
        recordAndCelebrate(`${edition.name} (gratuit)`, 0, pulls);
        return { pulls, isPerfectPack };
      },

      editionOwnedCount: (editionId) => {
        const edition = TCG_EDITIONS.find((e) => e.id === editionId);
        if (!edition) return 0;
        const collection = get().collection;
        return edition.cards.filter((c) => (collection[c.id] ?? 0) > 0 || (collection[`${c.id}:foil`] ?? 0) > 0).length;
      },

      claimCompletionBonus: (editionId) => {
        const edition = TCG_EDITIONS.find((e) => e.id === editionId);
        if (!edition) return null;
        if (get().completionClaimed[editionId]) return null;
        if (get().editionOwnedCount(editionId) < edition.cards.length) return null;

        const credits = 50_000;
        useCasinoStore.getState().award(credits);
        useCasinoStore.getState().buyFrame(edition.completionFrameId, 0);
        set((s) => ({ completionClaimed: { ...s.completionClaimed, [editionId]: true } }));
        return { credits, frameId: edition.completionFrameId };
      },

      duelMsRemaining: () => {
        const last = get().lastDuelClaim;
        if (!last) return 0;
        return Math.max(0, DUEL_COOLDOWN_MS - (Date.now() - last));
      },

      fightDuel: () => {
        if (get().duelMsRemaining() > 0) return null;
        const collection = get().collection;
        const ownedIds = Object.keys(collection)
          .filter((k) => collection[k] > 0)
          .map((k) => k.replace(":foil", ""));
        const uniqueOwned = [...new Set(ownedIds)].map(findCardById).filter((c): c is TcgCard => !!c);
        if (uniqueOwned.length < 3) return null;

        const playerTeam = [...uniqueOwned].sort((a, b) => b.attackDamage - a.attackDamage).slice(0, 3);
        const pool = allCards();
        const aiTeam = Array.from({ length: 3 }, () => pool[Math.floor(Math.random() * pool.length)]);

        const lanes: DuelLane[] = playerTeam.map((player, i) => ({
          player,
          ai: aiTeam[i],
          playerWins: player.attackDamage >= aiTeam[i].attackDamage,
        }));
        const won = lanes.filter((l) => l.playerWins).length >= 2;
        const reward = won ? 800 : 0;

        set((s) => ({ lastDuelClaim: Date.now(), duelWins: won ? s.duelWins + 1 : s.duelWins }));
        if (reward > 0) {
          useCasinoStore.getState().award(reward);
          useCasinoStore.getState().addXp(xpForPayout(reward));
        }
        return { lanes, won, reward };
      },

      tradeIn: (editionId, cardId, foil) => {
        const edition = TCG_EDITIONS.find((e) => e.id === editionId);
        const card = edition?.cards.find((c) => c.id === cardId);
        if (!edition || !card) return null;
        const nextRarity = RARITY_ORDER[RARITY_ORDER.indexOf(card.rarity) + 1];
        if (!nextRarity) return null; // already the top rarity, nothing to trade up to

        const cost = TRADE_IN_COST[card.rarity];
        const sourceKey = collectionKey(cardId, foil);
        if ((get().collection[sourceKey] ?? 0) < cost) return null;

        const pool = edition.cards.filter((c) => c.rarity === nextRarity);
        const won = pool[Math.floor(Math.random() * pool.length)];
        const wonKey = collectionKey(won.id, false);
        const isNew = !get().collection[wonKey];
        const pulled: PulledCard = { ...won, key: wonKey, foil: false, value: currentCardValue(won.rarity, false), isNew };

        set((s) => {
          const collection = { ...s.collection };
          collection[sourceKey] = Math.max(0, (collection[sourceKey] ?? 0) - cost);
          if (collection[sourceKey] === 0) delete collection[sourceKey];
          collection[wonKey] = (collection[wonKey] ?? 0) + 1;
          return { collection };
        });
        return pulled;
      },
    }),
    { name: "ino-casino-tcg" }
  )
);

function addToCollection(set: (fn: (s: TcgState) => Partial<TcgState>) => void, pulls: PulledCard[]) {
  set((s) => {
    const collection = { ...s.collection };
    for (const p of pulls) collection[p.key] = (collection[p.key] ?? 0) + 1;
    return { collection };
  });
}

function recordAndCelebrate(label: string, price: number, pulls: PulledCard[]) {
  const totalValue = pulls.reduce((sum, p) => sum + p.value, 0);
  const hasSecrete = pulls.some((p) => p.rarity === "secrete");
  // Free boosters (price=0) have no meaningful payout ratio — only a secrète pull still
  // triggers the big celebration, everything else is a quiet "none" tier.
  const tier = hasSecrete ? "maxWin" : price > 0 ? tierFromMultiplier(totalValue / price) : "none";
  const casino = useCasinoStore.getState();
  casino.recordRound({ game: "Boosters", label, bet: price, payout: totalValue, tier });

  if (hasSecrete) {
    useCelebrationStore.getState().trigger("maxWin", totalValue, "Boosters");
  }
}
