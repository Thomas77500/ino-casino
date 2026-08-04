import { motion } from "framer-motion";
import { TABS, type AppTab } from "../../lib/navigation";
import { useGameStatusStore } from "../../store/gameStatusStore";
import { cn } from "../../lib/format";

export function MobileNav({ active, onNavigate }: { active: AppTab; onNavigate: (t: AppTab) => void }) {
  const isAdmin = useGameStatusStore((s) => s.isAdmin);
  const items = TABS.filter((t) => !t.adminOnly || isAdmin);
  return (
    <nav className="fixed bottom-0 inset-x-0 z-50 border-t border-white/10 bg-ink-950/95 backdrop-blur-xl lg:hidden">
      <div className="flex items-center gap-1 overflow-x-auto px-2 py-2">

        {items.map((t) => {
          const Icon = t.icon;
          const isActive = active === t.id;
          return (
            <button key={t.id} onClick={() => onNavigate(t.id)} className="relative flex shrink-0 flex-col items-center gap-0.5 px-3 py-1">
              {isActive && (
                <motion.span layoutId="mobile-nav-glow" className="absolute -top-2 h-1 w-6 rounded-full bg-electric-400 shadow-glow" />
              )}
              <Icon className={cn("h-5 w-5", isActive ? "text-white" : "text-ice-200/50")} />
              <span className={cn("text-[10px] font-medium", isActive ? "text-white" : "text-ice-200/50")}>{t.label.split(" ")[0]}</span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}
