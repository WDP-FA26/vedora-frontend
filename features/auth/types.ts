/** `PublicUser` from vedora-api (`GET /auth/me`). Dates arrive as ISO strings. */
export type CurrentUser = {
  id: string
  username: string
  fullName: string
  email: string
  createdAt: string
  updatedAt: string
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
