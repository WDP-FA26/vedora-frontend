export type CurrentUser = {
  id: string
  username: string
  fullName: string
  email: string
  avatarUrl: string | null
  role: "USER" | "ADMIN"
  accountType: "PERSONAL" | "PAGE"
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

export type AuthTokens = {
  accessToken: string
  refreshToken: string
  accessTokenExpiresIn: number
  refreshTokenExpiresIn: number
}
