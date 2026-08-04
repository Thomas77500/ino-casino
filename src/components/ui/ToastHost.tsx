import { AnimatePresence, motion } from "framer-motion";
import { useToastStore } from "../../store/toastStore";
import { cn } from "../../lib/format";

const kindStyles = {
  info: "border-white/10 bg-ink-800/90",
  success: "border-emerald-500/30 bg-ink-800/90",
  bonus: "border-gold-500/30 bg-ink-800/90",
};

export function ToastHost() {
  const toasts = useToastStore((s) => s.toasts);
  return (
    <div className="pointer-events-none fixed top-20 right-4 z-[100] flex w-[320px] flex-col gap-2">
      <AnimatePresence>
        {toasts.map((t) => (
          <motion.div
            key={t.id}
            initial={{ opacity: 0, x: 60, scale: 0.9 }}
            animate={{ opacity: 1, x: 0, scale: 1 }}
            exit={{ opacity: 0, x: 60, scale: 0.9 }}
            transition={{ type: "spring", stiffness: 300, damping: 26 }}
            className={cn("pointer-events-auto rounded-xl border p-3.5 shadow-glow backdrop-blur-xl", kindStyles[t.kind])}
          >
            <p className="font-display text-sm font-semibold text-white">{t.title}</p>
            {t.description && <p className="mt-0.5 text-xs text-ice-200/70">{t.description}</p>}
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}
