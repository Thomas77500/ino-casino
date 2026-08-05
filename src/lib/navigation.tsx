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
  IconGamepad,
  IconTicketBet,
} from "../components/icons";

export type AppTab =
  | "home"
  | "games"
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
  | "pmu"
  | "bonus"
  | "rewards"
  | "leaderboard"
  | "shop"
  | "friends"
  | "salons"
  | "profile"
  | "admin";

// The full games catalog — every wagering game, current and future, lives here once and feeds
// both the "Jeux" hub page and the maintenance-gating map below, instead of getting its own
// top-level nav entry (that's what was cluttering the navbar/burger menu).
export const GAMES: { id: AppTab; label: string; icon: ComponentType<SVGProps<SVGSVGElement>>; blurb: string; tag: string }[] = [
  { id: "slots", label: "Machines à sous", icon: IconSlots, blurb: "4 machines à thème, de la faible à l'extrême volatilité.", tag: "Populaire" },
  { id: "blackjack", label: "Blackjack Royal", icon: IconCards, blurb: "Affronte le croupier, mise Paire Parfaite en option.", tag: "Stratégie" },
  { id: "roulette", label: "Roulette Électrique", icon: IconRoulette, blurb: "Zone chanceuse, bonus spin et Dark Roulette fictifs.", tag: "Classique" },
  { id: "chickenroad", label: "Chicken Road", icon: IconChicken, blurb: "Avance case après case, encaisse avant la sortie de route.", tag: "Nouveau" },
  { id: "plinko", label: "Plinko", icon: IconPlinko, blurb: "Lâche la bille, vise les multiplicateurs jusqu'à x1000.", tag: "Nouveau" },
  { id: "crash", label: "Crash", icon: IconRocket, blurb: "Encaisse avant l'explosion — plus tu attends, plus ça paie.", tag: "Nouveau" },
  { id: "scratch", label: "Cartes à gratter", icon: IconTicket, blurb: "3 symboles identiques sur la grille et c'est gagné.", tag: "Nouveau" },
  { id: "braquage", label: "Braquage", icon: IconVaultDoor, blurb: "Choisis ton butin, évite les alarmes, extrais-toi à temps.", tag: "Nouveau" },
  { id: "boosters", label: "Boosters", icon: IconPack, blurb: "Ouvre des boosters ou des displays, révèle et vends tes cartes.", tag: "Collection" },
  { id: "cases", label: "Caisses", icon: IconCrate, blurb: "Ouvre une caisse, l'objet tiré s'échange contre des crédits.", tag: "Nouveau" },
  { id: "pmu", label: "Bar PMU", icon: IconTicketBet, blurb: "Courses de chevaux, Loto et Euromillions fictifs.", tag: "Nouveau" },
  { id: "bourse", label: "Bourse", icon: IconTrendUp, blurb: "Mise à la hausse ou à la baisse — débloqué à 100M de gains cumulés.", tag: "Secret" },
];

export const TABS: { id: AppTab; label: string; icon: ComponentType<SVGProps<SVGSVGElement>>; adminOnly?: boolean }[] = [
  { id: "home", label: "Accueil", icon: IconHome },
  { id: "games", label: "Jeux", icon: IconGamepad },
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
  pmu: "pmu",
};
