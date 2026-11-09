"use client";

import { z } from "zod";
import { API_URL } from "@/features/auth/lib/api";
import { useAuthedSWR } from "@/features/auth/hooks/use-authed-swr";
import { sendJson } from "@/features/shared/lib/api-client";

export function useAdminPayments<S extends z.ZodType>(path: string, schema: S) {
  return useAuthedSWR(
    `${API_URL}/admin/payments${path}`,
    ([url, token]: readonly [string, string]) =>
      sendJson(schema, url, token, { cache: "no-store" }),
    { keepPreviousData: false, shouldRetryOnError: false },
  );
}
