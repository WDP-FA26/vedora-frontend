import type { Page } from "@playwright/test"

import { API_URL } from "../fixtures/data.mjs"
import { emptyMealPlanOf, MOCK_WEEK } from "../fixtures/data-extra.mjs"
import { signInAs } from "../helpers/auth"
import { mockApi } from "../helpers/api"
import { test, expect } from "../helpers/test"

const THREAD_ID = "0b6d3f1e-7c2a-4e9b-8d1f-2a3b4c5d6e7f"
const NOW = "2026-11-18T08:00:00.000Z"
const REASON = "Cần tìm giá tempeh ở Hà Nội, tài liệu Vedora chưa có."

const thread = {
  id: THREAD_ID,
  title: "Tempeh giá bao nhiêu?",
  messageCount: 2,
  lastMessagePreview: "Tempeh giá bao nhiêu?",
  lastMessageAt: NOW,
  createdAt: NOW,
  updatedAt: NOW,
}

const threadDetail = {
  ...thread,
  proposalStatuses: {},
  messages: [
    { id: "m-1", role: "user", text: "Tempeh giá bao nhiêu?", parts: [], createdAt: NOW },
    {
      id: "m-2",
      role: "assistant",
      text: "",
      parts: [
        { type: "step-start" },
        { type: "tool-requestWebSearch", toolCallId: "call-web", state: "input-available", input: { reason: REASON } },
      ],
      createdAt: NOW,
    },
  ],
}

const ANSWER = "Theo một số trang bán hàng, gói 250g khoảng 45.000–80.000đ. Thông tin từ web có thể sai, bạn kiểm tra lại nhé."

function webAnswerStream() {
  const chunks = [
    { type: "start", messageId: "m-3" },
    { type: "start-step" },
    { type: "source-url", sourceId: "https://example.com/tempeh", url: "https://example.com/tempeh", title: "Tempeh đậu nành 250g" },
    { type: "source-url", sourceId: "https://shop.example.vn/tempeh", url: "https://shop.example.vn/tempeh", title: "" },
    { type: "text-start", id: "t-1" },
    { type: "text-delta", id: "t-1", delta: ANSWER },
    { type: "text-end", id: "t-1" },
    { type: "finish-step" },
    { type: "finish" },
  ]
  return `${chunks.map((chunk) => `data: ${JSON.stringify(chunk)}\n\n`).join("")}data: [DONE]\n\n`
}

async function mockChat(page: Page) {
  const bodies: unknown[] = []
  await page.route(`${API_URL}/meal-plan/chat`, async (route) => {
    const request = route.request()
    if (request.method() === "OPTIONS") {
      return route.fulfill({
        status: 204,
        headers: {
          "access-control-allow-origin": "*",
          "access-control-allow-headers": "authorization, content-type",
          "access-control-allow-methods": "POST,OPTIONS",
        },
      })
    }
    bodies.push(request.postDataJSON())
    await route.fulfill({
      status: 200,
      headers: {
        "access-control-allow-origin": "*",
        "content-type": "text/event-stream",
        "x-vercel-ai-ui-message-stream": "v1",
      },
      body: webAnswerStream(),
    })
  })
  return bodies
}

test.describe("meal planner web search", () => {
  test.beforeEach(async ({ context, page }) => {
    await signInAs(context, "member")
    await mockApi(page, "/meal-plan/chat/threads", {
      body: {
        items: [thread],
        meta: { page: 1, limit: 50, totalItems: 1, totalPages: 1, hasNextPage: false, hasPreviousPage: false },
      },
    }, "GET")
    await mockApi(page, `/meal-plan/chat/threads/${THREAD_ID}`, { body: threadDetail }, "GET")
    await mockApi(page, `/meal-plan/chat/threads/${THREAD_ID}`, { body: threadDetail }, "PATCH")
    await mockApi(
      page,
      "/meal-plan",
      (route) => ({ body: emptyMealPlanOf(new URL(route.request().url()).searchParams.get("weekStart") ?? MOCK_WEEK) }),
      "GET"
    )
  })

  test("asks with a warning, then searches only after the user allows it", async ({ page }) => {
    const chats = await mockChat(page)
    await page.goto("/meal-planner")

    const consent = page.getByRole("region", { name: "Xin phép tìm trên web" })
    await expect(consent).toContainText(REASON)
    await expect(consent).toContainText("có thể sai")
    expect(chats).toHaveLength(0)

    await consent.getByRole("button", { name: "Cho phép trong đoạn chat này" }).click()

    await expect(page.getByText(ANSWER)).toBeVisible()
    await expect(consent).toHaveCount(0)
    expect(chats).toHaveLength(1)
    expect(chats[0]).toMatchObject({ threadId: THREAD_ID, allowWebSearch: true })
    await expect(page.getByText("Bạn đã cho phép tìm trên web")).toBeVisible()
    await expect(page.getByText("Được tìm trên web")).toBeVisible()

    await page.getByRole("button", { name: "Nguồn · 2" }).hover()
    const sources = page.getByRole("dialog", { name: "Nguồn trợ lý đã tham khảo" })
    await expect(sources.getByRole("region", { name: "Trên web" })).toContainText("có thể sai")
    const link = sources.getByRole("link", { name: "Tempeh đậu nành 250g" })
    await expect(link).toHaveAttribute("href", "https://example.com/tempeh")
    await expect(link).toHaveAttribute("target", "_blank")
    await expect(sources.getByRole("link", { name: "shop.example.vn" })).toBeVisible()
  })

  test("declining sends the next turn without web search", async ({ page }) => {
    const chats = await mockChat(page)
    await page.goto("/meal-planner")

    const consent = page.getByRole("region", { name: "Xin phép tìm trên web" })
    await consent.getByRole("button", { name: "Không" }).click()

    await expect.poll(() => chats.length).toBe(1)
    expect(chats[0]).toMatchObject({ allowWebSearch: false })
    await expect(page.getByText("Bạn đã không cho phép tìm trên web")).toBeVisible()
    await expect(page.getByText("Được tìm trên web")).toHaveCount(0)
  })
})
