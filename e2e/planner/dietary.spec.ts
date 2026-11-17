import { signInAs } from "../helpers/auth"
import { mockApi } from "../helpers/api"
import { test, expect, appAlerts } from "../helpers/test"

test.describe("dietary profile", () => {
  test.beforeEach(async ({ context }) => {
    await signInAs(context, "member")
  })

  test("shows the saved choices and a disabled save button", async ({ page }) => {
    await page.goto("/home/dietary")
    await expect(page).toHaveTitle(/Hồ sơ ăn uống · Vedora/)
    await expect(page.getByRole("heading", { name: "Hồ sơ ăn uống", level: 1 })).toBeVisible()
    await expect(page.getByText("Thực phẩm tôi không ăn")).toBeVisible()
    // Saved: avoids "Đậu phộng", likes "Nấm hương".
    await expect(page.getByText("Đậu phộng").first()).toBeVisible()
    await expect(page.getByText("Nấm hương").first()).toBeVisible()
    await expect(page.getByRole("button", { name: "Lưu", exact: true })).toBeDisabled()
    await expect(page.getByRole("button", { name: "Huỷ thay đổi" })).toBeDisabled()
  })

  test("the back link leads to the profile", async ({ page }) => {
    await page.goto("/home/dietary")
    await expect(page.locator('a[aria-label="Quay lại hồ sơ"]')).toHaveAttribute("href", "/profile/u-member")
  })

  test("choosing an ingredient enables saving and sends the ids", async ({ page }) => {
    const saved = await mockApi(
      page,
      "/dietary/me",
      (route) => {
        const sent = JSON.parse(route.request().postData() ?? "{}")
        return {
          body: {
            ingredients: [{ id: "i-1", name: "Đậu phộng" }, { id: "i-3", name: "Cà chua" }],
            groups: [],
            liked: [{ id: "i-2", name: "Nấm hương" }],
            echo: sent,
          },
        }
      },
      "PUT"
    )
    await page.goto("/home/dietary")
    await page.getByLabel("Nguyên liệu riêng lẻ").click()
    await page.getByRole("option", { name: "Cà chua" }).click()
    await page.keyboard.press("Escape")
    await expect(page.getByText("Có thay đổi chưa lưu.")).toBeVisible()
    await page.getByRole("button", { name: "Lưu", exact: true }).click()
    await expect(page.getByText("Đã lưu.")).toBeVisible()
    expect(saved).toHaveLength(1)
    expect(saved[0].body).toEqual({
      groupIds: [],
      ingredientIds: ["i-1", "i-3"],
      likedIngredientIds: ["i-2"],
    })
  })

  test("blocks saving an ingredient that is both liked and avoided", async ({ page }) => {
    await page.goto("/home/dietary")
    await page.getByLabel("Nguyên liệu tôi thích").click()
    await page.getByRole("option", { name: "Đậu phộng" }).click()
    await page.keyboard.press("Escape")
    await expect(page.getByText(/Không thể vừa thích vừa tránh: Đậu phộng/)).toBeVisible()
    await expect(page.getByRole("button", { name: "Lưu", exact: true })).toBeDisabled()
  })

  test("shows the API failure when saving fails", async ({ page }) => {
    await mockApi(page, "/dietary/me", { status: 500, body: { statusCode: 500, message: "boom" } }, "PUT")
    await page.goto("/home/dietary")
    await page.getByLabel("Nguyên liệu riêng lẻ").click()
    await page.getByRole("option", { name: "Cà chua" }).click()
    await page.keyboard.press("Escape")
    await page.getByRole("button", { name: "Lưu", exact: true }).click()
    await expect(page.getByText("Không lưu được. Thử lại nhé.")).toBeVisible()
  })

  test("shows an error when the lists cannot be loaded", async ({ page }) => {
    await mockApi(page, "/dietary/options", { status: 500, body: { statusCode: 500, message: "boom" } })
    await page.goto("/home/dietary")
    await expect(appAlerts(page)).toContainText("Không tải được danh sách.")
  })

  test("requires sign-in", async ({ browser }) => {
    const context = await browser.newContext()
    const page = await context.newPage()
    await page.goto("http://localhost:3000/home/dietary")
    await expect(page).toHaveURL(/\/login\?next=%2Fhome%2Fdietary/)
    await context.close()
  })
})
