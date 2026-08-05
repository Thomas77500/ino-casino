import { useId } from "react";
import { cn } from "../../lib/format";

// Faceted gem mark — casino/high-value motif, reads clearly from favicon size up to the
// loading-screen hero size. Gradient ids are per-instance (useId) so multiple logos on the same
// page (header + mobile drawer) never collide.
export function Logo({ className }: { className?: string }) {
  const id = useId();
  const gradId = `logo-bg-${id}`;
  return (
    <svg viewBox="0 0 64 64" className={cn("shrink-0", className)} role="img" aria-label="Ino Casino">
      <defs>
        <linearGradient id={gradId} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#5fb8ff" />
          <stop offset="100%" stopColor="#1467e8" />
        </linearGradient>
      </defs>
      <rect width="64" height="64" rx="16" fill={`url(#${gradId})`} />
      <path d="M32 11 L47 25 L32 53 L17 25 Z" fill="#ffffff" />
      <path d="M17 25 L47 25 L32 53 Z" fill="#cfe4ff" />
      <path d="M32 11 L47 25 L38 25 Z" fill="#ffffff" />
      <path d="M32 11 L17 25 L26 25 Z" fill="#eef5ff" />
      <path d="M17 25 L26 25 L32 34 Z" fill="#ffd77a" />
      <path d="M47 25 L38 25 L32 34 Z" fill="#f6bf4b" />
      <path d="M26 25 L38 25 L32 34 Z" fill="#ffe6a8" />
    </svg>
  );
}
