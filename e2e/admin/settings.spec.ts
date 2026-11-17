import { moderationSettings } from "../fixtures/data-extra.mjs"
import { signInAs } from "../helpers/auth"
import { mockApi } from "../helpers/api"
import { test, expect, appAlerts } from "../helpers/test"

test.describe("admin moderation settings", () => {
  test.beforeEach(async ({ context }) => {
    await signInAs(context, "admin")
  })

  test("shows the saved policy and no unsaved changes", async ({ page }) => {
    await page.goto("/admin/settings")
    await expect(page).toHaveTitle(/Cài đặt · Vedora Quản trị/)
    await expect(page.getByRole("heading", { name: "Kiểm duyệt nội dung" })).toBeVisible()
    await expect(page.getByRole("heading", { name: "Mức nghiêm ngặt" })).toBeVisible()
    await expect(page.getByLabel("Sửa tiêu chí Spam")).toBeVisible()
    await expect(page.getByLabel("Sửa tiêu chí Bạo lực")).toBeVisible()
    await expect(page.getByText("Không có thay đổi.")).toBeVisible()
    await expect(page.getByRole("button", { name: "Lưu thay đổi" })).toBeDisabled()
    await expect(page.getByRole("button", { name: "Hoàn tác" })).toBeDisabled()
  })

  test("choosing a strictness preset marks the draft dirty and saves it", async ({ page }) => {
    const saves = await mockApi(
      page,
      "/admin/moderation/settings",
      (route) => ({
        body: { ...moderationSettings, ...JSON.parse(route.request().postData() ?? "{}"), version: 4 },
      }),
      "PUT"
    )
    await page.goto("/admin/settings")
    await page.getByRole("button", { name: /Thoải mái/ }).click()
    await expect(page.getByText("Có thay đổi chưa lưu.")).toBeVisible()
    await page.getByRole("button", { name: "Lưu thay đổi" }).click()
    await expect(page.getByText("Không có thay đổi.")).toBeVisible()
    expect(saves).toHaveLength(1)
    expect(saves[0].body).toMatchObject({ reviewThreshold: 0.5, rejectThreshold: 0.95, version: 3 })
  })

  test("undo discards the draft", async ({ page }) => {
    await page.goto("/admin/settings")
    await page.getByRole("button", { name: /Thoải mái/ }).click()
    await page.getByRole("button", { name: "Hoàn tác" }).click()
    await expect(page.getByText("Không có thay đổi.")).toBeVisible()
  })

  test("removing a criterion changes the draft", async ({ page }) => {
    await page.goto("/admin/settings")
    await page.getByLabel("Xoá tiêu chí Bạo lực").click()
    await expect(page.getByLabel("Sửa tiêu chí Bạo lực")).toHaveCount(0)
    await expect(page.getByText("Có thay đổi chưa lưu.")).toBeVisible()
  })

  test("reports a version conflict from the API", async ({ page }) => {
    await mockApi(
      page,
      "/admin/moderation/settings",
      { status: 409, body: { statusCode: 409, message: "stale" } },
      "PUT"
    )
    await page.goto("/admin/settings")
    await page.getByRole("button", { name: /Thoải mái/ }).click()
    await page.getByRole("button", { name: "Lưu thay đổi" }).click()
    await expect(appAlerts(page)).toContainText("Có quản trị viên khác vừa lưu cài đặt.")
  })

  test("the policy test runs against the draft", async ({ page }) => {
    const tests = await mockApi(page, "/admin/moderation/settings/test", {
      body: { decision: "review", category: "spam", violationScore: 0.6, scores: { spam: 0.6 } },
    }, "POST")
    await page.goto("/admin/settings")
    const run = page.getByRole("button", { name: "Chạy thử" })
    await expect(run).toBeDisabled()
    await page.getByLabel("Văn bản cần thử").fill("Mua ngay giá rẻ!!!")
    await run.click()
    await expect(page.getByRole("status").filter({ hasText: "khả năng vi phạm 60%" })).toBeVisible()
    expect(tests).toHaveLength(1)
    expect(tests[0].body).toMatchObject({ text: "Mua ngay giá rẻ!!!" })
  })

  test("resetting to defaults asks for confirmation", async ({ page }) => {
    const resets = await mockApi(
      page,
      "/admin/moderation/settings/reset",
      { body: { ...moderationSettings, isDefault: true, version: 0 } },
      "POST"
    )
    await page.goto("/admin/settings")
    await page.getByRole("button", { name: "Nâng cao" }).click()
    await page.getByRole("button", { name: "Khôi phục mặc định" }).click()
    const confirm = page.getByRole("alertdialog")
    await expect(confirm.getByText("Khôi phục chính sách mặc định?")).toBeVisible()
    await confirm.getByRole("button", { name: /Khôi phục/ }).last().click()
    await expect.poll(() => resets.length).toBe(1)
  })

  test("shows an error when the settings cannot be loaded", async ({ page }) => {
    await mockApi(page, "/admin/moderation/settings", { status: 500, body: { statusCode: 500, message: "boom" } }, "GET")
    await page.goto("/admin/settings")
    await expect(appAlerts(page)).toContainText("Không tải được cài đặt kiểm duyệt.")
  })
})
