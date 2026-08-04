// ponytail: front-only PRNG dressed up as "casino math" — fine for a fictive social
// casino, would need a server-side authoritative RNG for anything real-money.

export function randInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

export function pick<T>(arr: readonly T[]): T {
  return arr[randInt(0, arr.length - 1)];
}

export interface Weighted<T> {
  value: T;
  weight: number;
}

export function weightedPick<T>(options: readonly Weighted<T>[]): T {
  const total = options.reduce((sum, o) => sum + o.weight, 0);
  let roll = Math.random() * total;
  for (const o of options) {
    if (roll < o.weight) return o.value;
    roll -= o.weight;
  }
  return options[options.length - 1].value;
}

export function chance(probability: number): boolean {
  return Math.random() < probability;
}

// Admin-adjustable win-probability knob. bias=1 is neutral (identical to weightedPick/chance).
// bias>1 flattens a weighted distribution toward rare/high-value entries (more generous);
// bias<1 sharpens it toward common/low-value entries (stingier).
export function biasedWeightedPick<T>(options: readonly Weighted<T>[], bias = 1): T {
  if (bias === 1) return weightedPick(options);
  const adjusted = options.map((o) => ({ value: o.value, weight: Math.max(1e-6, o.weight) ** (1 / bias) }));
  return weightedPick(adjusted);
}

// `probability` is the chance of the branch passed as `chance(probability)`. Set `invert: true`
// when that branch is unfavorable to the player (e.g. a "lose" chance) so bias still points the
// right way: generous (bias>1) always means better for the player.
export function biasedChance(probability: number, bias = 1, invert = false): boolean {
  if (bias === 1) return chance(probability);
  const adjusted = invert ? probability / bias : probability * bias;
  return chance(Math.min(0.98, Math.max(0.01, adjusted)));
}
