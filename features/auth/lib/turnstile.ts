import { PUBLIC_ENV } from "@/lib/env"

// The secret stays on vedora-api. Only this public site key reaches the browser.
// Production builds fail at startup when it is missing (lib/env.ts).
export const LOGIN_TURNSTILE_SITE_KEY = PUBLIC_ENV.turnstileSiteKey
