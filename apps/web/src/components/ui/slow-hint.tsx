"use client";

import { useEffect, useState } from "react";
import { useI18n } from "@/i18n";

/**
 * Shown when a request has been loading for a while. The engine runs on an instance that sleeps when idle and needs
 * up to about a minute to wake; long rotation searches also take tens of seconds. Rendered inside loading states only.
 */
export function SlowHint({ after = 8000, className = "" }: { after?: number; className?: string }) {
  const { t } = useI18n();
  const [show, setShow] = useState(false);
  useEffect(() => {
    const id = setTimeout(() => setShow(true), after);
    return () => clearTimeout(id);
  }, [after]);
  if (!show) return null;
  return (
    <p role="status" className={`text-sm text-ink-2 ${className}`}>
      {t("state.slow")}
    </p>
  );
}
