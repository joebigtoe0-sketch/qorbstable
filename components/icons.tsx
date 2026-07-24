/** Tiny inline SVG icon set — the brand uses icons or plain text, never
 * emojis. All icons inherit currentColor and size via className. */

type IconProps = { className?: string };

export function TaxIcon({ className = "h-4 w-4" }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" aria-hidden>
      <path d="M12.5 3.5 3.5 12.5" />
      <circle cx="4.75" cy="4.75" r="1.75" />
      <circle cx="11.25" cy="11.25" r="1.75" />
    </svg>
  );
}

export function CrownIcon({ className = "h-4 w-4" }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 16 16" fill="currentColor" aria-hidden>
      <path d="M2 5.2 4.8 7.4 8 3.6l3.2 3.8L14 5.2l-1 6.3H3z" />
      <rect x="3" y="12.4" width="10" height="1.4" rx="0.7" />
    </svg>
  );
}

export function ArrowRightIcon({ className = "h-4 w-4" }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M2.5 8h11M9.5 4l4 4-4 4" />
    </svg>
  );
}

export function GridIcon({ className = "h-4 w-4" }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden>
      <rect x="2.5" y="2.5" width="4.5" height="4.5" rx="1" />
      <rect x="9" y="2.5" width="4.5" height="4.5" rx="1" />
      <rect x="2.5" y="9" width="4.5" height="4.5" rx="1" />
      <rect x="9" y="9" width="4.5" height="4.5" rx="1" />
    </svg>
  );
}

export function RowsIcon({ className = "h-4 w-4" }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" aria-hidden>
      <path d="M2.5 4h11M2.5 8h11M2.5 12h11" />
    </svg>
  );
}

export function SealCheckIcon({ className = "h-4 w-4" }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M8 1.8l1.7 1.2 2-.2.7 1.9 1.8 1-.4 2 .9 1.8-1.5 1.4v2l-2 .5-1.2 1.6L8 14.2 6 15l-1.2-1.6-2-.5v-2L1.3 9.5l.9-1.8-.4-2 1.8-1 .7-1.9 2 .2z" />
      <path d="M5.6 8.2l1.7 1.7 3.1-3.4" />
    </svg>
  );
}

export function LockIcon({ className = "h-4 w-4" }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" aria-hidden>
      <rect x="3.5" y="7" width="9" height="6.5" rx="1.5" />
      <path d="M5.5 7V5.5a2.5 2.5 0 0 1 5 0V7" />
      <circle cx="8" cy="10.2" r="0.9" fill="currentColor" stroke="none" />
    </svg>
  );
}

export function WalletIcon({ className = "h-4 w-4" }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" aria-hidden>
      <rect x="2" y="4" width="12" height="9" rx="1.5" />
      <path d="M2 6.5h12" opacity="0" />
      <path d="M10 8.5h4v3h-4a1.5 1.5 0 0 1 0-3z" fill="currentColor" stroke="none" opacity="0.9" />
      <path d="M4 4V3.2A1.2 1.2 0 0 1 5.2 2h6" opacity="0.6" />
    </svg>
  );
}

export function XIcon({ className = "h-4 w-4" }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 16 16" fill="currentColor" aria-hidden>
      <path d="M9.5 6.9 14.6 1h-1.2L8.9 6.1 5.4 1H1.3l5.3 7.8L1.3 15h1.2l4.7-5.4 3.7 5.4h4.1zM7.8 8.9l-.5-.8L3 2h1.8l3.5 5 .5.8 4.5 6.5h-1.8z" />
    </svg>
  );
}

export function SparkIcon({ className = "h-4 w-4" }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 16 16" fill="currentColor" aria-hidden>
      <path d="M8 1.5 9.6 6l4.5 1.6-4.5 1.6L8 13.7 6.4 9.2 1.9 7.6 6.4 6z" />
    </svg>
  );
}

export function CoinIcon({ className = "h-4 w-4" }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden>
      <circle cx="8" cy="8" r="6" />
      <path d="M8 4.8v6.4M10.2 6.4c0-.9-1-1.6-2.2-1.6S5.8 5.5 5.8 6.4 6.8 8 8 8s2.2.7 2.2 1.6-1 1.6-2.2 1.6-2.2-.7-2.2-1.6" strokeLinecap="round" />
    </svg>
  );
}

export function PlusIcon({ className = "h-4 w-4" }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden>
      <path d="M8 3v10M3 8h10" />
    </svg>
  );
}

export function SproutIcon({ className = "h-4 w-4" }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" aria-hidden>
      <path d="M8 14V7.5" />
      <path d="M8 7.5C8 4.7 6 3 3 3c0 2.8 2 4.5 5 4.5z" />
      <path d="M8 9.5c0-2.2 1.6-3.5 4-3.5 0 2.2-1.6 3.5-4 3.5z" />
    </svg>
  );
}
