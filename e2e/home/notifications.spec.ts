import { signInAs } from "../helpers/auth"
import { mockApi } from "../helpers/api"
import { test, expect, appAlerts } from "../helpers/test"

test.describe("notifications", () => {
  test.beforeEach(async ({ context }) => {
    await signInAs(context, "member")
  })

  test("lists the mocked notifications with their wording", async ({ page }) => {
    await page.goto("/home/notifications")
    await expect(page.getByRole("heading", { name: "Thông báo" })).toBeVisible()
    const items = page.getByRole("listitem")
    await expect(items.filter({ hasText: "Lê Bếp Chay đã thích bài viết của bạn" })).toBeVisible()
    await expect(items.filter({ hasText: "Trần Quản Trị đã bắt đầu theo dõi bạn" })).toBeVisible()
    await expect(items.filter({ hasText: "Bài viết của bạn đã được duyệt và hiển thị công khai." })).toBeVisible()
  })

  test("marks only unread items with an indicator", async ({ page }) => {
    await page.goto("/home/notifications")
    await expect(page.locator('span[aria-label="Chưa đọc"]')).toHaveCount(1)
  })

  test("links a like notification to the post", async ({ page }) => {
    await page.goto("/home/notifications")
    await expect(page.getByRole("link", { name: /Lê Bếp Chay đã thích/ })).toHaveAttribute("href", "/posts/p-2")
  })

  test("'mark all read' posts to the API and refreshes the list", async ({ page }) => {
    let unread = 1
    await mockApi(page, "/notifications/unread-count", () => ({ body: { unreadCount: unread } }))
    const marked = await mockApi(
      page,
      "/notifications/read",
      () => {
        unread = 0
        return { status: 204 }
      },
      "POST"
    )
    await page.goto("/home/notifications")
    const button = page.getByRole("button", { name: "Đánh dấu đã đọc" })
    await expect(button).toBeEnabled()
    await button.click()
    await expect(button).toBeDisabled()
    expect(marked).toHaveLength(1)
  })

  test("shows the empty state", async ({ page }) => {
    await mockApi(page, "/notifications", { body: { items: [], nextCursor: null } })
    await mockApi(page, "/notifications/unread-count", { body: { unreadCount: 0 } })
    await page.goto("/home/notifications")
    await expect(page.getByText("Chưa có thông báo")).toBeVisible()
    await expect(page.getByRole("button", { name: "Đánh dấu đã đọc" })).toBeDisabled()
  })

  test("shows an error when the list fails to load", async ({ page }) => {
    await mockApi(page, "/notifications", { status: 500, body: { statusCode: 500, message: "boom" } })
    await page.goto("/home/notifications")
    await expect(appAlerts(page)).toContainText("Không tải được thông báo")
  })
})
