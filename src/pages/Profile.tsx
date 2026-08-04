import { useState } from "react";
import { useCasinoStore } from "../store/casinoStore";
import { useAuthStore } from "../store/authStore";
import { useToastStore } from "../store/toastStore";
import { useSoundStore } from "../store/soundStore";
import { Card } from "../components/ui/Card";
import { Button } from "../components/ui/Button";
import { Badge } from "../components/ui/Badge";
import { ProgressBar } from "../components/ui/ProgressBar";
import { Modal } from "../components/ui/Modal";
import { IconTrophy } from "../components/icons";
import { formatCredits, cn } from "../lib/format";
import { computeBadges } from "../lib/badges";
import { levelTitle, displayLevel, isMaxLevel } from "../lib/levelTitles";
import { currentSalon } from "../lib/salons";
import { AVATAR_OPTIONS } from "../lib/avatars";
import { exploitTitleLabel } from "../lib/exploitTitles";
import { AvatarBubble } from "../components/ui/AvatarBubble";

export function Profile() {
  const credits = useCasinoStore((s) => s.credits);
  const level = useCasinoStore((s) => s.level);
  const xp = useCasinoStore((s) => s.xp);
  const xpToNext = useCasinoStore((s) => s.xpToNext);
  const totalWagered = useCasinoStore((s) => s.totalWagered);
  const totalWon = useCasinoStore((s) => s.totalWon);
  const biggestWin = useCasinoStore((s) => s.biggestWin);
  const streakCount = useCasinoStore((s) => s.streakCount);
  const history = useCasinoStore((s) => s.history);
  const account = useAuthStore((s) => s.account);
  const updateProfile = useAuthStore((s) => s.updateProfile);
  const updateEmail = useAuthStore((s) => s.updateEmail);
  const updatePassword = useAuthStore((s) => s.updatePassword);
  const logout = useAuthStore((s) => s.logout);
  const push = useToastStore((s) => s.push);
  const [confirmReset, setConfirmReset] = useState(false);
  const [editing, setEditing] = useState(false);
  const [editUsername, setEditUsername] = useState(account?.username ?? "");
  const [editAvatar, setEditAvatar] = useState(account?.avatar ?? AVATAR_OPTIONS[0]);
  const [newEmail, setNewEmail] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmNewPassword, setConfirmNewPassword] = useState("");
  const [savingEmail, setSavingEmail] = useState(false);
  const [savingPassword, setSavingPassword] = useState(false);
  const muted = useSoundStore((s) => s.muted);
  const volume = useSoundStore((s) => s.volume);
  const toggleMuted = useSoundStore((s) => s.toggleMuted);
  const setVolume = useSoundStore((s) => s.setVolume);

  const badges = computeBadges({ level, biggestWin, totalWagered, streakCount });
  const earnedBadges = badges.filter((b) => b.earned);

  function resetProgress() {
    localStorage.removeItem("ino-casino-store");
    window.location.reload();
  }

  function openEdit() {
    setEditUsername(account?.username ?? "");
    setEditAvatar(account?.avatar ?? AVATAR_OPTIONS[0]);
    setEditing(true);
  }

  function saveEdit() {
    updateProfile({ username: editUsername, avatar: editAvatar });
    setEditing(false);
  }

  async function saveEmail(e: React.FormEvent) {
    e.preventDefault();
    if (!newEmail.trim() || savingEmail) return;
    setSavingEmail(true);
    const result = await updateEmail(newEmail.trim());
    setSavingEmail(false);
    push({ kind: result.ok ? "success" : "info", title: result.message });
    if (result.ok) setNewEmail("");
  }

  function copyReferralCode() {
    if (!account?.username) return;
    navigator.clipboard.writeText(account.username);
    push({ kind: "success", title: "Pseudo copié !" });
  }

  async function savePassword(e: React.FormEvent) {
    e.preventDefault();
    if (!newPassword || savingPassword) return;
    if (newPassword !== confirmNewPassword) {
      push({ kind: "info", title: "Les mots de passe ne correspondent pas." });
      return;
    }
    setSavingPassword(true);
    const result = await updatePassword(newPassword);
    setSavingPassword(false);
    push({ kind: result.ok ? "success" : "info", title: result.message });
    if (result.ok) {
      setNewPassword("");
      setConfirmNewPassword("");
    }
  }

  return (
    <div className="mx-auto max-w-4xl px-4 py-8 sm:px-6">
      <Card className="flex flex-col items-center gap-4 p-8 text-center sm:flex-row sm:text-left" glow>
        <AvatarBubble avatar={account?.avatar ?? "🎲"} frame={account?.frame} size="lg" className="shadow-glow" />
        <div className="flex-1">
          <div className="flex flex-wrap items-center justify-center gap-2 sm:justify-start">
            <h1 className="font-display text-2xl font-bold text-white">{account?.username ?? "Joueur Ino"}</h1>
            {exploitTitleLabel(account?.title) && <Badge tone="gold">{exploitTitleLabel(account?.title)}</Badge>}
            <button onClick={openEdit} className="text-xs text-electric-400 hover:text-electric-300">Modifier</button>
          </div>
          <p className="text-xs text-ice-200/40">{account?.email}</p>
          <p className="mt-1 text-sm text-ice-200/60">
            Niveau {displayLevel(level)} · <span className="text-gold-400">{levelTitle(level)}</span>
            {!isMaxLevel(level) && ` — ${xp} / ${xpToNext} XP`}
          </p>
          {!isMaxLevel(level) && <ProgressBar value={xp} max={xpToNext} className="mt-2 max-w-xs" />}
        </div>
        <div className="flex flex-col items-center gap-3 sm:items-end">
          <div className="text-right">
            <p className="text-[11px] uppercase tracking-wide text-ice-200/50">Crédits</p>
            <p className="font-display text-2xl font-bold text-gold-400">{formatCredits(credits)}</p>
          </div>
          <Button variant="secondary" size="sm" onClick={logout}>Se déconnecter</Button>
        </div>
      </Card>

      <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        <StatTile label="Total misé" value={formatCredits(totalWagered)} />
        <StatTile label="Total gagné" value={formatCredits(totalWon)} />
        <StatTile label="Plus gros gain" value={formatCredits(biggestWin)} />
        <StatTile label="Série quotidienne" value={`${streakCount} j`} />
        <StatTile label="Salon actuel" value={currentSalon(level).name} />
      </div>

      <Card className="mt-6 p-6">
        <div className="mb-4 flex items-center gap-2">
          <IconTrophy className="h-5 w-5 text-gold-400" />
          <h2 className="font-display text-lg font-semibold text-white">Badges obtenus ({earnedBadges.length}/{badges.length})</h2>
        </div>
        <div className="flex flex-wrap gap-2">
          {earnedBadges.map((b) => (
            <Badge key={b.id} tone="gold">{b.label}</Badge>
          ))}
          {earnedBadges.length === 0 && <p className="text-xs text-ice-200/50">Aucun badge pour le moment — commence à jouer !</p>}
        </div>
      </Card>

      <Card className="mt-6 p-6">
        <h2 className="mb-4 font-display text-lg font-semibold text-white">Sécurité du compte</h2>
        <div className="grid gap-6 sm:grid-cols-2">
          <form onSubmit={saveEmail} className="flex flex-col gap-2">
            <label className="flex flex-col gap-1.5">
              <span className="text-xs font-medium uppercase tracking-wide text-ice-200/50">Changer d'email</span>
              <input type="email" value={newEmail} onChange={(e) => setNewEmail(e.target.value)} placeholder={account?.email} className="input" />
            </label>
            <Button type="submit" size="sm" variant="secondary" disabled={!newEmail.trim() || savingEmail} className="self-start">
              {savingEmail ? "Envoi..." : "Mettre à jour l'email"}
            </Button>
          </form>
          <form onSubmit={savePassword} className="flex flex-col gap-2">
            <label className="flex flex-col gap-1.5">
              <span className="text-xs font-medium uppercase tracking-wide text-ice-200/50">Nouveau mot de passe</span>
              <input type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} placeholder="••••••••" className="input" />
            </label>
            <label className="flex flex-col gap-1.5">
              <span className="text-xs font-medium uppercase tracking-wide text-ice-200/50">Confirmer</span>
              <input type="password" value={confirmNewPassword} onChange={(e) => setConfirmNewPassword(e.target.value)} placeholder="••••••••" className="input" />
            </label>
            <Button type="submit" size="sm" variant="secondary" disabled={!newPassword || savingPassword} className="self-start">
              {savingPassword ? "..." : "Changer le mot de passe"}
            </Button>
          </form>
        </div>
      </Card>

      <Card className="mt-6 p-6">
        <h2 className="mb-2 font-display text-lg font-semibold text-white">Parrainage</h2>
        <p className="mb-4 text-xs text-ice-200/50">
          Partage ton pseudo comme code de parrainage — ton ami reçoit un bonus à l'inscription, tu reçois le tien à ta prochaine connexion.
        </p>
        <div className="flex items-center gap-2">
          <span className="rounded-lg border border-white/10 bg-white/[0.03] px-3 py-2 font-mono text-sm text-gold-400">{account?.username}</span>
          <Button variant="secondary" size="sm" onClick={copyReferralCode}>Copier</Button>
        </div>
      </Card>

      <Card className="mt-6 p-6">
        <h2 className="mb-4 font-display text-lg font-semibold text-white">Son</h2>
        <div className="flex flex-wrap items-center gap-4">
          <Button variant="secondary" size="sm" onClick={toggleMuted}>
            {muted ? "🔇 Muet" : "🔊 Actif"}
          </Button>
          <label className="flex flex-1 items-center gap-2 text-xs text-ice-200/50">
            Volume
            <input
              type="range"
              min={0}
              max={1}
              step={0.05}
              value={volume}
              onChange={(e) => setVolume(Number(e.target.value))}
              disabled={muted}
              className="flex-1"
            />
          </label>
        </div>
      </Card>

      <Card className="mt-6 p-6">
        <h2 className="mb-4 font-display text-lg font-semibold text-white">Historique complet</h2>
        {history.length === 0 ? (
          <p className="text-xs text-ice-200/50">Aucune partie jouée pour l'instant.</p>
        ) : (
          <div className="max-h-72 overflow-y-auto">
            <ul className="flex flex-col gap-2">
              {history.map((h) => (
                <li key={h.id} className="flex items-center justify-between rounded-lg bg-white/[0.03] px-3 py-2 text-xs">
                  <span className="text-ice-200/70">{h.game} — {h.label}</span>
                  <span className="text-ice-200/40">Mise {formatCredits(h.bet)}</span>
                  <span className={h.payout > h.bet ? "font-semibold text-emerald-400" : "text-ice-200/40"}>
                    {h.payout > 0 ? `+${formatCredits(h.payout)}` : "—"}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </Card>

      <div className="mt-6 rounded-2xl border border-electric-500/20 bg-electric-500/[0.05] p-4 text-xs text-ice-200/60">
        Rappel : Ino Casino fonctionne uniquement avec des crédits virtuels. Aucun dépôt ni retrait d'argent réel n'est possible sur cette plateforme.
      </div>

      <div className="mt-6">
        <Button variant="ghost" size="sm" onClick={() => setConfirmReset(true)} className="text-ice-200/40">
          Réinitialiser ma progression
        </Button>
      </div>

      <Modal open={confirmReset} onClose={() => setConfirmReset(false)}>
        <h3 className="mb-2 font-display text-lg font-bold text-white">Réinitialiser la progression ?</h3>
        <p className="mb-6 text-sm text-ice-200/60">Tes crédits, ton niveau, tes missions et ton historique seront définitivement effacés.</p>
        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={() => setConfirmReset(false)}>Annuler</Button>
          <Button variant="primary" onClick={resetProgress}>Réinitialiser</Button>
        </div>
      </Modal>

      <Modal open={editing} onClose={() => setEditing(false)}>
        <h3 className="mb-4 font-display text-lg font-bold text-white">Modifier le profil</h3>
        <label className="mb-4 flex flex-col gap-1.5">
          <span className="text-xs font-medium uppercase tracking-wide text-ice-200/50">Pseudo</span>
          <input value={editUsername} onChange={(e) => setEditUsername(e.target.value)} className="input" />
        </label>
        <p className="mb-2 text-xs font-medium uppercase tracking-wide text-ice-200/50">Avatar</p>
        <div className="mb-6 flex flex-wrap gap-2">
          {AVATAR_OPTIONS.map((a) => (
            <button
              key={a}
              onClick={() => setEditAvatar(a)}
              className={cn(
                "grid h-10 w-10 place-items-center rounded-full border text-lg transition-colors",
                editAvatar === a ? "border-gold-400 bg-gold-500/15 shadow-glow-gold" : "border-white/10 bg-white/[0.03]"
              )}
            >
              {a}
            </button>
          ))}
        </div>
        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={() => setEditing(false)}>Annuler</Button>
          <Button variant="primary" onClick={saveEdit} disabled={editUsername.trim().length < 3}>Enregistrer</Button>
        </div>
      </Modal>
    </div>
  );
}

function StatTile({ label, value }: { label: string; value: string }) {
  return (
    <Card className="p-4 text-center">
      <p className="text-[11px] uppercase tracking-wide text-ice-200/50">{label}</p>
      <p className="mt-1 font-display text-lg font-bold text-white">{value}</p>
    </Card>
  );
}
