import { useEffect, useRef, useState } from "react";
import { useGameStatusStore, GAME_LABELS } from "../store/gameStatusStore";
import { useToastStore } from "../store/toastStore";
import { Card } from "../components/ui/Card";
import { Button } from "../components/ui/Button";
import { Badge } from "../components/ui/Badge";
import { IconShield } from "../components/icons";

export function Admin() {
  const { statuses, isAdmin, fetchAll, setStatus } = useGameStatusStore();
  const push = useToastStore((s) => s.push);
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [biasDrafts, setBiasDrafts] = useState<Record<string, number>>({});
  const biasSaveTimers = useRef<Record<string, ReturnType<typeof setTimeout>>>({});

  useEffect(() => {
    fetchAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!isAdmin) {
    return (
      <div className="mx-auto max-w-lg px-4 py-16 text-center">
        <p className="text-sm text-ice-200/60">Accès réservé aux administrateurs.</p>
      </div>
    );
  }

  async function toggle(id: string, currentlyEnabled: boolean) {
    await setStatus(id, { enabled: !currentlyEnabled });
    push({ kind: "info", title: `${GAME_LABELS[id]} — ${currentlyEnabled ? "mis en maintenance" : "réactivé"}` });
  }

  async function saveMessage(id: string) {
    const message = drafts[id] ?? statuses[id]?.message ?? "";
    await setStatus(id, { message });
    push({ kind: "success", title: "Message de maintenance mis à jour" });
  }

  async function setBias(id: string, winBias: number) {
    await setStatus(id, { winBias });
  }

  // Committing only on mouseup/touchend misses keyboard-driven slider changes (arrow keys never
  // fire those events) — debounce a save on every change too, so every input method persists.
  function scheduleBiasSave(id: string, winBias: number) {
    setBiasDrafts((d) => ({ ...d, [id]: winBias }));
    clearTimeout(biasSaveTimers.current[id]);
    biasSaveTimers.current[id] = setTimeout(() => setBias(id, winBias), 400);
  }

  return (
    <div className="mx-auto max-w-3xl px-4 py-8 sm:px-6">
      <div className="mb-6 flex items-center gap-2">
        <IconShield className="h-6 w-6 text-gold-400" />
        <div>
          <h1 className="font-display text-2xl font-bold text-white sm:text-3xl">Administration</h1>
          <p className="text-sm text-ice-200/60">Active/désactive chaque jeu et personnalise le message de maintenance.</p>
        </div>
      </div>

      <div className="flex flex-col gap-3">
        {Object.entries(GAME_LABELS).map(([id, label]) => {
          const status = statuses[id];
          const enabled = status?.enabled ?? true;
          return (
            <Card key={id} className="p-4">
              <div className="flex items-center justify-between gap-4">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-semibold text-white">{label}</span>
                  <Badge tone={enabled ? "success" : "danger"}>{enabled ? "Actif" : "Maintenance"}</Badge>
                </div>
                <Button size="sm" variant={enabled ? "secondary" : "gold"} onClick={() => toggle(id, enabled)}>
                  {enabled ? "Mettre en maintenance" : "Réactiver"}
                </Button>
              </div>
              <div className="mt-3 flex gap-2">
                <input
                  className="input"
                  placeholder="Message affiché aux joueurs pendant la maintenance"
                  value={drafts[id] ?? status?.message ?? ""}
                  onChange={(e) => setDrafts((d) => ({ ...d, [id]: e.target.value }))}
                />
                <Button size="sm" variant="secondary" onClick={() => saveMessage(id)}>Enregistrer</Button>
              </div>
              <div className="mt-3 flex items-center gap-3">
                <span className="w-40 shrink-0 text-xs text-ice-200/50">Probabilité de gain</span>
                <input
                  type="range"
                  min={0.5}
                  max={2}
                  step={0.1}
                  value={biasDrafts[id] ?? status?.winBias ?? 1}
                  onChange={(e) => scheduleBiasSave(id, Number(e.target.value))}
                  onMouseUp={(e) => setBias(id, Number((e.target as HTMLInputElement).value))}
                  onTouchEnd={(e) => setBias(id, Number((e.target as HTMLInputElement).value))}
                  className="flex-1"
                />
                <span className="w-12 shrink-0 text-right font-display text-xs font-bold text-gold-400">
                  {(biasDrafts[id] ?? status?.winBias ?? 1).toFixed(1)}×
                </span>
                <Button size="sm" variant="ghost" onClick={() => { setBiasDrafts((d) => ({ ...d, [id]: 1 })); setBias(id, 1); }}>
                  Réinitialiser
                </Button>
              </div>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
