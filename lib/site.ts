import { PUBLIC_ENV } from "@/lib/env"

export const SITE_NAME = "Vedora"
export const SITE_URL = PUBLIC_ENV.siteUrl
export const SITE_LOCALE = "vi_VN"

export function absoluteUrl(path: string) {
  return new URL(path, SITE_URL).toString()
}
