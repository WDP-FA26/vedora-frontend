import { signInAs } from "../helpers/auth"
import { test, expect } from "../helpers/test"

test.describe("bookmarks", () => {
  test.beforeEach(async ({ context }) => {
    await signInAs(context, "member")
  })

  test("renders the saved-content tabs", async ({ page }) => {
    await page.goto("/home/bookmarks")
    await expect(page).toHaveTitle(/Đã lưu · Vedora/)
    await expect(page.getByRole("tablist", { name: "Loại nội dung đã lưu" })).toBeVisible()
  })
})
