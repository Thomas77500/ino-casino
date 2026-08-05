import { motion } from "framer-motion";
import { useGameStatusStore } from "../store/gameStatusStore";
import { Card } from "../components/ui/Card";
import { Badge } from "../components/ui/Badge";
import { IconGamepad } from "../components/icons";
import { GAMES, type AppTab } from "../lib/navigation";

export function Games({ onNavigate }: { onNavigate: (t: AppTab) => void }) {
  const statuses = useGameStatusStore((s) => s.statuses);

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
      <div className="mb-6 flex items-center gap-2">
        <IconGamepad className="h-6 w-6 text-electric-400" />
        <div>
          <h1 className="font-display text-2xl font-bold text-white sm:text-3xl">Jeux</h1>
          <p className="text-sm text-ice-200/60">Tous les jeux du casino, réunis au même endroit.</p>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {GAMES.map((g, i) => {
          const inMaintenance = statuses[g.id] && !statuses[g.id].enabled;
          return (
            <motion.div
              key={g.id}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.4, delay: i * 0.05 }}
              whileHover={{ y: -6 }}
            >
              <Card className="group flex h-full cursor-pointer flex-col p-5 transition-shadow hover:shadow-glow" onClick={() => onNavigate(g.id)}>
                <div className="mb-4 flex items-center justify-between">
                  <div className="grid h-11 w-11 place-items-center rounded-xl bg-gradient-to-br from-electric-500/20 to-electric-400/10 text-electric-400 transition-colors group-hover:from-electric-500 group-hover:to-electric-400 group-hover:text-white">
                    <g.icon className="h-5 w-5" />
                  </div>
                  {inMaintenance ? <Badge tone="danger">Maintenance</Badge> : <Badge tone="electric">{g.tag}</Badge>}
                </div>
                <h3 className="font-display text-lg font-bold text-white">{g.label}</h3>
                <p className="mt-1 flex-1 text-sm text-ice-200/60">{g.blurb}</p>
                <span className="mt-4 text-sm font-semibold text-electric-400 group-hover:text-electric-300">Jouer →</span>
              </Card>
            </motion.div>
          );
        })}
      </div>
    </div>
  );
}
