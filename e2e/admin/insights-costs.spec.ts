import { signInAs } from "../helpers/auth"
import { mockApi } from "../helpers/api"
import { test, expect, appAlerts } from "../helpers/test"

test.describe("admin insights", () => {
  test.beforeEach(async ({ context }) => {
    await signInAs(context, "admin")
  })

  test("shows the dashboard snapshot and period totals", async ({ page }) => {
    await page.goto("/admin/insights")
    await expect(page).toHaveTitle(/Thống kê · Vedora Quản trị/)
    await expect(page.getByRole("heading", { name: "Tổng quan Vedora" })).toBeVisible()
    await expect(page.getByText("Thành viên hoạt động")).toBeVisible()
    await expect(page.getByText("Báo cáo chờ xử lý")).toBeVisible()
    const totals = page.locator("dl").first()
    await expect(totals).toContainText("Thành viên mới")
    await expect(totals).toContainText("25")
    await expect(page.getByText("Chưa có dữ liệu").first()).toBeVisible()
  })

  test("applies a custom date range through the API", async ({ page }) => {
    const seen: string[] = []
    await page.route(/\/api\/v1\/admin\/dashboard\?/, async (route) => {
      seen.push(new URL(route.request().url()).search)
      await route.fallback()
    })
    await page.goto("/admin/insights")
    await expect(page.getByText("Thành viên hoạt động")).toBeVisible()
    await page.getByLabel("Từ ngày").fill("2026-01-01")
    await page.getByLabel("Đến ngày").fill("2026-01-31")
    await page.getByRole("button", { name: "Áp dụng" }).click()
    await expect.poll(() => seen.some((query) => query.includes("from=2026-01-01") && query.includes("to=2026-01-31"))).toBe(true)
  })

  test("rejects a range longer than 90 days", async ({ page }) => {
    await page.goto("/admin/insights")
    await page.waitForLoadState("networkidle")
    await expect(async () => {
      await page.getByLabel("Từ ngày").fill("2026-01-01")
      await page.getByLabel("Đến ngày").fill("2026-12-31")
      await page.getByRole("button", { name: "Áp dụng" }).click()
      await expect(appAlerts(page)).toContainText("tối đa 90 ngày", { timeout: 2000 })
    }).toPass({ timeout: 20_000 })
  })

  test("an invalid range in the URL falls back to 30 days with a notice", async ({ page }) => {
    await page.goto("/admin/insights?from=2026-01-01&to=2026-12-31")
    await expect(page.getByText(/Khoảng ngày trong liên kết không hợp lệ/)).toBeVisible()
    await expect(page.getByRole("heading", { name: "Tổng quan Vedora" })).toBeVisible()
  })

  test("shows an error when the dashboard cannot be loaded", async ({ page }) => {
    await mockApi(page, "/admin/dashboard", { status: 500, body: { statusCode: 500, message: "boom" } })
    await page.goto("/admin/insights")
    await expect(page.getByText("Không tải được thống kê. Vui lòng thử làm mới.")).toBeVisible()
  })
})

test.describe("admin AI costs", () => {
  test.beforeEach(async ({ context }) => {
    await signInAs(context, "admin")
  })

  test("shows the cost summary, groups and call details", async ({ page }) => {
    await page.goto("/admin/ai-costs")
    await expect(page).toHaveTitle(/Chi phí AI · Vedora Quản trị/)
    await expect(page.getByRole("heading", { name: "Chi phí AI thực tế" })).toBeVisible()
    await expect(page.getByText("$1.234500").first()).toBeVisible()
    await expect(page.getByText("Theo model và tính năng")).toBeVisible()
    await expect(page.getByRole("cell", { name: "Trợ lý thực đơn" })).toBeVisible()
    await expect(page.getByText("Chi tiết lần gọi")).toBeVisible()
  })

  test("the filter form sends feature and model to the API", async ({ page }) => {
    const seen: string[] = []
    await page.route(/\/api\/v1\/admin\/ai-costs\?/, async (route) => {
      seen.push(new URL(route.request().url()).search)
      await route.fallback()
    })
    await page.goto("/admin/ai-costs")
    await expect(page.getByText("Theo model và tính năng")).toBeVisible()
    await page.getByLabel("Tính năng").selectOption({ label: "Trợ lý blog" })
    await page.getByLabel("Model chính xác").fill("test-model")
    await page.getByRole("button", { name: "Áp dụng" }).click()
    await expect
      .poll(() => seen.some((query) => query.includes("feature=BLOG_CHAT") && query.includes("model=test-model")))
      .toBe(true)
  })

  test("rejects a range longer than 90 days", async ({ page }) => {
    await page.goto("/admin/ai-costs")
    await page.waitForLoadState("networkidle")
    await page.getByLabel("Từ ngày").fill("2026-01-01")
    await page.getByLabel("Đến ngày").fill("2026-12-31")
    await page.getByRole("button", { name: "Áp dụng" }).click()
    await expect(page.getByText("Chọn khoảng ngày hợp lệ, tối đa 90 ngày theo UTC+7.")).toBeVisible()
  })

  test("shows an error when the report cannot be loaded", async ({ page }) => {
    await mockApi(page, "/admin/ai-costs", { status: 500, body: { statusCode: 500, message: "boom" } })
    await page.goto("/admin/ai-costs")
    await expect(appAlerts(page).first()).toBeVisible()
  })

  test("a member is redirected away", async ({ browser }) => {
    const context = await browser.newContext()
    await signInAs(context, "member")
    const page = await context.newPage()
    await page.goto("http://localhost:3000/admin/ai-costs")
    await expect(page).toHaveURL(/\/home$/)
    await context.close()
  })
})
