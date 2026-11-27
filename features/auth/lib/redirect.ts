const DEFAULT_SIGNED_IN_PATH = "/home"

const BASE = "https://vedora.invalid"

export function safeRedirectPath(next: string | null | undefined): string {
  if (!next?.startsWith("/")) return DEFAULT_SIGNED_IN_PATH
  try {
    const url = new URL(next, BASE)
    if (url.origin !== BASE) return DEFAULT_SIGNED_IN_PATH
    return `${url.pathname}${url.search}${url.hash}`
  } catch {
    return DEFAULT_SIGNED_IN_PATH
  }
}
