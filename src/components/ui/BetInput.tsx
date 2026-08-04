import { formatCredits, cn } from "../../lib/format";

export function BetInput({
  value,
  onChange,
  max,
  min = 1,
  disabled,
}: {
  value: number;
  onChange: (v: number) => void;
  max: number;
  min?: number;
  disabled?: boolean;
}) {
  const step = Math.max(5, Math.round(max / 20));
  const quicks = [
    { label: "25%", amount: Math.max(min, Math.round((max * 0.25) / 5) * 5) },
    { label: "50%", amount: Math.max(min, Math.round((max * 0.5) / 5) * 5) },
    { label: "Max", amount: max },
  ];

  function set(v: number) {
    onChange(Math.min(max, Math.max(min, Math.round(v))));
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <div className="flex items-center rounded-xl border border-white/10 bg-white/[0.03]">
        <button
          onClick={() => set(value - step)}
          disabled={disabled || value <= min}
          className="px-3 py-2 text-lg font-bold text-ice-200/70 hover:text-white disabled:opacity-30"
        >
          −
        </button>
        <input
          type="number"
          value={Math.round(value)}
          onChange={(e) => set(Number(e.target.value) || min)}
          disabled={disabled}
          className="w-20 bg-transparent text-center font-display text-sm font-bold text-white outline-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
        />
        <button
          onClick={() => set(value + step)}
          disabled={disabled || value >= max}
          className="px-3 py-2 text-lg font-bold text-ice-200/70 hover:text-white disabled:opacity-30"
        >
          +
        </button>
      </div>
      <div className="flex items-center gap-1">
        {quicks.map((q) => (
          <button
            key={q.label}
            onClick={() => set(q.amount)}
            disabled={disabled}
            className={cn(
              "rounded-lg border border-white/10 bg-white/[0.03] px-2.5 py-1.5 text-xs font-semibold text-ice-200/60 hover:text-white disabled:opacity-30"
            )}
          >
            {q.label}
          </button>
        ))}
      </div>
      <span className="text-[11px] text-ice-200/40">Plafond {formatCredits(max)}</span>
    </div>
  );
}
