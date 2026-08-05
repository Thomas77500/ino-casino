import { useState } from "react";
import { motion } from "framer-motion";
import { useAuthStore } from "../../store/authStore";
import { useCasinoStore } from "../../store/casinoStore";
import { Card } from "../ui/Card";
import { Button } from "../ui/Button";
import { Badge } from "../ui/Badge";
import { Logo } from "../ui/Logo";
import { AVATAR_OPTIONS } from "../../lib/avatars";
import { cn } from "../../lib/format";
import { IconEye, IconEyeOff } from "../icons";

type Mode = "login" | "signup";

export function AuthGate() {
  const signUp = useAuthStore((s) => s.signUp);
  const login = useAuthStore((s) => s.login);
  const error = useAuthStore((s) => s.error);
  const loading = useAuthStore((s) => s.loading);
  const clearError = useAuthStore((s) => s.clearError);

  const [mode, setMode] = useState<Mode>("signup");
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [avatar, setAvatar] = useState(AVATAR_OPTIONS[0]);
  const [referrer, setReferrer] = useState("");
  const [loginEmail, setLoginEmail] = useState("");
  const [loginPassword, setLoginPassword] = useState("");
  // Anti-bot: a field real users never see or fill, plus a minimum time-to-submit — catches the
  // vast majority of scripted signups without any external CAPTCHA service or user friction.
  const [honeypot, setHoneypot] = useState("");
  const [formOpenedAt] = useState(() => Date.now());

  function switchMode(next: Mode) {
    setMode(next);
    clearError();
  }

  async function handleSignUp(e: React.FormEvent) {
    e.preventDefault();
    if (honeypot.trim() || Date.now() - formOpenedAt < 1500) {
      useAuthStore.setState({ error: "Réessaie dans un instant." });
      return;
    }
    if (password !== confirmPassword) {
      useAuthStore.setState({ error: "Les mots de passe ne correspondent pas." });
      return;
    }
    const ok = await signUp({ username, email, password, avatar, referrer });
    if (ok && referrer.trim()) {
      useCasinoStore.getState().award(500);
    }
  }

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    await login({ email: loginEmail, password: loginPassword });
  }

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden px-4 py-12">
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute -top-40 left-1/2 h-[500px] w-[900px] -translate-x-1/2 rounded-full bg-electric-500/20 blur-3xl animate-pulse-glow" />
        <div className="absolute top-40 right-10 h-64 w-64 rounded-full bg-gold-500/10 blur-3xl animate-float" />
      </div>

      <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }} className="relative w-full max-w-md">
        <div className="mb-6 flex flex-col items-center gap-3 text-center">
          <Logo className="h-12 w-12 shadow-glow rounded-xl" />
          <h1 className="font-display text-2xl font-bold text-white">Ino Casino</h1>
          <Badge tone="gold">100% crédits virtuels — aucun argent réel</Badge>
        </div>

        <Card className="p-6" glow>
          <div className="mb-6 flex items-center gap-1 rounded-xl border border-white/10 bg-white/[0.03] p-1">
            <button
              onClick={() => switchMode("signup")}
              className={cn("flex-1 rounded-lg py-2 text-sm font-semibold transition-colors", mode === "signup" ? "bg-electric-500 text-white shadow-glow" : "text-ice-200/60 hover:text-white")}
            >
              Inscription
            </button>
            <button
              onClick={() => switchMode("login")}
              className={cn("flex-1 rounded-lg py-2 text-sm font-semibold transition-colors", mode === "login" ? "bg-electric-500 text-white shadow-glow" : "text-ice-200/60 hover:text-white")}
            >
              Connexion
            </button>
          </div>

          {mode === "signup" ? (
            <form onSubmit={handleSignUp} className="flex flex-col gap-4">
              <input
                type="text"
                name="website"
                value={honeypot}
                onChange={(e) => setHoneypot(e.target.value)}
                className="absolute left-[-9999px] h-0 w-0 opacity-0"
                tabIndex={-1}
                autoComplete="off"
                aria-hidden="true"
              />
              <Field label="Pseudo">
                <input value={username} onChange={(e) => setUsername(e.target.value)} placeholder="ex. LuckyPlayer" className="input" />
              </Field>
              <Field label="Email">
                <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="toi@exemple.com" className="input" />
              </Field>
              <Field label="Mot de passe">
                <PasswordInput value={password} onChange={setPassword} />
              </Field>
              <Field label="Confirmer le mot de passe">
                <PasswordInput value={confirmPassword} onChange={setConfirmPassword} />
              </Field>
              <Field label="Code de parrainage (pseudo d'un ami — facultatif)">
                <input value={referrer} onChange={(e) => setReferrer(e.target.value)} placeholder="ex. LuckyPlayer" className="input" />
              </Field>
              <div>
                <p className="mb-2 text-xs font-medium uppercase tracking-wide text-ice-200/50">Avatar</p>
                <div className="flex flex-wrap gap-2">
                  {AVATAR_OPTIONS.map((a) => (
                    <button
                      key={a}
                      type="button"
                      onClick={() => setAvatar(a)}
                      className={cn(
                        "grid h-10 w-10 place-items-center rounded-full border text-lg transition-colors",
                        avatar === a ? "border-gold-400 bg-gold-500/15 shadow-glow-gold" : "border-white/10 bg-white/[0.03]"
                      )}
                    >
                      {a}
                    </button>
                  ))}
                </div>
              </div>
              {error && <p className="text-xs font-medium text-red-400">{error}</p>}
              <Button type="submit" size="lg" className="mt-2" disabled={loading}>
                {loading ? "Création..." : "Créer mon compte"}
              </Button>
            </form>
          ) : (
            <form onSubmit={handleLogin} className="flex flex-col gap-4">
              <Field label="Email">
                <input type="email" value={loginEmail} onChange={(e) => setLoginEmail(e.target.value)} placeholder="toi@exemple.com" className="input" />
              </Field>
              <Field label="Mot de passe">
                <PasswordInput value={loginPassword} onChange={setLoginPassword} />
              </Field>
              {error && <p className="text-xs font-medium text-red-400">{error}</p>}
              <Button type="submit" size="lg" className="mt-2" disabled={loading}>
                {loading ? "Connexion..." : "Se connecter"}
              </Button>
            </form>
          )}
        </Card>

        <p className="mt-6 text-center text-xs text-ice-200/40">
          Ino Casino est une plateforme sociale 100% fictive — aucun argent réel, uniquement des crédits virtuels.
        </p>
      </motion.div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-xs font-medium uppercase tracking-wide text-ice-200/50">{label}</span>
      {children}
    </label>
  );
}

function PasswordInput({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const [visible, setVisible] = useState(false);
  return (
    <div className="relative">
      <input
        type={visible ? "text" : "password"}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="••••••••"
        className="input pr-10"
      />
      <button
        type="button"
        onClick={() => setVisible((v) => !v)}
        className="absolute right-3 top-1/2 -translate-y-1/2 text-ice-200/40 hover:text-white"
        tabIndex={-1}
      >
        {visible ? <IconEyeOff className="h-4 w-4" /> : <IconEye className="h-4 w-4" />}
      </button>
    </div>
  );
}
