// Diagonal light sweep for Rare Holo+ card reveals — reuses the `shimmer` keyframe already
// declared in tailwind.config.js (background-position animation) but never used until now.
export function HoloSweep() {
  return (
    <div
      className="pointer-events-none absolute inset-0 animate-shimmer rounded-xl opacity-60"
      style={{
        backgroundImage: "linear-gradient(115deg, transparent 30%, rgba(255,255,255,0.55) 45%, rgba(246,191,75,0.5) 50%, rgba(255,255,255,0.55) 55%, transparent 70%)",
        backgroundSize: "250% 250%",
      }}
    />
  );
}
