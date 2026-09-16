import { useState } from "react";
import { useAuthStore } from "../../store/authStore";
import { useNotificationStore } from "../../store/notificationStore";
import { Modal } from "../ui/Modal";
import { IconBell } from "../icons";
import { cn } from "../../lib/format";

function timeAgo(iso: string): string {
  const mins = Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
  if (mins < 1) return "à l'instant";
  if (mins < 60) return `il y a ${mins} min`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `il y a ${hours} h`;
  return `il y a ${Math.floor(hours / 24)} j`;
}

export function NotificationBell() {
  const account = useAuthStore((s) => s.account);
  const items = useNotificationStore((s) => s.items);
  const markAllRead = useNotificationStore((s) => s.markAllRead);
  const [open, setOpen] = useState(false);
  const unread = items.filter((n) => !n.read).length;

  function toggle() {
    setOpen((wasOpen) => {
      if (!wasOpen && account && unread > 0) markAllRead(account.id);
      return !wasOpen;
    });
  }

  return (
    <>
      <button
        onClick={toggle}
        className="relative grid h-9 w-9 shrink-0 place-items-center rounded-full border border-white/10 bg-white/[0.04] text-ice-200/70 hover:text-white"
        aria-label="Notifications"
      >
        <IconBell className="h-4 w-4" />
        {unread > 0 && (
          <span className="absolute -right-0.5 -top-0.5 grid h-4 min-w-[16px] place-items-center rounded-full bg-red-500 px-1 text-[9px] font-bold text-white">
            {unread > 9 ? "9+" : unread}
          </span>
        )}
      </button>

      <Modal open={open} onClose={() => setOpen(false)}>
        <h3 className="mb-4 font-display text-lg font-bold text-white">Notifications</h3>
        {items.length === 0 ? (
          <p className="py-6 text-center text-sm text-ice-200/40">Rien pour l'instant.</p>
        ) : (
          <ul className="flex max-h-96 flex-col gap-2 overflow-y-auto">
            {items.map((n) => (
              <li key={n.id} className={cn("rounded-xl border p-3", n.read ? "border-white/10 bg-white/[0.02]" : "border-electric-500/30 bg-electric-500/5")}>
                <p className="text-sm font-semibold text-white">{n.title}</p>
                {n.body && <p className="mt-0.5 text-xs text-ice-200/60">{n.body}</p>}
                <p className="mt-1 text-[10px] text-ice-200/30">{timeAgo(n.createdAt)}</p>
              </li>
            ))}
          </ul>
        )}
      </Modal>
    </>
  );
}
