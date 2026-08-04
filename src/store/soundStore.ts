import { create } from "zustand";
import { persist } from "zustand/middleware";

interface SoundState {
  muted: boolean;
  volume: number;
  toggleMuted: () => void;
  setVolume: (v: number) => void;
}

export const useSoundStore = create<SoundState>()(
  persist(
    (set) => ({
      muted: false,
      volume: 0.5,
      toggleMuted: () => set((s) => ({ muted: !s.muted })),
      setVolume: (v) => set({ volume: Math.min(1, Math.max(0, v)) }),
    }),
    { name: "ino-casino-sound" }
  )
);
