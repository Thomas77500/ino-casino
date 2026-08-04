import { useCasinoStore } from "../store/casinoStore";
import { useAuthStore } from "../store/authStore";
import { useToastStore } from "../store/toastStore";
import { Card } from "../components/ui/Card";
import { Button } from "../components/ui/Button";
import { Badge } from "../components/ui/Badge";
import { AvatarBubble } from "../components/ui/AvatarBubble";
import { IconBag } from "../components/icons";
import { formatCredits } from "../lib/format";
import { FRAME_OPTIONS } from "../lib/cosmetics";

export function Shop() {
  const credits = useCasinoStore((s) => s.credits);
  const ownedFrames = useCasinoStore((s) => s.ownedFrames);
  const buyFrame = useCasinoStore((s) => s.buyFrame);
  const account = useAuthStore((s) => s.account);
  const updateProfile = useAuthStore((s) => s.updateProfile);
  const push = useToastStore((s) => s.push);

  function handleBuy(id: string, price: number) {
    const ok = buyFrame(id, price);
    push(ok ? { kind: "success", title: "Cadre acheté !" } : { kind: "info", title: "Crédits insuffisants" });
  }

  function handleEquip(id: string) {
    updateProfile({ frame: id });
    push({ kind: "success", title: "Cadre équipé" });
  }

  return (
    <div className="mx-auto max-w-4xl px-4 py-8 sm:px-6">
      <div className="mb-6 flex items-center gap-2">
        <IconBag className="h-6 w-6 text-gold-400" />
        <div>
          <h1 className="font-display text-2xl font-bold text-white sm:text-3xl">Boutique</h1>
          <p className="text-sm text-ice-200/60">Cadres d'avatar cosmétiques, achetés avec tes crédits virtuels — aucun avantage de jeu.</p>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {FRAME_OPTIONS.map((f) => {
          const owned = ownedFrames.includes(f.id);
          const equipped = account?.frame === f.id || (f.id === "none" && !account?.frame);
          return (
            <Card key={f.id} className="flex flex-col items-center gap-3 p-5 text-center">
              <AvatarBubble avatar={account?.avatar ?? "🎲"} frame={f.id} size="lg" />
              <h3 className="font-display text-sm font-bold text-white">{f.label}</h3>
              {owned ? (
                <Button size="sm" variant={equipped ? "gold" : "secondary"} onClick={() => handleEquip(f.id)} disabled={equipped}>
                  {equipped ? "Équipé" : "Équiper"}
                </Button>
              ) : (
                <Button size="sm" onClick={() => handleBuy(f.id, f.price)} disabled={credits < f.price}>
                  Acheter — {formatCredits(f.price)}
                </Button>
              )}
              {!owned && credits < f.price && <Badge tone="danger">Crédits insuffisants</Badge>}
            </Card>
          );
        })}
      </div>
    </div>
  );
}
