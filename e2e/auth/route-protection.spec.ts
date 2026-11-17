import { makeAccessToken, makeRefreshToken, users } from "../fixtures/data.mjs"
import { signInAs } from "../helpers/auth"
import { test, expect } from "../helpers/test"

test.describe("signed-out visitors", () => {
  for (const path of [
    "/home",
    "/home/notifications",
    "/home/bookmarks",
    "/blogs/new",
    "/billing",
  ]) {
    test(`${path} redirects to login and remembers the destination`, async ({ page }) => {
      await page.goto(path)
      await expect(page).toHaveURL(new RegExp(`/login\\?next=${encodeURIComponent(path).replace(/\./g, "\\.")}`))
      await expect(page.getByRole("heading", { name: "Chào mừng trở lại" })).toBeVisible()
    })
  }

  test("keeps the query string in ?next=", async ({ page }) => {
    await page.goto("/home/search?q=pho")
    await expect(page).toHaveURL(/\/login\?next=%2Fhome%2Fsearch%3Fq%3Dpho/)
  })

  test("/admin/payments sends a signed-out visitor to login", async ({ page }) => {
    await page.goto("/admin/payments")
    await expect(page).toHaveURL(/\/login\?next=%2Fadmin%2Fpayments$/)
  })

  test("public pages stay reachable", async ({ page }) => {
    await page.goto("/posts/p-1")
    await expect(page).toHaveURL(/\/posts\/p-1$/)
    await expect(page.getByRole("link", { name: "Đăng nhập" })).toBeVisible()
  })

  for (const path of ["/admin", "/admin/users", "/admin/content"]) {
    test(`${path} redirects a signed-out visitor to login`, async ({ page }) => {
      await page.goto(path)
      await expect(page).toHaveURL(new RegExp(`/login\\?next=${encodeURIComponent(path)}$`))
    })
  }
})

test.describe("signed-in users", () => {
  test.beforeEach(async ({ context }) => {
    await signInAs(context, "member")
  })

  for (const path of ["/login", "/register", "/forgot-password"]) {
    test(`${path} bounces to /home`, async ({ page }) => {
      await page.goto(path)
      await expect(page).toHaveURL(/\/home$/)
    })
  }

  test("guest pages honour ?next= for signed-in users", async ({ page }) => {
    await page.goto("/login?next=%2Fhome%2Fnotifications")
    await expect(page).toHaveURL(/\/home\/notifications$/)
  })

  test("non-admins are sent away from admin-only pages", async ({ page }) => {
    await page.goto("/admin/payments")
    await expect(page).toHaveURL(/\/home$/)
  })

  test("logging out clears the session", async ({ page, context }) => {
    await page.goto("/home")
    await page.getByRole("button", { name: /Menu tài khoản của/ }).click()
    await page.getByRole("menuitem", { name: /Đăng xuất/ }).click()
    await expect(page).toHaveURL(/\/login$/)
    const names = (await context.cookies()).map((cookie) => cookie.name)
    expect(names).not.toContain("vedora_at")
    await page.goto("/home")
    await expect(page).toHaveURL(/\/login\?next=/)
  })
})

test.describe("expired access token", () => {
  test("the proxy rotates it with the refresh token instead of signing out", async ({ page, context }) => {
    // Expired access token + valid refresh token: proxy.ts calls POST /auth/refresh.
    const base = { domain: "localhost", path: "/", httpOnly: true, sameSite: "Lax" as const }
    await context.addCookies([
      { ...base, name: "vedora_at", value: makeAccessToken(users.member.id, { expiresInSec: -60 }) },
      { ...base, name: "vedora_rt", value: makeRefreshToken(users.member.id) },
    ])
    await page.goto("/home")
    await expect(page).toHaveURL(/\/home$/)
    await expect(page.getByRole("tab", { name: "Dành cho bạn" })).toBeVisible()
  })

  test("a rejected refresh token signs the user out", async ({ page, context }) => {
    const base = { domain: "localhost", path: "/", httpOnly: true, sameSite: "Lax" as const }
    await context.addCookies([
      { ...base, name: "vedora_at", value: makeAccessToken(users.member.id, { expiresInSec: -60 }) },
      { ...base, name: "vedora_rt", value: "garbage" },
    ])
    await page.goto("/home")
    await expect(page).toHaveURL(/\/login\?next=%2Fhome/)
  })
})
