import { cn } from "../../lib/format";

type Tone = "electric" | "gold" | "neutral" | "success" | "danger";

const tones: Record<Tone, string> = {
  electric: "bg-electric-500/15 text-electric-400 border-electric-500/30",
  gold: "bg-gold-500/15 text-gold-400 border-gold-500/30",
  neutral: "bg-white/10 text-ice-200 border-white/10",
  success: "bg-emerald-500/15 text-emerald-400 border-emerald-500/30",
  danger: "bg-red-500/15 text-red-400 border-red-500/30",
};

export function Badge({ tone = "neutral", className, children }: { tone?: Tone; className?: string; children: React.ReactNode }) {
  return (
    <span className={cn("inline-flex items-center rounded-full border px-2.5 py-1 text-[11px] font-semibold tracking-wide uppercase", tones[tone], className)}>
      {children}
    </span>
  );
}
