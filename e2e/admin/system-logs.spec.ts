import type { Page } from "@playwright/test"
import type { SystemLog } from "../../features/admin/system-logs/schema"
import { signInAs } from "../helpers/auth"
import { mockApi } from "../helpers/api"
import { test, expect, appAlerts } from "../helpers/test"

const rows: SystemLog[] = Array.from({ length: 45 }, (_, i) => ({
  id: "log-" + i,
  requestId: "request-" + i,
  actorId: i % 2 === 0 ? "admin-a" : "admin-b",
  actorUsername: i % 2 === 0 ? "admin.bao" : "admin.an",
  action: "POST /admin/comment-reports/:id/review",
  actionLabel: i === 44 ? "Xử lý báo cáo cuối danh sách" : "Xử lý báo cáo bình luận " + i,
  resourceType: i % 3 === 0 ? "USER" : "COMMENT_REPORT",
  targetId: "target-" + i,
  method: "POST",
  route: "/admin/comment-reports/:id/review",
  outcome: i % 3 === 0 ? "FAILURE" : "SUCCESS",
  httpStatus: i % 3 === 0 ? 409 : 201,
  errorCode: i % 3 === 0 ? "CONFLICT" : null,
  durationMs: 18,
  decision: "REMOVE",
  targetRole: null,
  targetStatus: null,
  createdAt: "2026-11-24T10:00:00.000Z",
}))

async function setup(page: Page, initial = rows) {
  const state = { status: 200, detailStatus: 200, delay: 0 }
  const reads = await mockApi(
    page,
    "/admin/system-logs",
    async (route) => {
      if (state.delay) await new Promise((resolve) => setTimeout(resolve, state.delay))
      if (state.status !== 200) return { status: state.status, body: { message: "Fixture error" } }
      const params = new URL(route.request().url()).searchParams
      const pageNumber = Number(params.get("page") ?? 1)
      const limit = Number(params.get("limit") ?? 20)
      const filtered = initial.filter(
        (row) =>
          (!params.get("outcome") || row.outcome === params.get("outcome")) &&
          (!params.get("resourceType") || row.resourceType === params.get("resourceType")) &&
          (!params.get("actorId") || row.actorId === params.get("actorId")) &&
          (!params.get("q") ||
            row.actionLabel.toLowerCase().includes(params.get("q")!.toLowerCase()))
      )
      return {
        body: {
          items: filtered.slice((pageNumber - 1) * limit, pageNumber * limit),
          meta: {
            page: pageNumber,
            limit,
            totalItems: filtered.length,
            totalPages: Math.ceil(filtered.length / limit),
            hasNextPage: pageNumber * limit < filtered.length,
            hasPreviousPage: pageNumber > 1,
          },
        },
      }
    },
    "GET"
  )
  for (const row of initial) {
    await mockApi(
      page,
      "/admin/system-logs/" + row.id,
      () =>
        state.detailStatus === 200
          ? { body: row }
          : { status: state.detailStatus, body: { message: "Fixture error" } },
      "GET"
    )
  }
  return { reads, state }
}
const open = async (page: Page) => {
  await page.goto("/admin/system-logs")
  await expect(page.getByRole("table")).toBeVisible()
}

test.beforeEach(async ({ context }) => {
  await signInAs(context, "admin")
})

test("uses the shared admin table, sidebar and read-only detail sheet", async ({ page }) => {
  const { reads } = await setup(page)
  await open(page)
  await expect(
    page.getByRole("link", { name: "Nhật ký hệ thống", exact: true }).first()
  ).toHaveAttribute("href", "/admin/system-logs")
  for (const name of ["Thời gian", "Người thao tác", "Thao tác", "Đối tượng", "Kết quả"])
    await expect(page.getByRole("columnheader", { name, exact: true })).toBeVisible()
  await page.screenshot({
    path: test.info().outputPath("system-logs-desktop.png"),
    fullPage: true,
    animations: "disabled",
  })
  await page.getByRole("button", { name: "Xem nhật ký request-0", exact: true }).click()
  const sheet = page.getByRole("dialog", { name: "Chi tiết nhật ký" })
  await expect(sheet.getByText("CONFLICT", { exact: true })).toBeVisible()
  await expect(sheet.getByText("target-0", { exact: true })).toBeVisible()
  await expect(sheet.getByText("request-0", { exact: true })).toBeVisible()
  await expect(
    sheet.getByText("POST /admin/comment-reports/:id/review", { exact: true })
  ).toBeVisible()
  await expect(sheet.getByRole("button", { name: /Xóa|Lưu thay đổi|Sửa/ })).toHaveCount(0)
  expect(reads.every((request) => request.method === "GET")).toBe(true)
  await page.screenshot({
    path: test.info().outputPath("system-log-sheet-desktop.png"),
    fullPage: true,
    animations: "disabled",
  })
})

test("paginates server results without slicing the second page again", async ({ page }) => {
  const { reads, state } = await setup(page)
  await open(page)
  await expect(page.getByText("45 dòng", { exact: true })).toBeVisible()
  await expect(page.getByText("Trang 1 / 3", { exact: true })).toBeVisible()
  state.delay = 400
  await page.getByRole("button", { name: "Trang sau", exact: true }).click()
  await expect(page.getByRole("button", { name: "Trang sau", exact: true })).toBeDisabled()
  await expect(
    page.getByRole("button", { name: "Xem nhật ký request-20", exact: true })
  ).toBeVisible()
  await expect(page.getByRole("row")).toHaveCount(21)
  expect(reads.some((r) => new URL(r.url).searchParams.get("page") === "2")).toBe(true)
  await page.getByRole("button", { name: "Trang cuối", exact: true }).click()
  await expect(
    page.getByRole("button", { name: "Xem nhật ký request-44", exact: true })
  ).toBeVisible()
  await expect(page.getByRole("row")).toHaveCount(6)
  const sizes = page.getByRole("combobox", { name: "Số dòng mỗi trang" })
  await expect(sizes.getByRole("option", { name: "100", exact: true })).toHaveCount(0)
  await sizes.selectOption("50")
  await expect(page.getByRole("row")).toHaveCount(46)
  await expect(page.getByText("Trang 1 / 1", { exact: true })).toBeVisible()
})

