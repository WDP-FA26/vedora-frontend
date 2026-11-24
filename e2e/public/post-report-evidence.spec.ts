import type { Page } from "@playwright/test"
import { signInAs } from "../helpers/auth"
import { mockApi } from "../helpers/api"
import { test, expect, appAlerts } from "../helpers/test"

const png = {
  name: "proof.png",
  mimeType: "image/png",
  buffer: Buffer.from(
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAIAAACQd1PeAAAADElEQVR4nGNQzXMDAAGVANpsoEDZAAAAAElFTkSuQmCC",
    "base64"
  ),
}
async function openReport(page: Page) {
  await page.goto("/home")
  const post = page.getByRole("article").filter({ hasText: "Phở chay" }).first()
  await post.getByRole("button", { name: "Tùy chọn khác" }).click()
  await page.getByRole("menuitem", { name: "Báo cáo bài viết", exact: true }).click()
  const dialog = page.getByRole("dialog", { name: "Báo cáo bài viết", exact: true })
  await dialog.getByRole("radio", { name: "Spam hoặc quảng cáo", exact: true }).click()
  return dialog
}
test.beforeEach(async ({ context }) => {
  await signInAs(context, "member")
})

test("uploads an optional proof as multipart before submitting its id", async ({ page }) => {
  let contentType = ""
  const uploads = await mockApi(
    page,
    "/posts/p-1/report/evidence",
    (route) => {
      contentType = route.request().headers()["content-type"]
      return { status: 201, body: { id: "proof-1" } }
    },
    "POST"
  )
  const sends = await mockApi(page, "/posts/p-1/report", { status: 201, body: {} }, "POST")
  const dialog = await openReport(page)
  await dialog.locator('input[type="file"]').setInputFiles(png)
  await expect(dialog.getByRole("img", { name: "proof.png", exact: true })).toBeVisible()
  await dialog.getByRole("textbox", { name: "Chi tiết" }).fill("  Ảnh làm rõ nội dung  ")
  await page.screenshot({
    path: test.info().outputPath("report-with-evidence.png"),
    fullPage: true,
    animations: "disabled",
  })
  await dialog.getByRole("button", { name: "Gửi báo cáo", exact: true }).click()
  await expect(page.getByRole("heading", { name: "Đã gửi báo cáo", exact: true })).toBeVisible()
  expect(uploads).toHaveLength(1)
  expect(contentType).toContain("multipart/form-data; boundary=")
  expect(sends[0].body).toEqual({
    reason: "SPAM",
    details: "Ảnh làm rõ nội dung",
    evidenceIds: ["proof-1"],
  })
})

test("supports a report without proof and clears previews when cancelled", async ({ page }) => {
  const sends = await mockApi(page, "/posts/p-1/report", { status: 201, body: {} }, "POST")
  const dialog = await openReport(page)
  await dialog.locator('input[type="file"]').setInputFiles(png)
  await dialog.getByRole("button", { name: "Huỷ", exact: true }).click()
  await page
    .getByRole("article")
    .filter({ hasText: "Phở chay" })
    .first()
    .getByRole("button", { name: "Tùy chọn khác" })
    .click()
  await page.getByRole("menuitem", { name: "Báo cáo bài viết", exact: true }).click()
  await expect(dialog.getByRole("img", { name: "proof.png", exact: true })).toHaveCount(0)
  await dialog.getByRole("radio", { name: "Spam hoặc quảng cáo", exact: true }).click()
  await dialog.getByRole("button", { name: "Gửi báo cáo", exact: true }).click()
  await expect(page.getByRole("heading", { name: "Đã gửi báo cáo", exact: true })).toBeVisible()
  expect(sends[0].body).toEqual({ reason: "SPAM" })
})

test("rejects unsupported/oversized images, limits to three and allows removing them", async ({
  page,
}) => {
  const dialog = await openReport(page)
  const input = dialog.locator('input[type="file"]')
  await input.setInputFiles({
    name: "unsafe.svg",
    mimeType: "image/svg+xml",
    buffer: Buffer.from("<svg/>"),
  })
  await expect(appAlerts(page)).toContainText("Chỉ hỗ trợ ảnh JPG, PNG hoặc WebP")
  await input.setInputFiles({ ...png, buffer: Buffer.alloc(5 * 1024 * 1024 + 1) })
  await expect(appAlerts(page)).toContainText("Mỗi ảnh tối đa 5 MB")
  await input.setInputFiles(
    Array.from({ length: 4 }, (_, i) => ({ ...png, name: `proof-${i}.png` }))
  )
  await expect(dialog.getByRole("img")).toHaveCount(3)
  await expect(appAlerts(page)).toContainText("Tối đa 3 ảnh")
  await dialog.getByRole("button", { name: "Bỏ ảnh proof-0.png", exact: true }).click()
  await expect(dialog.getByRole("img")).toHaveCount(2)
})

test("keeps a completed upload for report retry and blocks submit while uploading", async ({
  page,
}) => {
  const uploads = await mockApi(
    page,
    "/posts/p-1/report/evidence",
    async () => {
      await new Promise((resolve) => setTimeout(resolve, 300))
      return { status: 201, body: { id: "proof-1" } }
    },
    "POST"
  )
  let failing = true
  const sends = await mockApi(
    page,
    "/posts/p-1/report",
    () => (failing ? { status: 500, body: { message: "Failed" } } : { status: 201, body: {} }),
    "POST"
  )
  const dialog = await openReport(page)
  await dialog.locator('input[type="file"]').setInputFiles(png)
  await dialog.getByRole("button", { name: "Gửi báo cáo", exact: true }).click()
  await expect(dialog.getByRole("button", { name: "Gửi báo cáo", exact: true })).toBeDisabled()
  await expect(appAlerts(page)).toContainText("Không gửi được báo cáo")
  failing = false
  await dialog.getByRole("button", { name: "Gửi báo cáo", exact: true }).click()
  await expect(page.getByRole("heading", { name: "Đã gửi báo cáo", exact: true })).toBeVisible()
  expect(sends).toHaveLength(2)
  expect(uploads).toHaveLength(1)
})
