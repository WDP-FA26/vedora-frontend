import { CONVERSATION_ID, conversation } from "../fixtures/data-extra.mjs"
import { signInAs } from "../helpers/auth"
import { mockApi } from "../helpers/api"
import { test, expect, appAlerts } from "../helpers/test"

test.describe("messages", () => {
  test.beforeEach(async ({ context }) => {
    await signInAs(context, "member")
  })

  test("lists conversations with last message and unread badge", async ({
    page,
  }) => {
    await page.goto("/home/messages")
    await expect(
      page.getByRole("heading", { name: "Tin nhắn", level: 1 }),
    ).toBeVisible()
    const row = page.getByRole("link", { name: /Lê Bếp Chay/ })
    await expect(row).toContainText("Hẹn bạn cuối tuần nhé!")
    await expect(row.getByLabel("2 tin chưa đọc")).toBeVisible()
    await expect(
      page.getByText("Chọn một cuộc trò chuyện để bắt đầu."),
    ).toBeVisible()
  })

  test("has friends and requests inboxes", async ({ page }) => {
    await page.goto("/home/messages")
    const inboxes = page.getByLabel("Hộp thư")
    await expect(inboxes.locator("a", { hasText: "Bạn bè" })).toHaveAttribute(
      "aria-current",
      "page",
    )
    await inboxes.locator("a", { hasText: "Tin nhắn lạ" }).click()
    await expect(page).toHaveURL(/box=requests/)
    await expect(page.getByText(/Tin nhắn chưa được chấp nhận/)).toBeVisible()
  })

  test("shows the empty friends state", async ({ page }) => {
    await mockApi(page, "/messaging/conversations", {
      body: { items: [], nextCursor: null },
    })
    await page.goto("/home/messages")
    await expect(page.getByText(/Cuộc trò chuyện đã chấp nhận/)).toBeVisible()
  })

  test("shows a retryable error when the inbox fails", async ({ page }) => {
    await mockApi(page, "/messaging/conversations", {
      status: 500,
      body: { statusCode: 500, message: "boom" },
    })
    await page.goto("/home/messages")
    await expect(appAlerts(page)).toContainText(
      "Không kết nối được. Vui lòng thử lại.",
    )
  })

  test("opens a conversation and shows its history", async ({ page }) => {
    await page.goto("/home/messages")
    await page.getByRole("link", { name: /Lê Bếp Chay/ }).click()
    await expect(page).toHaveURL(new RegExp(`conversation=${CONVERSATION_ID}`))
    const log = page.getByRole("log", { name: "Lịch sử tin nhắn" })
    await expect(log).toContainText(
      "Chào bạn, công thức phở chay của bạn rất hay.",
    )
    await expect(log).toContainText("Hẹn bạn cuối tuần nhé!")
    await expect(log).toContainText("Đã xem")
  })

  test("sends a message and shows it in the thread", async ({ page }) => {
    const sent = await mockApi(
      page,
      `/messaging/conversations/${CONVERSATION_ID}/messages`,
      (route) => {
        const payload = JSON.parse(route.request().postData() ?? "{}") as {
          body: string
          clientMessageId: string
        }
        return {
          status: 201,
          body: {
            conversationId: CONVERSATION_ID,
            message: {
              id: "m-new",
              conversationId: CONVERSATION_ID,
              senderId: "u-member",
              recipientId: "u-chef",
              clientMessageId: payload.clientMessageId,
              sequence: 3,
              body: payload.body,
              createdAt: new Date().toISOString(),
            },
          },
        }
      },
      "POST",
    )
    await page.goto(`/home/messages?conversation=${CONVERSATION_ID}`)
    const box = page.getByRole("textbox", { name: "Nội dung tin nhắn" })
    const send = page.getByRole("button", { name: "Gửi tin nhắn" })
    await expect(send).toBeDisabled()
    await box.fill("Mình sẽ ghé nhé!")
    await expect(send).toBeEnabled()
    await send.click()

    await expect(
      page.getByRole("log", { name: "Lịch sử tin nhắn" }),
    ).toContainText("Mình sẽ ghé nhé!")
    await expect(box).toHaveValue("")
    expect(sent).toHaveLength(1)
    expect(sent[0].body).toMatchObject({ body: "Mình sẽ ghé nhé!" })
    expect(
      (sent[0].body as { clientMessageId: string }).clientMessageId,
    ).toBeTruthy()
  })

  test("Shift+Enter inserts a newline instead of sending", async ({ page }) => {
    const sent = await mockApi(
      page,
      `/messaging/conversations/${CONVERSATION_ID}/messages`,
      { status: 201, body: {} },
      "POST",
    )
    await page.goto(`/home/messages?conversation=${CONVERSATION_ID}`)
    const box = page.getByRole("textbox", { name: "Nội dung tin nhắn" })
    await box.fill("dòng một")
    await box.press("Shift+Enter")
    await expect(box).toHaveValue("dòng một\n")
    expect(sent).toHaveLength(0)
  })

  test("keeps the draft and shows an error when sending fails", async ({
    page,
  }) => {
    await mockApi(
      page,
      `/messaging/conversations/${CONVERSATION_ID}/messages`,
      {
        status: 403,
        body: {
          statusCode: 403,
          code: "MESSAGE_FOLLOW_REQUIRED",
          message: "follow",
        },
      },
      "POST",
    )
    await page.goto(`/home/messages?conversation=${CONVERSATION_ID}`)
    const box = page.getByRole("textbox", { name: "Nội dung tin nhắn" })
    await box.fill("Xin chào")
    await page.getByRole("button", { name: "Gửi tin nhắn" }).click()
    await expect(appAlerts(page)).toContainText(
      "Bạn cần theo dõi người này trước khi gửi tin nhắn.",
    )
    await expect(box).toHaveValue("Xin chào")
  })

  test("offers accept and delete instead of requiring a follow-back for incoming requests", async ({
    page,
  }) => {
    await mockApi(page, `/messaging/conversations/${CONVERSATION_ID}`, {
      body: {
        id: CONVERSATION_ID,
        peer: {
          id: "u-chef",
          username: "bepchay",
          fullName: "Lê Bếp Chay",
          avatarUrl: null,
          isProfessional: false,
        },
        box: "requests",
        requestDirection: "incoming",
        followsPeer: false,
        peerFollowsYou: true,
        canSend: false,
        canAcceptRequest: true,
        canDeleteRequest: true,
        lastMessage: null,
        unreadCount: 0,
        myReadSequence: 0,
        peerReadSequence: 0,
      },
    })
    await page.goto(`/home/messages?conversation=${CONVERSATION_ID}`)
    await expect(
      page.getByRole("button", { name: "Chấp nhận", exact: true }),
    ).toBeVisible()
    await expect(
      page.getByRole("button", { name: "Xóa", exact: true }),
    ).toBeVisible()
    await expect(
      page.getByRole("textbox", { name: "Nội dung tin nhắn" }),
    ).toHaveCount(0)
    await expect(
      page.getByRole("button", { name: "Theo dõi", exact: true }),
    ).toHaveCount(0)
    await expect(
      page.getByRole("button", { name: "Chặn", exact: true }),
    ).toHaveCount(0)
  })

  test("starting a chat from a profile (?to=) shows the greeting and creates the conversation", async ({
    page,
  }) => {
    const sent = await mockApi(
      page,
      "/messaging/users/u-chef/messages",
      { status: 201, body: {} },
      "POST",
    )
    await page.goto("/home/messages?to=u-chef")
    await expect(
      page.getByText("Gửi lời chào để bắt đầu cuộc trò chuyện."),
    ).toBeVisible()
    await expect(
      page
        .getByRole("heading", { name: "Lê Bếp Chay" })
        .or(page.getByText("@bepchay")),
    ).toBeVisible()
    expect(sent).toHaveLength(0)
  })

  test("an unknown conversation shows a load error", async ({ page }) => {
    await page.goto("/home/messages?conversation=does-not-exist")
    await expect(appAlerts(page)).toContainText(
      "Người dùng hoặc cuộc trò chuyện không còn khả dụng.",
    )
  })
})

