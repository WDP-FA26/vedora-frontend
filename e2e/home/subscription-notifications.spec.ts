import type { Page } from "@playwright/test"
import type { ApiNotification } from "../../features/notifications/schemas"
import { signInAs } from "../helpers/auth"
import { mockApi } from "../helpers/api"
import { test, expect } from "../helpers/test"
import { billingOverview } from "../fixtures/data-extra.mjs"

const notice = (id = "subscription-notice-1", plan = "Pro"): ApiNotification => ({
  id, type: "SUBSCRIPTION_GRANTED", actor: null, postId: null, postType: null, commentId: null,
  reason: null, note: `Bạn đã được quản trị viên cấp gói ${plan} trong 30 ngày, có hiệu lực đến 07:00 GMT+7 28/12/2026. Xem quyền lợi tại Gói của bạn.`,
  readAt: null, createdAt: "2026-11-28T00:00:00Z",
})
async function setup(page: Page, rows: ApiNotification[] = []) {
  await mockApi(page, "/notifications", { body: { items: rows, nextCursor: null } }, "GET")
  await mockApi(page, "/notifications/unread-count", { body: { unreadCount: rows.length } }, "GET")
}
async function stream(page: Page) {
  await page.addInitScript(() => {
    const original = window.fetch.bind(window)
    window.fetch = async (input, init) => {
      const url = typeof input === "string" ? input : input instanceof URL ? input.href : input.url
      if (!url.endsWith("/notifications/sse")) return original(input, init)
      const stream = new ReadableStream<Uint8Array>({ start(controller) {
        const emit = (data: unknown) => controller.enqueue(new TextEncoder().encode(`event: notification\ndata: ${JSON.stringify(data)}\n\n`))
        Object.assign(window, { emitSubscriptionNotice: emit })
        init?.signal?.addEventListener("abort", () => controller.close(), { once: true })
      } })
      return new Response(stream, { headers: { "content-type": "text/event-stream" } })
    }
  })
}
async function emit(page: Page, event: ApiNotification) {
  await page.waitForFunction(() => "emitSubscriptionNotice" in window)
  await page.evaluate(event => {
    const emit: unknown = Reflect.get(window, "emitSubscriptionNotice")
    if (typeof emit !== "function") throw new Error("Stream fixture missing")
    emit(event)
  }, event)
}

test.beforeEach(async ({ context }) => { await signInAs(context, "member") })

test("shows Plus and Pro grant notifications with expiry and links to billing", async ({ page }) => {
  await setup(page, [notice(), notice("subscription-notice-2", "Plus")])
  await page.goto("/home/notifications")
  const pro = page.getByRole("link", { name: /cấp gói Pro trong 30 ngày/ })
  await expect(pro).toBeVisible()
  await expect(pro).toHaveAttribute("href", "/billing")
  await expect(pro).toContainText("28/12/2026")
  await expect(page.getByRole("link", { name: /cấp gói Plus trong 30 ngày/ })).toHaveAttribute("href", "/billing")
  await expect(page.locator('span[aria-label="Chưa đọc"]')).toHaveCount(2)
})

test("marks a grant notification as read when opening billing", async ({ page }) => {
  await setup(page, [notice()])
  const reads = await mockApi(page, "/notifications/subscription-notice-1/read", { status: 204 }, "POST")
  await page.goto("/home/notifications")
  await page.getByRole("link", { name: /cấp gói Pro trong 30 ngày/ }).click()
  await expect(page).toHaveURL(/\/billing$/)
  await expect.poll(() => reads.length).toBe(1)
})

test("delivers a live toast and unread badge only once for a repeated event", async ({ page }) => {
  await stream(page)
  await setup(page)
  await page.goto("/home")
  const event = notice("live-subscription")
  await emit(page, event)
  await expect(page.locator('[data-slot="toast-description"]')).toContainText("cấp gói Pro trong 30 ngày")
  await expect(page.getByRole("status", { name: "1 thông báo chưa đọc" })).toBeVisible()
  await emit(page, event)
  await expect(page.locator('[data-slot="toast-description"]')).toHaveCount(1)
  await expect(page.getByRole("status", { name: "1 thông báo chưa đọc" })).toBeVisible()
})

test("refreshes the open billing view when the subscription is granted", async ({ page }) => {
  await stream(page)
  await setup(page)
  let granted = false
  const reads = await mockApi(page, "/billing/me", () => ({ body: {
    ...billingOverview,
    membership: granted
      ? { planCode: "PRO", source: "ADMIN_GRANT", startsAt: "2026-11-28T00:00:00Z", expiresAt: "2026-12-28T00:00:00Z" }
      : { planCode: "FREE", startsAt: null, expiresAt: null },
    pendingPayment: null, recentPayments: [],
  } }), "GET")
  await page.goto("/billing")
  await expect(page.getByText("Gói của bạn · Miễn phí")).toBeVisible()
  const before = reads.length
  granted = true
  await emit(page, notice("billing-refresh-notice"))
  await expect(page.getByText("Gói của bạn · Pro")).toBeVisible()
  await expect(page.getByText("Gói được quản trị viên cấp.")).toBeVisible()
  expect(reads.length).toBeGreaterThan(before)
})

test("can render a grant notification without the optional note", async ({ page }) => {
  await setup(page, [{ ...notice(), note: null }])
  await page.goto("/home/notifications")
  await expect(page.getByRole("link", { name: /Bạn vừa được quản trị viên cấp gói/ })).toHaveAttribute("href", "/billing")
})
