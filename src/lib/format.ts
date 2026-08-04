const nf = new Intl.NumberFormat("fr-FR");

export function formatCredits(n: number): string {
  return nf.format(Math.round(n));
}

export function cn(...parts: Array<string | false | null | undefined>): string {
  return parts.filter(Boolean).join(" ");
}
