import { PUBLIC_ENV } from "@/lib/env"

export const SITE_NAME = "Vedora"
export const SITE_URL = PUBLIC_ENV.siteUrl
/** Open Graph locale of every page: the site is in Vietnamese. */
export const SITE_LOCALE = "vi_VN"

/** `path` on this site as an absolute URL, for JSON-LD and the sitemap. */
export function absoluteUrl(path: string) {
  return new URL(path, SITE_URL).toString()
}
