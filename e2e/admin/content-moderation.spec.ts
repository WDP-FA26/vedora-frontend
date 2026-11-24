import { signInAs } from "../helpers/auth"
import { mockApi } from "../helpers/api"
import { test, expect, appAlerts } from "../helpers/test"

test.describe("admin content", () => {
  test.beforeEach(async ({ context }) => {
    await signInAs(context, "admin")
  })

  test("lists every post whatever its status", async ({ page }) => {
    await page.goto("/admin/content")
    await expect(page).toHaveTitle(/Bài đăng · Vedora Quản trị/)
    await expect(page.getByRole("row", { name: /Lê Bếp Chay/ })).toContainText("Đã đăng")
    await expect(page.getByRole("row", { name: /Nguyễn Minh Anh/ }).first()).toBeVisible()
  })

  test("a status view narrows the list", async ({ page }) => {
    await page.goto("/admin/content")
    await page.getByRole("button", { name: "Chờ duyệt", exact: true }).click()
    await expect(page.getByRole("row", { name: /Nguyễn Minh Anh/ })).toHaveCount(1)
    await expect(page.getByRole("row", { name: /Lê Bếp Chay/ })).toHaveCount(0)
  })

  test("opens a post in a sheet", async ({ page }) => {
    await page.goto("/admin/content")
    await page.getByRole("button", { name: "Xem bài đăng của Lê Bếp Chay" }).click()
    const sheet = page.getByRole("dialog")
    await expect(sheet.getByText("Bài đăng").first()).toBeVisible()
    await expect(sheet).toContainText("Phở chay nước dùng nấm hương và hồi")
    await expect(sheet.getByRole("button", { name: "Xoá bài đăng" })).toBeVisible()
  })

  test("deleting a post asks for confirmation and calls DELETE", async ({ page }) => {
    const deletes = await mockApi(page, "/admin/posts/p-1", { status: 204 }, "DELETE")
    await page.goto("/admin/content")
    await page.getByRole("button", { name: "Xem bài đăng của Lê Bếp Chay" }).click()
    await page.getByRole("dialog").getByRole("button", { name: "Xoá bài đăng" }).click()
    const confirm = page.getByRole("alertdialog")
    await expect(confirm.getByText("Xoá bài đăng này?")).toBeVisible()
    await confirm.getByRole("button", { name: "Giữ lại" }).click()
    expect(deletes).toHaveLength(0)
    await page.getByRole("dialog").getByRole("button", { name: "Xoá bài đăng" }).click()
    await page.getByRole("alertdialog").getByRole("button", { name: "Xoá", exact: true }).click()
    await expect.poll(() => deletes.length).toBe(1)
  })

  test("shows an error when the list cannot be loaded", async ({ page }) => {
    await mockApi(page, "/admin/posts", { status: 500, body: { statusCode: 500, message: "boom" } })
    await page.goto("/admin/content")
    await expect(appAlerts(page)).toContainText("Không tải được danh sách bài đăng.")
  })

  test("shows the empty message for an empty view", async ({ page }) => {
    await mockApi(page, "/admin/posts", { body: { items: [], meta: { hasNextPage: false } } })
    await page.goto("/admin/content")
    await expect(page.getByText("Không có bài đăng nào ở mục này.")).toBeVisible()
  })
})

