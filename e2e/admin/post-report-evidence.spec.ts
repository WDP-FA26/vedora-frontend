import type { Page } from "@playwright/test"
import { signInAs } from "../helpers/auth"
import { mockApi } from "../helpers/api"
import { test, expect, appAlerts } from "../helpers/test"

const author = { id: "u-chef", username: "bepchay", fullName: "Lê Bếp Chay", avatarUrl: null }
const initial = Array.from({ length: 3 }, (_, i) => ({
  id: "report-" + i,
  postId: "p-1",
  reason: i === 1 ? "MISINFORMATION" : "SPAM",
  details: "Chi tiết người báo cáo " + i,
  status: i === 2 ? "DISMISSED" : "PENDING",
  createdAt: "2026-11-24T10:00:00Z",
  reviewedAt: null,
  reporter: { ...author, id: "reporter-" + i, fullName: "Người báo cáo " + i },
  post: { id: "p-1", body: "Phở chay nước dùng nấm", author },
  evidence:
    i === 0
      ? [
          {
            id: "proof-1",
            url: "http://localhost:9000/vedora-support/proof.png?signed=private",
            contentType: "image/png",
            sizeBytes: 100,
          },
        ]
      : [],
}))
async function setup(page: Page) {
  await page.route("http://localhost:9000/vedora-support/**", (route) =>
    route.fulfill({
      contentType: "image/png",
      body: Buffer.from(
        "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAIAAACQd1PeAAAADElEQVR4nGNQzXMDAAGVANpsoEDZAAAAAElFTkSuQmCC",
        "base64"
      ),
    })
  )
  const state = { rows: structuredClone(initial), failing: false, conflict: false }
  const reads = await mockApi(
    page,
    "/admin/reports",
    (route) => {
      if (state.failing) return { status: 500, body: { message: "Fixture failed" } }
      const params = new URL(route.request().url()).searchParams
      const items = state.rows.map((row) => ({
        ...row,
        reportCount: 3,
        pendingReportCount: state.rows.filter((r) => r.status === "PENDING").length,
      }))
      return {
        body: { items: params.get("page") === "2" ? [] : items, meta: { hasNextPage: false } },
      }
    },
    "GET"
  )
  const writes = await mockApi(
    page,
    "/admin/reports/report-0/review",
    (route) => {
      if (state.conflict) {
        state.rows[0].status = "DISMISSED"
        return { status: 409, body: { message: "Already reviewed" } }
      }
      const { status } = route.request().postDataJSON() as { status: string }
      state.rows[0].status = status
      return { body: { ...state.rows[0], reportCount: 3, pendingReportCount: 1 } }
    },
    "POST"
  )
  return { state, reads, writes }
}
async function open(page: Page) {
  await page.goto("/admin/reports")
  await page.getByRole("button", { name: "Bị báo cáo", exact: true }).click()
  const row = page.getByRole("row", { name: /Phở chay/ })
  await expect(row).toHaveCount(1)
  return row
}
test.beforeEach(async ({ context }) => {
  await signInAs(context, "admin")
})

test("groups reports by post, shows total/pending counts and exposes every report with private proof in details", async ({
  page,
}) => {
  const { reads } = await setup(page)
  const row = await open(page)
  await expect(row).toContainText("3 lượt")
  await expect(row).toContainText("2 chờ xử lý")
  await expect(row.getByRole("button", { name: "Bỏ qua", exact: true })).toHaveCount(0)
  await page.screenshot({
    path: test.info().outputPath("post-report-counts-desktop.png"),
    fullPage: true,
    animations: "disabled",
  })
  await row.getByRole("button", { name: "Xem", exact: true }).click()
  const panel = page.getByRole("region", { name: "Báo cáo của bài viết", exact: true })
  await expect(panel).toContainText("3 lượt báo cáo · 2 chờ xử lý")
  await expect(panel.getByRole("listitem", { name: /Báo cáo của Người/ })).toHaveCount(3)
  await expect(
    panel.getByRole("link", { name: "Xem ảnh minh chứng 1 của Người báo cáo 0", exact: true })
  ).toHaveAttribute("href", /signed=private/)
  await expect
    .poll(() =>
      panel
        .getByRole("img", { name: "Minh chứng 1", exact: true })
        .evaluate((image) => (image as HTMLImageElement).naturalWidth)
    )
    .toBe(1)
  expect(reads.some((r) => new URL(r.url).searchParams.get("postId") === "p-1")).toBe(true)
  await page.screenshot({
    path: test.info().outputPath("post-report-proofs-desktop.png"),
    fullPage: true,
    animations: "disabled",
  })
})

test("reviewing one report updates pending counts in both details and the shared table", async ({
  page,
}) => {
  const { writes } = await setup(page)
  const row = await open(page)
  await row.getByRole("button", { name: "Xem", exact: true }).click()
  const panel = page.getByRole("region", { name: "Báo cáo của bài viết", exact: true })
  await panel
    .getByRole("listitem", { name: "Báo cáo của Người báo cáo 0", exact: true })
    .getByRole("button", { name: "Bỏ qua báo cáo", exact: true })
    .click()
  await expect(panel).toContainText("3 lượt báo cáo · 1 chờ xử lý")
  expect(writes[0].body).toEqual({ status: "DISMISSED" })
  await page.keyboard.press("Escape")
  await expect(row).toContainText("1 chờ xử lý")
})

test("refreshes when another admin has already reviewed a report", async ({ page }) => {
  const { state } = await setup(page)
  state.conflict = true
  const row = await open(page)
  await row.getByRole("button", { name: "Xem", exact: true }).click()
  const panel = page.getByRole("region", { name: "Báo cáo của bài viết", exact: true })
  await panel
    .getByRole("listitem", { name: "Báo cáo của Người báo cáo 0", exact: true })
    .getByRole("button", { name: "Bỏ qua báo cáo", exact: true })
    .click()
  await expect(appAlerts(page)).toContainText("quản trị viên khác xử lý")
  await expect(panel).toContainText("1 chờ xử lý")
})

test("mobile report detail stays readable", async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 800 })
  await setup(page)
  const row = await open(page)
  await row.getByRole("button", { name: "Xem", exact: true }).click()
  await expect(
    page.getByRole("region", { name: "Báo cáo của bài viết", exact: true })
  ).toContainText("3 lượt báo cáo")
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
  await page.screenshot({
    path: test.info().outputPath("post-report-proofs-mobile.png"),
    fullPage: true,
    animations: "disabled",
  })
})

test("loads every page of a post's reports while preserving the post filter", async ({ page }) => {
  await setup(page)
  const reads = await mockApi(
    page,
    "/admin/reports",
    (route) => {
      const params = new URL(route.request().url()).searchParams
      const filtered = params.get("postId") === "p-1"
      const first = params.get("page") === "1"
      const items = initial.map((row) => ({ ...row, reportCount: 3, pendingReportCount: 2 }))
      return {
        body: {
          items: filtered ? (first ? items.slice(0, 1) : items.slice(1)) : items,
          meta: { hasNextPage: filtered && first },
        },
      }
    },
    "GET"
  )
  const row = await open(page)
  await row.getByRole("button", { name: "Xem", exact: true }).click()
  const panel = page.getByRole("region", { name: "Báo cáo của bài viết", exact: true })
  await expect(panel.getByRole("listitem", { name: /Báo cáo của Người/ })).toHaveCount(3)
  expect(
    reads.some((request) => {
      const params = new URL(request.url).searchParams
      return params.get("postId") === "p-1" && params.get("page") === "2"
    })
  ).toBe(true)
})
