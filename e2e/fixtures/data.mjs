// Fixture data shared by the mock API server (Node) and the specs.
// Shapes mirror the zod schemas in features/*/schemas.ts.

export const API_PORT = Number(process.env.E2E_API_PORT ?? 4010)
export const API_ORIGIN = `http://localhost:${API_PORT}`
export const API_URL = `${API_ORIGIN}/api/v1`

/** Password the mock API accepts for every seeded account. */
export const VALID_PASSWORD = "Password123"

const iso = (minutesAgo) => new Date(Date.now() - minutesAgo * 60_000).toISOString()

export const users = {
  member: {
    id: "u-member",
    username: "minhanh",
    fullName: "Nguyễn Minh Anh",
    email: "minhanh@example.com",
    avatarUrl: null,
    role: "USER",
    status: "ACTIVE",
    createdAt: "2025-01-10T08:00:00.000Z",
    updatedAt: "2025-01-10T08:00:00.000Z",
  },
  admin: {
    id: "u-admin",
    username: "quantri",
    fullName: "Trần Quản Trị",
    email: "admin@example.com",
    avatarUrl: null,
    role: "ADMIN",
    status: "ACTIVE",
    createdAt: "2024-12-01T08:00:00.000Z",
    updatedAt: "2024-12-01T08:00:00.000Z",
  },
  chef: {
    id: "u-chef",
    username: "bepchay",
    fullName: "Lê Bếp Chay",
    email: "chef@example.com",
    avatarUrl: null,
    role: "USER",
    status: "ACTIVE",
    createdAt: "2025-02-14T08:00:00.000Z",
    updatedAt: "2025-02-14T08:00:00.000Z",
  },
}

/** `PublicUser` as returned by `GET /auth/me`. */
// eslint-disable-next-line @typescript-eslint/no-unused-vars -- dropped from the response
export const publicUser = ({ status, ...user }) => user

const author = (user) => ({
  id: user.id,
  username: user.username,
  fullName: user.fullName,
  avatarUrl: user.avatarUrl,
})

function post(id, by, body, extra = {}) {
  return {
    id,
    type: "POST",
    status: "PUBLISHED",
    moderationVerdict: null,
    moderationReason: null,
    body,
    publishedAt: iso(90),
    createdAt: iso(90),
    author: author(by),
    media: [],
    commentCount: 2,
    likeCount: 7,
    isLiked: false,
    repostCount: 1,
    isReposted: false,
    isBookmarked: false,
    viewCount: 120,
    blog: null,
    ...extra,
  }
}

export const posts = [
  post("p-1", users.chef, "Phở chay nước dùng nấm hương và hồi, thơm cả bếp."),
  post("p-2", users.member, "Thử món đậu hũ sốt cà chua cho bữa tối nhẹ nhàng."),
  post("p-blog", users.chef, null, {
    type: "BLOG",
    commentCount: 0,
    blog: {
      title: "Cách ủ tương đậu nành tại nhà",
      coverImageUrl: null,
      excerpt: "Hướng dẫn từng bước ủ tương đậu nành sạch, không chất bảo quản.",
      recipes: [],
    },
  }),
]

export const blogs = {
  "p-blog": {
    id: "p-blog",
    status: "PUBLISHED",
    content: "## Nguyên liệu\n\nĐậu nành, muối, nước sạch.",
    updatedAt: iso(80),
    blog: posts[2].blog,
  },
}

export const comments = [
  {
    id: "c-1",
    postId: "p-1",
    body: "Công thức này nhìn ngon quá!",
    author: author(users.member),
    createdAt: iso(60),
    updatedAt: iso(60),
  },
]

export const profiles = Object.fromEntries(
  Object.values(users).map((user, index) => [
    user.id,
    {
      id: user.id,
      username: user.username,
      fullName: user.fullName,
      bio: user.id === "u-chef" ? "Đầu bếp chay, yêu thích món Việt." : null,
      avatarUrl: null,
      coverUrl: null,
      isProfessional: user.id === "u-chef",
      createdAt: user.createdAt,
      postCount: 3 + index,
      followerCount: 12 + index,
      followingCount: 4 + index,
    },
  ])
)

export const notifications = [
  {
    id: "n-1",
    type: "LIKE",
    actor: author(users.chef),
    postId: "p-2",
    postType: "POST",
    readAt: null,
    createdAt: iso(5),
  },
  {
    id: "n-2",
    type: "FOLLOW",
    actor: author(users.admin),
    postId: null,
    readAt: iso(2),
    createdAt: iso(300),
  },
  {
    id: "n-3",
    type: "POST_APPROVED",
    actor: null,
    postId: "p-2",
    postType: "POST",
    readAt: iso(2),
    createdAt: iso(600),
  },
]

export const adminUsers = [
  { ...users.admin, accountVersion: 1 },
  { ...users.member, accountVersion: 0 },
  { ...users.chef, accountVersion: 2 },
  {
    id: "u-suspended",
    username: "bidinhchi",
    fullName: "Phạm Bị Đình Chỉ",
    email: "suspended@example.com",
    avatarUrl: null,
    role: "USER",
    status: "SUSPENDED",
    accountVersion: 3,
    createdAt: "2025-03-01T08:00:00.000Z",
    updatedAt: "2025-03-01T08:00:00.000Z",
  },
]

// --- Tokens ---------------------------------------------------------------
// The app only reads `exp` from the access token (proxy.ts); the mock API
// reads `sub`. Signatures are not verified anywhere in the test setup.

const b64url = (value) => Buffer.from(JSON.stringify(value)).toString("base64url")

export function makeAccessToken(userId, { expiresInSec = 3600 } = {}) {
  const exp = Math.floor(Date.now() / 1000) + expiresInSec
  return `${b64url({ alg: "none", typ: "JWT" })}.${b64url({ sub: userId, exp })}.sig`
}

export function makeRefreshToken(userId) {
  return `refresh.${userId}.${Math.random().toString(36).slice(2)}`
}

/** `AuthTokens` as returned by `POST /auth/login | /auth/refresh`. */
export function makeTokens(userId) {
  return {
    accessToken: makeAccessToken(userId),
    refreshToken: makeRefreshToken(userId),
    accessTokenExpiresIn: 3600,
    refreshTokenExpiresIn: 86400,
  }
}

export const pageOf = (items, nextCursor = null) => ({ items, nextCursor })
