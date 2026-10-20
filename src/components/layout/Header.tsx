import { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useCasinoStore } from "../../store/casinoStore";
import { useAuthStore } from "../../store/authStore";
import { useToastStore } from "../../store/toastStore";
import { useGameStatusStore } from "../../store/gameStatusStore";
import { useJackpotStore } from "../../store/jackpotStore";
import { TABS, type AppTab } from "../../lib/navigation";
import { AnimatedNumber } from "../ui/AnimatedNumber";
import { AvatarBubble } from "../ui/AvatarBubble";
import { Logo } from "../ui/Logo";
import { Button } from "../ui/Button";
import { NotificationBell } from "./NotificationBell";
import { IconCoin, IconGift, IconVaultDoor, IconMenu } from "../icons";
import { cn } from "../../lib/format";
import { levelTitle, displayLevel } from "../../lib/levelTitles";
import { exploitTitleLabel } from "../../lib/exploitTitles";

export function Header({ active, onNavigate, onMenuClick }: { active: AppTab; onNavigate: (t: AppTab) => void; onMenuClick: () => void }) {
  const credits = useCasinoStore((s) => s.credits);
  const level = useCasinoStore((s) => s.level);
  const avatar = useAuthStore((s) => s.account?.avatar);
  const frame = useAuthStore((s) => s.account?.frame);
  const equippedTitle = useAuthStore((s) => exploitTitleLabel(s.account?.title));
  const isAdmin = useGameStatusStore((s) => s.isAdmin);
  const canClaimDaily = useCasinoStore((s) => s.canClaimDaily());
  const jackpot = useJackpotStore((s) => s.pot);
  const claimDaily = useCasinoStore((s) => s.claimDaily);
  const push = useToastStore((s) => s.push);
  const visibleTabs = TABS.filter((t) => !t.adminOnly || isAdmin);
  // Only the main tabs fit on one line next to the balance pills; the rest go in "Plus".
  const primaryTabs = visibleTabs.slice(0, 5);
  const moreTabs = visibleTabs.slice(5);
  const moreActive = moreTabs.some((t) => t.id === active);
  const [moreOpen, setMoreOpen] = useState(false);

  // Floating "+N" over the balance whenever it goes up, wherever the win came from.
  const prevCredits = useRef(credits);
  const [gains, setGains] = useState<{ id: number; amount: number }[]>([]);
  useEffect(() => {
    const delta = credits - prevCredits.current;
    prevCredits.current = credits;
    if (delta <= 0) return;
    const id = Date.now() + Math.random();
    setGains((g) => [...g.slice(-3), { id, amount: delta }]);
    const t = setTimeout(() => setGains((g) => g.filter((x) => x.id !== id)), 1600);
    return () => clearTimeout(t);
  }, [credits]);

  function handleDaily() {
    const reward = claimDaily();
    if (reward > 0) {
      push({ kind: "bonus", title: `Bonus quotidien : +${reward} crédits`, description: "Reviens demain pour continuer ta série." });
    } else {
      onNavigate("bonus");
    }
  }

  return (
    <header className="sticky top-0 z-50 border-b border-white/5 bg-ink-950/80 backdrop-blur-xl">
      <div className="mx-auto flex max-w-7xl items-center gap-6 px-4 py-3 sm:px-6">
        <button onClick={onMenuClick} className="grid h-9 w-9 shrink-0 place-items-center rounded-lg text-ice-200/80 hover:bg-white/5 hover:text-white lg:hidden" aria-label="Ouvrir le menu">
          <IconMenu className="h-5 w-5" />
        </button>

        <button onClick={() => onNavigate("home")} className="flex items-center gap-2 shrink-0">
          <Logo className="h-9 w-9 shadow-glow rounded-xl" />
          <span className="font-display text-lg font-bold tracking-tight text-white hidden sm:inline">Ino Casino</span>
        </button>

        <nav className="hidden flex-1 items-center gap-1 lg:flex">
          {primaryTabs.map((t) => (
            <button
              key={t.id}
              onClick={() => onNavigate(t.id)}
              className={cn(
                "relative whitespace-nowrap rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                active === t.id ? "text-white" : "text-ice-200/60 hover:text-white"
              )}
            >
              {active === t.id && (
                <motion.span layoutId="nav-pill" className="absolute inset-0 rounded-lg bg-white/[0.08] shadow-inner-glass" transition={{ type: "spring", stiffness: 400, damping: 30 }} />
              )}
              <span className="relative">{t.label}</span>
            </button>
          ))}
          {moreTabs.length > 0 && (
            <div className="relative">
              <button
                onClick={() => setMoreOpen((o) => !o)}
                className={cn(
                  "relative flex items-center gap-1 whitespace-nowrap rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                  moreActive || moreOpen ? "text-white" : "text-ice-200/60 hover:text-white"
                )}
              >
                {moreActive && (
                  <motion.span layoutId="nav-pill" className="absolute inset-0 rounded-lg bg-white/[0.08] shadow-inner-glass" transition={{ type: "spring", stiffness: 400, damping: 30 }} />
                )}
                <span className="relative">{moreActive ? moreTabs.find((t) => t.id === active)!.label : "Plus"}</span>
                <motion.span className="relative text-[10px]" animate={{ rotate: moreOpen ? 180 : 0 }}>▾</motion.span>
              </button>
              <AnimatePresence>
                {moreOpen && (
                  <>
                    <div className="fixed inset-0 z-40" onClick={() => setMoreOpen(false)} />
                    <motion.div
                      initial={{ opacity: 0, y: -6, scale: 0.97 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      exit={{ opacity: 0, y: -6, scale: 0.97 }}
                      transition={{ duration: 0.15 }}
                      className="absolute left-0 top-full z-50 mt-2 w-56 overflow-hidden rounded-xl border border-white/10 bg-ink-900/95 p-1.5 shadow-[0_20px_40px_-10px_rgba(0,0,0,0.8)] backdrop-blur-xl"
                    >
                      {moreTabs.map((t) => (
                        <button
                          key={t.id}
                          onClick={() => {
                            setMoreOpen(false);
                            onNavigate(t.id);
                          }}
                          className={cn(
                            "flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-left text-sm transition-colors",
                            active === t.id ? "bg-electric-500/15 text-white" : "text-ice-200/70 hover:bg-white/5 hover:text-white"
                          )}
                        >
                          <t.icon className="h-4 w-4 text-electric-400" />
                          {t.label}
                        </button>
                      ))}
                    </motion.div>
                  </>
                )}
              </AnimatePresence>
            </div>
          )}
        </nav>

        <div className="flex flex-1 lg:flex-none items-center justify-end gap-2 sm:gap-3">
          <div className="relative flex items-center gap-2 rounded-full border border-gold-400/25 bg-gradient-to-b from-white/[0.08] to-white/[0.02] px-3 py-1.5 sm:px-4 sm:py-2"
          >
            {gains.length > 0 && (
              <motion.span
                key={gains[gains.length - 1].id}
                className="pointer-events-none absolute inset-0 rounded-full"
                initial={{ boxShadow: "0 0 0px rgba(246,191,75,0)" }}
                animate={{ boxShadow: ["0 0 0px rgba(246,191,75,0)", "0 0 22px rgba(246,191,75,0.7)", "0 0 0px rgba(246,191,75,0)"] }}
                transition={{ duration: 1.1 }}
              />
            )}
            <IconCoin className="h-4 w-4 text-gold-400 drop-shadow-[0_0_6px_rgba(246,191,75,0.7)]" />
            <AnimatedNumber value={credits} className="font-display text-sm font-bold text-white tabular-nums" />
            <AnimatePresence>
              {gains.map((g) => (
                <motion.span
                  key={g.id}
                  initial={{ opacity: 0, y: 0, scale: 0.8 }}
                  animate={{ opacity: [0, 1, 1, 0], y: 26, scale: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 1.5, ease: "easeOut" }}
                  className="pointer-events-none absolute right-2 top-full whitespace-nowrap font-display text-xs font-black text-gold-300 drop-shadow-[0_0_6px_rgba(246,191,75,0.8)]"
                >
                  +{g.amount.toLocaleString("fr-FR")}
                </motion.span>
              ))}
            </AnimatePresence>
          </div>

          <div title="Jackpot progressif" className="hidden items-center gap-1.5 rounded-full border border-gold-500/30 bg-gold-500/10 px-3 py-1.5 md:flex">
            <IconVaultDoor className="h-4 w-4 text-gold-400" />
            <AnimatedNumber value={jackpot} className="font-display text-sm font-bold text-gold-400 tabular-nums" />
          </div>

          <Button variant={canClaimDaily ? "gold" : "secondary"} size="sm" onClick={handleDaily} className="hidden sm:inline-flex">
            <IconGift className="h-4 w-4" />
            {canClaimDaily ? "Bonus du jour" : "Réclamé"}
          </Button>

          <NotificationBell />

          <button
            onClick={() => onNavigate("profile")}
            title={levelTitle(level)}
            className="flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.04] px-2 py-1.5 sm:px-3"
          >
            <div className="grid h-6 w-6 place-items-center rounded-full bg-gradient-to-br from-electric-500 to-electric-700 text-[8px] font-bold text-white">
              {displayLevel(level)}
            </div>
            <span className="hidden text-xs font-medium text-ice-200/70 md:inline">{equippedTitle ?? levelTitle(level)}</span>
            <AvatarBubble avatar={avatar ?? "🎲"} frame={frame} size="sm" className="hidden sm:grid" />
          </button>
        </div>
      </div>
    </header>
  );
}
