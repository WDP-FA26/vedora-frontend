import type { Page } from "@playwright/test"
import { CONVERSATION_ID, conversation, messages } from "../fixtures/data-extra.mjs"
import { signInAs } from "../helpers/auth"
import { mockApi } from "../helpers/api"
import { test, expect, appAlerts } from "../helpers/test"

const chef = conversation.peer
const sharedPost = {
  id: "p-1",
  type: "POST",
  title: null,
  excerpt: "Bài viết được chia sẻ qua chat",
  imageUrl: null,
  author: chef,
}
const sharedMessage = {
  ...messages[0],
  id: "shared-message",
  clientMessageId: "fixture-share",
  sequence: 3,
  body: "Đã chia sẻ một bài viết",
  sharedPostId: "p-1",
  sharedPost,
}
const profile = (id: string, fullName: string, username: string) => ({
  id,
  fullName,
  username,
  avatarUrl: null,
  coverUrl: null,
  bio: null,
  isProfessional: false,
})

async function recipients(page: Page) {
  await mockApi(
    page,
    "/messaging/conversations",
    (route) => ({
      body: {
        items:
          new URL(route.request().url()).searchParams.get("box") === "requests"
            ? []
            : [{ ...conversation, followsPeer: false, peerFollowsYou: false, canSend: true }],
        nextCursor: null,
      },
    }),
    "GET"
  )
  await mockApi(
    page,
    "/profiles/u-member/following",
    { body: { items: [], nextCursor: null } },
    "GET"
  )
}

async function openShare(page: Page) {
  await page.goto("/posts/p-1")
  await page.getByRole("button", { name: "Chia sẻ", exact: true }).click()
  await page.getByRole("menuitem", { name: "Gửi qua tin nhắn" }).click()
  return page.getByRole("dialog", { name: "Chia sẻ qua tin nhắn" })
}

test("guests can copy a post link and are asked to sign in to send it", async ({
  page,
  context,
}) => {
  await context.grantPermissions(["clipboard-read", "clipboard-write"])
  await page.goto("/posts/p-1")
  await page.getByRole("button", { name: "Chia sẻ", exact: true }).click()
  await page.getByRole("menuitem", { name: "Sao chép liên kết" }).click()
  await expect(page.getByRole("button", { name: "Đã sao chép liên kết" })).toBeVisible()
  expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(
    "http://localhost:3000/posts/p-1"
  )
  await page.getByRole("button", { name: "Đã sao chép liên kết" }).click()
  await page.getByRole("menuitem", { name: "Gửi qua tin nhắn" }).click()
  await expect(page.getByRole("link", { name: "Đăng nhập để chia sẻ" })).toHaveAttribute(
    "href",
    "/login?next=%2Fposts%2Fp-1"
  )
})

test("shares with an accepted conversation without following and opens the post card in chat", async ({
  page,
  context,
}) => {
  await signInAs(context, "member")
  await recipients(page)
  const sent = await mockApi(
    page,
    "/messaging/users/u-chef/shared-posts",
    (route) => ({
      status: 201,
      body: {
        conversationId: CONVERSATION_ID,
        message: {
          ...sharedMessage,
          clientMessageId: route.request().postDataJSON().clientMessageId,
        },
      },
    }),
    "POST"
  )
  await mockApi(
    page,
    `/messaging/conversations/${CONVERSATION_ID}/messages`,
    { body: { items: [...messages, sharedMessage], nextCursor: null } },
    "GET"
  )
  const dialog = await openShare(page)
  await expect(dialog.getByRole("button", { name: "Gửi bài viết", exact: true })).toBeDisabled()
  await dialog.getByRole("button", { name: /Lê Bếp Chay/ }).click()
  await dialog.getByRole("button", { name: "Gửi bài viết", exact: true }).click()
  await expect(dialog.getByRole("status")).toContainText("Đã gửi bài viết cho Lê Bếp Chay")
  expect(sent).toHaveLength(1)
  expect(sent[0].body).toMatchObject({ postId: "p-1", clientMessageId: expect.any(String) })
  await dialog.getByRole("link", { name: "Mở cuộc trò chuyện" }).click()
  const card = page.getByRole("link", { name: "Mở bài viết được chia sẻ của Lê Bếp Chay" })
  await expect(card).toContainText(sharedPost.excerpt)
  await expect(card).toHaveAttribute("href", "/posts/p-1")
  await card.click()
  await expect(page).toHaveURL(/\/posts\/p-1$/)
})

test("retries an uncertain send with the same UUID, including after closing the dialog", async ({
  page,
  context,
}) => {
  await signInAs(context, "member")
  await recipients(page)
  let fail = true
  const attempts = await mockApi(
    page,
    "/messaging/users/u-chef/shared-posts",
    (route) =>
      fail
        ? { status: 503, body: { code: "SERVICE_UNAVAILABLE", message: "Retry" } }
        : {
            status: 201,
            body: {
              conversationId: CONVERSATION_ID,
              message: {
                ...sharedMessage,
                clientMessageId: route.request().postDataJSON().clientMessageId,
              },
            },
          },
    "POST"
  )
  const dialog = await openShare(page)
  await dialog.getByRole("button", { name: /Lê Bếp Chay/ }).click()
  await dialog.getByRole("button", { name: "Gửi bài viết", exact: true }).click()
  await expect(appAlerts(page)).toContainText("Không kết nối được")
  await page.keyboard.press("Escape")
  await expect(dialog).not.toBeVisible()
  await page.getByRole("button", { name: "Chia sẻ", exact: true }).click()
  await page.getByRole("menuitem", { name: "Gửi qua tin nhắn" }).click()
  await dialog.getByRole("button", { name: /Lê Bếp Chay/ }).click()
  fail = false
  await dialog.getByRole("button", { name: "Gửi bài viết", exact: true }).click()
  await expect(dialog.getByRole("status")).toContainText("Đã gửi bài viết")
  expect(attempts).toHaveLength(2)
  expect(attempts[0].body).toEqual(attempts[1].body)
})

