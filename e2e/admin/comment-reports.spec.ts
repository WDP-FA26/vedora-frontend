import type { Page } from "@playwright/test"
import type { AdminCommentReport } from "../../features/admin/comment-reports/schema"
import { signInAs } from "../helpers/auth"
import { mockApi } from "../helpers/api"
import { test, expect, appAlerts } from "../helpers/test"

const author = { id: "u-chef", username: "bepchay", fullName: "Lê Bếp Chay", avatarUrl: null }
const initial: AdminCommentReport = {
  id: "cr-1",
  postId: "p-1",
  commentId: "comment-1",
  reason: "HARASSMENT",
  details: "Chi tiết từ người báo cáo",
  status: "PENDING",
  createdAt: "2026-11-23T10:00:00Z",
  reviewedAt: null,
  reviewedById: null,
  action: null,
  reporter: { ...author, id: "u-member", fullName: "Nguyễn Minh Anh" },
  postAvailable: true,
  comment: {
    id: "comment-1",
    parentId: null,
    body: "Nội dung gốc lúc báo cáo",
    author,
    currentBody: "Nội dung đã sửa",
    isAvailable: true,
    replyCount: 2,
  },
}

async function setup(page: Page, overrides: Partial<typeof initial> = {}) {
  const state = { row: { ...initial, ...overrides }, failing: false }
  const reads = await mockApi(
    page,
    "/admin/comment-reports",
    (route) => {
      const status = new URL(route.request().url()).searchParams.get("status")
      const rows = !status || status === state.row.status ? [state.row] : []
      return {
        body: {
          items: rows,
          meta: { page: 1, totalItems: rows.length, hasNextPage: false, hasPreviousPage: false },
        },
      }
    },
    "GET"
  )
  const writes = await mockApi(
    page,
    "/admin/comment-reports/cr-1/review",
    (route) => {
      if (state.failing) return { status: 500, body: { message: "Failed" } }
      const { action } = route.request().postDataJSON() as { action: string }
      state.row = { ...state.row, status: action === "DISMISS" ? "DISMISSED" : "RESOLVED" }
      return {
        body: {
          ...state.row,
          action: action === "DISMISS" ? "DISMISSED" : "REMOVED",
          reviewedById: "u-admin",
          reviewedAt: "2026-11-24T10:00:00Z",
        },
      }
    },
    "POST"
  )
  return { state, reads, writes }
}
async function openQueue(page: Page) {
  await page.goto("/admin/reports")
  await page.getByRole("tab", { name: "Bình luận", exact: true }).click()
  await expect(page.getByRole("heading", { name: "Báo cáo bình luận" })).toBeVisible()
}

test.beforeEach(async ({ context }) => {
  await signInAs(context, "admin")
})

test("admin sees original evidence, edited text, reporter and a link to the comment", async ({
  page,
}) => {
  await setup(page)
  await openQueue(page)
  await expect(page.getByText(initial.comment.body, { exact: true })).toBeVisible()
  await expect(page.getByText("Nội dung đã sửa", { exact: true })).toBeVisible()
  await expect(page.getByText(/Người báo cáo: Nguyễn Minh Anh/)).toBeVisible()
  await expect(page.getByRole("link", { name: "Xem trong bài viết" })).toHaveAttribute(
    "href",
    "/posts/p-1?comment=comment-1#comment-comment-1"
  )
})

test("dismissing keeps content and refreshes the pending queue", async ({ page }) => {
  const { writes } = await setup(page)
  await openQueue(page)
  await page.getByRole("button", { name: "Bỏ qua báo cáo" }).click()
  await expect(page.getByText("Không có báo cáo bình luận trong mục này.")).toBeVisible()
  expect(writes).toHaveLength(1)
  expect(writes[0].body).toEqual({ action: "DISMISS" })
  await page.getByRole("combobox", { name: "Trạng thái" }).selectOption("DISMISSED")
  await expect(page.getByText(initial.comment.body, { exact: true })).toBeVisible()
  await expect(page.getByRole("button", { name: "Gỡ bình luận", exact: true })).toHaveCount(0)
})

