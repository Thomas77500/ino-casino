import type { ComponentType, SVGProps } from "react";
import {
  IconHome,
  IconSlots,
  IconCards,
  IconRoulette,
  IconGift,
  IconTrophy,
  IconUser,
  IconChicken,
  IconPlinko,
  IconRocket,
  IconTicket,
  IconUsers,
  IconDoor,
  IconTrendUp,
  IconVaultDoor,
  IconShield,
  IconBag,
  IconPack,
  IconCrate,
} from "../components/icons";

export type AppTab =
  | "home"
  | "slots"
  | "blackjack"
  | "roulette"
  | "chickenroad"
  | "plinko"
  | "crash"
  | "scratch"
  | "bourse"
  | "braquage"
  | "boosters"
  | "cases"
  | "bonus"
  | "rewards"
  | "leaderboard"
  | "shop"
  | "friends"
  | "salons"
  | "profile"
  | "admin";

export const TABS: { id: AppTab; label: string; icon: ComponentType<SVGProps<SVGSVGElement>>; adminOnly?: boolean }[] = [
  { id: "home", label: "Accueil", icon: IconHome },
  { id: "slots", label: "Machines à sous", icon: IconSlots },
  { id: "blackjack", label: "Blackjack", icon: IconCards },
  { id: "roulette", label: "Roulette", icon: IconRoulette },
  { id: "chickenroad", label: "Chicken Road", icon: IconChicken },
  { id: "plinko", label: "Plinko", icon: IconPlinko },
  { id: "crash", label: "Crash", icon: IconRocket },
  { id: "scratch", label: "Cartes à gratter", icon: IconTicket },
  { id: "bourse", label: "Bourse", icon: IconTrendUp },
  { id: "braquage", label: "Braquage", icon: IconVaultDoor },
  { id: "boosters", label: "Boosters", icon: IconPack },
  { id: "cases", label: "Caisses", icon: IconCrate },
  { id: "bonus", label: "Bonus", icon: IconGift },
  { id: "rewards", label: "Récompenses", icon: IconTrophy },
  { id: "leaderboard", label: "Classement", icon: IconTrophy },
  { id: "shop", label: "Boutique", icon: IconBag },
  { id: "friends", label: "Amis", icon: IconUsers },
  { id: "salons", label: "Salons privés", icon: IconDoor },
  { id: "profile", label: "Profil", icon: IconUser },
  { id: "admin", label: "Administration", icon: IconShield, adminOnly: true },
];

// Tabs whose page corresponds to a `game_status` row the admin panel can toggle into maintenance.
export const GATED_GAME_IDS: Partial<Record<AppTab, string>> = {
  slots: "slots",
  blackjack: "blackjack",
  roulette: "roulette",
  chickenroad: "chickenroad",
  plinko: "plinko",
  crash: "crash",
  scratch: "scratch",
  bourse: "bourse",
  braquage: "braquage",
  boosters: "boosters",
  cases: "cases",
};
