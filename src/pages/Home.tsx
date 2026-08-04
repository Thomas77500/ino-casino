import { motion } from "framer-motion";
import { useCasinoStore } from "../store/casinoStore";
import { useJackpotStore } from "../store/jackpotStore";
import { Card } from "../components/ui/Card";
import { Button } from "../components/ui/Button";
import { Badge } from "../components/ui/Badge";
import { ProgressBar } from "../components/ui/ProgressBar";
import { AnimatedNumber } from "../components/ui/AnimatedNumber";
import { LiveWinsFeed } from "../components/home/LiveWinsFeed";
import { IconSlots, IconCards, IconRoulette, IconGift, IconChicken, IconPlinko, IconRocket, IconTicket, IconTrendUp, IconVaultDoor, IconPack } from "../components/icons";
import { formatCredits } from "../lib/format";
import { displayLevel } from "../lib/levelTitles";
import type { AppTab } from "../lib/navigation";

const GAMES = [
  { tab: "slots" as AppTab, title: "Machines à sous", desc: "4 machines à thème, de la faible à l'extrême volatilité.", icon: IconSlots, tag: "Populaire" },
  { tab: "blackjack" as AppTab, title: "Blackjack Royal", desc: "Affronte le croupier, mise Paire Parfaite en option.", icon: IconCards, tag: "Stratégie" },
  { tab: "roulette" as AppTab, title: "Roulette Électrique", desc: "Zone chanceuse, bonus spin et Dark Roulette fictifs.", icon: IconRoulette, tag: "Classique" },
  { tab: "chickenroad" as AppTab, title: "Chicken Road", desc: "Avance case après case, encaisse avant la sortie de route.", icon: IconChicken, tag: "Nouveau" },
  { tab: "plinko" as AppTab, title: "Plinko", desc: "Lâche la bille, vise les multiplicateurs jusqu'à x1000.", icon: IconPlinko, tag: "Nouveau" },
  { tab: "crash" as AppTab, title: "Crash", desc: "Encaisse avant l'explosion — plus tu attends, plus ça paie.", icon: IconRocket, tag: "Nouveau" },
  { tab: "scratch" as AppTab, title: "Cartes à Gratter", desc: "3 symboles identiques sur la grille et c'est gagné.", icon: IconTicket, tag: "Nouveau" },
  { tab: "braquage" as AppTab, title: "Braquage", desc: "Choisis ton butin, évite les alarmes, extrais-toi à temps.", icon: IconVaultDoor, tag: "Nouveau" },
  { tab: "boosters" as AppTab, title: "Boosters", desc: "Ouvre des boosters ou des displays, révèle et vends tes cartes.", icon: IconPack, tag: "Nouveau" },
  { tab: "bourse" as AppTab, title: "Bourse", desc: "Mise à la hausse ou à la baisse — débloqué à 100M de gains cumulés.", icon: IconTrendUp, tag: "Secret" },
  { tab: "bonus" as AppTab, title: "Bonus & Coffres", desc: "Roue bonus, coffre surprise et bonus quotidien.", icon: IconGift, tag: "Gratuit" },
];

