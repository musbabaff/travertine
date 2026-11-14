"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useState, type ReactNode } from "react";
import { I18nProvider } from "@/i18n";
import { ApiRequestError } from "@/lib/api/client";

export function Providers({ children }: { children: ReactNode }) {
  const [client] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: { staleTime: 10 * 60_000, gcTime: 60 * 60_000, retry: (count, err) => count < 1 && !(err instanceof ApiRequestError && err.status !== undefined && err.status < 500), refetchOnWindowFocus: false },
        },
      }),
  );
  return (
    <QueryClientProvider client={client}>
      <I18nProvider>{children}</I18nProvider>
    </QueryClientProvider>
  );
}
