import { create } from "zustand";
import { supabase } from "../lib/supabase";

export interface Account {
  id: string;
  username: string;
  email: string;
  avatar: string;
  frame: string | null;
  title: string | null;
}

interface AuthState {
  account: Account | null;
  isAuthenticated: boolean;
  initializing: boolean;
  loading: boolean;
  error: string | null;
  recoveryMode: boolean;
  init: () => Promise<void>;
  signUp: (input: { username: string; email: string; password: string; avatar: string; referrer?: string }) => Promise<boolean>;
  login: (input: { email: string; password: string }) => Promise<boolean>;
  logout: () => Promise<void>;
  updateProfile: (input: { username?: string; avatar?: string; frame?: string; title?: string }) => Promise<void>;
  updateEmail: (newEmail: string) => Promise<{ ok: boolean; message: string }>;
  updatePassword: (newPassword: string) => Promise<{ ok: boolean; message: string }>;
  requestPasswordReset: (email: string) => Promise<{ ok: boolean; message: string }>;
  exitRecoveryMode: () => void;
  clearError: () => void;
}

async function fetchProfile(userId: string): Promise<{ username: string; avatar: string; frame: string | null; title: string | null; banned: boolean } | null> {
  const { data } = await supabase.from("profiles").select("username, avatar").eq("id", userId).maybeSingle();
  if (!data) return null;
  // frame/equipped_title/banned only exist after their respective migrations — fetched separately
  // and best-effort so login/init still work on a project that hasn't applied them yet.
  const [{ data: cosmetics }, { data: banStatus }] = await Promise.all([
    supabase.from("profiles").select("frame, equipped_title").eq("id", userId).maybeSingle(),
    supabase.from("profiles").select("banned").eq("id", userId).maybeSingle(),
  ]);
  return { username: data.username, avatar: data.avatar, frame: cosmetics?.frame ?? null, title: cosmetics?.equipped_title ?? null, banned: banStatus?.banned ?? false };
}

