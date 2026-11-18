import { emptyMealPlanOf, MOCK_NEXT_WEEK, MOCK_WEEK } from "../fixtures/data-extra.mjs"
import { signInAs } from "../helpers/auth"
import { mockApi } from "../helpers/api"
import { test, expect } from "../helpers/test"

const THREAD_ID = "6f1c2b8e-1d2a-4c3b-9e8f-0a1b2c3d4e5f"
const NOW = "2026-11-18T08:00:00.000Z"

/** A `tool-editDraft` output the planner made for `weekStart`: one new dinner on `day`. */
function draftPart(toolCallId: string, weekStart: string, day: string, title: string) {
  return {
    type: "tool-editDraft",
    toolCallId,
    state: "output-available",
    input: {},
    output: {
      weekStart,
      ok: true,
      problems: [],
      days: [
        {
          day,
          sections: [{ section: "DINNER", recipes: [{ id: `r-${toolCallId}`, title, tag: null }], previous: [] }],
        },
      ],
    },
  }
}

/** A saved conversation with one card for this week and one for next week. */
const thread = {
  id: THREAD_ID,
  title: "Thực đơn hai tuần",
  messageCount: 2,
  lastMessagePreview: "Đã tạo đề xuất thực đơn",
  lastMessageAt: NOW,
  createdAt: NOW,
  updatedAt: NOW,
}
const threadDetail = {
  ...thread,
  proposalStatuses: {},
  messages: [
    { id: "m-1", role: "user", text: "T6 này và T4 tuần sau ăn phở chay", parts: [], createdAt: NOW },
    {
      id: "m-2",
      role: "assistant",
      text: "Mình đã xếp xong, bạn bấm Áp dụng trên từng thẻ nhé.",
      parts: [
        { type: "text", text: "Mình đã xếp xong, bạn bấm Áp dụng trên từng thẻ nhé." },
        draftPart("call-this", MOCK_WEEK, "FRI", "Phở chay"),
        draftPart("call-next", MOCK_NEXT_WEEK, "WED", "Bún chay"),
      ],
      createdAt: NOW,
    },
  ],
}

test.describe("meal planner proposals", () => {
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

  test("shows one card per week and saves next week's card from the chat", async ({ page }) => {
    const saves = await mockApi(page, "/meal-plan/days", { body: emptyMealPlanOf(MOCK_NEXT_WEEK) }, "PUT")
    await page.goto("/meal-planner")

    const cards = page.getByRole("article", { name: "Đề xuất thực đơn" })
    await expect(cards).toHaveCount(2)
    const nextWeekCard = cards.filter({ hasText: "Tuần 23/11 – 29/11" })
    await expect(nextWeekCard).toContainText("Bún chay")
    await expect(cards.filter({ hasText: "Tuần 16/11 – 22/11" })).toContainText("đang xem trên lịch")

    await nextWeekCard.getByRole("button", { name: "Áp dụng" }).click()
    await expect(nextWeekCard).toContainText("Đã lưu vào thực đơn.")
    expect(saves).toHaveLength(1)
    expect(saves[0].body).toMatchObject({
      weekStart: MOCK_NEXT_WEEK,
      days: [{ day: "WED", dinner: ["r-call-next"] }],
    })
  })

  test("previews this week's card on the calendar without a way to apply it there", async ({ page }) => {
    await page.goto("/meal-planner")
    await expect(page.getByText("Trợ lý đề xuất thay đổi")).toBeVisible()
    await expect(page.getByRole("button", { name: "Xem thẻ đề xuất" })).toBeVisible()
    await expect(page.getByRole("button", { name: "Áp dụng vào bản nháp" })).toHaveCount(0)
    await expect(page.getByRole("button", { name: "Lưu thực đơn" })).toHaveCount(0)
  })

  test("dismissing a card drops that week's server draft", async ({ page }) => {
    const discards = await mockApi(page, "/meal-plan/draft", { status: 204 }, "DELETE")
    await page.goto("/meal-planner")

    const nextWeekCard = page.getByRole("article", { name: "Đề xuất thực đơn" }).filter({ hasText: "Tuần 23/11 – 29/11" })
    await nextWeekCard.getByRole("button", { name: "Bỏ đề xuất" }).click()
    await expect(nextWeekCard).toContainText("Đã bỏ đề xuất.")
    await expect.poll(() => discards.length).toBe(1)
    expect(new URL(discards[0].url).searchParams.get("weekStart")).toBe(MOCK_NEXT_WEEK)
  })
})
