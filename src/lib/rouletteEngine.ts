import { chance, randInt } from "./rng";

export type PocketColor = "red" | "black" | "green";

const RED_NUMBERS = new Set([1, 3, 5, 7, 9, 12, 14, 16, 18, 19, 21, 23, 25, 27, 30, 32, 34, 36]);

export function colorOf(n: number): PocketColor {
  if (n === 0) return "green";
  return RED_NUMBERS.has(n) ? "red" : "black";
}

export type BetKind =
  | { kind: "straight"; number: number }
  | { kind: "red" | "black" }
  | { kind: "odd" | "even" }
  | { kind: "low" | "high" } // 1-18 / 19-36
  | { kind: "dozen"; dozen: 1 | 2 | 3 }
  | { kind: "column"; column: 1 | 2 | 3 };

export const PAYOUT_MULTIPLIER: Record<BetKind["kind"], number> = {
  straight: 35,
  red: 1,
  black: 1,
  odd: 1,
  even: 1,
  low: 1,
  high: 1,
  dozen: 2,
  column: 2,
};

export interface SpinOutcome {
  number: number;
  color: PocketColor;
  luckyZone: boolean; // fictive "zone chanceuse" — doubles line payouts this round
  bonusSpin: boolean; // fictive flat bonus credit drop, independent of bets
  bonusAmount: number;
}

export interface SlipEntry {
  bet: BetKind;
  amount: number;
}

function payoutForNumber(number: number, slip: SlipEntry[]): number {
  const outcome = { number, color: colorOf(number) } as SpinOutcome;
  return slip.reduce((sum, s) => (betWins(s.bet, outcome) ? sum + s.amount * (PAYOUT_MULTIPLIER[s.bet.kind] + 1) : sum), 0);
}

// The wheel itself is a true 1/37 draw (real roulette, no weighting mechanism). To bias it
// against/for the player's actual bets, this samples a batch of candidate numbers and — with a
// chance derived from `bias` — swaps in whichever candidate pays the slip the least (stingy) or
// the most (generous), instead of the natural draw. At bias=1 this never triggers.
export function spinWheel(bet: number, slip: SlipEntry[] = [], bias = 1): SpinOutcome {
  let number = randInt(0, 36);

  if (bias !== 1 && slip.length > 0 && chance(Math.min(0.9, Math.abs(bias - 1) * 0.6))) {
    const candidates = Array.from({ length: 24 }, () => randInt(0, 36));
    const scored = candidates.map((n) => ({ n, payout: payoutForNumber(n, slip) }));
    const best = bias > 1
      ? scored.reduce((a, b) => (b.payout > a.payout ? b : a))
      : scored.reduce((a, b) => (b.payout < a.payout ? b : a));
    number = best.n;
  }

  const luckyZone = chance(0.06);
  const bonusSpin = chance(0.03);
  return {
    number,
    color: colorOf(number),
    luckyZone,
    bonusSpin,
    bonusAmount: bonusSpin ? Math.round(bet * (2 + Math.random() * 4)) : 0,
  };
}

export function betWins(bet: BetKind, outcome: SpinOutcome): boolean {
  const n = outcome.number;
  switch (bet.kind) {
    case "straight":
      return bet.number === n;
    case "red":
      return outcome.color === "red";
    case "black":
      return outcome.color === "black";
    case "odd":
      return n !== 0 && n % 2 === 1;
    case "even":
      return n !== 0 && n % 2 === 0;
    case "low":
      return n >= 1 && n <= 18;
    case "high":
      return n >= 19 && n <= 36;
    case "dozen":
      if (n === 0) return false;
      return Math.ceil(n / 12) === bet.dozen;
    case "column":
      if (n === 0) return false;
      return ((n - 1) % 3) + 1 === bet.column;
  }
}

export function betLabel(bet: BetKind): string {
  switch (bet.kind) {
    case "straight": return `Numéro ${bet.number}`;
    case "red": return "Rouge";
    case "black": return "Noir";
    case "odd": return "Impair";
    case "even": return "Pair";
    case "low": return "1-18";
    case "high": return "19-36";
    case "dozen": return `Douzaine ${bet.dozen}`;
    case "column": return `Colonne ${bet.column}`;
  }
}
