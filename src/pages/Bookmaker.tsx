import { useState } from "react";
import { motion } from "framer-motion";
import { useCasinoStore } from "../store/casinoStore";
import { useToastStore } from "../store/toastStore";
import { useGameStatusStore } from "../store/gameStatusStore";
import { Card } from "../components/ui/Card";
import { Button } from "../components/ui/Button";
import { Badge } from "../components/ui/Badge";
import { RoomChat } from "../components/ui/RoomChat";
import { WinCelebration } from "../components/ui/WinCelebration";
import { IconTicketOdds } from "../components/icons";
import { formatCredits, cn } from "../lib/format";
import { xpForPayout } from "../lib/xp";
import { tierFromMultiplier, type WinTier } from "../lib/winTiers";
import {
  generateMatch, defaultOdds, clampOdds, fairOdds, runBook, randomPoolSize,
  rollBadPayer, attemptCollect, HOUSE_STAKE, OUTCOMES, OUTCOME_LABEL,
  type BookmakerMatch, type Outcome, type BookResult, type BadPayerEvent, type CollectResult,
} from "../lib/bookmakerEngine";

type View = "book" | "salon";
type Phase = "setup" | "collecting" | "result";

export function Bookmaker() {
  const credits = useCasinoStore((s) => s.credits);
  const placeBet = useCasinoStore((s) => s.placeBet);
  const award = useCasinoStore((s) => s.award);
  const addXp = useCasinoStore((s) => s.addXp);
  const recordRound = useCasinoStore((s) => s.recordRound);
  const push = useToastStore((s) => s.push);
  const winBias = useGameStatusStore((s) => s.statuses.bookmaker?.winBias ?? 1);

  const [view, setView] = useState<View>("book");
  const [match, setMatch] = useState<BookmakerMatch>(() => generateMatch());
  const [odds, setOdds] = useState<Record<Outcome, number>>(() => defaultOdds(match));
  const [phase, setPhase] = useState<Phase>("setup");
  const [displayedPool, setDisplayedPool] = useState(0);
  const [bookResult, setBookResult] = useState<BookResult | null>(null);
  const [badPayer, setBadPayer] = useState<BadPayerEvent | null>(null);
  const [collectResolved, setCollectResolved] = useState<CollectResult | null>(null);
  const [celebration, setCelebration] = useState<{ tier: WinTier; payout: number } | null>(null);

  function setOutcomeOdds(outcome: Outcome, raw: number) {
    if (Number.isNaN(raw)) return;
    const fair = fairOdds(match.fair[outcome]);
    setOdds((o) => ({ ...o, [outcome]: clampOdds(fair, raw) }));
  }

  function newMatch() {
    const m = generateMatch();
    setMatch(m);
    setOdds(defaultOdds(m));
    setBookResult(null);
    setBadPayer(null);
    setCollectResolved(null);
    setCelebration(null);
    setPhase("setup");
  }

  function openBook() {
    if (phase !== "setup" || credits < HOUSE_STAKE) {
      if (credits < HOUSE_STAKE) push({ kind: "info", title: "Crédits insuffisants pour ouvrir le livre" });
      return;
    }
    placeBet(HOUSE_STAKE);
    const pool = randomPoolSize();
    setDisplayedPool(0);
    setPhase("collecting");

    const start = Date.now();
    const duration = 1200;
    function tick() {
      const t = Math.min(1, (Date.now() - start) / duration);
      setDisplayedPool(Math.round(pool * t));
      if (t < 1) {
        requestAnimationFrame(tick);
      } else {
        finalizeBook(pool);
      }
    }
    requestAnimationFrame(tick);
  }

  function finalizeBook(pool: number) {
    const result = runBook(match, odds, pool, winBias);
    setBookResult(result);
    const netThisRound = Math.max(0, HOUSE_STAKE + result.profit);
    award(netThisRound);
    addXp(xpForPayout(Math.max(0, result.profit)));
    const tier = tierFromMultiplier(netThisRound / HOUSE_STAKE);
    recordRound({ game: "Bookmaker", label: `${match.home.label} - ${match.away.label} — ${OUTCOME_LABEL[result.outcome]}`, bet: HOUSE_STAKE, payout: netThisRound, tier });
    if (tier === "megaWin" || tier === "gigaWin" || tier === "maxWin") {
      setCelebration({ tier, payout: netThisRound });
    } else {
      push({ kind: result.profit >= 0 ? "success" : "info", title: `${result.profit >= 0 ? "+" : ""}${formatCredits(result.profit)} sur ce livre` });
    }

    const bp = rollBadPayer(result.totalCollected);
    if (bp.happened) {
      placeBet(bp.amountAtRisk);
      setBadPayer(bp);
    } else {
      setBadPayer(null);
    }
    setCollectResolved(null);
    setPhase("result");
  }

  function writeOff() {
    setCollectResolved({ recovered: 0, narrative: "Tu laisses filer, sans faire d'histoires.", success: false });
  }

  function tryCollect() {
    if (!badPayer) return;
    const r = attemptCollect(badPayer.amountAtRisk, winBias);
    setCollectResolved(r);
    if (r.success) award(r.recovered);
    push({ kind: r.success ? "success" : "info", title: r.narrative });
  }

  const totalOddsBias = odds.home / fairOdds(match.fair.home) + odds.draw / fairOdds(match.fair.draw) + odds.away / fairOdds(match.fair.away);

  return (
    <div className="mx-auto max-w-3xl px-4 py-8 sm:px-6">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-2">
          <IconTicketOdds className="h-6 w-6 text-gold-400" />
          <div>
            <h1 className="font-display text-2xl font-bold text-white sm:text-3xl">Bookmaker Clandestin</h1>
            <p className="text-sm text-ice-200/60">Fixe les cotes, encaisse les mises, gère les mauvais payeurs. 100% fictif, open bar.</p>
          </div>
        </div>
        <div className="flex items-center gap-1 rounded-xl border border-white/10 bg-white/[0.03] p-1">
          {(["book", "salon"] as View[]).map((v) => (
            <button key={v} onClick={() => setView(v)} className={cn("rounded-lg px-3 py-1.5 text-xs font-semibold capitalize", view === v ? "bg-electric-500 text-white" : "text-ice-200/60")}>
              {v === "book" ? "Le Carnet" : "Salon"}
            </button>
          ))}
        </div>
      </div>

      {view === "book" && (
        <div className="flex flex-col gap-4">
          <Card className="p-4 sm:p-6" glow>
            <div className="flex items-center justify-center gap-4 text-center">
              <div className="flex flex-1 flex-col items-center gap-1">
                <span className={cn("grid h-12 w-12 place-items-center rounded-full bg-gradient-to-br text-xl", match.home.accent)}>{match.home.glyph}</span>
                <p className="text-sm font-semibold text-white">{match.home.label}</p>
                <span className="text-[10px] text-ice-200/40">{match.home.league}</span>
              </div>
              <span className="font-display text-lg font-bold text-ice-200/40">VS</span>
              <div className="flex flex-1 flex-col items-center gap-1">
                <span className={cn("grid h-12 w-12 place-items-center rounded-full bg-gradient-to-br text-xl", match.away.accent)}>{match.away.glyph}</span>
                <p className="text-sm font-semibold text-white">{match.away.label}</p>
                <span className="text-[10px] text-ice-200/40">{match.away.league}</span>
              </div>
            </div>

            {phase === "setup" && (
              <>
                <div className="mt-6 flex flex-col gap-3">
                  {OUTCOMES.map((o) => (
                    <div key={o} className="flex items-center gap-3 rounded-xl border border-white/10 bg-white/[0.03] p-3">
                      <span className="w-36 shrink-0 text-xs font-medium text-ice-200/70">{OUTCOME_LABEL[o]}</span>
                      <input
                        type="number"
                        step={0.05}
                        min={0.1}
                        value={odds[o]}
                        onChange={(e) => setOutcomeOdds(o, Number(e.target.value))}
                        className="input h-8 w-24 px-2 text-sm"
                      />
                      <span className="text-[10px] text-ice-200/40">cote juste {fairOdds(match.fair[o]).toFixed(2)}</span>
                    </div>
                  ))}
                </div>
                <p className="mt-3 text-center text-[11px] text-ice-200/40">
                  {totalOddsBias > 3.15 ? "Cotes très généreuses — la foule va affluer, mais la note peut être salée." : totalOddsBias < 2.85 ? "Cotes radines — peu de monde va miser, mais tu risques moins gros." : "Cotes proches de l'équilibre."}
                </p>
                <div className="mt-5 flex justify-center">
                  <Button size="lg" onClick={openBook} disabled={credits < HOUSE_STAKE}>
                    Ouvrir le livre — {formatCredits(HOUSE_STAKE)} engagés
                  </Button>
                </div>
              </>
            )}

            {phase === "collecting" && (
              <div className="mt-8 flex flex-col items-center gap-3 py-6">
                <motion.span className="text-4xl" animate={{ rotate: [0, -8, 8, 0] }} transition={{ duration: 0.6, repeat: Infinity }}>💰</motion.span>
                <p className="font-display text-2xl font-bold text-gold-400">{formatCredits(displayedPool)}</p>
                <p className="text-xs text-ice-200/50">Les mises affluent...</p>
              </div>
            )}

            {phase === "result" && bookResult && (
              <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} className="mt-6">
                <div className="rounded-xl border border-white/10 bg-white/[0.03] p-4 text-center">
                  <Badge tone={bookResult.outcome === "draw" ? "neutral" : "gold"}>{OUTCOME_LABEL[bookResult.outcome]}</Badge>
                  <p className="mt-3 text-sm text-ice-200/70">
                    Mises collectées : <span className="font-semibold text-white">{formatCredits(bookResult.totalCollected)}</span>
                  </p>
                  <p className="text-sm text-ice-200/70">
                    Gains à verser : <span className="font-semibold text-white">{formatCredits(bookResult.payout)}</span>
                  </p>
                  <p className={cn("mt-2 font-display text-2xl font-bold", bookResult.profit >= 0 ? "text-emerald-400" : "text-red-400")}>
                    {bookResult.profit >= 0 ? "+" : ""}{formatCredits(bookResult.profit)}
                  </p>
                </div>

                {badPayer && (
                  <div className="mt-4 rounded-xl border border-gold-400/30 bg-gold-500/10 p-4 text-center">
                    <p className="text-sm text-gold-300">⚠️ {badPayer.narrative}</p>
                    <p className="mt-1 text-xs text-ice-200/60">{formatCredits(badPayer.amountAtRisk)} déjà déduits de ton carnet.</p>
                    {collectResolved === null ? (
                      <div className="mt-3 flex justify-center gap-2">
                        <Button size="sm" variant="secondary" onClick={writeOff}>Laisser courir</Button>
                        <Button size="sm" variant="gold" onClick={tryCollect}>Envoyer un rappel</Button>
                      </div>
                    ) : (
                      <p className="mt-2 text-xs text-ice-200/70">{collectResolved.narrative}</p>
                    )}
                  </div>
                )}

                <div className="mt-5 flex justify-center">
                  <Button size="lg" onClick={newMatch} disabled={badPayer !== null && collectResolved === null}>
                    Match suivant
                  </Button>
                </div>
              </motion.div>
            )}
          </Card>
        </div>
      )}

      {view === "salon" && <RoomChat table="bookmaker_messages" title="Le Carnet" />}

      <WinCelebration tier={celebration?.tier ?? "none"} payout={celebration?.payout ?? 0} onClose={() => setCelebration(null)} game="Bookmaker Clandestin" />
    </div>
  );
}
