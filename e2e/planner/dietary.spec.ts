import { signInAs } from "../helpers/auth"
import { mockApi } from "../helpers/api"
import { test, expect, appAlerts } from "../helpers/test"

test.describe("dietary profile", () => {
  test.beforeEach(async ({ context }) => {
    await signInAs(context, "member")
  })

  test("shows the saved memory and a disabled save button", async ({ page }) => {
    await page.goto("/home/dietary")
    await expect(page).toHaveTitle(/Hồ sơ ăn uống · Vedora/)
    await expect(page.getByRole("heading", { name: "Hồ sơ ăn uống", level: 1 })).toBeVisible()
    await expect(page.getByText("Ghi nhớ của trợ lý")).toBeVisible()
    await expect(page.getByLabel("Dị ứng & không ăn")).toHaveValue("Dị ứng đậu phộng")
    await expect(page.getByLabel("Sở thích & thói quen")).toHaveValue("Thích nấm hương")
    await expect(page.getByRole("button", { name: "Lưu hồ sơ ăn uống" })).toBeDisabled()
    await expect(page.getByRole("button", { name: "Huỷ thay đổi" })).toBeDisabled()
  })

  test("the back link leads to the profile", async ({ page }) => {
    await page.goto("/home/dietary")
    await expect(page.locator('a[aria-label="Quay lại hồ sơ"]')).toHaveAttribute("href", "/profile/u-member")
  })

  test("sends one line per fact, without blanks or repeats", async ({ page }) => {
    const saved = await mockApi(
      page,
      "/dietary/me",
      (route) => ({ body: JSON.parse(route.request().postData() ?? "{}") }),
      "PUT"
    )
    await page.goto("/home/dietary")
    await page.getByLabel("Dị ứng & không ăn").fill("Dị ứng đậu phộng\n\n  Dị ứng mè  \nDị ứng đậu phộng")
    await expect(page.getByText("Có thay đổi chưa lưu.")).toBeVisible()
    await page.getByRole("button", { name: "Lưu hồ sơ ăn uống" }).click()
    await expect(page.getByText("Đã lưu.")).toBeVisible()
    expect(saved).toHaveLength(1)
    expect(saved[0].body).toEqual({
      allergies: ["Dị ứng đậu phộng", "Dị ứng mè"],
      preferences: ["Thích nấm hương"],
    })
    await expect(page.getByLabel("Dị ứng & không ăn")).toHaveValue("Dị ứng đậu phộng\nDị ứng mè")
  })

  test("blocks saving a line that is too long", async ({ page }) => {
    await page.goto("/home/dietary")
    await page.getByLabel("Sở thích & thói quen").fill("x".repeat(201))
    await page.getByRole("button", { name: "Lưu hồ sơ ăn uống" }).click()
    await expect(page.getByText("Mỗi dòng tối đa 200 ký tự.")).toBeVisible()
  })

  test("shows the API failure when saving fails", async ({ page }) => {
    await mockApi(page, "/dietary/me", { status: 500, body: { statusCode: 500, message: "boom" } }, "PUT")
    await page.goto("/home/dietary")
    await page.getByLabel("Dị ứng & không ăn").fill("Dị ứng mè")
    await page.getByRole("button", { name: "Lưu hồ sơ ăn uống" }).click()
    await expect(page.getByText("Không lưu được. Thử lại nhé.")).toBeVisible()
  })

  test("shows an error when the memory cannot be loaded", async ({ page }) => {
    await mockApi(page, "/dietary/me", { status: 500, body: { statusCode: 500, message: "boom" } })
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