export const useAuthStore = create<AuthState>()((set, get) => ({
  account: null,
  isAuthenticated: false,
  initializing: true,
  loading: false,
  error: null,
  recoveryMode: false,

  init: async () => {
    const { data } = await supabase.auth.getSession();
    const user = data.session?.user;
    if (user) {
      const profile = await fetchProfile(user.id);
      if (profile?.banned) {
        await supabase.auth.signOut();
      } else if (profile) {
        const { banned: _banned, ...rest } = profile;
        set({ account: { id: user.id, email: user.email ?? "", ...rest }, isAuthenticated: true });
      }
    }
    set({ initializing: false });

    // A password-reset email link lands here with a recovery token — supabase-js turns it into a
    // real session automatically and fires this event. Log the account in as usual, but flag
    // recoveryMode so the UI shows "choose a new password" instead of dropping them straight into
    // the app with whatever password they just clicked past.
    supabase.auth.onAuthStateChange(async (event, session) => {
      if (!session?.user) {
        set({ account: null, isAuthenticated: false });
        return;
      }
      const profile = await fetchProfile(session.user.id);
      if (profile?.banned) {
        await supabase.auth.signOut();
        return;
      }
      if (profile) {
        const { banned: _banned, ...rest } = profile;
        set({
          account: { id: session.user.id, email: session.user.email ?? "", ...rest },
          isAuthenticated: true,
          recoveryMode: event === "PASSWORD_RECOVERY" ? true : get().recoveryMode,
        });
      }
    });
  },

  signUp: async ({ username, email, password, avatar, referrer }) => {
    set({ loading: true, error: null });
    const trimmedUsername = username.trim();

    if (trimmedUsername.length < 3) {
      set({ loading: false, error: "Pseudo trop court (3 caractères minimum)." });
      return false;
    }
    if (!/^\S+@\S+\.\S+$/.test(email.trim())) {
      set({ loading: false, error: "Adresse email invalide." });
      return false;
    }
    if (password.length < 4) {
      set({ loading: false, error: "Mot de passe trop court (4 caractères minimum)." });
      return false;
    }

    const { data: existing } = await supabase.from("profiles").select("id").eq("username_lower", trimmedUsername.toLowerCase()).maybeSingle();
    if (existing) {
      set({ loading: false, error: "Ce pseudo est déjà pris." });
      return false;
    }

    const { data, error } = await supabase.auth.signUp({ email: email.trim(), password });
    if (error || !data.user) {
      set({ loading: false, error: error?.message ?? "Erreur d'inscription." });
      return false;
    }

    const { error: profileError } = await supabase.from("profiles").insert({ id: data.user.id, username: trimmedUsername, avatar });
    if (profileError) {
      set({ loading: false, error: profileError.message });
      return false;
    }

    if (!data.session) {
      set({ loading: false, error: "Compte créé — vérifie ta boîte mail pour confirmer ton adresse avant de te connecter." });
      return false;
    }

    if (referrer?.trim()) {
      // Best-effort: an invalid/unknown code or a failed call should never block signup.
      supabase.rpc("claim_referral", { p_referrer_username: referrer.trim() }).then(undefined, () => {});
    }

    set({
      account: { id: data.user.id, username: trimmedUsername, email: email.trim(), avatar, frame: null, title: null },
      isAuthenticated: true,
      loading: false,
    });
    return true;
  },

  login: async ({ email, password }) => {
    set({ loading: true, error: null });
    const { data, error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
    if (error || !data.user) {
      set({ loading: false, error: "Email ou mot de passe incorrect." });
      return false;
    }
    const profile = await fetchProfile(data.user.id);
    if (!profile) {
      set({ loading: false, error: "Profil introuvable pour ce compte." });
      return false;
    }
    if (profile.banned) {
      await supabase.auth.signOut();
      set({ loading: false, error: "Ce compte a été suspendu." });
      return false;
    }
    const { banned: _banned, ...rest } = profile;
    set({
      account: { id: data.user.id, email: data.user.email ?? email.trim(), ...rest },
      isAuthenticated: true,
      loading: false,
    });
    return true;
  },

  logout: async () => {
    await supabase.auth.signOut();
    set({ account: null, isAuthenticated: false, recoveryMode: false });
  },

  updateProfile: async ({ username, avatar, frame, title }) => {
    const account = get().account;
    if (!account) return;
    const patch: { username?: string; avatar?: string; frame?: string; equipped_title?: string } = {};
    if (username?.trim()) patch.username = username.trim();
    if (avatar) patch.avatar = avatar;
    if (frame !== undefined) patch.frame = frame;
    if (title !== undefined) patch.equipped_title = title;
    if (Object.keys(patch).length === 0) return;

    const { error } = await supabase.from("profiles").update(patch).eq("id", account.id);
    if (!error) {
      set({ account: { ...account, username: patch.username ?? account.username, avatar: patch.avatar ?? account.avatar, frame: frame !== undefined ? frame : account.frame, title: title !== undefined ? title : account.title } });
    }
  },

  updateEmail: async (newEmail) => {
    if (!/^\S+@\S+\.\S+$/.test(newEmail.trim())) {
      return { ok: false, message: "Adresse email invalide." };
    }
    const { error } = await supabase.auth.updateUser({ email: newEmail.trim() });
    if (error) return { ok: false, message: error.message };
    return { ok: true, message: "Vérifie ta boîte mail (ancienne et nouvelle adresse) pour confirmer le changement." };
  },

  updatePassword: async (newPassword) => {
    if (newPassword.length < 4) {
      return { ok: false, message: "Mot de passe trop court (4 caractères minimum)." };
    }
    const { error } = await supabase.auth.updateUser({ password: newPassword });
    if (error) return { ok: false, message: error.message };
    return { ok: true, message: "Mot de passe mis à jour." };
  },

  // Always reports success regardless of whether the email is registered — same behavior Supabase
  // itself returns — so this can't be used to check which addresses have an account.
  requestPasswordReset: async (email) => {
    if (!/^\S+@\S+\.\S+$/.test(email.trim())) {
      return { ok: false, message: "Adresse email invalide." };
    }
    await supabase.auth.resetPasswordForEmail(email.trim(), { redirectTo: window.location.origin });
    return { ok: true, message: "Si un compte existe avec cette adresse, un email de réinitialisation vient d'être envoyé." };
  },

  exitRecoveryMode: () => set({ recoveryMode: false }),

  clearError: () => set({ error: null }),
}));