test("root removal requires confirmation explaining the cascade", async ({ page }) => {
  const { writes } = await setup(page)
  await openQueue(page)
  await page.getByRole("button", { name: "Gỡ bình luận", exact: true }).click()
  const dialog = page.getByRole("alertdialog")
  await expect(dialog).toContainText("tất cả phản hồi")
  await expect(dialog).toContainText("2 phản hồi")
  await dialog.getByRole("button", { name: "Hủy", exact: true }).click()
  expect(writes).toHaveLength(0)
  await page.getByRole("button", { name: "Gỡ bình luận", exact: true }).click()
  await page.getByRole("alertdialog").getByRole("button", { name: "Xác nhận gỡ" }).click()
  await expect(page.getByText("Không có báo cáo bình luận trong mục này.")).toBeVisible()
  expect(writes[0].body).toEqual({ action: "REMOVE" })
})

test("reply removal explains that sibling replies remain", async ({ page }) => {
  await setup(page, { comment: { ...initial.comment, parentId: "root-1", replyCount: 0 } })
  await openQueue(page)
  await page.getByRole("button", { name: "Gỡ bình luận", exact: true }).click()
  await expect(page.getByRole("alertdialog")).toContainText("Các phản hồi khác được giữ lại")
})

test("a failed removal keeps the confirmation open and can be retried", async ({ page }) => {
  const { state, writes } = await setup(page)
  state.failing = true
  await openQueue(page)
  await page.getByRole("button", { name: "Gỡ bình luận", exact: true }).click()
  const dialog = page.getByRole("alertdialog")
  await dialog.getByRole("button", { name: "Xác nhận gỡ" }).click()
  await expect(dialog.getByRole("alert")).toContainText("Không xử lý được báo cáo")
  state.failing = false
  await dialog.getByRole("button", { name: "Xác nhận gỡ" }).click()
  await expect(dialog).toHaveCount(0)
  expect(writes).toHaveLength(2)
})

test("evidence remains readable for deleted content without a broken post link", async ({
  page,
}) => {
  await setup(page, {
    postAvailable: false,
    reporter: null,
    comment: { ...initial.comment, currentBody: null, isAvailable: false },
  })
  await openQueue(page)
  await expect(page.getByText(initial.comment.body, { exact: true })).toBeVisible()
  await expect(page.getByText(/Tài khoản không còn tồn tại/)).toBeVisible()
  await expect(page.getByRole("link", { name: "Xem trong bài viết" })).toHaveCount(0)
  await page.getByRole("button", { name: "Xác nhận đã xóa" }).click()
  await expect(page.getByRole("alertdialog")).toContainText("giữ bằng chứng")
})

test("API permission errors are visible", async ({ page }) => {
  await mockApi(page, "/admin/comment-reports", { status: 403, body: { message: "Forbidden" } })
  await openQueue(page)
  await expect(appAlerts(page)).toContainText("không có quyền")
})

test("a conflicting admin decision refreshes the queue and reports the conflict", async ({ page }) => {
  const { state } = await setup(page)
  await mockApi(page, "/admin/comment-reports/cr-1/review", () => {
    state.row.status = "RESOLVED"
    return { status: 409, body: { code: "CONFLICT", message: "Already reviewed" } }
  }, "POST")
  await openQueue(page)
  await page.getByRole("button", { name: "Gỡ bình luận", exact: true }).click()
  await page.getByRole("alertdialog").getByRole("button", { name: "Xác nhận gỡ" }).click()
  await expect(page.getByRole("alertdialog")).toHaveCount(0)
  await expect(appAlerts(page)).toContainText("admin khác xử lý")
  await expect(page.getByText("Không có báo cáo bình luận trong mục này.")).toBeVisible()
})

test("pagination uses server pages and changing the status resets to page one", async ({ page }) => {
  const reads = await mockApi(page, "/admin/comment-reports", (route) => {
    const pageNumber = Number(new URL(route.request().url()).searchParams.get("page"))
    return { body: { items: [{ ...initial, id: `cr-${pageNumber}`, details: `Trang dữ liệu ${pageNumber}` }],
      meta: { page: pageNumber, totalItems: 21, hasNextPage: pageNumber === 1, hasPreviousPage: pageNumber > 1 } } }
  }, "GET")
  await openQueue(page)
  await expect(page.getByText("Trang dữ liệu 1", { exact: true })).toBeVisible()
  await page.getByRole("button", { name: "Trang sau" }).click()
  await expect(page.getByText("Trang dữ liệu 2", { exact: true })).toBeVisible()
  await page.getByRole("combobox", { name: "Trạng thái" }).selectOption("DISMISSED")
  await expect(page.getByText("Trang dữ liệu 1", { exact: true })).toBeVisible()
  expect(new URL(reads.at(-1)!.url).searchParams.get("page")).toBe("1")
  expect(new URL(reads.at(-1)!.url).searchParams.get("status")).toBe("DISMISSED")
})
