import { useEffect, useState } from "react";
import { useFriendsStore } from "../store/friendsStore";
import { usePresenceStore } from "../store/presenceStore";
import { useToastStore } from "../store/toastStore";
import { useGiftsStore } from "../store/giftsStore";
import { useCasinoStore } from "../store/casinoStore";
import { useAuthStore } from "../store/authStore";
import { useDebtsStore } from "../store/debtsStore";
import { Card } from "../components/ui/Card";
import { Button } from "../components/ui/Button";
import { Badge } from "../components/ui/Badge";
import { PublicProfileModal } from "../components/ui/PublicProfileModal";
import { IconUsers } from "../components/icons";
import { cn, formatCredits } from "../lib/format";

export function Friends() {
  const { friends, incoming, outgoing, loading, fetchAll, sendRequest, accept, decline, remove } = useFriendsStore();
  const onlineIds = usePresenceStore((s) => s.onlineIds);
  const push = useToastStore((s) => s.push);
  const sendGift = useGiftsStore((s) => s.sendGift);
  const credits = useCasinoStore((s) => s.credits);
  const account = useAuthStore((s) => s.account);
  const debts = useDebtsStore((s) => s.debts);
  const fetchDebts = useDebtsStore((s) => s.fetchAll);
  const settleDebt = useDebtsStore((s) => s.settle);
  const [search, setSearch] = useState("");
  const [sending, setSending] = useState(false);
  const [giftTargetId, setGiftTargetId] = useState<string | null>(null);
  const [giftAmount, setGiftAmount] = useState("");
  const [giftSending, setGiftSending] = useState(false);
  const [viewingId, setViewingId] = useState<string | null>(null);

  async function handleGift(toUserId: string) {
    const amount = Number(giftAmount);
    if (!amount || amount <= 0) return;
    setGiftSending(true);
    const result = await sendGift(toUserId, amount);
    setGiftSending(false);
    push({ kind: result.ok ? "success" : "info", title: result.message });
    if (result.ok) {
      setGiftTargetId(null);
      setGiftAmount("");
    }
  }

  useEffect(() => {
    fetchAll();
    if (account) fetchDebts(account.id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [account?.id]);

  const openDebts = debts.filter((d) => !d.settled);

  async function handleSend(e: React.FormEvent) {
    e.preventDefault();
    if (!search.trim() || sending) return;
    setSending(true);
    const result = await sendRequest(search.trim());
    setSending(false);
    push({ kind: result.ok ? "success" : "info", title: result.message });
    if (result.ok) setSearch("");
  }

  return (
    <div className="mx-auto max-w-2xl px-4 py-8 sm:px-6">
      <div className="mb-6 flex items-center gap-2">
        <IconUsers className="h-6 w-6 text-electric-400" />
        <div>
          <h1 className="font-display text-2xl font-bold text-white sm:text-3xl">Amis</h1>
          <p className="text-sm text-ice-200/60">Retrouve tes amis, envoie des demandes, joue ensemble.</p>
        </div>
      </div>

      <Card className="p-6" glow>
        <form onSubmit={handleSend} className="flex gap-2">
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Pseudo exact d'un joueur"
            className="input"
          />
          <Button type="submit" disabled={sending || !search.trim()}>Ajouter</Button>
        </form>
      </Card>

      {openDebts.length > 0 && (
        <Card className="mt-6 p-6">
          <h2 className="mb-4 font-display text-lg font-semibold text-white">Ardoises (Table Clandestine)</h2>
          <ul className="flex flex-col gap-2">
            {openDebts.map((d) => (
              <li key={d.id} className="flex items-center justify-between rounded-xl border border-white/10 bg-white/[0.03] p-3 text-sm">
                {d.lenderId === account?.id ? (
                  <span className="text-ice-200/70"><span className="font-medium text-white">{d.borrowerUsername}</span> te doit {formatCredits(d.amount)}</span>
                ) : (
                  <span className="text-ice-200/70">Tu dois {formatCredits(d.amount)} à <span className="font-medium text-white">{d.lenderUsername}</span></span>
                )}
                <Button size="sm" variant="ghost" onClick={() => settleDebt(d.id)}>Marquer réglée</Button>
              </li>
            ))}
          </ul>
        </Card>
      )}

      {incoming.length > 0 && (
        <Card className="mt-6 p-6">
          <h2 className="mb-4 font-display text-lg font-semibold text-white">Demandes reçues</h2>
          <ul className="flex flex-col gap-3">
            {incoming.map((req) => (
              <li key={req.friendshipId} className="flex items-center justify-between rounded-xl border border-white/10 bg-white/[0.03] p-3">
                <div className="flex items-center gap-2">
                  <span className="text-xl">{req.from.avatar}</span>
                  <span className="text-sm font-medium text-white">{req.from.username}</span>
                </div>
                <div className="flex gap-2">
                  <Button size="sm" variant="gold" onClick={() => accept(req.friendshipId)}>Accepter</Button>
                  <Button size="sm" variant="secondary" onClick={() => decline(req.friendshipId)}>Refuser</Button>
                </div>
              </li>
            ))}
          </ul>
        </Card>
      )}

      {outgoing.length > 0 && (
        <Card className="mt-6 p-6">
          <h2 className="mb-4 font-display text-lg font-semibold text-white">Demandes envoyées</h2>
          <ul className="flex flex-col gap-3">
            {outgoing.map((req) => (
              <li key={req.friendshipId} className="flex items-center justify-between rounded-xl border border-white/10 bg-white/[0.03] p-3">
                <div className="flex items-center gap-2">
                  <span className="text-xl">{req.avatar}</span>
                  <span className="text-sm font-medium text-white">{req.username}</span>
                </div>
                <Badge tone="neutral">En attente</Badge>
              </li>
            ))}
          </ul>
        </Card>
      )}

      <Card className="mt-6 p-6">
        <h2 className="mb-4 font-display text-lg font-semibold text-white">Mes amis ({friends.length})</h2>
        {loading && friends.length === 0 ? (
          <p className="text-xs text-ice-200/50">Chargement...</p>
        ) : friends.length === 0 ? (
          <p className="text-xs text-ice-200/50">Aucun ami pour l'instant — cherche un pseudo ci-dessus.</p>
        ) : (
          <ul className="flex flex-col gap-3">
            {friends.map((friend) => {
              const online = onlineIds.has(friend.id);
              const isGifting = giftTargetId === friend.id;
              return (
                <li key={friend.friendshipId} className="rounded-xl border border-white/10 bg-white/[0.03] p-3">
                  <div className="flex items-center justify-between">
                    <button onClick={() => setViewingId(friend.id)} className="flex items-center gap-2 text-left">
                      <span className="relative text-xl">
                        {friend.avatar}
                        <span className={cn("absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full border border-ink-950", online ? "bg-emerald-400" : "bg-ice-200/20")} />
                      </span>
                      <span className="text-sm font-medium text-white hover:underline">{friend.username}</span>
                      {online && <Badge tone="success">En ligne</Badge>}
                    </button>
                    <div className="flex gap-2">
                      <Button size="sm" variant="gold" onClick={() => setGiftTargetId(isGifting ? null : friend.id)}>
                        🎁 Don
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => remove(friend.friendshipId)} className="text-ice-200/40">
                        Retirer
                      </Button>
                    </div>
                  </div>
                  {isGifting && (
                    <div className="mt-3 flex items-center gap-2 border-t border-white/10 pt-3">
                      <input
                        type="number"
                        min={1}
                        max={credits}
                        placeholder="Montant"
                        value={giftAmount}
                        onChange={(e) => setGiftAmount(e.target.value)}
                        className="input w-32"
                      />
                      <Button size="sm" disabled={giftSending || !giftAmount} onClick={() => handleGift(friend.id)}>
                        Envoyer
                      </Button>
                      <span className="text-[11px] text-ice-200/40">Solde : {formatCredits(credits)}</span>
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </Card>

      <PublicProfileModal userId={viewingId} onClose={() => setViewingId(null)} />
    </div>
  );
}
