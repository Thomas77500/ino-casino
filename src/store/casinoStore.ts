import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { WinTier } from "../lib/winTiers";
import { rollWheel } from "../lib/bonusWheel";
import { xpForPayout } from "../lib/xp";
import { MAX_LEVEL } from "../lib/levelTitles";
import { rollMysteryReward } from "../lib/mysteryBox";
import { isLuckyHourNow, LUCKY_HOUR_BONUS_RATE } from "../lib/luckyHour";
import { useJackpotStore } from "./jackpotStore";

export interface HistoryEntry {
  id: string;
  game: "Slots" | "Blackjack" | "Roulette" | "ChickenRoad" | "Plinko" | "Crash" | "ScratchCards" | "Bourse" | "Braquage" | "Boosters" | "Bonus";
  label: string;
  bet: number;
  payout: number;
  tier: WinTier;
  ts: number;
}

export type MissionKind = "playRounds" | "winRounds" | "wagerTotal" | "bigWin" | "playRoulette" | "playBlackjack";

export interface Mission {
  id: string;
  title: string;
  kind: MissionKind;
  target: number;
  progress: number;
  reward: number;
  xp: number;
  claimed: boolean;
}

const DAILY_STREAK_REWARDS = [150, 200, 300, 400, 550, 750, 1200];
const VAULT_COOLDOWN_MS = 10 * 60 * 1000;
const WHEEL_COOLDOWN_MS = 20 * 60 * 1000;

function todayKey(): string {
  return new Date().toISOString().slice(0, 10);
}

function defaultMissions(): Mission[] {
  return [
    { id: "play20", title: "Jouer 20 parties", kind: "playRounds", target: 20, progress: 0, reward: 200, xp: 40, claimed: false },
    { id: "win5", title: "Remporter 5 parties", kind: "winRounds", target: 5, progress: 0, reward: 300, xp: 60, claimed: false },
    { id: "wager5000", title: "Miser 5 000 crédits cumulés", kind: "wagerTotal", target: 5000, progress: 0, reward: 250, xp: 50, claimed: false },
    { id: "roulette3", title: "Jouer 3 tours de roulette", kind: "playRoulette", target: 3, progress: 0, reward: 150, xp: 30, claimed: false },
    { id: "blackjack3", title: "Jouer 3 mains de blackjack", kind: "playBlackjack", target: 3, progress: 0, reward: 150, xp: 30, claimed: false },
    { id: "bigwin1", title: "Décrocher un Mega Win ou plus", kind: "bigWin", target: 1, progress: 0, reward: 500, xp: 100, claimed: false },
  ];
}

interface CasinoState {
  credits: number;
  level: number;
  xp: number;
  xpToNext: number;
  streakCount: number;
  lastDailyClaim: string | null;
  lastVaultClaim: number | null;
  lastWheelClaim: number | null;
  missionsDay: string;
  missions: Mission[];
  history: HistoryEntry[];
  totalWagered: number;
  totalWon: number;
  biggestWin: number;
  gamesPlayed: Partial<Record<HistoryEntry["game"], number>>;
  ownedFrames: string[];

  canBet: (amount: number) => boolean;
  placeBet: (amount: number) => void;
  award: (amount: number) => void;
  buyFrame: (id: string, price: number) => boolean;
  addXp: (amount: number) => void;
  recordRound: (entry: Omit<HistoryEntry, "id" | "ts">) => void;
  claimDaily: () => number;
  canClaimDaily: () => boolean;
  claimVault: () => number;
  vaultMsRemaining: () => number;
  claimWheel: () => { amount: number; index: number } | null;
  wheelMsRemaining: () => number;
  claimMission: (id: string) => number;
}

