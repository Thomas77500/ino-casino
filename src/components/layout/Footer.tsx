export function Footer() {
  return (
    <footer className="border-t border-white/5 bg-ink-950 pb-20 pt-10 lg:pb-10">
      <div className="mx-auto max-w-7xl px-4 sm:px-6">
        <div className="rounded-2xl border border-electric-500/20 bg-electric-500/[0.06] p-4 text-center text-xs leading-relaxed text-ice-200/70 sm:text-sm">
          <strong className="text-white">Ino Casino est une plateforme de divertissement 100% fictive.</strong>{" "}
          Tous les jeux se jouent avec des crédits virtuels sans aucune valeur monétaire. Aucun dépôt, aucun retrait,
          aucune conversion en argent réel n'est possible. Les crédits s'obtiennent uniquement en jouant : bonus
          quotidien, missions, coffre et récompenses de progression.
        </div>
        <p className="mt-6 text-center text-xs text-ice-200/30">© {new Date().getFullYear()} Ino Casino — Jeu social sans argent réel.</p>
      </div>
    </footer>
  );
}
