import { RARITY_VALUE, DISPLAY_VALUE_MULTIPLIER, type CardRarity } from "./tcgCards";

const BUCKET_MS = 10 * 60 * 1000; // market moves every ~10 min

// Deterministic per-time-bucket hash — same technique as luckyHour.ts — so every client computes
// the same fluctuating multiplier without any server call or table.
function hashBucket(bucket: number, salt: string): number {
  let h = 0;
  const s = `${bucket}-${salt}`;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  return h;
}

// Bounded 0.7x-1.6x, average ~1x — enough swing to make "sell now or wait" a real choice
// without trivializing the house edge baked into RARITY_VALUE.
export function marketMultiplier(rarity: CardRarity, now = Date.now()): number {
  const bucket = Math.floor(now / BUCKET_MS);
  const h = hashBucket(bucket, rarity);
  return 0.7 + ((h % 1000) / 1000) * 0.9;
}

export function marketTrendUp(rarity: CardRarity, now = Date.now()): boolean {
  return marketMultiplier(rarity, now) >= marketMultiplier(rarity, now - BUCKET_MS);
}

export function currentCardValue(rarity: CardRarity, foil = false, now = Date.now()): number {
  const base = RARITY_VALUE[rarity] * marketMultiplier(rarity, now);
  return Math.round(foil ? base * DISPLAY_VALUE_MULTIPLIER : base);
}
