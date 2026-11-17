import { signInAs } from "../helpers/auth"
import { mockApi } from "../helpers/api"
import { test, expect, appAlerts } from "../helpers/test"

test.describe("post detail (guest)", () => {
  test("renders the post, author and comments without signing in", async ({ page }) => {
    await page.goto("/posts/p-1")
    await expect(page).toHaveTitle(/Vedora/)
    await expect(page.getByRole("heading", { name: "Bài viết", level: 1 })).toBeVisible()
    const article = page.getByRole("article", { name: "Bài viết của Lê Bếp Chay" })
    await expect(article).toContainText("Phở chay nước dùng nấm hương và hồi")
    await expect(article).toContainText("@bepchay")
    await expect(page.getByRole("heading", { name: /Bình luận/ })).toBeVisible()
    await expect(page.getByRole("article", { name: "Bình luận của Nguyễn Minh Anh" })).toContainText(
      "Công thức này nhìn ngon quá!"
    )
  })

  test("asks guests to sign in before commenting", async ({ page }) => {
    await page.goto("/posts/p-1")
    const login = page.getByRole("link", { name: "Đăng nhập" }).last()
    await expect(login).toHaveAttribute("href", "/login?next=%2Fposts%2Fp-1")
    await expect(page.getByRole("textbox", { name: "Viết bình luận" })).toHaveCount(0)
  })

  test("the author name links to their profile", async ({ page }) => {
    await page.goto("/posts/p-1")
    await page
      .getByRole("article", { name: "Bài viết của Lê Bếp Chay" })
      .getByRole("link", { name: "Hồ sơ của Lê Bếp Chay" })
      .click()
    await expect(page).toHaveURL(/\/profile\/u-chef$/)
  })

  test("renders a blog's title and Markdown body", async ({ page }) => {
    await page.goto("/posts/p-blog")
    await expect(page.getByRole("heading", { level: 1, name: "Cách ủ tương đậu nành tại nhà" })).toBeVisible()
    await expect(page.getByRole("heading", { name: "Nguyên liệu" })).toBeVisible()
    await expect(page.getByText("Đậu nành, muối, nước sạch.")).toBeVisible()
  })

  test("shows a not-found message for an unknown post", async ({ page }) => {
    await page.goto("/posts/does-not-exist")
    await expect(appAlerts(page)).toContainText("Bài viết này không tồn tại hoặc đã bị xoá.")
  })
})

test.describe("post detail (signed in)", () => {
  test.beforeEach(async ({ context }) => {
    await signInAs(context, "member")
  })

  test("shows the comment form and posts a comment", async ({ page }) => {
    const created = await mockApi(
      page,
      "/posts/p-1/comments",
      (route) => ({
        status: 201,
        body: {
          id: "c-new",
          postId: "p-1",
          body: (JSON.parse(route.request().postData() ?? "{}") as { body: string }).body,
          author: { id: "u-member", username: "minhanh", fullName: "Nguyễn Minh Anh", avatarUrl: null },
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
      }),
      "POST"
    )
    await page.goto("/posts/p-1")
    const box = page.getByRole("textbox", { name: "Viết bình luận" })
    const submit = page.getByRole("button", { name: "Bình luận", exact: true })
    await expect(submit).toBeDisabled()
    await box.fill("Mình sẽ thử nấu cuối tuần này")
    await expect(submit).toBeEnabled()
    await submit.click()
    await expect(
      page.getByRole("list", { name: "Danh sách bình luận" }).getByText("Mình sẽ thử nấu cuối tuần này")
    ).toBeVisible()
    expect(created).toHaveLength(1)
    expect(created[0].body).toEqual({ body: "Mình sẽ thử nấu cuối tuần này" })
  })

  test("the back button returns to the previous page", async ({ page }) => {
    await page.goto("/home")
    await page
      .getByRole("article", { name: "Bài viết của Lê Bếp Chay" })
      .getByRole("link", { name: /Mở bài viết/ })
      .click()
    await expect(page).toHaveURL(/\/posts\/p-1$/)
    await page.getByRole("button", { name: "Quay lại" }).click()
    await expect(page).toHaveURL(/\/home$/)
  })
})
