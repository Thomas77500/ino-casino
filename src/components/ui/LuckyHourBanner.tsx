import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { isLuckyHourNow, luckyHourMsRemaining, LUCKY_HOUR_BONUS_RATE } from "../../lib/luckyHour";
import { IconBolt } from "../icons";

function formatMs(ms: number): string {
  const totalSec = Math.ceil(ms / 1000);
  const m = Math.floor(totalSec / 60);
  const s = totalSec % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

export function LuckyHourBanner() {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

  const active = isLuckyHourNow(now);

  return (
    <AnimatePresence>
      {active && (
        <motion.div
          initial={{ height: 0, opacity: 0 }}
          animate={{ height: "auto", opacity: 1 }}
          exit={{ height: 0, opacity: 0 }}
          className="overflow-hidden border-b border-gold-500/30 bg-gold-500/10"
        >
          <div className="mx-auto flex max-w-7xl items-center justify-center gap-2 px-4 py-2 text-xs sm:text-sm">
            <IconBolt className="h-4 w-4 shrink-0 text-gold-400" />
            <span className="font-semibold text-gold-400">
              Heure chanceuse ! Tous les gains sont boostés de +{Math.round(LUCKY_HOUR_BONUS_RATE * 100)}%
            </span>
            <span className="text-gold-400/60">— encore {formatMs(luckyHourMsRemaining(now))}</span>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
