import { useEffect, useState, lazy, Suspense } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { useAuthStore } from "./store/authStore";
import { useCasinoStore } from "./store/casinoStore";
import { usePresenceStore } from "./store/presenceStore";
import { useGameStatusStore } from "./store/gameStatusStore";
import { useJackpotStore } from "./store/jackpotStore";
import { useCelebrationStore } from "./store/celebrationStore";
import { useGlobalFeedStore } from "./store/globalFeedStore";
import { useGiftsStore } from "./store/giftsStore";
import { useFriendsStore } from "./store/friendsStore";
import { useNotificationStore } from "./store/notificationStore";
import { AuthGate } from "./components/auth/AuthGate";
import { ResetPasswordScreen } from "./components/auth/ResetPasswordScreen";
import { Header } from "./components/layout/Header";
import { MobileNav } from "./components/layout/MobileNav";
import { Footer } from "./components/layout/Footer";
import { ToastHost } from "./components/ui/ToastHost";
import { LuckyHourBanner } from "./components/ui/LuckyHourBanner";
import { WinCelebration } from "./components/ui/WinCelebration";
import { Card } from "./components/ui/Card";
import { Logo } from "./components/ui/Logo";
import { IconLock } from "./components/icons";
import { GATED_GAME_IDS, type AppTab } from "./lib/navigation";
import { supabase } from "./lib/supabase";
import { Home } from "./pages/Home";
import { Games } from "./pages/Games";

// Code-split every other page — each game/section only loads when a player actually opens it,
// instead of all ~20 pages landing in one bundle on first paint.
const Slots = lazy(() => import("./pages/Slots").then((m) => ({ default: m.Slots })));
const Blackjack = lazy(() => import("./pages/Blackjack").then((m) => ({ default: m.Blackjack })));
const Roulette = lazy(() => import("./pages/Roulette").then((m) => ({ default: m.Roulette })));
const ChickenRoad = lazy(() => import("./pages/ChickenRoad").then((m) => ({ default: m.ChickenRoad })));
const Plinko = lazy(() => import("./pages/Plinko").then((m) => ({ default: m.Plinko })));
const Crash = lazy(() => import("./pages/Crash").then((m) => ({ default: m.Crash })));
const ScratchCards = lazy(() => import("./pages/ScratchCards").then((m) => ({ default: m.ScratchCards })));
const Bourse = lazy(() => import("./pages/Bourse").then((m) => ({ default: m.Bourse })));
const Braquage = lazy(() => import("./pages/Braquage").then((m) => ({ default: m.Braquage })));
const Boosters = lazy(() => import("./pages/Boosters").then((m) => ({ default: m.Boosters })));
const Cases = lazy(() => import("./pages/Cases").then((m) => ({ default: m.Cases })));
const Pmu = lazy(() => import("./pages/Pmu").then((m) => ({ default: m.Pmu })));
const Ministry = lazy(() => import("./pages/Ministry").then((m) => ({ default: m.Ministry })));
const Club = lazy(() => import("./pages/Club").then((m) => ({ default: m.Club })));
const Laundering = lazy(() => import("./pages/Laundering").then((m) => ({ default: m.Laundering })));
const Blackmarket = lazy(() => import("./pages/Blackmarket").then((m) => ({ default: m.Blackmarket })));
const Darktable = lazy(() => import("./pages/Darktable").then((m) => ({ default: m.Darktable })));
const Sect = lazy(() => import("./pages/Sect").then((m) => ({ default: m.Sect })));
const Startup = lazy(() => import("./pages/Startup").then((m) => ({ default: m.Startup })));
const Bookmaker = lazy(() => import("./pages/Bookmaker").then((m) => ({ default: m.Bookmaker })));
const Bonus = lazy(() => import("./pages/Bonus").then((m) => ({ default: m.Bonus })));
const Rewards = lazy(() => import("./pages/Rewards").then((m) => ({ default: m.Rewards })));
const Leaderboard = lazy(() => import("./pages/Leaderboard").then((m) => ({ default: m.Leaderboard })));
const Shop = lazy(() => import("./pages/Shop").then((m) => ({ default: m.Shop })));
const Friends = lazy(() => import("./pages/Friends").then((m) => ({ default: m.Friends })));
const Salons = lazy(() => import("./pages/Salons").then((m) => ({ default: m.Salons })));
const Profile = lazy(() => import("./pages/Profile").then((m) => ({ default: m.Profile })));
const Admin = lazy(() => import("./pages/Admin").then((m) => ({ default: m.Admin })));

