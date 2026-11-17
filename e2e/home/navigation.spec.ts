import { users } from "../fixtures/data.mjs"
import { signInAs } from "../helpers/auth"
import { test, expect } from "../helpers/test"

test.describe("app shell navigation", () => {
  test.beforeEach(async ({ context }) => {
    await signInAs(context, "member")
  })

  test("the left nav exposes the main sections", async ({ page }) => {
    await page.goto("/home")
    const nav = page.getByRole("navigation", { name: "Điều hướng chính" })
    await expect(nav.getByRole("link", { name: /Thông báo/ })).toHaveAttribute("href", "/home/notifications")
    await expect(nav.getByRole("link", { name: /Hồ sơ/ })).toHaveAttribute("href", "/home/profile")
  })

  test("the notifications badge reflects the unread count", async ({ page }) => {
    await page.goto("/home")
    await expect(page.getByLabel("1 thông báo chưa đọc")).toBeVisible()
  })

  test("'Hồ sơ' redirects to the signed-in user's own profile", async ({ page }) => {
    await page.goto("/home/profile")
    await expect(page).toHaveURL(/\/profile\/u-member$/)
    await expect(page.getByRole("heading", { name: "Nguyễn Minh Anh" })).toBeVisible()
  })

  test("the compose dialog opens from the nav", async ({ page }) => {
    await page.goto("/home")
    await page.getByRole("button", { name: "Đăng bài" }).first().click()
    await expect(page.getByRole("dialog")).toBeVisible()
  })
})

test.describe("sidebar avatar", () => {
  test("shows the initials when the user has no photo", async ({ page, context }) => {
    await signInAs(context, "member")
    await page.goto("/home")
    const menu = page.getByRole("button", { name: "Menu tài khoản của Nguyễn Minh Anh" })
    await expect(menu).toContainText("NA")
    await expect(menu.locator("img")).toHaveCount(0)
  })

  test("shows the photo from /auth/me", async ({ page, context }) => {
    // 1x1 transparent PNG, so the avatar image actually loads.
    const png = Buffer.from(
      "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=",
      "base64"
    )
    await page.route(users.photo.avatarUrl, (route) =>
      route.fulfill({ status: 200, contentType: "image/png", body: png })
    )
    await signInAs(context, "photo")
    await page.goto("/home")
    const menu = page.getByRole("button", { name: "Menu tài khoản của Phạm Ảnh Đại" })
    await expect(menu.locator("img")).toHaveAttribute("src", users.photo.avatarUrl)
  })
})
