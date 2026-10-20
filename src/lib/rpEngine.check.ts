// Self-check for the role-play layer. Run: npx esbuild src/lib/rpEngine.check.ts --bundle --platform=node | node
import { applyEffect, buildEventOptions, seasonInterludes, type Ctx, type RpState } from "./rpEngine";

const assert = (cond: unknown, msg: string) => {
  if (!cond) throw new Error(`FAIL: ${msg}`);
};

const ctx: Ctx = {
  factions: [
    { id: "bold", label: "Les Audacieux", short: "Aud", lean: 0.8 },
    { id: "calm", label: "Les Prudents", short: "Pru", lean: -0.8 },
  ],
  mUnit: 1000,
  mFloor: 0,
  lexicon: { delegate: "Bob", gamble: "Bluff", gambleWin: "ok", gambleLose: "ko" },
  chaos: () => ({ a: 0, r: 0, m: 0, factions: {}, text: "chaos" }),
};
const base: RpState = { a: 50, r: 10, m: 0, factions: { bold: 50, calm: 50 }, flags: [], journal: [], stanceCounts: {} };
const event = {
  id: "e",
  category: "x",
  title: "Affaire Test",
  description: "",
  choices: [
    { label: "Sage", outcome: "calme", a: 2, r: 1, m: 0 },
    { label: "Cher", outcome: "payé", a: 4, r: -2, m: -5000 },
  ],
};

// clamping, flags in, flags consumed
const s1 = applyEffect(base, { a: 80, r: -50, m: 300, factions: { bold: 70 }, text: "", flags: ["x"] });
assert(s1.a === 100 && s1.r === 0 && s1.m === 300 && s1.factions.bold === 100 && s1.flags.includes("x"), "applyEffect clamps and adds flags");
assert(!applyEffect(s1, { a: 0, r: 0, m: 0, factions: {}, text: "", consume: ["x"] }).flags.includes("x"), "applyEffect consumes flags");

// gating: unaffordable choice and leverage are locked at the start
const opts = buildEventOptions(event, base, ctx);
assert(opts.length === 5, "2 authored + delegate + leverage + gamble");
assert(opts.find((o) => o.key === "c1")!.locked, "costly choice locked with an empty treasury");
assert(opts.find((o) => o.key === "leverage")!.locked, "leverage needs a camp at 60+");

// once a camp trusts you, leverage works, costs that camp, and leaves a debt
const trusted = { ...base, m: 10000, factions: { bold: 70, calm: 40 } };
const lev = buildEventOptions(event, trusted, ctx).find((o) => o.key === "leverage")!;
assert(!lev.locked, "leverage unlocked at 70");
const e = lev.resolve();
assert(e.flags?.includes("favor:bold") && e.factions.bold < 0, "leverage spends the favour and records the debt");

// the debt and a scandal come back next season, capped at two interludes
const later = applyEffect(trusted, { a: 0, r: 0, m: 0, factions: { calm: -30 }, text: "", flags: ["favor:bold", "scandal:Affaire Test"] });
const inter = seasonInterludes(later, ctx);
assert(inter.length === 2 && inter[0].id === "scandal:Affaire Test" && inter[1].id === "favor:bold", "scandal then favour, max two");
const hush = inter[0].options.find((o) => o.key === "hush")!;
assert(!applyEffect(later, hush.resolve()).flags.includes("scandal:Affaire Test"), "resolving a scandal clears it");

console.log("rpEngine: all checks passed");
