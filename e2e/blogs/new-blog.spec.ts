import { signInAs } from "../helpers/auth"
import { mockApi } from "../helpers/api"
import { test, expect } from "../helpers/test"

test.describe("new blog", () => {
  test.beforeEach(async ({ context }) => {
    await signInAs(context, "member")
  })

  test("renders the editor with the title and body fields", async ({ page }) => {
    await page.goto("/blogs/new")
    await expect(page).toHaveTitle(/Viết blog · Vedora/)
    await expect(page.getByRole("textbox", { name: "Tiêu đề bài viết" })).toBeVisible()
    await expect(page.getByRole("textbox", { name: "Nội dung bài viết" })).toBeVisible()
    await expect(page.locator('a[aria-label="Quay lại danh sách blog"]')).toHaveAttribute(
      "href",
      "/home/blogs"
    )
  })

  test("publishing is disabled until there is a title and content", async ({ page }) => {
    await page.goto("/blogs/new")
    const publish = page.getByRole("button", { name: "Đăng", exact: true })
    await expect(publish).toBeDisabled()

    await page.getByRole("textbox", { name: "Tiêu đề bài viết" }).fill("Món chay cuối tuần")
    await expect(publish).toBeDisabled()

    await page.getByRole("textbox", { name: "Nội dung bài viết" }).click()
    await page.keyboard.type("Đậu hũ sốt cà chua rất dễ làm.")
    await expect(publish).toBeEnabled()
  })

  test("saving a draft without a title shows a validation error", async ({ page }) => {
    const requests = await mockApi(page, "/blogs", { status: 201, body: {} }, "POST")
    await page.goto("/blogs/new")
    await page.getByRole("button", { name: "Lưu nháp" }).click()
    await expect(page.getByRole("status")).toContainText("Nhập tiêu đề trước khi lưu.")
    expect(requests).toHaveLength(0)
  })

  test("saving a draft creates the blog and updates the URL", async ({ page }) => {
    const requests = await mockApi(
      page,
      "/blogs",
      (route) => {
        const sent = JSON.parse(route.request().postData() ?? "{}") as { title: string; content: string }
        return {
          status: 201,
          body: {
            id: "b-new",
            status: "DRAFT",
            content: sent.content,
            updatedAt: new Date().toISOString(),
            blog: { title: sent.title, coverImageUrl: null, excerpt: "" },
          },
        }
      },
      "POST"
    )
    await page.goto("/blogs/new")
    await page.getByRole("textbox", { name: "Tiêu đề bài viết" }).fill("Món chay cuối tuần")
    await page.getByRole("textbox", { name: "Nội dung bài viết" }).click()
    await page.keyboard.type("Đậu hũ sốt cà chua rất dễ làm.")
    await page.getByRole("button", { name: "Lưu nháp" }).click()

    await expect(page.getByRole("status")).toContainText("Đã lưu")
    await expect(page).toHaveURL(/\/blogs\/b-new\/edit$/)
    expect(requests).toHaveLength(1)
    expect(requests[0].body).toMatchObject({ title: "Món chay cuối tuần" })
    expect((requests[0].body as { content: string }).content).toContain("Đậu hũ sốt cà chua")
  })

  test("shows the API's message when saving fails", async ({ page }) => {
    await mockApi(page, "/blogs", { status: 500, body: { statusCode: 500, message: "boom" } }, "POST")
    await page.goto("/blogs/new")
    await page.getByRole("textbox", { name: "Tiêu đề bài viết" }).fill("Tiêu đề")
    await page.getByRole("button", { name: "Lưu nháp" }).click()
    await expect(page.getByRole("status")).toContainText("Không lưu được. Thử lại nhé.")
  })

  test("publishing sends status PUBLISHED and offers 'back to draft'", async ({ page }) => {
    const requests = await mockApi(
      page,
      "/blogs",
      (route) => {
        const sent = JSON.parse(route.request().postData() ?? "{}") as { title: string; content: string }
        return {
          status: 201,
          body: {
            id: "b-new",
            status: "PUBLISHED",
            content: sent.content,
            updatedAt: new Date().toISOString(),
            blog: { title: sent.title, coverImageUrl: null, excerpt: "" },
          },
        }
      },
      "POST"
    )
    await page.goto("/blogs/new")
    await page.getByRole("textbox", { name: "Tiêu đề bài viết" }).fill("Món chay cuối tuần")
    await page.getByRole("textbox", { name: "Nội dung bài viết" }).click()
    await page.keyboard.type("Nội dung")
    await page.getByRole("button", { name: "Đăng", exact: true }).click()

    await expect(page.getByRole("button", { name: "Chuyển về nháp" })).toBeVisible()
    expect(requests[0].body).toMatchObject({ status: "PUBLISHED" })
  })
})

test.describe("edit blog", () => {
  test("loads an existing blog into the editor", async ({ page, context }) => {
    await signInAs(context, "chef")
    await page.goto("/blogs/p-blog/edit")
    await expect(page.getByRole("textbox", { name: "Tiêu đề bài viết" })).toHaveValue(
      "Cách ủ tương đậu nành tại nhà"
    )
    await expect(page.getByRole("textbox", { name: "Nội dung bài viết" })).toContainText("Đậu nành, muối, nước sạch.")
    // A published blog is saved explicitly and can go back to draft.
    await expect(page.getByRole("button", { name: "Chuyển về nháp" })).toBeVisible()
  })

  test("requires sign-in", async ({ page }) => {
    await page.goto("/blogs/p-blog/edit")
    await expect(page).toHaveURL(/\/login\?next=/)
  })
})