export function Home({ onNavigate }: { onNavigate: (t: AppTab) => void }) {
  const credits = useCasinoStore((s) => s.credits);
  const level = useCasinoStore((s) => s.level);
  const missions = useCasinoStore((s) => s.missions);
  const jackpot = useJackpotStore((s) => s.pot);

  const previewMissions = missions.filter((m) => !m.claimed).slice(0, 2);

  return (
    <div>
      <section className="relative overflow-hidden border-b border-white/5">
        <div className="pointer-events-none absolute inset-0">
          <div className="absolute -top-40 left-1/2 h-[500px] w-[900px] -translate-x-1/2 rounded-full bg-electric-500/20 blur-3xl animate-pulse-glow" />
          <div className="absolute top-20 right-10 h-64 w-64 rounded-full bg-gold-500/10 blur-3xl animate-float" />
        </div>

        <div className="relative mx-auto max-w-6xl px-4 py-16 text-center sm:px-6 sm:py-24">
          <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6 }}>
            <Badge tone="gold" className="mb-5">100% crédits virtuels — aucun argent réel</Badge>
            <h1 className="font-display text-4xl font-bold tracking-tight text-white sm:text-6xl">
              Bienvenue sur <span className="bg-gradient-to-r from-electric-400 to-ice-100 bg-clip-text text-transparent">Ino Casino</span>
            </h1>
            <p className="mx-auto mt-4 max-w-xl text-sm text-ice-200/70 sm:text-lg">
              L'expérience casino social la plus immersive, jouée uniquement avec des crédits virtuels gagnés en jouant.
            </p>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.15 }}
            className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row"
          >
            <Button size="lg" onClick={() => onNavigate("slots")}>Jouer maintenant</Button>
            <Button size="lg" variant="secondary" onClick={() => onNavigate("bonus")}>Découvrir les bonus</Button>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.6, delay: 0.3 }}
            className="mx-auto mt-12 flex max-w-md items-center justify-center gap-8 rounded-2xl border border-white/10 bg-white/[0.03] p-5 backdrop-blur-xl"
          >
            <div>
              <p className="text-[11px] uppercase tracking-wide text-ice-200/50">Tes crédits</p>
              <AnimatedNumber value={credits} className="font-display text-2xl font-bold text-gold-400" />
            </div>
            <div className="h-10 w-px bg-white/10" />
            <div>
              <p className="text-[11px] uppercase tracking-wide text-ice-200/50">Niveau</p>
              <p className="font-display text-2xl font-bold text-white">{displayLevel(level)}</p>
            </div>
          </motion.div>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 py-12 sm:px-6">
        <div className="mb-6 flex items-center justify-between">
          <h2 className="font-display text-xl font-bold text-white sm:text-2xl">Jeux à la une</h2>
        </div>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {GAMES.map((g, i) => (
            <motion.div
              key={g.tab}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.4, delay: i * 0.08 }}
              whileHover={{ y: -6 }}
            >
              <Card className="group flex h-full cursor-pointer flex-col p-5 transition-shadow hover:shadow-glow" onClick={() => onNavigate(g.tab)}>
                <div className="mb-4 flex items-center justify-between">
                  <div className="grid h-11 w-11 place-items-center rounded-xl bg-gradient-to-br from-electric-500/20 to-electric-400/10 text-electric-400 group-hover:from-electric-500 group-hover:to-electric-400 group-hover:text-white transition-colors">
                    <g.icon className="h-5 w-5" />
                  </div>
                  <Badge tone="electric">{g.tag}</Badge>
                </div>
                <h3 className="font-display text-lg font-bold text-white">{g.title}</h3>
                <p className="mt-1 flex-1 text-sm text-ice-200/60">{g.desc}</p>
                <span className="mt-4 text-sm font-semibold text-electric-400 group-hover:text-electric-300">Jouer →</span>
              </Card>
            </motion.div>
          ))}
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 pb-12 sm:px-6">
        <div className="grid gap-6 lg:grid-cols-[1.3fr_1fr]">
          <Card className="relative overflow-hidden p-6 sm:p-8" glow>
            <div className="pointer-events-none absolute -right-10 -top-10 h-40 w-40 rounded-full bg-gold-500/20 blur-3xl animate-pulse-glow" />
            <p className="text-[11px] uppercase tracking-wide text-ice-200/50">Jackpot progressif partagé</p>
            <p className="mt-2 font-display text-4xl font-bold text-gold-400 sm:text-5xl">
              <AnimatedNumber value={jackpot} duration={400} />
            </p>
            <p className="mt-2 text-xs text-ice-200/40">Alimenté par les mises de tous les joueurs — décroché au hasard, remis à 1 000 à chaque tirage.</p>
          </Card>
          <LiveWinsFeed />
        </div>
      </section>

      {previewMissions.length > 0 && (
        <section className="mx-auto max-w-6xl px-4 pb-16 sm:px-6">
          <Card className="p-6">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="font-display text-lg font-bold text-white">Missions en cours</h2>
              <Button size="sm" variant="ghost" onClick={() => onNavigate("rewards")}>Voir tout →</Button>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              {previewMissions.map((m) => (
                <div key={m.id} className="rounded-xl border border-white/10 bg-white/[0.03] p-4">
                  <div className="mb-2 flex items-center justify-between text-sm">
                    <span className="font-medium text-white">{m.title}</span>
                    <span className="text-xs text-ice-200/50">{Math.min(m.progress, m.target)}/{m.target}</span>
                  </div>
                  <ProgressBar value={m.progress} max={m.target} />
                  <p className="mt-2 text-xs text-gold-400">Récompense : {formatCredits(m.reward)} crédits</p>
                </div>
              ))}
            </div>
          </Card>
        </section>
      )}
    </div>
  );
}
