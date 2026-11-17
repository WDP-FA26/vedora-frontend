import { signInAs } from "../helpers/auth"
import { mockApi } from "../helpers/api"
import { test, expect } from "../helpers/test"

test.describe("home feed", () => {
  test.beforeEach(async ({ context }) => {
    await signInAs(context, "member")
  })

  test("renders the timeline tabs and the signed-in user's menu", async ({ page }) => {
    await page.goto("/home")
    await expect(page).toHaveTitle(/Khám phá · Vedora/)
    const tabs = page.getByRole("tablist", { name: "Dòng thời gian" })
    for (const name of ["Dành cho bạn", "Đang theo dõi", "Blog", "Công thức"]) {
      await expect(tabs.getByRole("tab", { name })).toBeVisible()
    }
    await expect(page.getByRole("button", { name: "Menu tài khoản của Nguyễn Minh Anh" })).toBeVisible()
  })

  test("shows the mocked 'for you' posts", async ({ page }) => {
    await page.goto("/home")
    const chef = page.getByRole("article", { name: "Bài viết của Lê Bếp Chay" })
    await expect(chef).toBeVisible()
    await expect(chef).toContainText("Phở chay nước dùng nấm hương và hồi")
    await expect(chef).toContainText("@bepchay")
    await expect(page.getByRole("article", { name: "Bài viết của Nguyễn Minh Anh" })).toContainText(
      "đậu hũ sốt cà chua"
    )
  })

  test("the 'following' tab loads its own list", async ({ page }) => {
    await page.goto("/home")
    await page.getByRole("tab", { name: "Đang theo dõi" }).click()
    await expect(page.getByRole("tabpanel").getByRole("article")).toHaveCount(1)
  })

  test("the 'blog' tab lists published blogs only", async ({ page }) => {
    await page.goto("/home")
    await page.getByRole("tab", { name: "Blog" }).click()
    const panel = page.getByRole("tabpanel")
    await expect(panel.getByText("Cách ủ tương đậu nành tại nhà")).toBeVisible()
    await expect(panel.getByRole("article")).toHaveCount(1)
  })

  test("shows the empty state when the API returns no posts", async ({ page }) => {
    await mockApi(page, "/posts/feed", { body: { items: [], nextCursor: null } })
    await page.goto("/home")
    await expect(page.getByText("Chưa có bài viết dành cho bạn")).toBeVisible()
  })

  test("shows an error with a working retry when the feed fails", async ({ page }) => {
    let calls = 0
    await mockApi(page, "/posts/feed", () => {
      calls += 1
      return calls === 1
        ? { status: 500, body: { statusCode: 500, message: "boom" } }
        : { body: { items: [], nextCursor: null } }
    })
    await page.goto("/home")
    const alert = page.getByRole("alert").filter({ hasText: "Không tải được bài viết mới" })
    await expect(alert).toBeVisible()
    await alert.getByRole("button", { name: "Thử lại" }).click()
    await expect(page.getByText("Chưa có bài viết dành cho bạn")).toBeVisible()
  })

  test("only published posts are shown", async ({ page }) => {
    await mockApi(page, "/posts/feed", {
      body: {
        items: [
          {
            id: "p-processing",
            type: "POST",
            status: "PROCESSING",
            body: "Bài đang xử lý không được hiển thị",
            publishedAt: null,
            createdAt: new Date().toISOString(),
            author: { id: "u-chef", username: "bepchay", fullName: "Lê Bếp Chay", avatarUrl: null },
            media: [],
            commentCount: 0,
            likeCount: 0,
            isLiked: false,
            repostCount: 0,
            isReposted: false,
            isBookmarked: false,
            viewCount: 0,
          },
        ],
        nextCursor: null,
      },
    })
    await page.goto("/home")
    await expect(page.getByText("Chưa có bài viết dành cho bạn")).toBeVisible()
    await expect(page.getByText("Bài đang xử lý không được hiển thị")).toHaveCount(0)
  })

  test("liking a post sends PUT /like and flips the button", async ({ page }) => {
    const requests = await mockApi(
      page,
      "/posts/p-1/like",
      { body: { isLiked: true, likeCount: 8 } },
      "PUT"
    )
    await page.goto("/home")
    const card = page.getByRole("article", { name: "Bài viết của Lê Bếp Chay" })
    await card.getByRole("button", { name: /^Thích, / }).click()
    await expect(card.getByRole("button", { name: /^Bỏ thích, / })).toBeVisible()
    expect(requests.map((request) => request.method)).toEqual(["PUT"])
  })

  test("the post's time links to its own page", async ({ page }) => {
    await page.goto("/home")
    const card = page.getByRole("article", { name: "Bài viết của Lê Bếp Chay" })
    await card.getByRole("link", { name: /Mở bài viết/ }).click()
    await expect(page).toHaveURL(/\/posts\/p-1$/)
  })
})
