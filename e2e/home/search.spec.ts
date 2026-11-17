import { signInAs } from "../helpers/auth"
import { mockApi } from "../helpers/api"
import { test, expect, appAlerts } from "../helpers/test"

test.describe("search", () => {
  test.beforeEach(async ({ context }) => {
    await signInAs(context, "member")
  })

  test("shows the prompt state without a query", async ({ page }) => {
    await page.goto("/home/search")
    await expect(page).toHaveTitle(/Tìm kiếm · Vedora/)
    await expect(page.getByText("Tìm bài viết trên Vedora")).toBeVisible()
    await expect(page.getByRole("searchbox", { name: "Tìm kiếm trên Vedora" })).toBeFocused()
  })

  test("submitting the search box navigates to ?q= and lists matches", async ({ page }) => {
    await page.goto("/home/search")
    await page.getByRole("searchbox", { name: "Tìm kiếm trên Vedora" }).fill("phở")
    await page.keyboard.press("Enter")
    await expect(page).toHaveURL(/\/home\/search\?q=/)
    await expect(page.getByRole("article", { name: "Bài viết của Lê Bếp Chay" })).toContainText("Phở chay")
  })

  test("shows the empty state when nothing matches", async ({ page }) => {
    await page.goto("/home/search?q=khongcokq")
    await expect(page.getByText("Không có bài viết phù hợp")).toBeVisible()
  })

  test("shows an error when the search API fails", async ({ page }) => {
    await mockApi(page, "/posts/search", { status: 500, body: { statusCode: 500, message: "down" } })
    await page.goto("/home/search?q=pho")
    await expect(appAlerts(page)).toContainText("Không tìm được lúc này")
  })

  test("offers 'load more' when the API returns a cursor", async ({ page }) => {
    const first = {
      id: "p-1",
      type: "POST",
      status: "PUBLISHED",
      body: "Kết quả trang một",
      publishedAt: new Date().toISOString(),
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
    }
    await mockApi(page, "/posts/search", (route) => {
      const cursor = new URL(route.request().url()).searchParams.get("cursor")
      return cursor
        ? { body: { items: [{ ...first, id: "p-2", body: "Kết quả trang hai" }], nextCursor: null } }
        : { body: { items: [first], nextCursor: "next" } }
    })
    await page.goto("/home/search?q=ket")
    await expect(page.getByText("Kết quả trang một")).toBeVisible()
    await page.getByRole("button", { name: "Xem thêm kết quả" }).click()
    await expect(page.getByText("Kết quả trang hai")).toBeVisible()
    await expect(page.getByRole("button", { name: "Xem thêm kết quả" })).toHaveCount(0)
  })
})