test.describe("admin moderation queue", () => {
  test.beforeEach(async ({ context }) => {
    await signInAs(context, "admin")
  })

  test("defaults to posts that need review", async ({ page }) => {
    await page.goto("/admin/reports")
    await expect(page).toHaveTitle(/Kiểm duyệt · Vedora Quản trị/)
    await expect(page.getByRole("button", { name: "Cần xem xét", exact: true })).toHaveAttribute("aria-pressed", "true")
    const row = page.getByRole("row", { name: /Bài chờ duyệt thủ công/ })
    await expect(row).toBeVisible()
    await expect(row).toContainText("Trung bình")
    await expect(row.getByRole("button", { name: "Chặn" })).toBeVisible()
    await expect(row.getByRole("button", { name: "Cho đăng" })).toBeVisible()
  })

  test("allowing a held post sends an APPROVE decision", async ({ page }) => {
    const decisions = await mockApi(
      page,
      "/admin/posts/p-held/moderation",
      { body: { id: "p-held" } },
      "POST"
    )
    await page.goto("/admin/reports")
    await page.getByRole("row", { name: /Bài chờ duyệt thủ công/ }).getByRole("button", { name: "Cho đăng" }).click()
    await expect.poll(() => decisions.length).toBe(1)
    expect(decisions[0].body).toEqual({ decision: "APPROVE" })
  })

  test("blocking a held post sends a REJECT decision", async ({ page }) => {
    const decisions = await mockApi(page, "/admin/posts/p-held/moderation", { body: { id: "p-held" } }, "POST")
    await page.goto("/admin/reports")
    await page.getByRole("row", { name: /Bài chờ duyệt thủ công/ }).getByRole("button", { name: "Chặn" }).click()
    await expect.poll(() => decisions.length).toBe(1)
    expect(decisions[0].body).toEqual({ decision: "REJECT" })
  })

  test("the reported view shows the reason and closes a report", async ({ page }) => {
    const reviews = await mockApi(page, "/admin/reports/rep-1/review", { body: {} }, "POST")
    await page.goto("/admin/reports")
    await page.getByRole("button", { name: "Bị báo cáo", exact: true }).click()
    const row = page.getByRole("row", { name: /Phở chay/ })
    await expect(row).toContainText("Báo cáo: Spam hoặc quảng cáo")
    await row.getByRole("button", { name: "Bỏ qua" }).click()
    await expect.poll(() => reviews.length).toBe(1)
    expect(reviews[0].body).toEqual({ status: "DISMISSED" })
  })

  test("the blocked view lists rejected posts", async ({ page }) => {
    await page.goto("/admin/reports")
    await page.getByRole("button", { name: "Đã chặn", exact: true }).click()
    await expect(page.getByRole("row", { name: /Bài bị chặn/ })).toContainText("Đã chặn")
    await expect(page.getByRole("row", { name: /Bài bị chặn/ })).toContainText("Cao")
  })

  test("a blocked post shows its risk level and the model's evidence", async ({ page }) => {
    await page.goto("/admin/reports")
    await page.getByRole("button", { name: "Đã chặn", exact: true }).click()
    await page.getByRole("row", { name: /Bài bị chặn/ }).getByRole("button", { name: "Xem" }).click()
    const panel = page.getByRole("dialog").getByRole("region", { name: "Kiểm duyệt tự động" })
    await expect(panel).toContainText("Mức rủi ro")
    await expect(panel).toContainText("Cao")
    await expect(panel).toContainText("Bài quảng cáo lặp lại, kèm liên kết bán hàng.")
    await expect(panel.getByRole("button", { name: /Phân tích/ })).toHaveCount(0)
    await expect(panel.getByRole("button", { name: "Cho phép đăng" })).toBeEnabled()
    await expect(panel.getByRole("button", { name: "Từ chối" })).toBeDisabled()
  })

  test("shows the empty message when nothing needs review", async ({ page }) => {
    await mockApi(page, "/admin/posts", { body: { items: [], meta: { hasNextPage: false } } })
    await mockApi(page, "/admin/reports", { body: { items: [], meta: { hasNextPage: false } } })
    await page.goto("/admin/reports")
    await expect(page.getByText("Không có bài nào cần xem xét.")).toBeVisible()
  })

  test("shows an error when the queue cannot be loaded", async ({ page }) => {
    await mockApi(page, "/admin/reports", { status: 500, body: { statusCode: 500, message: "boom" } })
    await page.goto("/admin/reports")
    await expect(appAlerts(page)).toContainText("Không tải được danh sách kiểm duyệt.")
  })
})
