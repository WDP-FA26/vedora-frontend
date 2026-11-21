/** `PublicUser` from vedora-api (`GET /auth/me`). Dates arrive as ISO strings. */
export type CurrentUser = {
  id: string
  username: string
  fullName: string
  email: string
  avatarUrl: string | null
  role: "USER" | "ADMIN"
  /** `PAGE` for a restaurant page; members act as it after switching. */
  accountType: "PERSONAL" | "PAGE"
  /** The person acting as this page; `null` in a personal session. */
  actor: SessionActor | null
  createdAt: string
  updatedAt: string
}

export type SessionActor = {
  id: string
  username: string
  fullName: string
  avatarUrl: string | null
}

/** Token pair returned by `POST /auth/login | /auth/register | /auth/refresh`. */
export type AuthTokens = {
  accessToken: string
  refreshToken: string
  /** Seconds. */
  accessTokenExpiresIn: number
  /** Seconds. */
  refreshTokenExpiresIn: number
}
