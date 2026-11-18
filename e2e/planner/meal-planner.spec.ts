import { filledMealPlan, shoppingList } from "../fixtures/data-extra.mjs"
import { signInAs } from "../helpers/auth"
import { mockApi } from "../helpers/api"
import { test, expect } from "../helpers/test"

test.describe("meal planner", () => {
  test.beforeEach(async ({ context }) => {
    await signInAs(context, "member")
  })

  test("renders the assistant and, with an empty plan, the request form", async ({ page }) => {
    await page.goto("/meal-planner")
    await expect(page).toHaveTitle(/Lên thực đơn · Vedora/)
    await expect(page.getByRole("heading", { name: "Trợ lý Vedora" })).toBeVisible()
    await expect(page.getByRole("textbox", { name: "Tin nhắn cho trợ lý" })).toBeVisible()
    await expect(page.getByRole("heading", { name: "Lên thực đơn", level: 2 })).toBeVisible()
    await expect(page.getByRole("heading", { name: "1. Thực đơn cần lập" })).toBeVisible()
    await expect(page.getByRole("button", { name: /Đưa yêu cầu vào chat/ })).toBeVisible()
  })

  test("the send button stays disabled until something is typed", async ({ page }) => {
    await page.goto("/meal-planner")
    const send = page.getByRole("button", { name: "Gửi", exact: true })
    await expect(send).toBeDisabled()
    await page.getByRole("textbox", { name: "Tin nhắn cho trợ lý" }).fill("Gợi ý bữa tối nhẹ")
    await expect(send).toBeEnabled()
  })

  test("shows the saved week with its recipes", async ({ page }) => {
    await mockApi(page, "/meal-plan", { body: filledMealPlan }, "GET")
    await page.goto("/meal-planner")
    await expect(page.getByRole("heading", { name: "Thực đơn tuần" })).toBeVisible()
    await expect(page.getByText("Cháo nấm").first()).toBeVisible()
    await expect(page.getByText("Đậu hũ sốt cà chua").first()).toBeVisible()
    const days = page.getByRole("group", { name: "Chọn ngày trong thực đơn" })
    await days.getByRole("button", { name: /Thứ Hai/ }).click()
    await expect(days.getByRole("button", { name: /Thứ Hai/ })).toHaveAttribute("aria-pressed", "true")
    await expect(page.getByRole("region", { name: "Các bữa Thứ Hai" })).toContainText("Cháo nấm")
  })

  test("flags plan problems and links to the dietary profile", async ({ page }) => {
    await mockApi(page, "/meal-plan", {
      body: {
        ...filledMealPlan,
        problems: [
          { code: "AVOIDED_INGREDIENT", day: "MON", recipes: ["Cháo nấm"], ingredients: ["đậu phộng"], reason: null },
        ],
      },
    }, "GET")
    await page.goto("/meal-planner")
    await expect(page.getByText("Thực đơn có chỗ cần xem lại")).toBeVisible()
    await expect(page.getByText(/Cháo nấm có đậu phộng/)).toBeVisible()
    await expect(page.getByRole("link", { name: "Xem hồ sơ ăn uống" })).toHaveAttribute("href", "/home/dietary")
  })

  test("shows an error with retry when the plan cannot be loaded", async ({ page }) => {
    await mockApi(page, "/meal-plan", { status: 500, body: { statusCode: 500, message: "boom" } }, "GET")
    await page.goto("/meal-planner")
    await expect(page.getByText("Không tải được thực đơn")).toBeVisible()
    await expect(page.getByRole("button", { name: "Thử lại" })).toBeVisible()
  })

  test("the shopping list opens with the aggregated ingredients", async ({ page }) => {
    await mockApi(page, "/meal-plan", { body: filledMealPlan }, "GET")
    await mockApi(page, "/meal-plan/shopping-list", { body: shoppingList })
    await page.goto("/meal-planner")
    await page.getByRole("button", { name: /đi chợ/i }).click()
    await expect(page.getByRole("dialog")).toContainText("Đậu hũ")
    await expect(page.getByRole("dialog")).toContainText("300")
  })
})

test.describe("meal planner preview (dev only)", () => {
  test("renders the static preview", async ({ page, context }) => {
    await signInAs(context, "member")
    const response = await page.goto("/home/meal-planner/preview")
    expect(response?.status()).toBe(200)
    await expect(page.locator("main, section").first()).toBeVisible()
  })

  test("requires sign-in", async ({ page }) => {
    await page.goto("/home/meal-planner/preview")
    await expect(page).toHaveURL(/\/login\?next=/)
  })
})
