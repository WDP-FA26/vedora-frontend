import { makeAccessToken, makeRefreshToken, users } from "./fixtures/data.mjs"

/**
 * `next dev` compiles each route on its first request, which can take many
 * seconds and makes the first specs to touch a route flaky. Request every
 * route the suite uses once, sequentially, before any spec starts.
 */
const GUEST_ROUTES = [
  "/",
  "/login",
  "/register",
  "/forgot-password",
  "/reset-password",
  "/verify-email",
  "/posts/p-1",
  "/profile/u-chef",
  "/robots.txt",
  "/sitemap.xml",
]

const MEMBER_ROUTES = [
  "/home",
  "/home/search?q=pho",
  "/home/notifications",
  "/home/bookmarks",
  "/home/profile",
  "/profile/u-member",
  "/blogs/new",
  "/blogs/p-blog/edit",
  "/admin/payments",
  "/admin/insights",
  "/admin/ai-costs",
]

const ADMIN_ROUTES = [
  "/admin",
  "/admin/users",
  "/admin/payments",
  "/admin/payments/44444444-4444-4444-8444-444444444444",
  "/admin/content",
  "/admin/reports",
  "/admin/settings",
  "/admin/insights",
  "/admin/ai-costs",
  "/admin/verification",
  "/admin/knowledge",
  "/admin/knowledge/k0000000-0000-4000-8000-000000000001",
  "/admin/recipes",
  "/admin/recipes/new",
  "/admin/recipes/e0000000-0000-4000-8000-000000000001",
]

async function warm(baseURL: string, path: string, cookie?: string) {
  try {
    await fetch(new URL(path, baseURL), { headers: cookie ? { cookie } : {}, redirect: "manual" })
  } catch {
    // Warming is best effort; a failure shows up in the specs themselves.
  }
}

const cookieFor = (userId: string) =>
  `vedora_at=${makeAccessToken(userId)}; vedora_rt=${makeRefreshToken(userId)}`

export default async function globalSetup(config: { projects: { use: { baseURL?: string } }[] }) {
  const baseURL = config.projects[0]?.use.baseURL ?? "http://localhost:3000"
  for (const path of GUEST_ROUTES) await warm(baseURL, path)
  for (const path of MEMBER_ROUTES) await warm(baseURL, path, cookieFor(users.member.id))
  for (const path of ADMIN_ROUTES) await warm(baseURL, path, cookieFor(users.admin.id))
}
