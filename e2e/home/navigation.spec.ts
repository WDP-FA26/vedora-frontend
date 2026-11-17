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
