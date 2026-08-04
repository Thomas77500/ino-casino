import { cn } from "../../lib/format";
import { frameRing } from "../../lib/cosmetics";

export function AvatarBubble({
  avatar,
  frame,
  size = "md",
  className,
}: {
  avatar: string;
  frame?: string | null;
  size?: "sm" | "md" | "lg";
  className?: string;
}) {
  const sizeClass = size === "sm" ? "h-8 w-8 text-base" : size === "lg" ? "h-20 w-20 text-4xl" : "h-10 w-10 text-lg";
  return (
    <div
      className={cn(
        "grid shrink-0 place-items-center rounded-full bg-gradient-to-br from-electric-400 to-electric-700",
        sizeClass,
        frameRing(frame),
        className
      )}
    >
      {avatar}
    </div>
  );
}
