import { test, expect } from "../helpers/test"

test.describe("landing page", () => {
  test("renders the hero and calls to action", async ({ page }) => {
    await page.goto("/")
    await expect(page).toHaveTitle(/Giới thiệu · Vedora/)
    await expect(page.getByRole("heading", { level: 1, name: "Ăn xanh hơn, sống nhẹ hơn." })).toBeVisible()
    await expect(page.locator("a", { hasText: "Vào Vedora" })).toHaveAttribute("href", "/home")
  })

  test("has the theme and sound controls", async ({ page }) => {
    await page.goto("/")
    await expect(page.getByRole("button", { name: "Giao diện" })).toBeVisible()
    const sound = page.getByRole("button", { name: "Bật âm thanh" })
    await expect(sound).toHaveAttribute("aria-pressed", "false")
  })

  test("the closing section links into the app", async ({ page }) => {
    await page.goto("/")
    const cta = page.locator("a", { hasText: "Khám phá Vedora" })
    await cta.scrollIntoViewIfNeeded()
    await expect(cta).toHaveAttribute("href", "/home")
  })

  test("'Vào Vedora' sends a signed-out visitor through login", async ({ page }) => {
    await page.goto("/")
    await page.locator("a", { hasText: "Vào Vedora" }).click()
    await expect(page).toHaveURL(/\/login\?next=%2Fhome/)
  })

  test("serves robots.txt and a sitemap", async ({ request }) => {
    expect((await request.get("/robots.txt")).ok()).toBeTruthy()
    expect((await request.get("/sitemap.xml")).status()).toBeLessThan(500)
  })
})