test("finds and shares with a followed user beyond the first recipient page", async ({
  page,
  context,
}) => {
  await signInAs(context, "member")
  await recipients(page)
  await mockApi(
    page,
    "/profiles/u-member/following",
    (route) => ({
      body: new URL(route.request().url()).searchParams.has("cursor")
        ? { items: [profile("u-new", "Bạn Mới", "banmoi")], nextCursor: null }
        : { items: [profile(chef.id, chef.fullName, chef.username)], nextCursor: "profile-next" },
    }),
    "GET"
  )
  const sent = await mockApi(
    page,
    "/messaging/users/u-new/shared-posts",
    {
      status: 201,
      body: {
        conversationId: "new-conversation",
        message: { ...sharedMessage, recipientId: "u-new" },
      },
    },
    "POST"
  )
  const dialog = await openShare(page)
  await dialog.getByRole("textbox", { name: "Tìm người nhận trong danh sách" }).fill("banmoi")
  await dialog.getByRole("button", { name: "Xem thêm người nhận" }).click()
  await dialog.getByRole("button", { name: /Bạn Mới/ }).click()
  await dialog.getByRole("button", { name: "Gửi bài viết", exact: true }).click()
  await expect(dialog.getByRole("status")).toContainText("Đã gửi bài viết cho Bạn Mới")
  expect(sent).toHaveLength(1)
})

test("disables unaccepted requests and shows a useful error if the post becomes unavailable", async ({
  page,
  context,
}) => {
  await signInAs(context, "member")
  await recipients(page)
  await mockApi(
    page,
    "/messaging/conversations",
    (route) => ({
      body: {
        items:
          new URL(route.request().url()).searchParams.get("box") === "requests"
            ? [
                {
                  ...conversation,
                  id: "pending",
                  peer: { ...chef, id: "u-pending", fullName: "Người Lạ" },
                  box: "requests",
                  canSend: false,
                },
              ]
            : [conversation],
        nextCursor: null,
      },
    }),
    "GET"
  )
  await mockApi(
    page,
    "/messaging/users/u-chef/shared-posts",
    { status: 404, body: { code: "SHARED_POST_UNAVAILABLE", message: "Unavailable" } },
    "POST"
  )
  const dialog = await openShare(page)
  await expect(dialog.getByRole("button", { name: /Người Lạ/ })).toBeDisabled()
  await dialog.getByRole("button", { name: /Lê Bếp Chay/ }).click()
  await dialog.getByRole("button", { name: "Gửi bài viết", exact: true }).click()
  await expect(appAlerts(page)).toContainText("Bài viết không còn khả dụng để chia sẻ")
})

test("shows an unavailable card without leaking removed post content", async ({
  page,
  context,
}) => {
  await signInAs(context, "member")
  await mockApi(
    page,
    `/messaging/conversations/${CONVERSATION_ID}/messages`,
    { body: { items: [...messages, { ...sharedMessage, sharedPost: null }], nextCursor: null } },
    "GET"
  )
  await page.goto(`/home/messages?conversation=${CONVERSATION_ID}`)
  await expect(page.getByRole("log")).toContainText("Bài viết không còn khả dụng")
  await expect(page.getByRole("link", { name: /Mở bài viết được chia sẻ/ })).toHaveCount(0)
  await expect(page.getByText(sharedPost.excerpt)).toHaveCount(0)
})

test("recipient selection fits a phone screen and prevents another send while waiting", async ({
  page,
  context,
}) => {
  await signInAs(context, "member")
  await page.setViewportSize({ width: 390, height: 844 })
  await recipients(page)
  let release!: () => void
  const pending = new Promise<void>((resolve) => {
    release = resolve
  })
  const sent = await mockApi(
    page,
    "/messaging/users/u-chef/shared-posts",
    async () => {
      await pending
      return { status: 201, body: { conversationId: CONVERSATION_ID, message: sharedMessage } }
    },
    "POST"
  )
  const dialog = await openShare(page)
  await dialog.getByRole("button", { name: /Lê Bếp Chay/ }).click()
  await page.screenshot({ path: "test-results/share-post-mobile.png", fullPage: true })
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(
    true
  )
  await dialog.getByRole("button", { name: "Gửi bài viết", exact: true }).click()
  await expect(dialog.getByRole("button", { name: "Đang gửi…", exact: true })).toBeDisabled()
  await page.keyboard.press("Escape")
  await expect(dialog).toBeVisible()
  release()
  await expect(dialog.getByRole("status")).toContainText("Đã gửi bài viết")
  expect(sent).toHaveLength(1)
})
