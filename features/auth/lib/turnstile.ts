// The secret stays on vedora-api. Only this public site key reaches the browser.
// Production must configure a real site key; never silently use the test key.
export const LOGIN_TURNSTILE_SITE_KEY =
  process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY ||
  (process.env.NODE_ENV === "production" ? "" : "1x00000000000000000000AA")
