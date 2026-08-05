import { AnimatePresence, motion } from "framer-motion";
import { TABS, type AppTab } from "../../lib/navigation";
import { useGameStatusStore } from "../../store/gameStatusStore";
import { IconClose } from "../icons";
import { Logo } from "../ui/Logo";
import { cn } from "../../lib/format";

export function MobileNav({
  active,
  open,
  onNavigate,
  onClose,
}: {
  active: AppTab;
  open: boolean;
  onNavigate: (t: AppTab) => void;
  onClose: () => void;
}) {
  const isAdmin = useGameStatusStore((s) => s.isAdmin);
  const items = TABS.filter((t) => !t.adminOnly || isAdmin);

  return (
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-[60] lg:hidden">
          <motion.div
            className="absolute inset-0 bg-ink-950/70 backdrop-blur-sm"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
          />
          <motion.nav
            className="absolute inset-y-0 left-0 flex w-72 max-w-[80vw] flex-col border-r border-white/10 bg-ink-950"
            initial={{ x: "-100%" }}
            animate={{ x: 0 }}
            exit={{ x: "-100%" }}
            transition={{ type: "spring", stiffness: 340, damping: 34 }}
          >
            <div className="flex items-center justify-between border-b border-white/10 px-4 py-3.5">
              <span className="flex items-center gap-2">
                <Logo className="h-7 w-7 rounded-lg" />
                <span className="font-display text-lg font-bold text-white">Ino Casino</span>
              </span>
              <button onClick={onClose} className="grid h-8 w-8 place-items-center rounded-lg text-ice-200/60 hover:bg-white/5 hover:text-white" aria-label="Fermer le menu">
                <IconClose className="h-4 w-4" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto px-2 py-2">
              {items.map((t) => {
                const Icon = t.icon;
                const isActive = active === t.id;
                return (
                  <button
                    key={t.id}
                    onClick={() => {
                      onNavigate(t.id);
                      onClose();
                    }}
                    className={cn(
                      "flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left text-sm font-medium transition-colors",
                      isActive ? "bg-white/[0.07] text-white" : "text-ice-200/60 hover:bg-white/[0.04] hover:text-white"
                    )}
                  >
                    <Icon className={cn("h-5 w-5 shrink-0", isActive ? "text-electric-400" : "text-ice-200/50")} />
                    {t.label}
                  </button>
                );
              })}
            </div>
          </motion.nav>
        </div>
      )}
    </AnimatePresence>
  );
}
