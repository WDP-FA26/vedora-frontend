import type { Page } from "@playwright/test"
import type { ApiNotification } from "../../features/notifications/schemas"
import { signInAs } from "../helpers/auth"
import { mockApi } from "../helpers/api"
import { test, expect } from "../helpers/test"

const notification = (type: ApiNotification["type"], id: string = type): ApiNotification => ({
  id,
  type,
  actor: null,
  postId: "p-1",
  postType: "POST",
  commentId: null,
  reason: "HARASSMENT",
  note: "Nội dung bình luận",
  readAt: null,
  createdAt: "2026-11-24T08:00:00Z",
})

async function setup(page: Page, rows: ApiNotification[]) {
  await mockApi(page, "/notifications", { body: { items: rows, nextCursor: null } }, "GET")
  await mockApi(page, "/notifications/unread-count", { body: { unreadCount: rows.length } }, "GET")
}

async function streamFixture(page: Page) {
  await page.addInitScript(() => {
    const original = window.fetch.bind(window)
    window.fetch = async (input, init) => {
      const url = typeof input === "string" ? input : input instanceof URL ? input.href : input.url
      if (!url.endsWith("/notifications/sse")) return original(input, init)
      const stream = new ReadableStream<Uint8Array>({
        start(controller) {
          const emit = (data: unknown) =>
            controller.enqueue(
              new TextEncoder().encode(`event: notification\ndata: ${JSON.stringify(data)}\n\n`)
            )
          ;(window as unknown as { emitCommentNotice: typeof emit }).emitCommentNotice = emit
          init?.signal?.addEventListener("abort", () => controller.close(), { once: true })
        },
      })
      return new Response(stream, { headers: { "content-type": "text/event-stream" } })
    }
  })
}
async function emit(page: Page, event: ApiNotification) {
  await page.waitForFunction(
    () =>
      typeof (window as unknown as { emitCommentNotice?: unknown }).emitCommentNotice === "function"
  )
  await page.evaluate((event) => {
    ;(window as unknown as { emitCommentNotice: (event: unknown) => void }).emitCommentNotice(event)
  }, event)
}

test.beforeEach(async ({ context }) => {
  await signInAs(context, "member")
})

test("renders admin and post-owner removals as different notifications", async ({ page }) => {
  await setup(page, [
    notification("COMMENT_REMOVED"),
    notification("COMMENT_REMOVED_BY_POST_OWNER"),
  ])
  await page.goto("/home/notifications")
  await expect(page.getByRole("link", { name: /quản trị viên gỡ bỏ/ })).toContainText(
    "quấy rối, công kích người khác"
  )
  await expect(page.getByRole("link", { name: /chủ bài viết xóa/ })).toBeVisible()
  await expect(page.getByText(/kháng cáo/i)).toHaveCount(0)
})

test("collateral reply notices explain the root deletion without accusing the reply author", async ({
  page,
}) => {
  await setup(page, [notification("COMMENT_THREAD_REMOVED")])
  await page.goto("/home/notifications")
  const item = page.getByRole("link", { name: /Phản hồi.*bình luận gốc/ })
  await expect(item).toBeVisible()
  await expect(item).not.toContainText("vi phạm")
  await expect(item).not.toContainText("quấy rối")
})

test("reporters receive resolved and dismissed outcomes with the comment excerpt", async ({
  page,
}) => {
  await setup(page, [
    notification("COMMENT_REPORT_RESOLVED"),
    notification("COMMENT_REPORT_DISMISSED"),
  ])
  await page.goto("/home/notifications")
  await expect(page.getByRole("link", { name: /mà bạn báo cáo đã bị xóa/ })).toContainText(
    "Nội dung bình luận"
  )
  await expect(page.getByRole("link", { name: /bỏ qua báo cáo của bạn/ })).toContainText(
    "Nội dung bình luận"
  )
})

test("removal notices open the post without a deleted-comment anchor", async ({ page }) => {
  await setup(page, [notification("COMMENT_REMOVED"), notification("COMMENT_REPORT_RESOLVED")])
  await page.goto("/home/notifications")
  await expect(page.getByRole("link", { name: /quản trị viên gỡ bỏ/ })).toHaveAttribute(
    "href",
    "/posts/p-1"
  )
  await expect(page.getByRole("link", { name: /mà bạn báo cáo đã bị xóa/ })).toHaveAttribute(
    "href",
    "/posts/p-1"
  )
})

test("notices without an available post stay on the notifications page", async ({ page }) => {
  await setup(page, [{ ...notification("COMMENT_REPORT_RESOLVED"), postId: null }])
  await page.goto("/home/notifications")
  await expect(page.getByRole("link", { name: /mà bạn báo cáo đã bị xóa/ })).toHaveAttribute(
    "href",
    "/home/notifications"
  )
})

test("comment notifications retain unread markers and mark-read behavior", async ({ page }) => {
  const row = notification("COMMENT_REMOVED", "comment-notice-1")
  await setup(page, [row])
  const reads = await mockApi(page, "/notifications/comment-notice-1/read", { status: 204 }, "POST")
  await page.goto("/home/notifications")
  await expect(page.locator('span[aria-label="Chưa đọc"]')).toHaveCount(1)
  await page.getByRole("link", { name: /quản trị viên gỡ bỏ/ }).click()
  await expect.poll(() => reads.length).toBe(1)
})

test("live comment removals show a single toast and increment the unread badge once", async ({
  page,
}) => {
  await streamFixture(page)
  await setup(page, [])
  await page.goto("/home")
  const row = notification("COMMENT_REMOVED", "live-comment-notice")
  await emit(page, row)
  await expect(page.locator('[data-slot="toast-description"]')).toContainText("quản trị viên gỡ bỏ")
  await expect(page.getByRole("status", { name: "1 thông báo chưa đọc" })).toBeVisible()
  await emit(page, row)
  await expect(page.locator('[data-slot="toast-description"]')).toHaveCount(1)
  await expect(page.getByRole("status", { name: "1 thông báo chưa đọc" })).toBeVisible()
})

test("live report outcomes update the notification list without duplicating a toast on that page", async ({
  page,
}) => {
  await streamFixture(page)
  await setup(page, [])
  await page.goto("/home/notifications")
  await expect(page.getByText("Chưa có thông báo", { exact: true })).toBeVisible()
  const row = notification("COMMENT_REPORT_DISMISSED", "live-report-result")
  await emit(page, row)
  await expect(page.getByRole("link", { name: /bỏ qua báo cáo của bạn/ })).toBeVisible()
  await expect(page.locator('[data-slot="toast-description"]')).toHaveCount(0)
  await emit(page, row)
  await expect(page.getByRole("link", { name: /bỏ qua báo cáo của bạn/ })).toHaveCount(1)
})
