import { useState } from "react";
import { useCasinoStore } from "../store/casinoStore";
import { useToastStore } from "../store/toastStore";
import { useGameStatusStore } from "../store/gameStatusStore";
import { Card } from "../components/ui/Card";
import { Button } from "../components/ui/Button";
import { Badge } from "../components/ui/Badge";
import { BetInput } from "../components/ui/BetInput";
import { WinCelebration } from "../components/ui/WinCelebration";
import { PlayingCard } from "../components/games/PlayingCard";
import { formatCredits } from "../lib/format";
import { maxBetFor } from "../lib/betting";
import { xpForPayout } from "../lib/xp";
import {
  createShoe,
  handValue,
  isBlackjack,
  dealerShouldHit,
  evaluatePerfectPair,
  PERFECT_PAIR_PAYOUT,
  PERFECT_PAIR_LABEL,
  type Card as CardT,
  type PerfectPairResult,
} from "../lib/blackjackEngine";
import { tierFromMultiplier, type WinTier } from "../lib/winTiers";

interface Hand {
  cards: CardT[];
  bet: number;
  status: "playing" | "stood" | "bust" | "blackjack";
  outcome?: "win" | "lose" | "push" | "blackjack";
  payout?: number;
}

type Phase = "betting" | "player" | "dealer" | "result";

