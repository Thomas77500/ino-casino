export type Suit = "♠" | "♥" | "♦" | "♣";
export type Rank = "A" | "2" | "3" | "4" | "5" | "6" | "7" | "8" | "9" | "10" | "J" | "Q" | "K";

export interface Card {
  rank: Rank;
  suit: Suit;
  id: string;
}

const RANKS: Rank[] = ["A", "2", "3", "4", "5", "6", "7", "8", "9", "10", "J", "Q", "K"];
const SUITS: Suit[] = ["♠", "♥", "♦", "♣"];

const HIGH_RANKS = new Set<Rank>(["10", "J", "Q", "K", "A"]);

// No isolated "win chance" exists in blackjack — house edge comes from fixed dealer rules. The
// closest honest lever is the shuffle itself: a soft nudge (not a guarantee) that shifts how
// often high cards (10/J/Q/K/A — the ones that make blackjacks and strong totals) land near the
// front of the shoe. bias>1 nudges them earlier (helps whoever draws next, generally the
// player); bias<1 pushes them later.
export function createShoe(decks = 2, bias = 1): Card[] {
  const shoe: Card[] = [];
  for (let d = 0; d < decks; d++) {
    for (const suit of SUITS) {
      for (const rank of RANKS) {
        shoe.push({ rank, suit, id: `${rank}${suit}-${d}-${Math.random()}` });
      }
    }
  }
  for (let i = shoe.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shoe[i], shoe[j]] = [shoe[j], shoe[i]];
  }

  if (bias !== 1) {
    const tilt = bias - 1; // roughly -0.5..+1
    shoe.sort((a, b) => {
      const scoreA = (HIGH_RANKS.has(a.rank) ? -tilt : tilt) + (Math.random() - 0.5) * 2;
      const scoreB = (HIGH_RANKS.has(b.rank) ? -tilt : tilt) + (Math.random() - 0.5) * 2;
      return scoreA - scoreB;
    });
  }

  return shoe;
}

export function rankValue(rank: Rank): number {
  if (rank === "A") return 11;
  if (rank === "J" || rank === "Q" || rank === "K") return 10;
  return Number(rank);
}

export function handValue(cards: Card[]): { total: number; soft: boolean } {
  let total = cards.reduce((sum, c) => sum + rankValue(c.rank), 0);
  let aces = cards.filter((c) => c.rank === "A").length;
  while (total > 21 && aces > 0) {
    total -= 10;
    aces -= 1;
  }
  const soft = cards.some((c) => c.rank === "A") && total <= 21 && aces > 0;
  return { total, soft };
}

export function isBlackjack(cards: Card[]): boolean {
  return cards.length === 2 && handValue(cards).total === 21;
}

export function dealerShouldHit(cards: Card[]): boolean {
  const { total, soft } = handValue(cards);
  if (total < 17) return true;
  if (total === 17 && soft) return true; // hit soft 17
  return false;
}

// Perfect Pairs side bet — resolved on the initial two cards only, independent of the hand's outcome.
export type PerfectPairResult = "none" | "mixed" | "colored" | "perfect";

export const PERFECT_PAIR_PAYOUT: Record<Exclude<PerfectPairResult, "none">, number> = {
  mixed: 6,
  colored: 12,
  perfect: 25,
};

export const PERFECT_PAIR_LABEL: Record<Exclude<PerfectPairResult, "none">, string> = {
  mixed: "Paire mixte",
  colored: "Paire colorée",
  perfect: "Paire parfaite",
};

function isRedSuit(suit: Suit): boolean {
  return suit === "♥" || suit === "♦";
}

export function evaluatePerfectPair([a, b]: [Card, Card]): PerfectPairResult {
  if (a.rank !== b.rank) return "none";
  if (a.suit === b.suit) return "perfect";
  return isRedSuit(a.suit) === isRedSuit(b.suit) ? "colored" : "mixed";
}
