import { ORDER_ID } from "../fixtures/data-extra.mjs"
import { signInAs } from "../helpers/auth"
import { mockApi } from "../helpers/api"
import { test, expect } from "../helpers/test"

test.describe("admin payments", () => {
  test.beforeEach(async ({ context }) => {
    await signInAs(context, "admin")
  })

  test("shows the overview cards", async ({ page }) => {
    await page.goto("/admin/payments")
    await expect(page.getByRole("heading", { name: "Thanh toán và gói thành viên" })).toBeVisible()
    await expect(page.getByText("Tiền đã xác nhận theo bộ lọc")).toBeVisible()
    await expect(page.getByText("99.000").first()).toBeVisible()
    await expect(page.getByText("1 chờ · 1 thành công · 1 hủy")).toBeVisible()
    await expect(page.getByText("Plus còn hạn toàn hệ thống")).toBeVisible()
    await expect(page.getByText("Thống kê theo ngày")).toBeVisible()
  })

  test("lists orders with links to their detail page", async ({ page }) => {
    await page.goto("/admin/payments")
    await expect(page.getByRole("link", { name: "INV-2026-0001" })).toHaveAttribute(
      "href",
      `/admin/payments/${ORDER_ID}`
    )
    const row = page.getByRole("row", { name: /INV-2026-0002/ })
    await expect(row).toContainText("Chờ thanh toán")
    await expect(page.getByRole("row", { name: /INV-2026-0001/ })).toContainText("Đã xác nhận")
  })

  test("switches between orders, webhooks and active subscriptions", async ({ page }) => {
    await page.goto("/admin/payments")
    const group = page.getByRole("group", { name: "Chọn nội dung tra cứu" })
    await group.getByRole("button", { name: "Webhook" }).click()
    await expect(group.getByRole("button", { name: "Webhook" })).toHaveAttribute("aria-pressed", "true")
    await expect(page.getByRole("cell", { name: "Đã ghi nhận thanh toán và kích hoạt gói." })).toBeVisible()
    await group.getByRole("button", { name: "Gói còn hạn" }).click()
    await expect(group.getByRole("button", { name: "Gói còn hạn" })).toHaveAttribute("aria-pressed", "true")
    await expect(page.getByText("INV-2026-0001").first()).toBeVisible()
  })

  test("the filter form sends status and plan to the API", async ({ page }) => {
    const seen: string[] = []
    await page.route(/\/api\/v1\/admin\/payments\/orders\?/, async (route) => {
      seen.push(new URL(route.request().url()).search)
      await route.fallback()
    })
    await page.goto("/admin/payments")
    await expect(page.getByRole("link", { name: "INV-2026-0001" })).toBeVisible()
    await page.getByLabel("Trạng thái đơn").selectOption({ label: "Đã hủy" })
    await page.getByLabel("Gói đơn hàng").selectOption("PRO")
    await page.getByRole("button", { name: "Áp dụng" }).click()
    await expect
      .poll(() => seen.some((query) => query.includes("status=CANCELLED") && query.includes("plan=PRO")))
      .toBe(true)
  })

  test("rejects a range longer than 90 days", async ({ page }) => {
    await page.goto("/admin/payments")
    await page.waitForLoadState("networkidle")
    await page.getByLabel("Từ ngày").fill("2026-01-01")
    await page.getByLabel("Đến ngày").fill("2026-12-31")
    await page.getByRole("button", { name: "Áp dụng" }).click()
    await expect(page.getByText("Chọn khoảng ngày hợp lệ, tối đa 90 ngày theo UTC+7.")).toBeVisible()
  })

  test("shows an error when the overview fails", async ({ page }) => {
    await mockApi(page, "/admin/payments/overview", { status: 500, body: { statusCode: 500, message: "boom" } })
    await page.goto("/admin/payments")
    await expect(page.getByText("Không tải được thống kê. Kiểm tra quyền Admin hoặc thử lại.")).toBeVisible()
  })

  test("shows an error when the orders fail", async ({ page }) => {
    await mockApi(page, "/admin/payments/orders", { status: 500, body: { statusCode: 500, message: "boom" } })
    await page.goto("/admin/payments")
    await expect(page.getByText("Không tải được danh sách đơn.")).toBeVisible()
  })
})

test.describe("admin payment detail", () => {
  test.beforeEach(async ({ context }) => {
    await signInAs(context, "admin")
  })

  test("shows the order, membership and webhook history", async ({ page }) => {
    await page.goto(`/admin/payments/${ORDER_ID}`)
    await expect(page).toHaveTitle(/Chi tiết thanh toán · Vedora Quản trị/)
    await expect(page.getByRole("heading", { name: "INV-2026-0001" })).toBeVisible()
    await expect(page.getByText("Đã xác nhận", { exact: true }).first()).toBeVisible()
    const details = page.locator("dl").first()
    await expect(details).toContainText("VEDORA12345")
    await expect(details).toContainText("minhanh · minhanh@example.com")
    await expect(details).toContainText("MBBank · ****6789")
    await expect(page.getByRole("cell", { name: "Đã ghi nhận thanh toán và kích hoạt gói." })).toBeVisible()
    await expect(page.getByRole("link", { name: "← Thanh toán" })).toHaveAttribute("href", "/admin/payments")
  })

  test("an unknown order shows not-found", async ({ page }) => {
    await page.goto("/admin/payments/99999999-9999-4999-8999-999999999999")
    await expect(page.getByText("Không tìm thấy đơn thanh toán.")).toBeVisible()
    await expect(page.getByRole("link", { name: "Quay lại thanh toán" })).toBeVisible()
  })

  test("a malformed id is a 404", async ({ page }) => {
    const response = await page.goto("/admin/payments/not-a-uuid")
    expect(response?.status()).toBe(404)
  })

  test("a member is redirected away", async ({ browser }) => {
    const context = await browser.newContext()
    await signInAs(context, "member")
    const page = await context.newPage()
    await page.goto(`http://localhost:3000/admin/payments/${ORDER_ID}`)
    await expect(page).toHaveURL(/\/home$/)
    await context.close()
  })
})