const incoming = {
  ...conversation,
  box: "requests",
  requestDirection: "incoming",
  followsPeer: false,
  canSend: false,
  canAcceptRequest: true,
  canDeleteRequest: true,
  deletedThroughSequence: 0,
}

test.describe("message request actions", () => {
  test.beforeEach(async ({ page, context }) => {
    await signInAs(context, "member")
    await mockApi(page, `/messaging/conversations/${CONVERSATION_ID}`, {
      body: incoming,
    })
  })

  test("accepts without follow-back, switches to friends and enables replying", async ({
    page,
  }) => {
    let accepted = false
    const friend = {
      ...incoming,
      box: "friends",
      requestDirection: null,
      canSend: true,
      canAcceptRequest: false,
      canDeleteRequest: false,
    }
    await mockApi(page, `/messaging/conversations/${CONVERSATION_ID}`, () => ({
      body: accepted ? friend : incoming,
    }))
    await mockApi(page, "/messaging/conversations", (route) => ({
      body: {
        items:
          new URL(route.request().url()).searchParams.get("box") ===
          (accepted ? "friends" : "requests")
            ? [accepted ? friend : incoming]
            : [],
        nextCursor: null,
      },
    }))
    const requests = await mockApi(
      page,
      `/messaging/conversations/${CONVERSATION_ID}/accept`,
      () => {
        accepted = true
        return { body: friend }
      },
      "POST",
    )
    const follows = await mockApi(
      page,
      "/profiles/u-chef/follow",
      { status: 204 },
      "PUT",
    )
    await page.goto(
      `/home/messages?box=requests&conversation=${CONVERSATION_ID}`,
    )
    await page.getByRole("button", { name: "Chấp nhận", exact: true }).click()
    await expect(page).toHaveURL(/box=friends/)
    await expect(
      page.getByRole("textbox", { name: "Nội dung tin nhắn" }),
    ).toBeEnabled()
    await expect(page.getByLabel("Lời mời nhắn tin")).toHaveCount(0)
    await expect(
      page.getByLabel("Hộp thư").locator("a", { hasText: "Bạn bè" }),
    ).toHaveAttribute("aria-current", "page")
    expect(requests).toHaveLength(1)
    expect(follows).toHaveLength(0)
  })

  test("deletes a request using its last displayed message and leaves the thread", async ({
    page,
  }) => {
    await mockApi(page, "/messaging/conversations", {
      body: { items: [], nextCursor: null },
    })
    const requests = await mockApi(
      page,
      `/messaging/conversations/${CONVERSATION_ID}/request`,
      { body: { conversationId: CONVERSATION_ID, deletedThroughSequence: 2 } },
      "DELETE",
    )
    await page.goto(
      `/home/messages?box=requests&conversation=${CONVERSATION_ID}`,
    )
    await page.getByRole("button", { name: "Xóa", exact: true }).click()
    await expect(page).toHaveURL(/\/home\/messages\?box=requests$/)
    await expect(
      page.getByRole("log", { name: "Lịch sử tin nhắn" }),
    ).toHaveCount(0)
    expect(requests).toHaveLength(1)
    expect(requests[0].body).toEqual({
      throughMessageId: conversation.lastMessage.id,
    })
  })

  test("keeps request actions and history available when deletion fails", async ({
    page,
  }) => {
    await mockApi(
      page,
      `/messaging/conversations/${CONVERSATION_ID}/request`,
      { status: 500, body: { message: "failed" } },
      "DELETE",
    )
    await page.goto(
      `/home/messages?box=requests&conversation=${CONVERSATION_ID}`,
    )
    await page.getByRole("button", { name: "Xóa", exact: true }).click()
    await expect(
      page.getByLabel("Lời mời nhắn tin").getByRole("alert"),
    ).toBeVisible()
    await expect(
      page.getByRole("button", { name: "Xóa", exact: true }),
    ).toBeEnabled()
    await expect(
      page.getByRole("button", { name: "Chấp nhận", exact: true }),
    ).toBeEnabled()
    await expect(
      page.getByRole("log", { name: "Lịch sử tin nhắn" }),
    ).toContainText(conversation.lastMessage.body)
  })

  test("does not unlock the composer on failed acceptance", async ({
    page,
  }) => {
    await mockApi(
      page,
      `/messaging/conversations/${CONVERSATION_ID}/accept`,
      { status: 500, body: { message: "failed" } },
      "POST",
    )
    await page.goto(
      `/home/messages?box=requests&conversation=${CONVERSATION_ID}`,
    )
    await page.getByRole("button", { name: "Chấp nhận", exact: true }).click()
    await expect(
      page.getByLabel("Lời mời nhắn tin").getByRole("alert"),
    ).toBeVisible()
    await expect(
      page.getByRole("textbox", { name: "Nội dung tin nhắn" }),
    ).toHaveCount(0)
    await expect(page).toHaveURL(/box=requests/)
  })

  test("hides deleted messages even if a history page was cached", async ({
    page,
  }) => {
    await mockApi(page, `/messaging/conversations/${CONVERSATION_ID}`, {
      body: { ...incoming, deletedThroughSequence: 1 },
    })
    await page.goto(
      `/home/messages?box=requests&conversation=${CONVERSATION_ID}`,
    )
    const log = page.getByRole("log", { name: "Lịch sử tin nhắn" })
    await expect(log).toContainText(conversation.lastMessage.body)
    await expect(log).not.toContainText(
      "Chào bạn, công thức phở chay của bạn rất hay.",
    )
  })

  test("does not show recipient actions for an outgoing request", async ({
    page,
  }) => {
    await mockApi(page, `/messaging/conversations/${CONVERSATION_ID}`, {
      body: {
        ...incoming,
        requestDirection: "outgoing",
        canSend: true,
        canAcceptRequest: false,
        canDeleteRequest: false,
      },
    })
    await page.goto(
      `/home/messages?box=requests&conversation=${CONVERSATION_ID}`,
    )
    await expect(
      page.getByRole("textbox", { name: "Nội dung tin nhắn" }),
    ).toBeEnabled()
    await expect(
      page.getByRole("button", { name: "Chấp nhận", exact: true }),
    ).toHaveCount(0)
    await expect(
      page.getByRole("button", { name: "Xóa", exact: true }),
    ).toHaveCount(0)
  })

  test("keeps both recipient actions usable on mobile", async ({
    page,
  }, testInfo) => {
    await page.setViewportSize({ width: 390, height: 844 })
    await page.goto(
      `/home/messages?box=requests&conversation=${CONVERSATION_ID}`,
    )
    await expect(
      page.getByRole("button", { name: "Xóa", exact: true }),
    ).toBeEnabled()
    await expect(
      page.getByRole("button", { name: "Chấp nhận", exact: true }),
    ).toBeEnabled()
    await expect(
      page.getByRole("button", { name: "Chặn", exact: true }),
    ).toHaveCount(0)
    await page.screenshot({
      path: testInfo.outputPath("incoming-request-mobile.png"),
    })
  })
})
