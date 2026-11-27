export const GOOGLE_STATE_COOKIE = "vedora_google_state"

export const GOOGLE_STATE_MAX_AGE = 10 * 60

export type GoogleAuthorization = { url: string; state: string; codeVerifier: string }

export type GoogleState = { state: string; codeVerifier: string; next: string }

export type GoogleError = "google_unavailable" | "google_cancelled" | "google_failed"
