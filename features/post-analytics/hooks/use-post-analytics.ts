"use client"

import { useAuthedSWR } from "@/features/auth/hooks/use-authed-swr"
import { sendJson } from "@/features/shared/lib/api-client"
import {
  analyticsPostsKey,
  summaryKey,
  type DateRange,
  type PostSort,
} from "../post-analytics-cache"
import { analyticsPostPageSchema, analyticsSummarySchema } from "../schemas"

function fetchSummary([url, token]: readonly [string, string]) {
  return sendJson(analyticsSummarySchema, url, token, { cache: "no-store" })
}

function fetchPostPage([url, token]: readonly [string, string]) {
  return sendJson(analyticsPostPageSchema, url, token, { cache: "no-store" })
}

export function useAnalyticsSummary(range: DateRange) {
  return useAuthedSWR(summaryKey(range), fetchSummary, { shouldRetryOnError: false })
}

export function useAnalyticsPosts(range: DateRange, sort: PostSort, page: number) {
  return useAuthedSWR(analyticsPostsKey(range, sort, page), fetchPostPage, {
    keepPreviousData: true,
    shouldRetryOnError: false,
  })
}
