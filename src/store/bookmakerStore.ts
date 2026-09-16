import { create } from "zustand";
import { persist } from "zustand/middleware";

// Persisted locally (no server-side stakes here, same as Blanchiment) — the whole point is to give
// Bookmaker Clandestin a career that actually accumulates across sessions instead of resetting to
// a flat, static round every time: réputation unlocks bigger houseStake/pools (see REP_TIERS in
// bookmakerEngine.ts), and named regulars build individual trust that colors how bad-payer events
// play out with them specifically.
interface BookmakerState {
  reputation: number;
  regularTrust: Record<string, number>;
  adjustReputation: (delta: number) => void;
  adjustTrust: (regularId: string, delta: number) => void;
  trustFor: (regularId: string) => number;
}

export const useBookmakerStore = create<BookmakerState>()(
  persist(
    (set, get) => ({
      reputation: 0,
      regularTrust: {},

      adjustReputation: (delta) => set((s) => ({ reputation: Math.max(0, s.reputation + delta) })),

      adjustTrust: (regularId, delta) =>
        set((s) => ({
          regularTrust: { ...s.regularTrust, [regularId]: Math.max(0, Math.min(100, (s.regularTrust[regularId] ?? 50) + delta)) },
        })),

      trustFor: (regularId) => get().regularTrust[regularId] ?? 50,
    }),
    { name: "ino-casino-bookmaker" }
  )
);
