import { API_URL } from "@/features/auth/lib/api"

export const ANALYTICS_KEY = `${API_URL}/analytics/posts`

export const ANALYTICS_PATH = "/home/analytics"

export const RANGE_PRESETS = [7, 30, 90] as const
export type RangePreset = (typeof RANGE_PRESETS)[number]
export const DEFAULT_RANGE_PRESET: RangePreset = 30

export const POST_SORTS = ["recent", "saves", "comments", "likes", "reposts", "views"] as const
export type PostSort = (typeof POST_SORTS)[number]

export function isPostSort(value: unknown): value is PostSort {
  return POST_SORTS.some((sort) => sort === value)
}

export type DateRange = { from: string; to: string }

export function summaryKey(range: DateRange) {
  const params = new URLSearchParams(range)
  return `${ANALYTICS_KEY}/summary?${params}`
}

export const POSTS_PAGE_SIZE = 10

export function analyticsPostsKey(range: DateRange, sort: PostSort, page: number) {
  const params = new URLSearchParams({
    ...range,
    sort,
    page: String(page),
    limit: String(POSTS_PAGE_SIZE),
  })
  return `${ANALYTICS_KEY}?${params}`
}
