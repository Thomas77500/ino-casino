import { create } from "zustand";
import type { WinTier } from "../lib/winTiers";

// Separate from each game page's own local win-celebration state — this one is for events that
// can happen while the player is on ANY page (currently: the shared jackpot), so a single global
// <WinCelebration/> instance (mounted once in App.tsx) can react to it without every game file
// needing to know about the jackpot.
interface CelebrationState {
  tier: WinTier;
  payout: number;
  game: string;
  trigger: (tier: WinTier, payout: number, game: string) => void;
  clear: () => void;
}

export const useCelebrationStore = create<CelebrationState>((set) => ({
  tier: "none",
  payout: 0,
  game: "Casino",
  trigger: (tier, payout, game) => set({ tier, payout, game }),
  clear: () => set({ tier: "none", payout: 0 }),
}));