export function Blackjack() {
  const credits = useCasinoStore((s) => s.credits);
  const level = useCasinoStore((s) => s.level);
  const placeBet = useCasinoStore((s) => s.placeBet);
  const award = useCasinoStore((s) => s.award);
  const addXp = useCasinoStore((s) => s.addXp);
  const recordRound = useCasinoStore((s) => s.recordRound);
  const history = useCasinoStore((s) => s.history);
  const push = useToastStore((s) => s.push);
  const winBias = useGameStatusStore((s) => s.statuses.blackjack?.winBias ?? 1);

  const maxBet = maxBetFor(credits, level);
  const [bet, setBet] = useState(Math.min(50, maxBet));
  const [sideBetOn, setSideBetOn] = useState(false);
  const [sideBet, setSideBet] = useState(Math.min(10, maxBet));
  const [sideBetResult, setSideBetResult] = useState<PerfectPairResult | null>(null);
  const [shoe, setShoe] = useState<CardT[]>(() => createShoe(2, winBias));
  const [phase, setPhase] = useState<Phase>("betting");
  const [hands, setHands] = useState<Hand[]>([]);
  const [activeHand, setActiveHand] = useState(0);
  const [dealerCards, setDealerCards] = useState<CardT[]>([]);
  const [dealerHidden, setDealerHidden] = useState(true);
  const [celebration, setCelebration] = useState<{ tier: WinTier; payout: number } | null>(null);

  const totalStake = bet + (sideBetOn ? sideBet : 0);

  const bjHistory = history.filter((h) => h.game === "Blackjack").slice(0, 8);

  function draw(currentShoe: CardT[]): [CardT, CardT[]] {
    let s = currentShoe;
    if (s.length < 10) s = createShoe(2, winBias);
    const [card, ...rest] = s;
    return [card, rest];
  }

  function deal() {
    if (credits < totalStake) {
      push({ kind: "info", title: "Crédits insuffisants" });
      return;
    }
    placeBet(totalStake);
    let s = shoe;
    const playerCards: CardT[] = [];
    const dealer: CardT[] = [];
    let c: CardT;
    [c, s] = draw(s); playerCards.push(c);
    [c, s] = draw(s); dealer.push(c);
    [c, s] = draw(s); playerCards.push(c);
    [c, s] = draw(s); dealer.push(c);

    setShoe(s);
    setDealerCards(dealer);
    setDealerHidden(true);
    setActiveHand(0);

    if (sideBetOn && sideBet > 0) {
      const result = evaluatePerfectPair([playerCards[0], playerCards[1]]);
      setSideBetResult(result);
      if (result !== "none") {
        const payout = sideBet * PERFECT_PAIR_PAYOUT[result];
        award(payout);
        addXp(xpForPayout(payout));
        recordRound({ game: "Blackjack", label: PERFECT_PAIR_LABEL[result], bet: sideBet, payout, tier: tierFromMultiplier(payout / sideBet) });
        push({ kind: "bonus", title: `${PERFECT_PAIR_LABEL[result]} ! x${PERFECT_PAIR_PAYOUT[result]}`, description: `+${formatCredits(payout)} crédits` });
      } else {
        recordRound({ game: "Blackjack", label: "Paire parfaite (perdue)", bet: sideBet, payout: 0, tier: "none" });
      }
    } else {
      setSideBetResult(null);
    }

    const playerBJ = isBlackjack(playerCards);
    const hand: Hand = { cards: playerCards, bet, status: playerBJ ? "blackjack" : "playing" };
    setHands([hand]);

    if (playerBJ) {
      setPhase("dealer");
      setTimeout(() => runDealer([hand], dealer, s), 500);
    } else {
      setPhase("player");
    }
  }

  function updateActiveHand(mutator: (h: Hand) => Hand) {
    setHands((prev) => prev.map((h, i) => (i === activeHand ? mutator(h) : h)));
  }

  function advanceOrDealer(nextHands: Hand[]) {
    const nextIdx = nextHands.findIndex((h, i) => i > activeHand && h.status === "playing");
    if (nextIdx !== -1) {
      setActiveHand(nextIdx);
    } else {
      setPhase("dealer");
      setTimeout(() => runDealer(nextHands, dealerCards, shoe), 500);
    }
  }

  function hit() {
    let s = shoe;
    let c: CardT;
    [c, s] = draw(s);
    const hand = hands[activeHand];
    const newCards = [...hand.cards, c];
    const { total } = handValue(newCards);
    const status: Hand["status"] = total > 21 ? "bust" : "playing";
    const updated = { ...hand, cards: newCards, status };
    const nextHands = hands.map((h, i) => (i === activeHand ? updated : h));
    setHands(nextHands);
    setShoe(s);
    if (status === "bust") advanceOrDealer(nextHands);
  }

  function stand() {
    const nextHands = hands.map((h, i) => (i === activeHand ? { ...h, status: "stood" as const } : h));
    setHands(nextHands);
    advanceOrDealer(nextHands);
  }

  function double() {
    const hand = hands[activeHand];
    if (credits < hand.bet) return;
    placeBet(hand.bet);
    let s = shoe;
    let c: CardT;
    [c, s] = draw(s);
    const newCards = [...hand.cards, c];
    const { total } = handValue(newCards);
    const updated: Hand = { ...hand, cards: newCards, bet: hand.bet * 2, status: total > 21 ? "bust" : "stood" };
    const nextHands = hands.map((h, i) => (i === activeHand ? updated : h));
    setHands(nextHands);
    setShoe(s);
    advanceOrDealer(nextHands);
  }

  function split() {
    const hand = hands[activeHand];
    if (hand.cards.length !== 2 || handValue([hand.cards[0]]).total !== handValue([hand.cards[1]]).total) return;
    if (credits < hand.bet || hands.length > 1) return;
    placeBet(hand.bet);
    let s = shoe;
    let c1: CardT, c2: CardT;
    [c1, s] = draw(s);
    [c2, s] = draw(s);
    const handA: Hand = { cards: [hand.cards[0], c1], bet: hand.bet, status: "playing" };
    const handB: Hand = { cards: [hand.cards[1], c2], bet: hand.bet, status: "playing" };
    setHands([handA, handB]);
    setShoe(s);
    setActiveHand(0);
  }

  function runDealer(finalHands: Hand[], startDealer: CardT[], startShoe: CardT[]) {
    setDealerHidden(false);
    const anyoneLeft = finalHands.some((h) => h.status !== "bust");
    let dealer = startDealer;
    let s = startShoe;

    function step() {
      if (anyoneLeft && dealerShouldHit(dealer)) {
        let c: CardT;
        [c, s] = draw(s);
        dealer = [...dealer, c];
        setDealerCards(dealer);
        setShoe(s);
        setTimeout(step, 550);
      } else {
        resolve(finalHands, dealer);
      }
    }
    setTimeout(step, 400);
  }

  function resolve(finalHands: Hand[], dealer: CardT[]) {
    const dealerTotal = handValue(dealer).total;
    const dealerBust = dealerTotal > 21;

    let totalPayout = 0;
    let totalBet = 0;
    const resolvedHands = finalHands.map((h) => {
      totalBet += h.bet;
      if (h.status === "bust") return { ...h, outcome: "lose" as const, payout: 0 };
      const playerTotal = handValue(h.cards).total;
      if (h.status === "blackjack") {
        const payout = h.bet * 2.5;
        totalPayout += payout;
        return { ...h, outcome: "blackjack" as const, payout };
      }
      if (dealerBust || playerTotal > dealerTotal) {
        const payout = h.bet * 2;
        totalPayout += payout;
        return { ...h, outcome: "win" as const, payout };
      }
      if (playerTotal === dealerTotal) {
        totalPayout += h.bet;
        return { ...h, outcome: "push" as const, payout: h.bet };
      }
      return { ...h, outcome: "lose" as const, payout: 0 };
    });

    setHands(resolvedHands);
    setPhase("result");

    if (totalPayout > 0) {
      award(totalPayout);
      addXp(xpForPayout(totalPayout));
    }
    const netMultiplier = totalPayout / totalBet;
    const tier = totalPayout > totalBet ? tierFromMultiplier(netMultiplier) : "none";
    recordRound({ game: "Blackjack", label: "Manche", bet: totalBet, payout: totalPayout, tier });

    if (tier === "megaWin" || tier === "gigaWin" || tier === "maxWin") {
      setCelebration({ tier, payout: totalPayout });
    } else if (totalPayout > totalBet) {
      push({ kind: "success", title: `Manche gagnée : +${formatCredits(totalPayout - totalBet)} crédits` });
    } else if (totalPayout === 0) {
      push({ kind: "info", title: "Manche perdue" });
    }
  }

  function newRound() {
    setHands([]);
    setDealerCards([]);
    setSideBetResult(null);
    setPhase("betting");
  }

  const active = hands[activeHand];
  const canDouble = phase === "player" && active?.cards.length === 2 && credits >= (active?.bet ?? 0);
  const canSplit =
    phase === "player" &&
    hands.length === 1 &&
    active?.cards.length === 2 &&
    handValue([active.cards[0]]).total === handValue([active.cards[1]]).total &&
    credits >= (active?.bet ?? 0);

  return (
    <div className="mx-auto max-w-4xl px-4 py-8 sm:px-6">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="font-display text-2xl font-bold text-white sm:text-3xl">Blackjack Royal</h1>
          <p className="text-sm text-ice-200/60">21 face au croupier — le Blackjack paie 3:2</p>
        </div>
        <Badge tone="gold">Crédits virtuels uniquement</Badge>
      </div>

      <Card className="p-4 sm:p-8" glow>
        <div className="rounded-2xl border border-electric-500/20 bg-gradient-to-b from-electric-950/40 to-ink-950/60 p-4 sm:p-8">
          <div className="mb-8">
            <div className="mb-2 flex items-center gap-2 text-xs uppercase tracking-wide text-ice-200/50">
              Croupier {dealerCards.length > 0 && !dealerHidden && <span className="text-white">— {handValue(dealerCards).total}</span>}
            </div>
            <div className="flex gap-2 sm:gap-3">
              {dealerCards.map((c, i) => (
                <PlayingCard key={c.id} card={c} hidden={i === 1 && dealerHidden} index={i} />
              ))}
              {dealerCards.length === 0 && <PlayingCard card={null} hidden index={0} />}
            </div>
          </div>

          <div className="flex flex-col gap-4">
            {hands.length === 0 && (
              <div className="flex gap-2 sm:gap-3 opacity-40">
                <PlayingCard card={null} hidden />
                <PlayingCard card={null} hidden />
              </div>
            )}
            {hands.map((h, i) => (
              <div key={i} className={`rounded-xl p-2 transition-colors ${i === activeHand && phase === "player" ? "bg-electric-500/10 ring-1 ring-electric-400/40" : ""}`}>
                <div className="mb-2 flex items-center gap-2 text-xs uppercase tracking-wide text-ice-200/50">
                  {hands.length > 1 ? `Main ${i + 1}` : "Votre main"}
                  <span className="text-white">— {handValue(h.cards).total}</span>
                  {h.outcome && (
                    <Badge tone={h.outcome === "lose" ? "neutral" : h.outcome === "push" ? "electric" : "success"}>
                      {h.outcome === "blackjack" ? "Blackjack !" : h.outcome === "win" ? "Gagné" : h.outcome === "push" ? "Égalité" : "Perdu"}
                    </Badge>
                  )}
                  {i === 0 && sideBetResult && sideBetResult !== "none" && (
                    <Badge tone="gold">{PERFECT_PAIR_LABEL[sideBetResult]} x{PERFECT_PAIR_PAYOUT[sideBetResult]}</Badge>
                  )}
                </div>
                <div className="flex gap-2 sm:gap-3">
                  {h.cards.map((c, ci) => (
                    <PlayingCard key={c.id} card={c} index={ci} />
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>

        {phase === "betting" && (
          <div className="mt-6 rounded-xl border border-white/10 bg-white/[0.02] p-4">
            <label className="flex items-center gap-2 text-sm font-medium text-white">
              <input type="checkbox" checked={sideBetOn} onChange={(e) => setSideBetOn(e.target.checked)} className="h-4 w-4 accent-gold-400" />
              Mise Paire Parfaite (optionnelle)
            </label>
            <p className="mt-1 text-xs text-ice-200/50">Paire mixte x{PERFECT_PAIR_PAYOUT.mixed} · Paire colorée x{PERFECT_PAIR_PAYOUT.colored} · Paire parfaite x{PERFECT_PAIR_PAYOUT.perfect}</p>
            {sideBetOn && (
              <div className="mt-3">
                <BetInput value={sideBet} onChange={setSideBet} max={maxBet} min={Math.min(5, maxBet)} />
              </div>
            )}
          </div>
        )}

        <div className="mt-6 flex flex-wrap items-center justify-between gap-4">
          {phase === "betting" ? (
            <>
              <BetInput value={bet} onChange={setBet} max={maxBet} min={Math.min(10, maxBet)} />
              <Button size="lg" onClick={deal} disabled={credits < totalStake}>
                Distribuer ({formatCredits(totalStake)})
              </Button>
            </>
          ) : phase === "player" ? (
            <div className="flex flex-wrap gap-2">
              <Button onClick={hit}>Tirer</Button>
              <Button variant="secondary" onClick={stand}>Rester</Button>
              <Button variant="secondary" onClick={double} disabled={!canDouble}>Doubler</Button>
              <Button variant="secondary" onClick={split} disabled={!canSplit}>Séparer</Button>
            </div>
          ) : phase === "result" ? (
            <Button size="lg" onClick={newRound}>Nouvelle manche</Button>
          ) : (
            <p className="text-sm text-ice-200/60">Le croupier joue...</p>
          )}
        </div>
      </Card>

      {bjHistory.length > 0 && (
        <Card className="mt-6 p-4">
          <h3 className="mb-3 font-display text-sm font-semibold text-white">Historique récent</h3>
          <ul className="flex flex-col gap-2">
            {bjHistory.map((h) => (
              <li key={h.id} className="flex items-center justify-between text-xs">
                <span className="text-ice-200/60">Mise {formatCredits(h.bet)}</span>
                <span className={h.payout > h.bet ? "font-semibold text-emerald-400" : "text-ice-200/40"}>
                  {h.payout > 0 ? `+${formatCredits(h.payout)}` : "—"}
                </span>
              </li>
            ))}
          </ul>
        </Card>
      )}

      <WinCelebration tier={celebration?.tier ?? "none"} payout={celebration?.payout ?? 0} onClose={() => setCelebration(null)} />
    </div>
  );
}
