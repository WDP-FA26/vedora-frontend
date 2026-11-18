import type { Page } from "@playwright/test"
import { signInAs } from "../helpers/auth"
import { mockApi } from "../helpers/api"
import { test, expect, appAlerts } from "../helpers/test"

const member = {
  id: "u-member",
  username: "minhanh",
  fullName: "Nguyễn Minh Anh",
  avatarUrl: null,
}
const chef = {
  id: "u-chef",
  username: "bepchay",
  fullName: "Lê Bếp Chay",
  avatarUrl: null,
}
const root = {
  id: "root",
  postId: "p-1",
  body: "Bình luận gốc",
  author: chef,
  parentId: null,
  replyToId: null,
  replyToAuthor: null,
  replyCount: 1,
  createdAt: "2026-11-18T10:00:00Z",
  updatedAt: "2026-11-18T10:00:00Z",
}
const first = {
  ...root,
  id: "reply-1",
  body: "Trả lời ban đầu",
  author: member,
  parentId: root.id,
  replyToId: root.id,
  replyToAuthor: chef,
  replyCount: 0,
}

async function setup(page: Page) {
  const state = { replies: [first], rootDeleted: false }
  await mockApi(
    page,
    "/posts/p-1/comments",
    () => ({
      body: {
        items: state.rootDeleted ? [] : [{ ...root, replyCount: state.replies.length }],
        nextCursor: null,
      },
    }),
    "GET"
  )
  await mockApi(
    page,
    "/posts/p-1/comments/root/replies",
    () => ({ body: { items: state.replies, nextCursor: null } }),
    "GET"
  )
  return state
}

test("guest can expand replies and is asked to sign in to reply", async ({ page }) => {
  await setup(page)
  await page.goto("/posts/p-1")
  await expect(page.getByText(first.body, { exact: true })).toHaveCount(0)
  await page.getByRole("button", { name: "Xem 1 phản hồi" }).click()
  await expect(page.getByText(first.body, { exact: true })).toBeVisible()
  await expect(page.getByRole("link", { name: "Đăng nhập để trả lời" }).first()).toHaveAttribute(
    "href",
    "/login?next=%2Fposts%2Fp-1"
  )
  await expect(page.getByRole("textbox", { name: "Viết trả lời" })).toHaveCount(0)
})

test("replies to a root and a reply stay in one thread and update counts", async ({
  page,
  context,
}) => {
  await signInAs(context, "member")
  const state = await setup(page)
  const created = await mockApi(
    page,
    "/posts/p-1/comments/root/replies",
    (route) => {
      const body = (route.request().postDataJSON() as { body: string }).body
      const saved = { ...first, id: "reply-new", body }
      state.replies.unshift(saved)
      return { status: 201, body: saved }
    },
    "POST"
  )
  const nested = await mockApi(
    page,
    "/posts/p-1/comments/reply-1/replies",
    (route) => {
      const body = (route.request().postDataJSON() as { body: string }).body
      const saved = {
        ...first,
        id: "reply-nested",
        body,
        replyToId: first.id,
        replyToAuthor: member,
      }
      state.replies.unshift(saved)
      return { status: 201, body: saved }
    },
    "POST"
  )
  await page.goto("/posts/p-1")
  await page.locator("#comment-root").getByRole("button", { name: "Trả lời", exact: true }).click()
  await page.getByRole("textbox", { name: "Viết trả lời" }).fill("Cảm ơn công thức")
  await page
    .locator("form")
    .filter({ has: page.getByRole("textbox", { name: "Viết trả lời" }) })
    .getByRole("button", { name: "Trả lời", exact: true })
    .click()
  await expect(page.getByText("Cảm ơn công thức", { exact: true })).toBeVisible()
  expect(created).toHaveLength(1)
  await page
    .locator("#comment-reply-1")
    .getByRole("button", { name: "Trả lời", exact: true })
    .click()
  await expect(page.getByText("Đang trả lời Nguyễn Minh Anh")).toBeVisible()
  await page.getByRole("textbox", { name: "Viết trả lời" }).fill("Trả lời bạn trong cùng luồng")
  await page
    .locator("form")
    .filter({ has: page.getByRole("textbox", { name: "Viết trả lời" }) })
    .getByRole("button", { name: "Trả lời", exact: true })
    .click()
  await expect(page.getByText("Trả lời bạn trong cùng luồng", { exact: true })).toBeVisible()
  expect(nested).toHaveLength(1)
  await page.getByRole("button", { name: "Ẩn phản hồi" }).click()
  await expect(page.getByRole("button", { name: "Xem 3 phản hồi" })).toBeVisible()
})

test("keeps the reply draft after moderation failure and allows retry", async ({
  page,
  context,
}) => {
  await signInAs(context, "member")
  await setup(page)
  let failed = true
  await mockApi(
    page,
    "/posts/p-1/comments/root/replies",
    (route) =>
      failed
        ? {
            status: 422,
            body: { code: "CONTENT_REJECTED", message: "Rejected" },
          }
        : {
            status: 201,
            body: {
              ...first,
              id: "retry",
              body: route.request().postDataJSON().body,
            },
          },
    "POST"
  )
  await page.goto("/posts/p-1")
  await page.locator("#comment-root").getByRole("button", { name: "Trả lời", exact: true }).click()
  const box = page.getByRole("textbox", { name: "Viết trả lời" })
  const submit = page
    .locator("form")
    .filter({ has: box })
    .getByRole("button", { name: "Trả lời", exact: true })
  await box.fill("Bản nháp cần giữ")
  await submit.click()
  await expect(appAlerts(page)).toContainText("vi phạm tiêu chuẩn")
  await expect(box).toHaveValue("Bản nháp cần giữ")
  failed = false
  await submit.click()
  await expect(page.getByText("Bản nháp cần giữ", { exact: true })).toBeVisible()
})

