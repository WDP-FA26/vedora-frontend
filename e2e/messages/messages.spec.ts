import { CONVERSATION_ID } from "../fixtures/data-extra.mjs"
import { signInAs } from "../helpers/auth"
import { mockApi } from "../helpers/api"
import { test, expect, appAlerts } from "../helpers/test"

test.describe("messages", () => {
  test.beforeEach(async ({ context }) => {
    await signInAs(context, "member")
  })

  test("lists conversations with last message and unread badge", async ({ page }) => {
    await page.goto("/home/messages")
    await expect(page.getByRole("heading", { name: "Tin nhắn", level: 1 })).toBeVisible()
    const row = page.getByRole("link", { name: /Lê Bếp Chay/ })
    await expect(row).toContainText("Hẹn bạn cuối tuần nhé!")
    await expect(row.getByLabel("2 tin chưa đọc")).toBeVisible()
    await expect(page.getByText("Chọn một cuộc trò chuyện để bắt đầu.")).toBeVisible()
  })

  test("has friends and requests inboxes", async ({ page }) => {
    await page.goto("/home/messages")
    const inboxes = page.getByLabel("Hộp thư")
    await expect(inboxes.locator("a", { hasText: "Bạn bè" })).toHaveAttribute("aria-current", "page")
    await inboxes.locator("a", { hasText: "Tin nhắn lạ" }).click()
    await expect(page).toHaveURL(/box=requests/)
    await expect(page.getByText(/Tin nhắn khi chưa theo dõi nhau hai chiều/)).toBeVisible()
  })

  test("shows the empty friends state", async ({ page }) => {
    await mockApi(page, "/messaging/conversations", { body: { items: [], nextCursor: null } })
    await page.goto("/home/messages")
    await expect(page.getByText(/Bạn bè là những người theo dõi nhau/)).toBeVisible()
  })

  test("shows a retryable error when the inbox fails", async ({ page }) => {
    await mockApi(page, "/messaging/conversations", { status: 500, body: { statusCode: 500, message: "boom" } })
    await page.goto("/home/messages")
    await expect(appAlerts(page)).toContainText("Không kết nối được. Vui lòng thử lại.")
  })

  test("opens a conversation and shows its history", async ({ page }) => {
    await page.goto("/home/messages")
    await page.getByRole("link", { name: /Lê Bếp Chay/ }).click()
    await expect(page).toHaveURL(new RegExp(`conversation=${CONVERSATION_ID}`))
    const log = page.getByRole("log", { name: "Lịch sử tin nhắn" })
    await expect(log).toContainText("Chào bạn, công thức phở chay của bạn rất hay.")
    await expect(log).toContainText("Hẹn bạn cuối tuần nhé!")
    // The member's own message was read by the peer (peerReadSequence 1).
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
      "POST"
    )
    await page.goto(`/home/messages?conversation=${CONVERSATION_ID}`)
    const box = page.getByRole("textbox", { name: "Nội dung tin nhắn" })
    const send = page.getByRole("button", { name: "Gửi tin nhắn" })
    await expect(send).toBeDisabled()
    await box.fill("Mình sẽ ghé nhé!")
    await expect(send).toBeEnabled()
    await send.click()

    await expect(page.getByRole("log", { name: "Lịch sử tin nhắn" })).toContainText("Mình sẽ ghé nhé!")
    await expect(box).toHaveValue("")
    expect(sent).toHaveLength(1)
    expect(sent[0].body).toMatchObject({ body: "Mình sẽ ghé nhé!" })
    expect((sent[0].body as { clientMessageId: string }).clientMessageId).toBeTruthy()
  })

  test("Shift+Enter inserts a newline instead of sending", async ({ page }) => {
    const sent = await mockApi(
      page,
      `/messaging/conversations/${CONVERSATION_ID}/messages`,
      { status: 201, body: {} },
      "POST"
    )
    await page.goto(`/home/messages?conversation=${CONVERSATION_ID}`)
    const box = page.getByRole("textbox", { name: "Nội dung tin nhắn" })
    await box.fill("dòng một")
    await box.press("Shift+Enter")
    await expect(box).toHaveValue("dòng một\n")
    expect(sent).toHaveLength(0)
  })

  test("keeps the draft and shows an error when sending fails", async ({ page }) => {
    await mockApi(
      page,
      `/messaging/conversations/${CONVERSATION_ID}/messages`,
      { status: 403, body: { statusCode: 403, code: "MESSAGE_FOLLOW_REQUIRED", message: "follow" } },
      "POST"
    )
    await page.goto(`/home/messages?conversation=${CONVERSATION_ID}`)
    const box = page.getByRole("textbox", { name: "Nội dung tin nhắn" })
    await box.fill("Xin chào")
    await page.getByRole("button", { name: "Gửi tin nhắn" }).click()
    await expect(appAlerts(page)).toContainText("Bạn cần theo dõi người này trước khi gửi tin nhắn.")
    await expect(box).toHaveValue("Xin chào")
  })

  test("disables the composer when the peer cannot be messaged", async ({ page }) => {
    await mockApi(page, `/messaging/conversations/${CONVERSATION_ID}`, {
      body: {
        id: CONVERSATION_ID,
        peer: { id: "u-chef", username: "bepchay", fullName: "Lê Bếp Chay", avatarUrl: null, isProfessional: false },
        box: "requests",
        requestDirection: "incoming",
        followsPeer: false,
        peerFollowsYou: true,
        canSend: false,
        lastMessage: null,
        unreadCount: 0,
        myReadSequence: 0,
        peerReadSequence: 0,
      },
    })
    await page.goto(`/home/messages?conversation=${CONVERSATION_ID}`)
    await expect(page.getByText("Bạn cần theo dõi người này để gửi tin nhắn.")).toBeVisible()
    await expect(page.getByRole("textbox", { name: "Nội dung tin nhắn" })).toBeDisabled()
    await expect(page.getByText(/Người này đang theo dõi bạn/)).toBeVisible()
  })

  test("starting a chat from a profile (?to=) shows the greeting and creates the conversation", async ({ page }) => {
    const sent = await mockApi(page, "/messaging/users/u-chef/messages", { status: 201, body: {} }, "POST")
    await page.goto("/home/messages?to=u-chef")
    await expect(page.getByText("Gửi lời chào để bắt đầu cuộc trò chuyện.")).toBeVisible()
    await expect(page.getByRole("heading", { name: "Lê Bếp Chay" }).or(page.getByText("@bepchay"))).toBeVisible()
    expect(sent).toHaveLength(0)
  })

  test("an unknown conversation shows a load error", async ({ page }) => {
    await page.goto("/home/messages?conversation=does-not-exist")
    await expect(appAlerts(page)).toContainText("Người dùng hoặc cuộc trò chuyện không còn khả dụng.")
  })
})