export const useCasinoStore = create<CasinoState>()(
  persist(
    (set, get) => ({
      credits: 5000,
      level: 1,
      xp: 0,
      xpToNext: 150,
      streakCount: 0,
      lastDailyClaim: null,
      lastVaultClaim: null,
      lastWheelClaim: null,
      missionsDay: todayKey(),
      missions: defaultMissions(),
      history: [],
      totalWagered: 0,
      totalWon: 0,
      biggestWin: 0,
      gamesPlayed: {},
      ownedFrames: ["none"],

      canBet: (amount) => get().credits >= amount,

      placeBet: (amount) => {
        set((s) => ({ credits: s.credits - amount, totalWagered: s.totalWagered + amount }));
        useJackpotStore.getState().contribute(amount);
        useJackpotStore.getState().tryHit();
      },

      award: (amount) =>
        set((s) => {
          const bonus = isLuckyHourNow() ? Math.round(amount * LUCKY_HOUR_BONUS_RATE) : 0;
          const total = amount + bonus;
          return {
            credits: s.credits + total,
            totalWon: s.totalWon + total,
            biggestWin: Math.max(s.biggestWin, total),
          };
        }),

      buyFrame: (id, price) => {
        const s = get();
        if (s.ownedFrames.includes(id) || s.credits < price) return false;
        set({ credits: s.credits - price, ownedFrames: [...s.ownedFrames, id] });
        return true;
      },

      addXp: (amount) =>
        set((s) => {
          let { xp, level, xpToNext, credits } = s;
          if (level >= MAX_LEVEL) return {};
          xp += amount;
          while (xp >= xpToNext && level < MAX_LEVEL) {
            xp -= xpToNext;
            level += 1;
            xpToNext = 150 + level * 60;
            credits += 100 + level * 20; // level-up bonus
          }
          return { xp, level, xpToNext, credits };
        }),

      recordRound: (entry) =>
        set((s) => {
          const day = todayKey();
          const resetMissions = s.missionsDay !== day ? defaultMissions() : s.missions;

          const missions = resetMissions.map((m) => {
            if (m.claimed) return m;
            let delta = 0;
            if (m.kind === "playRounds") delta = 1;
            if (m.kind === "winRounds" && entry.payout > entry.bet) delta = 1;
            if (m.kind === "wagerTotal") delta = entry.bet;
            if (m.kind === "playRoulette" && entry.game === "Roulette") delta = 1;
            if (m.kind === "playBlackjack" && entry.game === "Blackjack") delta = 1;
            if (m.kind === "bigWin" && (entry.tier === "megaWin" || entry.tier === "gigaWin" || entry.tier === "maxWin")) delta = 1;
            return delta ? { ...m, progress: Math.min(m.target, m.progress + delta) } : m;
          });

          const newEntry: HistoryEntry = { ...entry, id: crypto.randomUUID(), ts: Date.now() };
          return {
            missionsDay: day,
            missions,
            history: [newEntry, ...s.history].slice(0, 60),
            gamesPlayed: { ...s.gamesPlayed, [entry.game]: (s.gamesPlayed[entry.game] ?? 0) + 1 },
          };
        }),

      canClaimDaily: () => get().lastDailyClaim !== todayKey(),

      claimDaily: () => {
        const s = get();
        if (!s.canClaimDaily()) return 0;
        const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
        const nextStreak = s.lastDailyClaim === yesterday ? s.streakCount + 1 : 1;
        const reward = DAILY_STREAK_REWARDS[Math.min(nextStreak - 1, DAILY_STREAK_REWARDS.length - 1)];
        set({ lastDailyClaim: todayKey(), streakCount: nextStreak, credits: s.credits + reward });
        get().addXp(xpForPayout(reward));
        return reward;
      },

      vaultMsRemaining: () => {
        const last = get().lastVaultClaim;
        if (!last) return 0;
        return Math.max(0, VAULT_COOLDOWN_MS - (Date.now() - last));
      },

      claimVault: () => {
        const s = get();
        if (s.vaultMsRemaining() > 0) return 0;
        const rewards = [80, 120, 150, 200, 300, 500, 1000];
        const weights = [22, 22, 20, 15, 12, 7, 2];
        let roll = Math.random() * weights.reduce((a, b) => a + b, 0);
        let reward = rewards[0];
        for (let i = 0; i < rewards.length; i++) {
          if (roll < weights[i]) { reward = rewards[i]; break; }
          roll -= weights[i];
        }
        set({ lastVaultClaim: Date.now(), credits: s.credits + reward });
        get().addXp(xpForPayout(reward));
        return reward;
      },

      wheelMsRemaining: () => {
        const last = get().lastWheelClaim;
        if (!last) return 0;
        return Math.max(0, WHEEL_COOLDOWN_MS - (Date.now() - last));
      },

      claimWheel: () => {
        const s = get();
        if (s.wheelMsRemaining() > 0) return null;
        const result = rollWheel();
        set({ lastWheelClaim: Date.now(), credits: s.credits + result.amount });
        get().addXp(xpForPayout(result.amount));
        return result;
      },

      claimMission: (id) => {
        const s = get();
        const mission = s.missions.find((m) => m.id === id);
        if (!mission || mission.claimed || mission.progress < mission.target) return 0;
        const reward = rollMysteryReward(mission.reward);
        set({
          credits: s.credits + reward,
          missions: s.missions.map((m) => (m.id === id ? { ...m, claimed: true } : m)),
        });
        get().addXp(mission.xp);
        return reward;
      },
    }),
    { name: "ino-casino-store" }
  )
);
