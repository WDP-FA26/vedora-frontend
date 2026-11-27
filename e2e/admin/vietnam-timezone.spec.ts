import { signInAs } from "../helpers/auth"
import { mockApi } from "../helpers/api"
import { test, expect } from "../helpers/test"

for (const timezoneId of ["UTC", "America/Los_Angeles", "Asia/Tokyo", "Asia/Ho_Chi_Minh"]) {
  test.describe(timezoneId, () => {
    test.use({ timezoneId })

    test("shows Vietnam timestamps and sends Vietnam day boundaries to the API", async ({ page, context }) => {
      await signInAs(context, "admin")
      const requests = await mockApi(page, "/admin/system-logs", {
        body: {
          items: [{
            id: "timezone-log",
            requestId: "timezone-request",
            actorId: "admin-a",
            actorUsername: "admin.bao",
            action: "POST /admin/comment-reports/:id/review",
            actionLabel: "Kiểm tra thời gian Việt Nam",
            resourceType: "COMMENT_REPORT",
            targetId: "report-a",
            method: "POST",
            route: "/admin/comment-reports/:id/review",
            outcome: "SUCCESS",
            httpStatus: 201,
            errorCode: null,
            durationMs: 18,
            decision: "REMOVE",
            targetRole: null,
            targetStatus: null,
            createdAt: "2026-12-31T17:30:00.000Z",
          }],
          meta: { page: 1, limit: 20, totalItems: 1, totalPages: 1, hasNextPage: false, hasPreviousPage: false },
        },
      }, "GET")

      await page.goto("/admin/system-logs")
      const table = page.getByRole("table")
      await expect(table).toContainText("00:30")
      await expect(table).toContainText("1 tháng 1, 2027")
      await page.getByLabel("Từ ngày", { exact: true }).fill("2027-01-01")
      await page.getByLabel("Đến ngày", { exact: true }).fill("2027-01-01")
      await expect.poll(() => requests.some(({ url }) => {
        const params = new URL(url).searchParams
        return params.get("from") === "2026-12-31T17:00:00.000Z" &&
          params.get("to") === "2027-01-01T16:59:59.999Z"
      })).toBe(true)
    })
  })
}
