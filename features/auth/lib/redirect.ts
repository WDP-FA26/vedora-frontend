export const DEFAULT_SIGNED_IN_PATH = "/home"

/** Only same-origin paths, so `?next=` can't be used as an open redirect. */
export function safeRedirectPath(next: string | null | undefined): string {
  if (!next || !next.startsWith("/") || next.startsWith("//") || next.includes("\\")) {
    return DEFAULT_SIGNED_IN_PATH
  }
  return next
}
