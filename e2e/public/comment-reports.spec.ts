import type { Page } from "@playwright/test"
import { signInAs } from "../helpers/auth"
import { mockApi } from "../helpers/api"
import { test, expect } from "../helpers/test"

const chef = { id: "u-chef", username: "bepchay", fullName: "Lê Bếp Chay", avatarUrl: null }
const root = {
  id: "report-root",
  postId: "p-1",
  body: "Bình luận cần báo cáo",
  author: chef,
  parentId: null,
  replyToId: null,
  replyToAuthor: null,
  replyCount: 1,
  createdAt: "2026-11-23T10:00:00Z",
  updatedAt: "2026-11-23T10:00:00Z",
}
const reply = {
  ...root,
  id: "report-reply",
  parentId: root.id,
  replyCount: 0,
  body: "Phản hồi cần báo cáo",
}

async function setup(page: Page) {
  await mockApi(page, "/posts/p-1/comments", { body: { items: [root], nextCursor: null } }, "GET")
  await mockApi(
    page,
    `/posts/p-1/comments/${root.id}/replies`,
    { body: { items: [reply], nextCursor: null } },
    "GET"
  )
}
async function openReport(page: Page, id = root.id) {
  await page.locator(`#comment-${id}`).getByRole("button", { name: "Tùy chọn bình luận" }).click()
  await page.getByRole("menuitem", { name: "Báo cáo bình luận" }).click()
  await expect(page.getByRole("dialog")).toBeVisible()
}

test("member reports another person's comment with a reason and trimmed details", async ({
  page,
  context,
}) => {
  await signInAs(context, "member")
  await setup(page)
  const sent = await mockApi(
    page,
    `/posts/p-1/comments/${root.id}/report`,
    { status: 201, body: {} },
    "POST"
  )
  await page.goto("/posts/p-1")
  await openReport(page)
  const dialog = page.getByRole("dialog")
  await dialog.getByRole("radio", { name: "Quấy rối, công kích người khác" }).click()
  await dialog.getByRole("textbox", { name: "Chi tiết" }).fill("  Vui lòng kiểm tra  ")
  await dialog.getByRole("button", { name: "Gửi báo cáo" }).click()
  await expect(dialog.getByRole("heading", { name: "Đã gửi báo cáo" })).toBeVisible()
  expect(sent).toHaveLength(1)
  expect(sent[0].body).toEqual({ reason: "HARASSMENT", details: "Vui lòng kiểm tra" })
  await dialog.getByRole("button", { name: "Xong" }).click()
  await expect(dialog).toHaveCount(0)
})

test("replies can be reported independently on mobile", async ({ page, context }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await signInAs(context, "member")
  await setup(page)
  const sent = await mockApi(
    page,
    `/posts/p-1/comments/${reply.id}/report`,
    { status: 201, body: {} },
    "POST"
  )
  await page.goto("/posts/p-1")
  await page.getByRole("button", { name: "Xem 1 phản hồi" }).click()
  await openReport(page, reply.id)
  await page.getByRole("radio", { name: "Spam hoặc quảng cáo" }).click()
  await page.getByRole("button", { name: "Gửi báo cáo" }).click()
  await expect(page.getByRole("heading", { name: "Đã gửi báo cáo" })).toBeVisible()
  expect(sent).toHaveLength(1)
})

test("guests cannot report comments", async ({ page }) => {
  await setup(page)
  await page.goto("/posts/p-1")
  await expect(page.locator(`#comment-${root.id}`)).toBeVisible()
  await expect(
    page.locator(`#comment-${root.id}`).getByRole("button", { name: "Tùy chọn bình luận" })
  ).toHaveCount(0)
})

test("the author sees editing actions but cannot report their own comment", async ({
  page,
  context,
}) => {
  await signInAs(context, "chef")
  await setup(page)
  await page.goto("/posts/p-1")
  await page
    .locator(`#comment-${root.id}`)
    .getByRole("button", { name: "Tùy chọn bình luận" })
    .click()
  await expect(page.getByRole("menuitem", { name: "Sửa bình luận" })).toBeVisible()
  await expect(page.getByRole("menuitem", { name: "Báo cáo bình luận" })).toHaveCount(0)
})

test("a failed submission preserves input and does not display a false success", async ({
  page,
  context,
}) => {
  await signInAs(context, "member")
  await setup(page)
  let failing = true
  const sent = await mockApi(
    page,
    `/posts/p-1/comments/${root.id}/report`,
    () => (failing ? { status: 500, body: { message: "Failed" } } : { status: 201, body: {} }),
    "POST"
  )
  await page.goto("/posts/p-1")
  await openReport(page)
  const dialog = page.getByRole("dialog")
  await dialog.getByRole("radio", { name: "Spam hoặc quảng cáo" }).click()
  await dialog.getByRole("textbox", { name: "Chi tiết" }).fill("Giữ nội dung này")
  await dialog.getByRole("button", { name: "Gửi báo cáo" }).click()
  await expect(dialog.getByRole("alert")).toContainText("Không gửi được báo cáo")
  await expect(dialog.getByRole("heading", { name: "Đã gửi báo cáo" })).toHaveCount(0)
  await expect(dialog.getByRole("textbox", { name: "Chi tiết" })).toHaveValue("Giữ nội dung này")
  failing = false
  await dialog.getByRole("button", { name: "Gửi báo cáo" }).click()
  await expect(dialog.getByRole("heading", { name: "Đã gửi báo cáo" })).toBeVisible()
  expect(sent).toHaveLength(2)
})

test("a duplicate report is acknowledged and a removed target shows an error", async ({
  page,
  context,
}) => {
  await signInAs(context, "member")
  await setup(page)
  await mockApi(
    page,
    `/posts/p-1/comments/${root.id}/report`,
    { status: 409, body: { code: "ALREADY_REPORTED", message: "Duplicate" } },
    "POST"
  )
  await page.goto("/posts/p-1")
  await openReport(page)
  await page.getByRole("radio", { name: "Spam hoặc quảng cáo" }).click()
  await page.getByRole("button", { name: "Gửi báo cáo" }).click()
  await expect(page.getByRole("heading", { name: "Bạn đã báo cáo bình luận này rồi" })).toBeVisible()
  await page.getByRole("button", { name: "Xong" }).click()
  await mockApi(
    page,
    `/posts/p-1/comments/${root.id}/report`,
    { status: 404, body: { code: "NOT_FOUND", message: "Gone" } },
    "POST"
  )
  await openReport(page)
  await page.getByRole("radio", { name: "Spam hoặc quảng cáo" }).click()
  await page.getByRole("button", { name: "Gửi báo cáo" }).click()
  await expect(page.getByRole("dialog").getByRole("alert")).toContainText("không còn khả dụng")
})
