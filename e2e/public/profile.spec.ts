import { signInAs } from "../helpers/auth"
import { mockApi } from "../helpers/api"
import { test, expect } from "../helpers/test"

test.describe("profile (guest)", () => {
  test("renders the header, stats and posts", async ({ page }) => {
    await page.goto("/profile/u-chef")
    const profile = page.getByRole("article", { name: "Hồ sơ của Lê Bếp Chay" })
    await expect(profile.getByRole("heading", { name: "Lê Bếp Chay" })).toBeVisible()
    await expect(profile).toContainText("@bepchay")
    await expect(profile).toContainText("Đầu bếp chay, yêu thích món Việt.")
    await expect(profile.getByRole("link", { name: /Người theo dõi/ })).toHaveAttribute(
      "href",
      "/profile/u-chef/followers"
    )
    await expect(profile.getByRole("link", { name: /Đang theo dõi/ })).toHaveAttribute(
      "href",
      "/profile/u-chef/following"
    )
    await expect(profile.getByRole("article", { name: "Bài viết của Lê Bếp Chay" })).toHaveCount(2)
  })

  test("the follow button sends guests to login and returns them here", async ({ page }) => {
    await page.goto("/profile/u-chef")
    await expect(page.getByRole("heading", { name: "Lê Bếp Chay" })).toBeVisible()
    await page.locator("a", { hasText: /^Theo dõi$/ }).click()
    await expect(page).toHaveURL(/\/login\?next=%2Fprofile%2Fu-chef/)
  })

  test("shows a not-found state for an unknown profile", async ({ page }) => {
    await page.goto("/profile/nobody")
    await expect(page.getByRole("heading", { name: "Không tìm thấy hồ sơ" })).toBeVisible()
  })

  test("shows a retryable error when the profile fails to load", async ({ page }) => {
    let calls = 0
    await mockApi(page, "/profiles/u-chef", () => {
      calls += 1
      return calls === 1 ? { status: 500, body: { statusCode: 500, message: "boom" } } : {}
    })
    await page.goto("/profile/u-chef")
    await expect(page.getByRole("heading", { name: "Chưa tải được hồ sơ" })).toBeVisible()
    await expect(page.getByRole("button", { name: "Thử lại" })).toBeVisible()
  })
})

test.describe("profile (signed in)", () => {
  test.beforeEach(async ({ context }) => {
    await signInAs(context, "member")
  })

  test("own profile offers editing and the own-content tabs", async ({ page }) => {
    await page.goto("/profile/u-member")
    await expect(page.getByRole("button", { name: "Chỉnh sửa hồ sơ" })).toBeVisible()
    await expect(page.getByRole("button", { name: /Video của tôi/ })).toBeVisible()
    await expect(page.getByRole("button", { name: /Blog của tôi/ })).toBeVisible()
    await expect(page.getByText("Thêm lời giới thiệu để mọi người hiểu hơn về bạn.")).toBeVisible()
  })

  test("someone else's profile offers follow and message, not edit", async ({ page }) => {
    await page.goto("/profile/u-chef")
    await expect(page.getByRole("button", { name: "Theo dõi" })).toBeVisible()
    await expect(page.locator("a", { hasText: "Nhắn tin" })).toHaveAttribute(
      "href",
      "/home/messages?to=u-chef"
    )
    await expect(page.getByRole("button", { name: "Chỉnh sửa hồ sơ" })).toHaveCount(0)
  })

  test("following a profile calls the API and flips the button", async ({ page }) => {
    let following = false
    await mockApi(page, "/profiles/u-chef/relationship", () => ({ body: { isFollowing: following } }))
    const calls = await mockApi(
      page,
      "/profiles/u-chef/follow",
      () => {
        following = true
        return { status: 204 }
      },
      "PUT"
    )
    await page.goto("/profile/u-chef")
    await page.getByRole("button", { name: "Theo dõi", exact: true }).click()
    await expect(page.getByRole("button", { name: "Đang theo dõi" })).toBeVisible()
    expect(calls.length).toBeGreaterThan(0)
  })

  test("the edit dialog validates the display name", async ({ page }) => {
    await page.goto("/profile/u-member")
    await page.getByRole("button", { name: "Chỉnh sửa hồ sơ" }).click()
    const dialog = page.getByRole("dialog")
    await expect(dialog).toBeVisible()
    await dialog.getByLabel("Tên hiển thị").fill("")
    await dialog.getByRole("button", { name: "Lưu thay đổi" }).click()
    await expect(dialog.getByText("Nhập tên hiển thị")).toBeVisible()
  })
})
