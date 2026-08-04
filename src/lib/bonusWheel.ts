export interface WheelSegment {
  label: string;
  amount: number;
  weight: number;
}

export const WHEEL_SEGMENTS: WheelSegment[] = [
  { label: "150", amount: 150, weight: 22 },
  { label: "250", amount: 250, weight: 20 },
  { label: "400", amount: 400, weight: 16 },
  { label: "600", amount: 600, weight: 13 },
  { label: "900", amount: 900, weight: 10 },
  { label: "1 500", amount: 1500, weight: 7 },
  { label: "300", amount: 300, weight: 18 },
  { label: "JACKPOT", amount: 3000, weight: 2 },
  { label: "700", amount: 700, weight: 11 },
  { label: "200", amount: 200, weight: 20 },
];

export function rollWheel(): { amount: number; index: number } {
  const total = WHEEL_SEGMENTS.reduce((s, seg) => s + seg.weight, 0);
  let roll = Math.random() * total;
  for (let i = 0; i < WHEEL_SEGMENTS.length; i++) {
    if (roll < WHEEL_SEGMENTS[i].weight) return { amount: WHEEL_SEGMENTS[i].amount, index: i };
    roll -= WHEEL_SEGMENTS[i].weight;
  }
  return { amount: WHEEL_SEGMENTS[0].amount, index: 0 };
}