test("opens a reply outside the loaded pages from a notification link on mobile", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await mockApi(page, "/posts/p-1/comments", {
    body: { items: [], nextCursor: null },
  })
  await mockApi(page, "/posts/p-1/comments/reply-1", { body: first })
  await mockApi(page, "/posts/p-1/comments/root", { body: root })
  await mockApi(page, "/posts/p-1/comments/root/replies", {
    body: { items: [], nextCursor: null },
  })
  await page.goto("/posts/p-1?comment=reply-1#comments")
  await expect(page.locator("#comment-root")).toBeVisible()
  await expect(page.locator("#comment-reply-1")).toContainText(first.body)
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(
    true
  )
  await page.screenshot({
    path: "test-results/comment-replies-mobile.png",
    fullPage: true,
  })
})

test("reply notifications use the reply wording and open the exact comment", async ({
  page,
  context,
}) => {
  await signInAs(context, "member")
  await mockApi(page, "/notifications", {
    body: {
      items: [
        {
          id: "reply-note",
          type: "COMMENT_REPLY",
          actor: chef,
          postId: "p-1",
          commentId: "reply-1",
          readAt: null,
          createdAt: root.createdAt,
        },
      ],
      nextCursor: null,
    },
  })
  await page.goto("/home/notifications")
  await expect(
    page.getByRole("link", {
      name: /Lê Bếp Chay đã trả lời bình luận của bạn/,
    })
  ).toHaveAttribute("href", "/posts/p-1?comment=reply-1#comments")
})

test("edits and deletes an owned reply without removing its root", async ({ page, context }) => {
  await signInAs(context, "member")
  const state = await setup(page)
  const edited = await mockApi(
    page,
    "/posts/p-1/comments/reply-1",
    (route) => {
      state.replies[0] = { ...first, body: route.request().postDataJSON().body }
      return { body: state.replies[0] }
    },
    "PATCH"
  )
  const deleted = await mockApi(
    page,
    "/posts/p-1/comments/reply-1",
    () => {
      state.replies = []
      return { status: 204 }
    },
    "DELETE"
  )
  await page.goto("/posts/p-1")
  await page.getByRole("button", { name: "Xem 1 phản hồi" }).click()
  const reply = page.locator("#comment-reply-1")
  await reply.getByRole("button", { name: "Tùy chọn bình luận" }).click()
  await page.getByRole("menuitem", { name: "Sửa bình luận" }).click()
  await page.getByRole("textbox", { name: "Sửa bình luận" }).fill("Nội dung đã sửa")
  await reply.getByRole("button", { name: "Lưu", exact: true }).click()
  await expect(reply).toContainText("Nội dung đã sửa")
  expect(edited).toHaveLength(1)
  await reply.getByRole("button", { name: "Tùy chọn bình luận" }).click()
  await page.getByRole("menuitem", { name: "Xoá bình luận" }).click()
  await page.getByRole("alertdialog").getByRole("button", { name: "Xoá", exact: true }).click()
  await expect(reply).toHaveCount(0)
  await expect(page.locator("#comment-root")).toBeVisible()
  expect(deleted).toHaveLength(1)
})

test("warns before cascading root deletion and removes its replies", async ({ page, context }) => {
  await signInAs(context, "member")
  const state = await setup(page)
  await mockApi(
    page,
    "/posts/p-1/comments",
    { body: { items: [{ ...root, author: member }], nextCursor: null } },
    "GET"
  )
  const deleted = await mockApi(
    page,
    "/posts/p-1/comments/root",
    () => {
      state.rootDeleted = true
      state.replies = []
      return { status: 204 }
    },
    "DELETE"
  )
  await page.goto("/posts/p-1")
  await page.getByRole("button", { name: "Xem 1 phản hồi" }).click()
  await expect(page.locator("#comment-reply-1")).toBeVisible()
  await page.locator("#comment-root").getByRole("button", { name: "Tùy chọn bình luận" }).click()
  await page.getByRole("menuitem", { name: "Xoá bình luận" }).click()
  const dialog = page.getByRole("alertdialog")
  await expect(dialog).toContainText("Bình luận và tất cả phản hồi")
  await dialog.getByRole("button", { name: "Xoá", exact: true }).click()
  await expect(page.locator("#comment-root")).toHaveCount(0)
  await expect(page.locator("#comment-reply-1")).toHaveCount(0)
  expect(deleted).toHaveLength(1)
})

test("loads more replies within the selected thread", async ({ page }) => {
  await setup(page)
  const next = { ...first, id: "reply-older", body: "Phản hồi trang sau" }
  const requests = await mockApi(
    page,
    "/posts/p-1/comments/root/replies",
    (route) => {
      const cursor = new URL(route.request().url()).searchParams.get("cursor")
      return {
        body: cursor
          ? { items: [next], nextCursor: null }
          : { items: [first], nextCursor: first.id },
      }
    },
    "GET"
  )
  await page.goto("/posts/p-1")
  await page.getByRole("button", { name: "Xem 1 phản hồi" }).click()
  await page.getByRole("button", { name: "Xem thêm phản hồi" }).click()
  await expect(page.getByText(next.body)).toBeVisible()
  expect(requests.some((request) => request.url.includes("cursor=reply-1"))).toBe(true)
})
