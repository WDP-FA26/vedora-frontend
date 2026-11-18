import type { Page } from "@playwright/test"
import { CONVERSATION_ID } from "../fixtures/data-extra.mjs"
import { signInAs } from "../helpers/auth"
import { mockApi } from "../helpers/api"
import { test, expect } from "../helpers/test"

async function streamFixture(page: Page) {
  await page.addInitScript(() => {
    const original = window.fetch.bind(window)
    window.fetch = async (input, init) => {
      const url = typeof input === "string" ? input : input instanceof URL ? input.href : input.url
      if (!url.endsWith("/messaging/events")) return original(input, init)
      const stream = new ReadableStream<Uint8Array>({
        start(controller) {
          const emit = (type: string, data: unknown) =>
            controller.enqueue(
              new TextEncoder().encode(`event: ${type}\ndata: ${JSON.stringify(data)}\n\n`)
            )
          ;(window as unknown as { emitMessaging: typeof emit }).emitMessaging = emit
          emit("stream.ready", {})
          init?.signal?.addEventListener("abort", () => controller.close(), { once: true })
        },
      })
      return new Response(stream, { headers: { "content-type": "text/event-stream" } })
    }
  })
}

async function emit(page: Page, type: string) {
  await page.evaluate(
    ({ type, conversationId }) => {
      ;(
        window as unknown as { emitMessaging: (type: string, data: unknown) => void }
      ).emitMessaging(type, { conversationId, messageId: null, readerId: null, readSequence: null })
    },
    { type, conversationId: CONVERSATION_ID }
  )
}

test.beforeEach(async ({ context }) => {
  await signInAs(context, "member")
})

test("shows a global unread badge on desktop while viewing the feed", async ({ page }) => {
  await mockApi(page, "/messaging/unread-count", { body: { unreadCount: 27 } })
  await page.goto("/home")
  await expect(page.getByRole("status", { name: "27 tin nhắn chưa đọc" })).toHaveText("27")
  await expect(page.getByRole("link", { name: /Tin nhắn/ }).first()).toHaveAttribute(
    "href",
    "/home/messages"
  )
})

test("updates from live message/read/deletion events on another page without waiting for polling", async ({
  page,
}) => {
  await streamFixture(page)
  let count = 2
  await mockApi(page, "/messaging/unread-count", () => ({ body: { unreadCount: count } }))
  await page.goto("/home")
  await expect(page.getByRole("status", { name: "2 tin nhắn chưa đọc" })).toBeVisible()
  count = 5
  await emit(page, "message.created")
  await expect(page.getByRole("status", { name: "5 tin nhắn chưa đọc" })).toBeVisible({
    timeout: 3000,
  })
  count = 1
  await emit(page, "request.deleted")
  await expect(page.getByRole("status", { name: "1 tin nhắn chưa đọc" })).toBeVisible({
    timeout: 3000,
  })
  count = 0
  await emit(page, "conversation.read")
  await expect(page.getByRole("status", { name: /tin nhắn chưa đọc/ })).toHaveCount(0, {
    timeout: 3000,
  })
})

test("polls the total when the messaging stream is unavailable", async ({ page }) => {
  await streamFixture(page)
  let count = 1
  await mockApi(page, "/messaging/unread-count", () => ({ body: { unreadCount: count } }))
  await page.goto("/home")
  await expect(page.getByRole("status", { name: "1 tin nhắn chưa đọc" })).toBeVisible()
  await emit(page, "stream.unavailable")
  count = 3
  await expect(page.getByRole("status", { name: "3 tin nhắn chưa đọc" })).toBeVisible({
    timeout: 8000,
  })
})

test("refreshes the badge after reading a conversation locally", async ({ page }) => {
  await streamFixture(page)
  let count = 2
  await mockApi(page, "/messaging/unread-count", () => ({ body: { unreadCount: count } }))
  const read = await mockApi(
    page,
    `/messaging/conversations/${CONVERSATION_ID}/read`,
    () => {
      count = 0
      return { body: { conversationId: CONVERSATION_ID, readSequence: 2, unreadCount: 0 } }
    },
    "PUT"
  )
  await page.goto("/home")
  await expect(page.getByRole("status", { name: "2 tin nhắn chưa đọc" })).toBeVisible()
  await page.goto(`/home/messages?conversation=${CONVERSATION_ID}`)
  await expect.poll(() => read.length).toBeGreaterThan(0)
  await expect(page.getByRole("status", { name: /tin nhắn chưa đọc/ })).toHaveCount(0)
})

test("shows 99+ on mobile navigation and in the account drawer", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await mockApi(page, "/messaging/unread-count", { body: { unreadCount: 120 } })
  await page.goto("/home")
  await expect(page.getByRole("status", { name: "120 tin nhắn chưa đọc" })).toHaveText("99+")
  await page.screenshot({ path: "test-results/unread-badge-mobile.png", fullPage: true })
  await page.getByRole("button", { name: "Mở menu", exact: true }).click()
  await expect(
    page.getByRole("dialog").getByRole("status", { name: "120 tin nhắn chưa đọc" })
  ).toHaveText("99+")
})

test("hides the badge when there are no unread messages", async ({ page }) => {
  await mockApi(page, "/messaging/unread-count", { body: { unreadCount: 0 } })
  await page.goto("/home")
  await expect(page.getByRole("link", { name: "Tin nhắn", exact: true })).toBeVisible()
  await expect(page.getByRole("status", { name: /tin nhắn chưa đọc/ })).toHaveCount(0)
})