const PAGES: Record<AppTab, (onNavigate: (t: AppTab) => void) => JSX.Element> = {
  home: (onNavigate) => <Home onNavigate={onNavigate} />,
  games: (onNavigate) => <Games onNavigate={onNavigate} />,
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
  cases: () => <Cases />,
  pmu: () => <Pmu />,
  ministry: () => <Ministry />,
  club: () => <Club />,
  laundering: () => <Laundering />,
  blackmarket: () => <Blackmarket />,
  darktable: () => <Darktable />,
  sect: () => <Sect />,
  startup: () => <Startup />,
  bookmaker: () => <Bookmaker />,
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
  const [navOpen, setNavOpen] = useState(false);
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const recoveryMode = useAuthStore((s) => s.recoveryMode);
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
      useCasinoStore.getState().hydrateFromCloud(account.id);
      useNotificationStore.getState().fetchAll(account.id);
      const unsubscribeStatus = subscribeGameStatuses();
      const unsubscribeJackpot = subscribeJackpot();
      const unsubscribeFeed = subscribeGlobalFeed();
      const unsubscribeCasino = useCasinoStore.subscribe(() => useCasinoStore.getState().syncToCloud(account.id));
      const unsubscribeCasinoCloud = useCasinoStore.getState().subscribeToCloud(account.id);
      const unsubscribeGifts = useGiftsStore.getState().subscribe(account.id);
      const unsubscribeNotifications = useNotificationStore.getState().subscribe(account.id);
      const unsubscribeFriends = useFriendsStore.getState().subscribe();
      return () => {
        unsubscribeStatus();
        unsubscribeJackpot();
        unsubscribeFeed();
        unsubscribeCasino();
        unsubscribeCasinoCloud();
        unsubscribeGifts();
        unsubscribeNotifications();
        unsubscribeFriends();
      };
    }
    stopPresence();
    resetGameStatus();
    useNotificationStore.getState().reset();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAuthenticated, account?.id]);

  function navigate(next: AppTab) {
    setTab(next);
    setNavOpen(false);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  if (initializing) {
    return (
      <div className="grid min-h-screen place-items-center bg-ink-950">
        <Logo className="h-12 w-12 shadow-glow rounded-xl animate-pulse-glow" />
      </div>
    );
  }

  if (recoveryMode) return <ResetPasswordScreen />;
  if (!isAuthenticated) return <AuthGate />;

  const gameId = GATED_GAME_IDS[tab];
  const status = gameId ? gameStatuses[gameId] : undefined;
  const inMaintenance = status && !status.enabled;

  return (
    <div className="flex min-h-screen flex-col">
      <Header active={tab} onNavigate={navigate} onMenuClick={() => setNavOpen(true)} />
      <LuckyHourBanner />
      <ToastHost />
      <main className="flex-1">
        <AnimatePresence mode="wait">
          <motion.div
            key={tab}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.25 }}
          >
            {inMaintenance ? (
              <MaintenanceScreen message={status!.message} />
            ) : (
              <Suspense fallback={<PageLoading />}>{PAGES[tab](navigate)}</Suspense>
            )}
          </motion.div>
        </AnimatePresence>
      </main>
      {tab === "home" && <Footer />}
      <MobileNav active={tab} open={navOpen} onNavigate={navigate} onClose={() => setNavOpen(false)} />
      <WinCelebration tier={celebration.tier} payout={celebration.payout} onClose={celebration.clear} game={celebration.game} />
    </div>
  );
}

function PageLoading() {
  return (
    <div className="grid place-items-center py-24">
      <Logo className="h-10 w-10 animate-pulse-glow rounded-xl" />
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
