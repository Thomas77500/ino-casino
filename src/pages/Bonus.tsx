import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { useCasinoStore } from "../store/casinoStore";
import { useToastStore } from "../store/toastStore";
import { Card } from "../components/ui/Card";
import { Button } from "../components/ui/Button";
import { Badge } from "../components/ui/Badge";
import { BonusWheel } from "../components/games/BonusWheel";
import { IconGift, IconVault, IconBolt } from "../components/icons";
import { formatCredits, cn } from "../lib/format";
import { WHEEL_SEGMENTS } from "../lib/bonusWheel";

const WHEEL_DISPLAY_SEGMENTS = WHEEL_SEGMENTS.map((s) => ({ label: s.label, highlight: s.label === "JACKPOT" }));

function formatMs(ms: number): string {
  const totalSec = Math.ceil(ms / 1000);
  const m = Math.floor(totalSec / 60);
  const s = totalSec % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

export function Bonus() {
  const streakCount = useCasinoStore((s) => s.streakCount);
  const canClaimDaily = useCasinoStore((s) => s.canClaimDaily());
  const claimDaily = useCasinoStore((s) => s.claimDaily);
  const vaultMsRemaining = useCasinoStore((s) => s.vaultMsRemaining);
  const claimVault = useCasinoStore((s) => s.claimVault);
  const wheelMsRemaining = useCasinoStore((s) => s.wheelMsRemaining);
  const claimWheel = useCasinoStore((s) => s.claimWheel);
  const push = useToastStore((s) => s.push);

  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

  const vaultLeft = vaultMsRemaining();
  const wheelLeft = wheelMsRemaining();
  const [vaultReward, setVaultReward] = useState<number | null>(null);
  const [wheelSpin, setWheelSpin] = useState({ trigger: 0, index: null as number | null, spinning: false });

  function handleDaily() {
    const reward = claimDaily();
    if (reward > 0) push({ kind: "bonus", title: `Bonus quotidien réclamé : +${formatCredits(reward)} crédits` });
  }

  function handleVault() {
    if (vaultLeft > 0) return;
    const reward = claimVault();
    if (reward > 0) {
      setVaultReward(reward);
      push({ kind: "bonus", title: `Coffre ouvert : +${formatCredits(reward)} crédits` });
    }
  }

  function handleWheel() {
    if (wheelLeft > 0 || wheelSpin.spinning) return;
    const result = claimWheel();
    if (!result) return;
    setWheelSpin({ trigger: wheelSpin.trigger + 1, index: result.index, spinning: true });
    setTimeout(() => {
      setWheelSpin((w) => ({ ...w, spinning: false }));
      push({ kind: "bonus", title: `Roue Bonus : +${formatCredits(result.amount)} crédits` });
    }, 3300);
  }

  return (
    <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6">
      <div className="mb-6">
        <h1 className="font-display text-2xl font-bold text-white sm:text-3xl">Bonus &amp; Récompenses</h1>
        <p className="text-sm text-ice-200/60">Reviens régulièrement pour maximiser tes crédits virtuels gratuits.</p>
      </div>

      <Card className="p-6" glow>
        <div className="mb-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <IconGift className="h-5 w-5 text-gold-400" />
            <h2 className="font-display text-lg font-semibold text-white">Bonus quotidien</h2>
          </div>
          <Badge tone="gold">Série : {streakCount} jour{streakCount > 1 ? "s" : ""}</Badge>
        </div>
        <div className="mb-5 grid grid-cols-7 gap-2">
          {[150, 200, 300, 400, 550, 750, 1200].map((reward, i) => {
            const day = i + 1;
            const isPast = day <= streakCount && !canClaimDaily;
            const isToday = canClaimDaily ? day === streakCount + 1 : false;
            return (
              <div
                key={day}
                className={cn(
                  "flex flex-col items-center gap-1 rounded-xl border p-2 text-center",
                  isToday ? "border-gold-400 bg-gold-500/10 shadow-glow-gold" : isPast ? "border-emerald-500/30 bg-emerald-500/5" : "border-white/10 bg-white/[0.02]"
                )}
              >
                <span className="text-[10px] uppercase text-ice-200/50">J{day}</span>
                <span className="text-xs font-bold text-white">{reward}</span>
              </div>
            );
          })}
        </div>
        <Button variant={canClaimDaily ? "gold" : "secondary"} onClick={handleDaily} disabled={!canClaimDaily} className="w-full sm:w-auto">
          {canClaimDaily ? "Réclamer le bonus du jour" : "Déjà réclamé aujourd'hui"}
        </Button>
      </Card>

      <div className="mt-6 grid gap-6 md:grid-cols-2">
        <Card className="flex flex-col items-center gap-4 p-6" glow>
          <div className="flex items-center gap-2 self-start">
            <IconVault className="h-5 w-5 text-electric-400" />
            <h2 className="font-display text-lg font-semibold text-white">Coffre surprise</h2>
          </div>
          <motion.div
            animate={vaultLeft === 0 ? { y: [0, -6, 0] } : {}}
            transition={{ duration: 1.6, repeat: Infinity }}
            className={cn("grid h-28 w-28 place-items-center rounded-2xl border text-5xl", vaultLeft === 0 ? "border-gold-400 shadow-glow-gold" : "border-white/10 opacity-50")}
          >
            🎁
          </motion.div>
          {vaultReward !== null && <p className="font-display text-sm font-semibold text-emerald-400">Dernier gain : +{formatCredits(vaultReward)}</p>}
          <Button variant={vaultLeft === 0 ? "primary" : "secondary"} onClick={handleVault} disabled={vaultLeft > 0} className="w-full">
            {vaultLeft > 0 ? `Disponible dans ${formatMs(vaultLeft)}` : "Ouvrir le coffre"}
          </Button>
        </Card>

        <Card className="flex flex-col items-center gap-4 p-6" glow>
          <div className="flex items-center gap-2 self-start">
            <IconBolt className="h-5 w-5 text-gold-400" />
            <h2 className="font-display text-lg font-semibold text-white">Roue Bonus</h2>
          </div>
          <BonusWheel segments={WHEEL_DISPLAY_SEGMENTS} resultIndex={wheelSpin.index} spinTrigger={wheelSpin.trigger} spinning={wheelSpin.spinning} />
          <Button
            variant={wheelLeft === 0 && !wheelSpin.spinning ? "primary" : "secondary"}
            onClick={handleWheel}
            disabled={wheelLeft > 0 || wheelSpin.spinning}
            className="w-full"
          >
            {wheelSpin.spinning ? "Ça tourne..." : wheelLeft > 0 ? `Disponible dans ${formatMs(wheelLeft)}` : "Lancer la roue"}
          </Button>
        </Card>
      </div>
    </div>
  );
}