test("filters all history on the server and resets pagination", async ({ page }) => {
  const { reads } = await setup(page)
  await open(page)
  await page.getByRole("button", { name: "Trang sau", exact: true }).click()
  await expect(
    page.getByRole("button", { name: "Xem nhật ký request-20", exact: true })
  ).toBeVisible()
  await page.getByRole("searchbox").fill("cuối danh sách")
  await expect(page.getByRole("row")).toHaveCount(2)
  await expect(
    page.getByRole("button", { name: "Xem nhật ký request-44", exact: true })
  ).toBeVisible()
  await expect(page.getByText("Trang 1 / 1", { exact: true })).toBeVisible()
  expect(reads.some((r) => new URL(r.url).searchParams.get("q") === "cuối danh sách")).toBe(true)
  await page.getByRole("button", { name: "Xóa bộ lọc", exact: true }).click()
  await page.getByRole("combobox", { name: "Lọc kết quả" }).selectOption("FAILURE")
  await page.getByRole("combobox", { name: "Lọc đối tượng" }).selectOption("USER")
  await expect(page.getByText("15 dòng", { exact: true })).toBeVisible()
  expect(reads.some((r) => new URL(r.url).searchParams.get("outcome") === "FAILURE")).toBe(true)
})

test("filters by the actor from details and can reset the filter", async ({ page }) => {
  const { reads } = await setup(page)
  await open(page)
  await page.getByRole("button", { name: "Xem nhật ký request-0", exact: true }).click()
  await page.getByRole("button", { name: "Lọc người thao tác này", exact: true }).click()
  await expect(page.getByText("Đang lọc người thao tác: @admin.bao")).toBeVisible()
  await expect(page.getByText("23 dòng", { exact: true })).toBeVisible()
  expect(reads.some((r) => new URL(r.url).searchParams.get("actorId") === "admin-a")).toBe(true)
  await page.getByRole("button", { name: "Xóa bộ lọc", exact: true }).click()
  await expect(page.getByText("45 dòng", { exact: true })).toBeVisible()
})

test("converts date boundaries to timezone-aware timestamps and rejects reversed dates", async ({
  page,
}) => {
  const { reads } = await setup(page)
  await open(page)
  await page.getByLabel("Từ ngày", { exact: true }).fill("2026-11-24")
  await page.getByLabel("Đến ngày", { exact: true }).fill("2026-11-24")
  await expect
    .poll(() =>
      reads.some((r) => {
        const params = new URL(r.url).searchParams
        return params.get("from")?.endsWith("Z") && params.get("to")?.endsWith("Z")
      })
    )
    .toBe(true)
  await page.getByLabel("Từ ngày", { exact: true }).fill("2026-11-25")
  await expect(appAlerts(page)).toContainText("Từ ngày phải trước hoặc bằng đến ngày")
  await expect(page.getByRole("table")).toHaveCount(0)
  await expect(page.getByRole("button", { name: "Làm mới", exact: true })).toBeDisabled()
})

test("handles empty, forbidden, retry and missing detail states", async ({ page }) => {
  const { state } = await setup(page, [rows[0]])
  state.status = 403
  await page.goto("/admin/system-logs")
  await expect(appAlerts(page)).toContainText("Bạn không có quyền xem nhật ký hệ thống")
  state.status = 200
  await page.getByRole("button", { name: "Thử lại", exact: true }).click()
  await expect(page.getByRole("table")).toBeVisible()
  state.detailStatus = 404
  await page.getByRole("button", { name: "Xem nhật ký request-0", exact: true }).click()
  await expect(appAlerts(page)).toContainText("Không tìm thấy hoặc không có quyền xem nhật ký này")
  await page.keyboard.press("Escape")
  await page.getByRole("searchbox").fill("không khớp")
  await expect(page.getByText("Không có nhật ký phù hợp.", { exact: true })).toBeVisible()
})

test("mobile table and details stay within the viewport", async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 800 })
  await setup(page, [rows[0]])
  await open(page)
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
  const openButton = page.getByRole("button", { name: "Xem nhật ký request-0", exact: true })
  const bounds = await openButton.boundingBox()
  expect(bounds && bounds.x + bounds.width <= 360).toBe(true)
  await page.screenshot({
    path: test.info().outputPath("system-logs-mobile.png"),
    fullPage: true,
    animations: "disabled",
  })
  await page.getByRole("button", { name: "Xem nhật ký request-0", exact: true }).click()
  await expect(page.getByRole("dialog", { name: "Chi tiết nhật ký" })).toBeVisible()
  await page.screenshot({
    path: test.info().outputPath("system-log-sheet-mobile.png"),
    fullPage: true,
    animations: "disabled",
  })
})

test("members cannot open the admin history route", async ({ context, page }) => {
  await signInAs(context, "member")
  await page.goto("/admin/system-logs")
  await expect(page).toHaveURL(/\/home(?:\?|$)/)
  await expect(page.getByRole("region", { name: "Nhật ký hệ thống", exact: true })).toHaveCount(0)
})
