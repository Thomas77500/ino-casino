import { motion } from "framer-motion";
import { useCasinoStore } from "../../store/casinoStore";
import { useAuthStore } from "../../store/authStore";
import { useToastStore } from "../../store/toastStore";
import { useGameStatusStore } from "../../store/gameStatusStore";
import { useJackpotStore } from "../../store/jackpotStore";
import { TABS, type AppTab } from "../../lib/navigation";
import { AnimatedNumber } from "../ui/AnimatedNumber";
import { AvatarBubble } from "../ui/AvatarBubble";
import { Button } from "../ui/Button";
import { IconCoin, IconGift, IconVaultDoor } from "../icons";
import { cn } from "../../lib/format";
import { levelTitle, displayLevel } from "../../lib/levelTitles";
import { exploitTitleLabel } from "../../lib/exploitTitles";

export function Header({ active, onNavigate }: { active: AppTab; onNavigate: (t: AppTab) => void }) {
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
        <button onClick={() => onNavigate("home")} className="flex items-center gap-2 shrink-0">
          <div className="grid h-9 w-9 place-items-center rounded-xl bg-gradient-to-br from-electric-400 to-electric-600 shadow-glow">
            <span className="font-display text-lg font-bold text-white">I</span>
          </div>
          <span className="font-display text-lg font-bold tracking-tight text-white hidden sm:inline">Ino Casino</span>
        </button>

        <nav className="hidden lg:flex items-center gap-1 flex-1 overflow-x-auto">
          {visibleTabs.map((t) => (
            <button
              key={t.id}
              onClick={() => onNavigate(t.id)}
              className={cn(
                "relative px-3 py-2 text-sm font-medium rounded-lg transition-colors",
                active === t.id ? "text-white" : "text-ice-200/60 hover:text-white"
              )}
            >
              {active === t.id && (
                <motion.span layoutId="nav-pill" className="absolute inset-0 rounded-lg bg-white/[0.07]" transition={{ type: "spring", stiffness: 400, damping: 30 }} />
              )}
              <span className="relative">{t.label}</span>
            </button>
          ))}
        </nav>

        <div className="flex flex-1 lg:flex-none items-center justify-end gap-2 sm:gap-3">
          <div className="flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.04] px-3 py-1.5 sm:px-4 sm:py-2">
            <IconCoin className="h-4 w-4 text-gold-400" />
            <AnimatedNumber value={credits} className="font-display text-sm font-bold text-white tabular-nums" />
          </div>

          <div title="Jackpot progressif" className="hidden items-center gap-1.5 rounded-full border border-gold-500/30 bg-gold-500/10 px-3 py-1.5 md:flex">
            <IconVaultDoor className="h-4 w-4 text-gold-400" />
            <AnimatedNumber value={jackpot} className="font-display text-sm font-bold text-gold-400 tabular-nums" />
          </div>

          <Button variant={canClaimDaily ? "gold" : "secondary"} size="sm" onClick={handleDaily} className="hidden sm:inline-flex">
            <IconGift className="h-4 w-4" />
            {canClaimDaily ? "Bonus du jour" : "Réclamé"}
          </Button>

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
