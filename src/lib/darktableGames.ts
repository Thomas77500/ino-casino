import { randInt, pick } from "./rng";
import { colorOf, type PocketColor } from "./rouletteEngine";

// Table Clandestine rotates between several shared-round formats instead of running Crash on
// repeat. Crash keeps its "cash out anytime during the climb" mechanic; roulette and dice are
// simpler "pick a side before reveal" rounds — everyone's bet resolves at the same instant, no
// per-player timing skill involved, which keeps the shared-round model dead simple to reason about.
export type DarktableGameType = "crash" | "roulette" | "dice";
export const GAME_ROTATION: DarktableGameType[] = ["crash", "roulette", "dice", "roulette", "dice"];

export function rollGameType(): DarktableGameType {
  return pick(GAME_ROTATION);
}

// How long the reveal animation (wheel spin / dice roll) runs before the round is "ended" —
// roulette and dice have no growth curve to time against, so this is just a fixed flourish.
export const REVEAL_WINDOW_MS = 4200;

export type RouletteChoice = "rouge" | "noir" | "vert";
export const ROULETTE_PAYOUT: Record<RouletteChoice, number> = { rouge: 2, noir: 2, vert: 14 };

export function rollRouletteNumber(): number {
  return randInt(0, 36);
}

export function rouletteChoiceWins(choice: RouletteChoice, number: number): boolean {
  const color: PocketColor = colorOf(number);
  return (choice === "rouge" && color === "red") || (choice === "noir" && color === "black") || (choice === "vert" && color === "green");
}

export type DiceChoice = "sous" | "sur";
export const DICE_PAYOUT = 1.92;
export const DICE_TARGET = 50;

// Continuous 0-100 roll — ties are ~impossible, no need for a push rule.
export function rollDiceOutcome(): number {
  return Math.round(Math.random() * 10000) / 100;
}

export function diceChoiceWins(choice: DiceChoice, roll: number): boolean {
  return choice === "sous" ? roll < DICE_TARGET : roll > DICE_TARGET;
}
