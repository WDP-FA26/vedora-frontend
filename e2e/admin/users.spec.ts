import { signInAs } from "../helpers/auth"
import { mockApi } from "../helpers/api"
import { test, expect, appAlerts } from "../helpers/test"

test.describe("admin users (admin)", () => {
  test.beforeEach(async ({ context }) => {
    await signInAs(context, "admin")
  })

  test("/admin lands on the users list", async ({ page }) => {
    await page.goto("/admin")
    await expect(page).toHaveURL(/\/admin\/users$/)
    await expect(page).toHaveTitle(/Người dùng · Vedora Quản trị/)
  })

  test("lists every account with role and status badges", async ({ page }) => {
    await page.goto("/admin/users")
    const table = page.getByRole("table")
    await expect(table.getByRole("row", { name: /Trần Quản Trị/ })).toContainText("Quản trị viên")
    await expect(table.getByRole("row", { name: /Nguyễn Minh Anh/ })).toContainText("Thành viên")
    await expect(table.getByRole("row", { name: /Phạm Bị Đình Chỉ/ })).toContainText("Đình chỉ")
    await expect(table.getByRole("row", { name: /Trần Quản Trị/ })).toContainText("Hoạt động")
    await expect(table.getByRole("link", { name: "@minhanh" })).toHaveAttribute("href", "/profile/u-member")
    const pageRow = table.getByRole("row", { name: /Bếp An Lành/ })
    await expect(pageRow).toContainText("—")
    await expect(pageRow).not.toContainText("page.vedora.internal")
  })

  test("the admin sidebar links to the other sections", async ({ page }) => {
    await page.goto("/admin/users")
    await expect(page.getByRole("link", { name: "Xác minh chuyên gia" })).toHaveAttribute(
      "href",
      "/admin/verification"
    )
    await expect(page.getByRole("link", { name: "Bài đăng" })).toHaveAttribute("href", "/admin/content")
  })

  test("searching sends ?q= to the API after a pause", async ({ page }) => {
    const seen: string[] = []
    await page.route(/\/api\/v1\/users\?/, async (route) => {
      seen.push(new URL(route.request().url()).searchParams.get("q") ?? "")
      await route.fallback()
    })
    await page.goto("/admin/users")
    await expect(page.getByRole("row", { name: /Trần Quản Trị/ })).toBeVisible()
    await page.getByPlaceholder("Tìm theo tên, username hoặc email").fill("bepchay")
    await expect(page.getByRole("row", { name: /Lê Bếp Chay/ })).toBeVisible()
    await expect(page.getByRole("row", { name: /Trần Quản Trị/ })).toHaveCount(0)
    expect(seen).toContain("bepchay")
  })

  test("filters by status through the API", async ({ page }) => {
    await page.goto("/admin/users")
    await expect(page.getByRole("row", { name: /Trần Quản Trị/ })).toBeVisible()
    await page.getByLabel("Lọc theo trạng thái").selectOption({ label: "Đình chỉ" })
    await expect(page.getByRole("row", { name: /Phạm Bị Đình Chỉ/ })).toBeVisible()
    await expect(page.getByRole("row", { name: /Trần Quản Trị/ })).toHaveCount(0)
  })

  test("shows the empty message when nothing matches", async ({ page }) => {
    await page.goto("/admin/users")
    await page.getByPlaceholder("Tìm theo tên, username hoặc email").fill("zzzz-no-match")
    await expect(page.getByText("Không có người dùng nào khớp.")).toBeVisible()
  })

  test("shows an error when the list cannot be loaded", async ({ page }) => {
    await mockApi(page, "/users", { status: 500, body: { statusCode: 500, message: "boom" } })
    await page.goto("/admin/users")
    await expect(appAlerts(page)).toContainText("Không tải được danh sách người dùng")
  })

  test("the payments page is open to admins", async ({ page }) => {
    await page.goto("/admin/payments")
    await expect(page).toHaveURL(/\/admin\/payments$/)
    await expect(page).toHaveTitle(/Thanh toán · Vedora Quản trị/)
  })
})

test.describe("admin users (member)", () => {
  test.beforeEach(async ({ context }) => {
    await signInAs(context, "member")
  })

  for (const path of [
    "/admin",
    "/admin/users",
    "/admin/content",
    "/admin/knowledge",
    "/admin/payments",
    "/admin/insights",
    "/admin/ai-costs",
  ]) {
    test(`${path} redirects a non-admin to /home`, async ({ page }) => {
      await page.goto(path)
      await expect(page).toHaveURL(/\/home$/)
    })
  }
})
