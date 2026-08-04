import { useEffect, useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Card } from "../ui/Card";
import { formatCredits } from "../../lib/format";
import { randInt, pick } from "../../lib/rng";
import { useGlobalFeedStore } from "../../store/globalFeedStore";

const NAMES = ["Nova_Lyra", "BlueFrost", "KaelDrift", "IcicleQueen", "VoltRunner", "Zephyr9", "Mira.exe", "LuckyPanda", "Aurex_", "Frostbyte"];
const GAMES = ["Golden Reels", "Roulette Électrique", "Blackjack Royal"];

interface FeedItem {
  id: string;
  name: string;
  game: string;
  amount: number;
}

function randomItem(): FeedItem {
  return {
    id: crypto.randomUUID(),
    name: pick(NAMES),
    game: pick(GAMES),
    amount: randInt(150, 6000),
  };
}

export function LiveWinsFeed() {
  const [simulated, setSimulated] = useState<FeedItem[]>(() => Array.from({ length: 5 }, randomItem));
  const realWins = useGlobalFeedStore((s) => s.items);

  useEffect(() => {
    const t = setInterval(() => {
      setSimulated((prev) => [randomItem(), ...prev].slice(0, 6));
    }, 3800);
    return () => clearInterval(t);
  }, []);

  // Real mega+ wins (broadcast live via WinCelebration) lead the list; simulated ambiance fills
  // the rest so the feed still feels alive with few players connected.
  const items = useMemo(
    () => [...realWins.map((w) => ({ id: w.id, name: w.name, game: w.game, amount: w.amount })), ...simulated].slice(0, 6),
    [realWins, simulated]
  );

  return (
    <Card className="p-4 sm:p-5">
      <div className="mb-3 flex items-center gap-2">
        <span className="relative flex h-2 w-2">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
          <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-400" />
        </span>
        <h3 className="font-display text-sm font-semibold text-white">Gains récents des joueurs</h3>
      </div>
      <ul className="flex flex-col gap-2">
        <AnimatePresence initial={false}>
          {items.map((it) => (
            <motion.li
              key={it.id}
              layout
              initial={{ opacity: 0, x: -16 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 16 }}
              transition={{ type: "spring", stiffness: 300, damping: 28 }}
              className="flex items-center justify-between rounded-lg bg-white/[0.03] px-3 py-2 text-xs"
            >
              <span className="text-ice-200/70">{it.name} <span className="text-ice-200/40">· {it.game}</span></span>
              <span className="font-semibold text-emerald-400">+{formatCredits(it.amount)}</span>
            </motion.li>
          ))}
        </AnimatePresence>
      </ul>
    </Card>
  );
}
