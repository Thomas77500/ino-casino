import type { SVGProps } from "react";

const base = { fill: "none", stroke: "currentColor", strokeWidth: 1.7, strokeLinecap: "round", strokeLinejoin: "round" } as const;

export const IconHome = (p: SVGProps<SVGSVGElement>) => (
  <svg viewBox="0 0 24 24" {...base} {...p}><path d="M3 11.5 12 4l9 7.5" /><path d="M5 10v9a1 1 0 0 0 1 1h4v-6h4v6h4a1 1 0 0 0 1-1v-9" /></svg>
);
export const IconSlots = (p: SVGProps<SVGSVGElement>) => (
  <svg viewBox="0 0 24 24" {...base} {...p}><rect x="3" y="5" width="18" height="14" rx="2.5" /><path d="M8 5v14M16 5v14" /><circle cx="8" cy="12" r="1.4" /><circle cx="16" cy="12" r="1.4" /></svg>
);
export const IconCards = (p: SVGProps<SVGSVGElement>) => (
  <svg viewBox="0 0 24 24" {...base} {...p}><rect x="4" y="6" width="11" height="15" rx="2" transform="rotate(-8 9 13)" /><rect x="9" y="4" width="11" height="15" rx="2" /></svg>
);
export const IconRoulette = (p: SVGProps<SVGSVGElement>) => (
  <svg viewBox="0 0 24 24" {...base} {...p}><circle cx="12" cy="12" r="9" /><circle cx="12" cy="12" r="3.2" /><path d="M12 3v3M12 18v3M3 12h3M18 12h3" /></svg>
);
export const IconGift = (p: SVGProps<SVGSVGElement>) => (
  <svg viewBox="0 0 24 24" {...base} {...p}><rect x="3" y="9" width="18" height="12" rx="1.5" /><path d="M3 13h18M12 9v12" /><path d="M12 9c-2-4-7-3-7-.5S8 9 12 9Zm0 0c2-4 7-3 7-.5S16 9 12 9Z" /></svg>
);
export const IconTrophy = (p: SVGProps<SVGSVGElement>) => (
  <svg viewBox="0 0 24 24" {...base} {...p}><path d="M7 4h10v5a5 5 0 0 1-10 0Z" /><path d="M7 5H4v2a3 3 0 0 0 3 3M17 5h3v2a3 3 0 0 1-3 3" /><path d="M12 14v3M9 21h6M8.5 21c0-2 1-2.5 3.5-2.5S15.5 19 15.5 21" /></svg>
);
export const IconStar = (p: SVGProps<SVGSVGElement>) => (
  <svg viewBox="0 0 24 24" {...base} {...p}><path d="m12 3 2.6 5.9 6.4.6-4.8 4.3 1.4 6.3L12 17l-5.6 3.1 1.4-6.3-4.8-4.3 6.4-.6Z" /></svg>
);
export const IconUser = (p: SVGProps<SVGSVGElement>) => (
  <svg viewBox="0 0 24 24" {...base} {...p}><circle cx="12" cy="8" r="3.5" /><path d="M4.5 20c1.4-4 4-6 7.5-6s6.1 2 7.5 6" /></svg>
);
export const IconCoin = (p: SVGProps<SVGSVGElement>) => (
  <svg viewBox="0 0 24 24" {...base} {...p}><circle cx="12" cy="12" r="9" /><path d="M9 9.5c0-1 1-1.8 3-1.8s3 .8 3 1.8-1 1.3-3 1.8-3 .8-3 1.8 1 1.8 3 1.8 3-.8 3-1.8" /></svg>
);
export const IconBolt = (p: SVGProps<SVGSVGElement>) => (
  <svg viewBox="0 0 24 24" {...base} {...p}><path d="M13 3 4 14h6l-1 7 9-11h-6Z" /></svg>
);
export const IconVault = (p: SVGProps<SVGSVGElement>) => (
  <svg viewBox="0 0 24 24" {...base} {...p}><rect x="3" y="4" width="18" height="16" rx="2" /><circle cx="12" cy="12" r="3.2" /><path d="M12 12v.01" /><path d="M7 4v3M17 4v3" /></svg>
);
export const IconClose = (p: SVGProps<SVGSVGElement>) => (
  <svg viewBox="0 0 24 24" {...base} {...p}><path d="M6 6l12 12M18 6 6 18" /></svg>
);
export const IconChicken = (p: SVGProps<SVGSVGElement>) => (
  <svg viewBox="0 0 24 24" {...base} {...p}><path d="M8 10a4 4 0 1 1 8 0c0 2-1 3-1 5v2a2 2 0 0 1-2 2h-2a2 2 0 0 1-2-2v-2c0-2-1-3-1-5Z" /><path d="M15 8l3-1-1 3" /><circle cx="10" cy="9" r="0.6" fill="currentColor" /><path d="M9 19v2M13 19v2" /></svg>
);
export const IconPlinko = (p: SVGProps<SVGSVGElement>) => (
  <svg viewBox="0 0 24 24" {...base} {...p}><circle cx="7" cy="6" r="1" fill="currentColor" /><circle cx="12" cy="6" r="1" fill="currentColor" /><circle cx="17" cy="6" r="1" fill="currentColor" /><circle cx="9.5" cy="11" r="1" fill="currentColor" /><circle cx="14.5" cy="11" r="1" fill="currentColor" /><circle cx="12" cy="16" r="1" fill="currentColor" /><path d="M4 21h16" /><path d="M12 16v-8" strokeDasharray="1 2" /></svg>
);
export const IconRocket = (p: SVGProps<SVGSVGElement>) => (
  <svg viewBox="0 0 24 24" {...base} {...p}><path d="M12 2c3 2 5 6 5 10 0 2-1 4-2 5l-3 3-3-3c-1-1-2-3-2-5 0-4 2-8 5-10Z" /><circle cx="12" cy="10" r="1.6" /><path d="M9 16l-3 1 1-3M15 16l3 1-1-3" /></svg>
);
export const IconTicket = (p: SVGProps<SVGSVGElement>) => (
  <svg viewBox="0 0 24 24" {...base} {...p}><path d="M3 8a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v2a2 2 0 0 0 0 4v2a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-2a2 2 0 0 0 0-4V8Z" /><path d="M10 6v12" strokeDasharray="1.5 2" /></svg>
);
export const IconUsers = (p: SVGProps<SVGSVGElement>) => (
  <svg viewBox="0 0 24 24" {...base} {...p}><circle cx="9" cy="8" r="3" /><path d="M3 20c1-3.2 3-5 6-5s5 1.8 6 5" /><circle cx="17" cy="9" r="2.4" /><path d="M15.5 12.2c2.3.4 3.6 1.9 4.4 4.3" /></svg>
);
export const IconDoor = (p: SVGProps<SVGSVGElement>) => (
  <svg viewBox="0 0 24 24" {...base} {...p}><rect x="6" y="3" width="12" height="18" rx="1" /><circle cx="14.5" cy="12" r="0.8" fill="currentColor" /><path d="M3 21h18" /></svg>
);
export const IconShield = (p: SVGProps<SVGSVGElement>) => (
  <svg viewBox="0 0 24 24" {...base} {...p}><path d="M12 3l7 3v6c0 4.5-3 7.5-7 9-4-1.5-7-4.5-7-9V6l7-3Z" /><path d="m9 12 2 2 4-4" /></svg>
);
export const IconTrendUp = (p: SVGProps<SVGSVGElement>) => (
  <svg viewBox="0 0 24 24" {...base} {...p}><path d="M3 17l6-6 4 4 8-8" /><path d="M15 7h6v6" /></svg>
);
export const IconVaultDoor = (p: SVGProps<SVGSVGElement>) => (
  <svg viewBox="0 0 24 24" {...base} {...p}><circle cx="12" cy="12" r="9" /><circle cx="12" cy="12" r="4" /><path d="M12 8v1M12 15v1M8 12h1M15 12h1" /></svg>
);
export const IconLock = (p: SVGProps<SVGSVGElement>) => (
  <svg viewBox="0 0 24 24" {...base} {...p}><rect x="5" y="11" width="14" height="9" rx="1.5" /><path d="M8 11V7a4 4 0 0 1 8 0v4" /></svg>
);
export const IconBag = (p: SVGProps<SVGSVGElement>) => (
  <svg viewBox="0 0 24 24" {...base} {...p}><path d="M6 8h12l1 12.5a1.5 1.5 0 0 1-1.5 1.5H6.5A1.5 1.5 0 0 1 5 20.5L6 8Z" /><path d="M9 8V6a3 3 0 0 1 6 0v2" /></svg>
);
export const IconEye = (p: SVGProps<SVGSVGElement>) => (
  <svg viewBox="0 0 24 24" {...base} {...p}><path d="M2 12s3.8-7 10-7 10 7 10 7-3.8 7-10 7-10-7-10-7Z" /><circle cx="12" cy="12" r="3" /></svg>
);
export const IconEyeOff = (p: SVGProps<SVGSVGElement>) => (
  <svg viewBox="0 0 24 24" {...base} {...p}><path d="M3 3l18 18" /><path d="M10.6 5.2A10.6 10.6 0 0 1 12 5c6.2 0 10 7 10 7a17.6 17.6 0 0 1-3.4 4.2M6.6 6.6C3.7 8.4 2 12 2 12s3.8 7 10 7c1.4 0 2.7-.3 3.9-.8" /><path d="M9.5 9.9a3 3 0 0 0 4.2 4.2" /></svg>
);
export const IconPack = (p: SVGProps<SVGSVGElement>) => (
  <svg viewBox="0 0 24 24" {...base} {...p}><path d="M6 4h9l3 3.5V20a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1V5a1 1 0 0 1 1-1Z" /><path d="M15 4v3.5h3" /><path d="M9 12h6M9 15.5h4" /><circle cx="12" cy="9" r="1.1" fill="currentColor" /></svg>
);
export const IconMenu = (p: SVGProps<SVGSVGElement>) => (
  <svg viewBox="0 0 24 24" {...base} {...p}><path d="M4 6h16M4 12h16M4 18h16" /></svg>
);
export const IconCrate = (p: SVGProps<SVGSVGElement>) => (
  <svg viewBox="0 0 24 24" {...base} {...p}><path d="M3 8l9-4.5L21 8v8l-9 4.5L3 16Z" /><path d="M3 8l9 4.5L21 8M12 12.5V21" /></svg>
);
export const IconGamepad = (p: SVGProps<SVGSVGElement>) => (
  <svg viewBox="0 0 24 24" {...base} {...p}><rect x="2.5" y="7" width="19" height="11" rx="5.5" /><path d="M7 9.5v5M4.5 12h5" /><circle cx="15.5" cy="10.5" r="1" fill="currentColor" /><circle cx="18" cy="13" r="1" fill="currentColor" /></svg>
);
export const IconTicketBet = (p: SVGProps<SVGSVGElement>) => (
  <svg viewBox="0 0 24 24" {...base} {...p}><path d="M3 8a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v2a2 2 0 0 0 0 4v2a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-2a2 2 0 0 0 0-4Z" /><path d="M9 6v12" strokeDasharray="2 2" /></svg>
);
export const IconMinistry = (p: SVGProps<SVGSVGElement>) => (
  <svg viewBox="0 0 24 24" {...base} {...p}><path d="M3.5 9.5 12 4l8.5 5.5" /><rect x="4" y="10" width="16" height="8" rx="1" /><path d="M7 10v8M11 10v8M13 10v8M17 10v8" /><path d="M2.5 19.5h19" /></svg>
);
export const IconBell = (p: SVGProps<SVGSVGElement>) => (
  <svg viewBox="0 0 24 24" {...base} {...p}><path d="M6 10a6 6 0 1 1 12 0c0 4 1.5 5.5 2 6.5H4c.5-1 2-2.5 2-6.5Z" /><path d="M10 20a2 2 0 0 0 4 0" /></svg>
);
export const IconChartBar = (p: SVGProps<SVGSVGElement>) => (
  <svg viewBox="0 0 24 24" {...base} {...p}><path d="M4 20V10M11 20V4M18 20v-7" /><path d="M2.5 20h19" /></svg>
);
export const IconFootball = (p: SVGProps<SVGSVGElement>) => (
  <svg viewBox="0 0 24 24" {...base} {...p}><circle cx="12" cy="12" r="9" /><path d="M12 8.2 15 10l-1.2 3.5H10.2L9 10Z" /><path d="M12 3v5.2M9.7 20.3l.5-6.8M13.8 20.3l-.5-6.8M4.3 8.7l4.7 1.3M19.7 8.7 15 10" /></svg>
);
export const IconWasher = (p: SVGProps<SVGSVGElement>) => (
  <svg viewBox="0 0 24 24" {...base} {...p}><rect x="4" y="3" width="16" height="18" rx="2" /><circle cx="12" cy="13" r="5" /><circle cx="12" cy="13" r="1.6" /><circle cx="7" cy="6" r="0.6" fill="currentColor" /><circle cx="10" cy="6" r="0.6" fill="currentColor" /></svg>
);
export const IconMask = (p: SVGProps<SVGSVGElement>) => (
  <svg viewBox="0 0 24 24" {...base} {...p}><path d="M3 9c2-1.5 4.5-2 9-2s7 0.5 9 2c-1 5-3.5 9-9 11-5.5-2-8-6-9-11Z" /><circle cx="8.5" cy="11" r="1.6" /><circle cx="15.5" cy="11" r="1.6" /><path d="M10.3 11h3.4" /></svg>
);
export const IconDice = (p: SVGProps<SVGSVGElement>) => (
  <svg viewBox="0 0 24 24" {...base} {...p}><rect x="4" y="4" width="16" height="16" rx="3" /><circle cx="8.5" cy="8.5" r="1" fill="currentColor" /><circle cx="15.5" cy="8.5" r="1" fill="currentColor" /><circle cx="8.5" cy="15.5" r="1" fill="currentColor" /><circle cx="15.5" cy="15.5" r="1" fill="currentColor" /><circle cx="12" cy="12" r="1" fill="currentColor" /></svg>
);
export const IconCultEye = (p: SVGProps<SVGSVGElement>) => (
  <svg viewBox="0 0 24 24" {...base} {...p}><path d="M12 3 3 19h18Z" /><path d="M12 10.5c-2.2 0-3.8 1.6-4.6 3 .8 1.4 2.4 3 4.6 3s3.8-1.6 4.6-3c-.8-1.4-2.4-3-4.6-3Z" /><circle cx="12" cy="13.5" r="1.3" fill="currentColor" /></svg>
);
export const IconUnicorn = (p: SVGProps<SVGSVGElement>) => (
  <svg viewBox="0 0 24 24" {...base} {...p}><path d="M4 21c1-5 4-8 8-8s7 2 8 4" /><path d="M12 13V6l3-3 .5 3-2.5 2" /><circle cx="9.5" cy="14.5" r="0.6" fill="currentColor" /><path d="M4 21c0-2 1-3 2.5-3" /></svg>
);
export const IconTicketOdds = (p: SVGProps<SVGSVGElement>) => (
  <svg viewBox="0 0 24 24" {...base} {...p}><path d="M3 8a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v1.5a1.7 1.7 0 0 0 0 3V14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-1.5a1.7 1.7 0 0 0 0-3Z" /><path d="M9 6v10" strokeDasharray="1.8 1.8" /></svg>
);
export const IconFedora = (p: SVGProps<SVGSVGElement>) => (
  <svg viewBox="0 0 24 24" {...base} {...p}><ellipse cx="12" cy="15.5" rx="9" ry="2.2" /><path d="M6.5 15C6.5 10.5 8.5 6.5 12 6.5s5.5 4 5.5 8.5" /><path d="M8.5 6.7c0-1.5 1.5-2.7 3.5-2.7s3.5 1.2 3.5 2.7" /></svg>
);
export const IconUfo = (p: SVGProps<SVGSVGElement>) => (
  <svg viewBox="0 0 24 24" {...base} {...p}><ellipse cx="12" cy="11" rx="10" ry="3.2" /><path d="M8 11c0-2.8 1.8-5 4-5s4 2.2 4 5" /><path d="M4.5 12.5 3 17M19.5 12.5 21 17M9 12.8v3M15 12.8v3" /></svg>
);
