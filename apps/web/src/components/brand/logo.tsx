import { LOCKUP, MARK_BOX, MARK_PATH, WORDMARK_PATH } from "./paths";

/**
 * Brand artwork traced from docs/brand/original/travertine-logo-original.png. Never recolour, stretch or restyle the
 * mark: it is always brand teal. Size it with a height class; the width follows the aspect ratio.
 * Rules: docs/brand/README.md.
 */
export function BrandMark({ className = "h-6", title }: { className?: string; title?: string }) {
  return (
    <svg viewBox={`0 0 ${MARK_BOX.w} ${MARK_BOX.h}`} className={`w-auto shrink-0 ${className}`} role={title ? "img" : undefined} aria-hidden={title ? undefined : true} aria-label={title}>
      <path fill="var(--color-brand-teal)" d={MARK_PATH} />
    </svg>
  );
}

/** Mark left, wordmark right. `tone="dark"` switches the wordmark to off-white for dark backgrounds. */
export function BrandLockup({ className = "h-7", tone = "light" }: { className?: string; tone?: "light" | "dark" }) {
  return (
    <svg viewBox={`0 0 ${LOCKUP.w} ${LOCKUP.h}`} className={`w-auto shrink-0 ${className}`} role="img" aria-label="Travertine">
      <path fill="var(--color-brand-teal)" d={MARK_PATH} />
      <path
        transform={`translate(${MARK_BOX.w + LOCKUP.gap} ${LOCKUP.wordY}) scale(${LOCKUP.wordScale})`}
        fill={tone === "dark" ? "var(--color-brand-paper)" : "var(--color-brand-navy)"}
        d={WORDMARK_PATH}
      />
    </svg>
  );
}
