import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { useAuthStore } from "./store/authStore";
import { useCasinoStore } from "./store/casinoStore";
import { usePresenceStore } from "./store/presenceStore";
import { useGameStatusStore } from "./store/gameStatusStore";
import { useJackpotStore } from "./store/jackpotStore";
import { useCelebrationStore } from "./store/celebrationStore";
import { useGlobalFeedStore } from "./store/globalFeedStore";
import { AuthGate } from "./components/auth/AuthGate";
import { Header } from "./components/layout/Header";
import { MobileNav } from "./components/layout/MobileNav";
import { Footer } from "./components/layout/Footer";
import { ToastHost } from "./components/ui/ToastHost";
import { LuckyHourBanner } from "./components/ui/LuckyHourBanner";
import { WinCelebration } from "./components/ui/WinCelebration";
import { Card } from "./components/ui/Card";
import { IconLock } from "./components/icons";
import { GATED_GAME_IDS, type AppTab } from "./lib/navigation";
import { supabase } from "./lib/supabase";
import { Home } from "./pages/Home";
import { Slots } from "./pages/Slots";
import { Blackjack } from "./pages/Blackjack";
import { Roulette } from "./pages/Roulette";
import { ChickenRoad } from "./pages/ChickenRoad";
import { Plinko } from "./pages/Plinko";
import { Crash } from "./pages/Crash";
import { ScratchCards } from "./pages/ScratchCards";
import { Bourse } from "./pages/Bourse";
import { Braquage } from "./pages/Braquage";
import { Boosters } from "./pages/Boosters";
import { Bonus } from "./pages/Bonus";
import { Rewards } from "./pages/Rewards";
import { Leaderboard } from "./pages/Leaderboard";
import { Shop } from "./pages/Shop";
import { Friends } from "./pages/Friends";
import { Salons } from "./pages/Salons";
import { Profile } from "./pages/Profile";
import { Admin } from "./pages/Admin";

const PAGES: Record<AppTab, (onNavigate: (t: AppTab) => void) => JSX.Element> = {
  home: (onNavigate) => <Home onNavigate={onNavigate} />,
  slots: () => <Slots />,
  blackjack: () => <Blackjack />,
  roulette: () => <Roulette />,
  chickenroad: () => <ChickenRoad />,
  plinko: () => <Plinko />,
  crash: () => <Crash />,
  scratch: () => <ScratchCards />,
  bourse: () => <Bourse />,
  braquage: () => <Braquage />,
  boosters: () => <Boosters />,
  bonus: () => <Bonus />,
  rewards: () => <Rewards />,
  leaderboard: () => <Leaderboard />,
  shop: () => <Shop />,
  friends: () => <Friends />,
  salons: () => <Salons />,
  profile: () => <Profile />,
  admin: () => <Admin />,
};

// The referrer isn't necessarily online when their invitee signs up, so pending referral bonuses
// are collected the next time they log in — best-effort, silently skipped if schema_extras.sql
// hasn't been run yet (the `referrals` table won't exist).
async function claimPendingReferrals(userId: string) {
  const { data, error } = await supabase.from("referrals").select("id").eq("referrer", userId).eq("reward_claimed", false);
  if (error || !data?.length) return;
  useCasinoStore.getState().award(500 * data.length);
  await supabase.from("referrals").update({ reward_claimed: true }).eq("referrer", userId).eq("reward_claimed", false);
}

export default function App() {
  const [tab, setTab] = useState<AppTab>("home");
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const initializing = useAuthStore((s) => s.initializing);
  const account = useAuthStore((s) => s.account);
  const init = useAuthStore((s) => s.init);
  const startPresence = usePresenceStore((s) => s.start);
  const stopPresence = usePresenceStore((s) => s.stop);
  const gameStatuses = useGameStatusStore((s) => s.statuses);
  const fetchGameStatuses = useGameStatusStore((s) => s.fetchAll);
  const subscribeGameStatuses = useGameStatusStore((s) => s.subscribe);
  const checkAdmin = useGameStatusStore((s) => s.checkAdmin);
  const resetGameStatus = useGameStatusStore((s) => s.reset);
  const fetchJackpot = useJackpotStore((s) => s.fetchAll);
  const subscribeJackpot = useJackpotStore((s) => s.subscribe);
  const subscribeGlobalFeed = useGlobalFeedStore((s) => s.subscribe);
  const celebration = useCelebrationStore();

  useEffect(() => {
    init();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (isAuthenticated && account) {
      startPresence(account.id);
      fetchGameStatuses();
      checkAdmin(account.id);
      fetchJackpot();
      claimPendingReferrals(account.id);
      const unsubscribeStatus = subscribeGameStatuses();
      const unsubscribeJackpot = subscribeJackpot();
      const unsubscribeFeed = subscribeGlobalFeed();
      return () => {
        unsubscribeStatus();
        unsubscribeJackpot();
        unsubscribeFeed();
      };
    }
    stopPresence();
    resetGameStatus();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAuthenticated, account?.id]);

  function navigate(next: AppTab) {
    setTab(next);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  if (initializing) {
    return (
      <div className="grid min-h-screen place-items-center bg-ink-950">
        <div className="grid h-12 w-12 place-items-center rounded-xl bg-gradient-to-br from-electric-400 to-electric-600 shadow-glow animate-pulse-glow">
          <span className="font-display text-xl font-bold text-white">I</span>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) return <AuthGate />;

  const gameId = GATED_GAME_IDS[tab];
  const status = gameId ? gameStatuses[gameId] : undefined;
  const inMaintenance = status && !status.enabled;

  return (
    <div className="flex min-h-screen flex-col">
      <Header active={tab} onNavigate={navigate} />
      <LuckyHourBanner />
      <ToastHost />
      <main className="flex-1 pb-16 lg:pb-0">
        <AnimatePresence mode="wait">
          <motion.div
            key={tab}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.25 }}
          >
            {inMaintenance ? <MaintenanceScreen message={status!.message} /> : PAGES[tab](navigate)}
          </motion.div>
        </AnimatePresence>
      </main>
      {tab === "home" && <Footer />}
      <MobileNav active={tab} onNavigate={navigate} />
      <WinCelebration tier={celebration.tier} payout={celebration.payout} onClose={celebration.clear} game={celebration.game} />
    </div>
  );
}

function MaintenanceScreen({ message }: { message: string }) {
  return (
    <div className="mx-auto max-w-lg px-4 py-16 text-center">
      <Card className="p-8" glow>
        <IconLock className="mx-auto mb-4 h-10 w-10 text-gold-400" />
        <h1 className="font-display text-xl font-bold text-white">Jeu en maintenance</h1>
        <p className="mt-2 text-sm text-ice-200/60">
          {message || "Ce jeu est temporairement indisponible. Reviens un peu plus tard."}
        </p>
      </Card>
    </div>
  );
}
