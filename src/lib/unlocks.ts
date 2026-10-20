// Total-won thresholds for the secret games. Lives in its own tiny module so the game lobby can
// show lock progress without pulling every engine into the main bundle.
export const UNLOCKS = {
  blackmarket: 15_000_000,
  ministry: 25_000_000,
  club: 35_000_000,
  startup: 40_000_000,
  sect: 45_000_000,
  mafia: 55_000_000,
  area51: 60_000_000,
  bourse: 100_000_000,
} as const;
