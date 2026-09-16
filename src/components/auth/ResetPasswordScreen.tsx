import { useState } from "react";
import { motion } from "framer-motion";
import { useAuthStore } from "../../store/authStore";
import { Card } from "../ui/Card";
import { Button } from "../ui/Button";
import { Logo } from "../ui/Logo";
import { PasswordInput } from "./AuthGate";

// Shown instead of the normal app whenever authStore.recoveryMode is true — i.e. the player just
// followed a "mot de passe oublié" email link and needs to pick a new password before continuing.
export function ResetPasswordScreen() {
  const updatePassword = useAuthStore((s) => s.updatePassword);
  const exitRecoveryMode = useAuthStore((s) => s.exitRecoveryMode);
  const logout = useAuthStore((s) => s.logout);

  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (password !== confirmPassword) {
      setError("Les mots de passe ne correspondent pas.");
      return;
    }
    setLoading(true);
    const result = await updatePassword(password);
    setLoading(false);
    if (!result.ok) {
      setError(result.message);
      return;
    }
    exitRecoveryMode();
  }

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden px-4 py-12">
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute -top-40 left-1/2 h-[500px] w-[900px] -translate-x-1/2 rounded-full bg-electric-500/20 blur-3xl animate-pulse-glow" />
      </div>

      <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }} className="relative w-full max-w-md">
        <div className="mb-6 flex flex-col items-center gap-3 text-center">
          <Logo className="h-12 w-12 shadow-glow rounded-xl" />
          <h1 className="font-display text-2xl font-bold text-white">Nouveau mot de passe</h1>
          <p className="text-sm text-ice-200/60">Choisis un nouveau mot de passe pour ton compte.</p>
        </div>

        <Card className="p-6" glow>
          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <label className="flex flex-col gap-1.5">
              <span className="text-xs font-medium uppercase tracking-wide text-ice-200/50">Nouveau mot de passe</span>
              <PasswordInput value={password} onChange={setPassword} />
            </label>
            <label className="flex flex-col gap-1.5">
              <span className="text-xs font-medium uppercase tracking-wide text-ice-200/50">Confirmer</span>
              <PasswordInput value={confirmPassword} onChange={setConfirmPassword} />
            </label>
            {error && <p className="text-xs font-medium text-red-400">{error}</p>}
            <Button type="submit" size="lg" className="mt-2" disabled={loading}>
              {loading ? "Mise à jour..." : "Valider"}
            </Button>
            <button type="button" onClick={() => logout()} className="self-center text-xs text-ice-200/50 hover:text-white">
              Annuler et se déconnecter
            </button>
          </form>
        </Card>
      </motion.div>
    </div>
  );
}
