import { motion, type HTMLMotionProps } from "framer-motion";
import { cn } from "../../lib/format";

type Variant = "primary" | "secondary" | "ghost" | "gold";
type Size = "sm" | "md" | "lg";

interface ButtonProps extends Omit<HTMLMotionProps<"button">, "ref"> {
  variant?: Variant;
  size?: Size;
}

const variants: Record<Variant, string> = {
  primary:
    "bg-gradient-to-b from-electric-400 to-electric-600 text-white shadow-glow hover:from-electric-400 hover:to-electric-500 border border-electric-400/40",
  secondary:
    "bg-white/[0.06] text-ice-100 border border-white/10 hover:bg-white/[0.1] shadow-inner-glass",
  ghost: "bg-transparent text-ice-200/80 hover:text-white hover:bg-white/5",
  gold: "bg-gradient-to-b from-gold-400 to-gold-500 text-ink-950 shadow-glow-gold border border-gold-400/40 font-semibold",
};

const sizes: Record<Size, string> = {
  sm: "text-xs px-3 py-1.5 rounded-lg gap-1.5",
  md: "text-sm px-4 py-2.5 rounded-xl gap-2",
  lg: "text-base px-6 py-3.5 rounded-2xl gap-2.5",
};

export function Button({ variant = "primary", size = "md", className, children, disabled, ...props }: ButtonProps) {
  return (
    <motion.button
      whileHover={disabled ? undefined : { scale: 1.02, y: -1 }}
      whileTap={disabled ? undefined : { scale: 0.96 }}
      transition={{ type: "spring", stiffness: 500, damping: 22 }}
      disabled={disabled}
      className={cn(
        "inline-flex items-center justify-center font-display font-semibold whitespace-nowrap transition-colors disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:scale-100",
        variants[variant],
        sizes[size],
        className
      )}
      {...props}
    >
      {children}
    </motion.button>
  );
}
