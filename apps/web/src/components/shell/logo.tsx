/** Travertine mark: three stepped terrace pools. Original artwork. */
export function LogoMark({ className = "size-6" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden className={className}>
      <rect x="2" y="4" width="20" height="4" rx="2" fill="var(--color-teal-100)" stroke="var(--color-teal-700)" strokeWidth="1.5" />
      <rect x="5" y="10" width="14" height="4" rx="2" fill="var(--color-teal-100)" stroke="var(--color-teal-700)" strokeWidth="1.5" />
      <rect x="8" y="16" width="8" height="4" rx="2" fill="var(--color-teal-700)" />
    </svg>
  );
}
