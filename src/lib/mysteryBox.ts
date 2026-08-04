// Mission rewards are rolled as a mystery box around the mission's stated amount, instead of a
// flat payout — same "surprise reveal" feel as the Bonus vault, scaled to whatever the mission
// was worth so a 150-credit mission and a 500-credit mission both feel proportionate.
const MULTIPLIERS = [0.4, 0.7, 1, 1, 1.3, 1.8, 3];
const WEIGHTS = [10, 20, 25, 25, 12, 6, 2];

export function rollMysteryReward(baseReward: number): number {
  let roll = Math.random() * WEIGHTS.reduce((a, b) => a + b, 0);
  for (let i = 0; i < MULTIPLIERS.length; i++) {
    if (roll < WEIGHTS[i]) return Math.max(1, Math.round(baseReward * MULTIPLIERS[i]));
    roll -= WEIGHTS[i];
  }
  return baseReward;
}
