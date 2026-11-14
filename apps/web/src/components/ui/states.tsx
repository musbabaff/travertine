import { AlertCircle, RotateCw } from "lucide-react";
import type { ReactNode } from "react";
import { Button } from "./button";

export function Skeleton({ className = "" }: { className?: string }) {
  return <div aria-hidden className={`animate-pulse rounded-sm bg-sunken [animation-duration:1.2s] ${className}`} />;
}

export function ErrorState({ title, body, retryLabel, onRetry }: { title: string; body: string; retryLabel: string; onRetry: () => void }) {
  return (
    <div role="alert" className="rounded-md border border-danger/40 bg-surface p-4">
      <div className="flex items-start gap-3">
        <AlertCircle aria-hidden className="mt-0.5 size-5 shrink-0 text-danger" strokeWidth={1.5} />
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-ink">{title}</p>
          <p className="mt-1 break-words text-sm text-ink-2">{body}</p>
          <Button size="sm" className="mt-3" onClick={onRetry}>
            <RotateCw aria-hidden className="size-4" strokeWidth={1.5} />
            {retryLabel}
          </Button>
        </div>
      </div>
    </div>
  );
}

export function EmptyState({ icon, title, body, children }: { icon?: ReactNode; title: string; body: string; children?: ReactNode }) {
  return (
    <div className="flex flex-col items-start gap-3 py-2">
      {icon}
      <div>
        <p className="text-h3 font-semibold text-ink">{title}</p>
        <p className="mt-1 text-sm text-ink-2">{body}</p>
      </div>
      {children}
    </div>
  );
}
