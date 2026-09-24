// Google sign-in runs through one Route Handler on this origin, /auth/google:
//
//   no `code`    vedora-api returns Google's consent URL, a `state` nonce and
//                a PKCE verifier. Both secrets go into an httpOnly cookie and
//                the browser goes to Google.
//   `code`       Google redirected back here (vedora-api's GOOGLE_CALLBACK_URL
//                is this same URL). After checking `state`, the `code` and
//                verifier go to vedora-api, which returns the token pair that
//                gets written to the usual cookies.
//
// `state` stops login CSRF (someone else's `code` forced into this browser).
// PKCE makes a leaked `code` useless without the verifier, which never leaves
// the servers.

export const GOOGLE_STATE_COOKIE = "vedora_google_state"

/** How long the consent screen may stay open before the nonce expires. */
export const GOOGLE_STATE_MAX_AGE = 10 * 60

/** Response of vedora-api's `POST /auth/google/authorize`. */
export type GoogleAuthorization = { url: string; state: string; codeVerifier: string }

/** What the httpOnly state cookie holds while the user is on Google. */
export type GoogleState = { state: string; codeVerifier: string; next: string }

/** `?error=` values `/login` knows how to explain. */
export type GoogleError = "google_unavailable" | "google_cancelled" | "google_failed"
