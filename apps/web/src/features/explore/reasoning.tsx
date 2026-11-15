"use client";

import { useI18n, type MessageKey } from "@/i18n";
import type { Rotation } from "@/lib/api/types";

type Reasoning = NonNullable<Rotation["reasoning"]>;
const PARTS = ["why_suggested", "evidence", "benefits", "information_gaps", "local_review"] as const;

/**
 * The five labelled parts the challenge asks for on every strategy, exactly as the engine words them. A part the engine
 * leaves empty is shown as such, never filled in by the UI.
 */
export function ReasoningParts({ reasoning, open = false }: { reasoning: Reasoning; open?: boolean }) {
  const { t, n } = useI18n();
  return (
    <details className="mt-4 rounded-md border border-border bg-surface" data-testid="reasoning" open={open || undefined}>
      <summary className="cursor-pointer px-3 py-2 text-sm font-medium text-ink">{t("reasoning.title")}</summary>
      <dl className="space-y-3 border-t border-border px-3 py-3" data-engine-text>
        {PARTS.map((part) => {
          const items = reasoning[part] ?? [];
          return (
            <div key={part}>
              <dt className="text-xs font-semibold text-ink">{t(`reasoning.${part}` as MessageKey)}</dt>
              <dd className="mt-1 text-sm text-ink-2">
                {items.length === 0 ? (
                  <span className="text-ink-muted">{t("reasoning.empty")}</span>
                ) : (
                  <ul className="list-disc space-y-1 pl-5">
                    {part === "evidence"
                      ? (items as Reasoning["evidence"]).map((e, i) => (
                          <li key={i}>
                            {e.statement}{" "}
                            <span className="tabular-nums text-ink">
                              ({n(e.value, 2)} {e.unit})
                            </span>{" "}
                            <span className="text-xs text-ink-muted">· {e.dataset}</span>
                          </li>
                        ))
                      : (items as string[]).map((s, i) => <li key={i}>{s}</li>)}
                  </ul>
                )}
              </dd>
            </div>
          );
        })}
      </dl>
    </details>
  );
}
