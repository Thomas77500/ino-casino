export function StatTile({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-white/10 bg-white/[0.03] p-2.5 text-center">
      <p className="text-[10px] uppercase tracking-wide text-ice-200/40">{label}</p>
      <p className="mt-0.5 font-display text-sm font-bold text-white">{value}</p>
    </div>
  );
}
