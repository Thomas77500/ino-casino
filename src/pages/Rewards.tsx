import { useCasinoStore } from "../store/casinoStore";
import { useAuthStore } from "../store/authStore";
import { useToastStore } from "../store/toastStore";
import { Card } from "../components/ui/Card";
import { Button } from "../components/ui/Button";
import { Badge } from "../components/ui/Badge";
import { ProgressBar } from "../components/ui/ProgressBar";
import { IconTrophy, IconStar, IconSlots } from "../components/icons";
import { formatCredits, cn } from "../lib/format";
import { computeBadges } from "../lib/badges";
import { levelTitle, nextLevelTier, displayLevel, isMaxLevel } from "../lib/levelTitles";
import { SALONS, currentSalon } from "../lib/salons";
import { SLOT_MACHINES } from "../lib/slotMachines";
import { EXPLOIT_TITLES, unlockedExploitTitles } from "../lib/exploitTitles";

export function Rewards() {
  const level = useCasinoStore((s) => s.level);
  const xp = useCasinoStore((s) => s.xp);
  const xpToNext = useCasinoStore((s) => s.xpToNext);
  const missions = useCasinoStore((s) => s.missions);
  const claimMission = useCasinoStore((s) => s.claimMission);
  const biggestWin = useCasinoStore((s) => s.biggestWin);
  const totalWagered = useCasinoStore((s) => s.totalWagered);
  const totalWon = useCasinoStore((s) => s.totalWon);
  const streakCount = useCasinoStore((s) => s.streakCount);
  const gamesPlayed = useCasinoStore((s) => s.gamesPlayed);
  const equippedTitle = useAuthStore((s) => s.account?.title);
  const updateProfile = useAuthStore((s) => s.updateProfile);
  const push = useToastStore((s) => s.push);

  const badges = computeBadges({ level, biggestWin, totalWagered, streakCount });
  const unlockedTitles = unlockedExploitTitles({ level, biggestWin, totalWagered, totalWon, gamesPlayed });

  function handleClaim(id: string, reward: number) {
    const won = claimMission(id);
    push({ kind: "bonus", title: `Coffre de mission ouvert : +${formatCredits(won || reward)} crédits` });
  }

  return (
    <div className="mx-auto max-w-4xl px-4 py-8 sm:px-6">
      <div className="mb-6">
        <h1 className="font-display text-2xl font-bold text-white sm:text-3xl">Récompenses &amp; Missions</h1>
        <p className="text-sm text-ice-200/60">Progresse, gagne de l'XP et débloque des badges.</p>
      </div>

      <Card className="p-6" glow>
        <div className="mb-2 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <IconStar className="h-5 w-5 text-gold-400" />
            <h2 className="font-display text-lg font-semibold text-white">Niveau {displayLevel(level)} — {levelTitle(level)}</h2>
          </div>
          {!isMaxLevel(level) && <span className="text-xs text-ice-200/50">{xp} / {xpToNext} XP</span>}
        </div>
        {!isMaxLevel(level) && <ProgressBar value={xp} max={xpToNext} />}
        {nextLevelTier(level) && (
          <p className="mt-2 text-xs text-ice-200/40">
            Prochain titre — <span className="text-gold-400">{nextLevelTier(level)!.title}</span> au niveau {nextLevelTier(level)!.minLevel}
          </p>
        )}
      </Card>

      <Card className="mt-6 p-6">
        <h2 className="mb-1 font-display text-lg font-semibold text-white">Salons VIP</h2>
        <p className="mb-4 text-xs text-ice-200/50">Chaque salon débloqué augmente le plafond de mise autorisé selon ton solde.</p>
        <div className="flex flex-col gap-2">
          {SALONS.map((s) => {
            const unlocked = level >= s.minLevel;
            const isCurrent = currentSalon(level).id === s.id;
            return (
              <div
                key={s.id}
                className={cn(
                  "flex items-center justify-between rounded-xl border p-4",
                  isCurrent ? "border-gold-400/50 bg-gold-500/5" : unlocked ? "border-emerald-500/20 bg-emerald-500/5" : "border-white/10 bg-white/[0.02] opacity-50"
                )}
              >
                <div>
                  <p className="text-sm font-semibold text-white">{s.name} {isCurrent && <Badge tone="gold" className="ml-2">Actuel</Badge>}</p>
                  <p className="text-xs text-ice-200/50">{s.description}</p>
                </div>
                <div className="text-right">
                  <p className="font-display text-sm font-bold text-electric-400">Mise max {s.betCapPercent}%</p>
                  <p className="text-[11px] text-ice-200/40">{unlocked ? "Débloqué" : `Niveau ${s.minLevel} requis`}</p>
                </div>
              </div>
            );
          })}
        </div>
      </Card>

      <Card className="mt-6 p-6">
        <div className="mb-1 flex items-center gap-2">
          <IconSlots className="h-5 w-5 text-electric-400" />
          <h2 className="font-display text-lg font-semibold text-white">Déblocage des machines à sous</h2>
        </div>
        <p className="mb-4 text-xs text-ice-200/50">Monte de niveau en jouant pour ouvrir toutes les machines du casino.</p>
        <div className="grid gap-2 sm:grid-cols-2">
          {SLOT_MACHINES.map((m) => {
            const unlocked = level >= m.minLevel;
            return (
              <div key={m.id} className={cn("flex items-center justify-between rounded-xl border p-3", unlocked ? "border-emerald-500/20 bg-emerald-500/5" : "border-white/10 bg-white/[0.02] opacity-50")}>
                <div>
                  <p className="text-sm font-semibold text-white">{m.name}</p>
                  <p className="text-xs text-ice-200/50">{m.theme}</p>
                </div>
                <Badge tone={unlocked ? "success" : "neutral"}>{unlocked ? "Débloquée" : `Niv. ${m.minLevel}`}</Badge>
              </div>
            );
          })}
        </div>
      </Card>

      <Card className="mt-6 p-6">
        <h2 className="mb-4 font-display text-lg font-semibold text-white">Missions du jour</h2>
        <div className="flex flex-col gap-3">
          {missions.map((m) => {
            const done = m.progress >= m.target;
            return (
              <div key={m.id} className="rounded-xl border border-white/10 bg-white/[0.03] p-4">
                <div className="mb-2 flex items-center justify-between">
                  <p className="text-sm font-medium text-white">{m.title}</p>
                  <span className="text-xs text-ice-200/50">{Math.min(m.progress, m.target)} / {m.target}</span>
                </div>
                <ProgressBar value={m.progress} max={m.target} className="mb-3" />
                <div className="flex items-center justify-between">
                  <span className="text-xs text-gold-400">+{formatCredits(m.reward)} crédits · +{m.xp} XP</span>
                  <Button size="sm" variant={done && !m.claimed ? "gold" : "secondary"} disabled={!done || m.claimed} onClick={() => handleClaim(m.id, m.reward)}>
                    {m.claimed ? "Réclamé" : done ? "Réclamer" : "En cours"}
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      </Card>

      <Card className="mt-6 p-6">
        <div className="mb-4 flex items-center gap-2">
          <IconTrophy className="h-5 w-5 text-electric-400" />
          <h2 className="font-display text-lg font-semibold text-white">Badges</h2>
        </div>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {badges.map((b) => (
            <div key={b.id} className={`flex flex-col items-center gap-2 rounded-xl border p-4 text-center ${b.earned ? "border-gold-400/40 bg-gold-500/5" : "border-white/10 bg-white/[0.02] opacity-40"}`}>
              <IconTrophy className={`h-6 w-6 ${b.earned ? "text-gold-400" : "text-ice-200/40"}`} />
              <span className="text-xs font-medium text-white">{b.label}</span>
              {b.earned && <Badge tone="gold">Débloqué</Badge>}
            </div>
          ))}
        </div>
      </Card>

      <Card className="mt-6 p-6">
        <div className="mb-4 flex items-center gap-2">
          <IconTrophy className="h-5 w-5 text-gold-400" />
          <h2 className="font-display text-lg font-semibold text-white">Titres délirants ({unlockedTitles.length}/{EXPLOIT_TITLES.length})</h2>
        </div>
        <p className="mb-4 text-xs text-ice-200/50">Le titre équipé s'affiche à côté de ton pseudo, visible par les autres joueurs.</p>
        <div className="flex flex-col gap-2">
          {EXPLOIT_TITLES.map((t) => {
            const unlocked = unlockedTitles.some((u) => u.id === t.id);
            const isEquipped = equippedTitle === t.id;
            return (
              <div key={t.id} className={cn("flex items-center justify-between rounded-xl border p-3", unlocked ? "border-emerald-500/20 bg-emerald-500/5" : "border-white/10 bg-white/[0.02] opacity-40")}>
                <span className="text-sm font-semibold text-white">{t.label}</span>
                {unlocked ? (
                  <Button
                    size="sm"
                    variant={isEquipped ? "gold" : "secondary"}
                    onClick={() => updateProfile({ title: isEquipped ? "" : t.id })}
                  >
                    {isEquipped ? "Équipé" : "Équiper"}
                  </Button>
                ) : (
                  <Badge tone="neutral">Verrouillé</Badge>
                )}
              </div>
            );
          })}
        </div>
      </Card>
    </div>
  );
}
