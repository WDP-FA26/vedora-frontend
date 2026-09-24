// Google sign-in runs through two Route Handlers on this origin:
//
//   /auth/google           asks vedora-api for Google's consent URL, adds a
//                          `state` nonce and sends the browser there.
//   /auth/google/callback  Google redirects back here (vedora-api's
//                          GOOGLE_CALLBACK_URL). After checking `state`, the
//                          `code` goes to vedora-api, which returns the token
//                          pair that gets written to the usual cookies.
//
// vedora-api's strategy doesn't use `state` itself, so the nonce stops login
// CSRF (someone else's `code` forced into this browser).

export const GOOGLE_STATE_COOKIE = "vedora_google_state"

/** How long the consent screen may stay open before the nonce expires. */
export const GOOGLE_STATE_MAX_AGE = 10 * 60

export type GoogleState = { state: string; next: string }

/** `?error=` values `/login` knows how to explain. */
export type GoogleError = "google_unavailable" | "google_cancelled" | "google_failed"
