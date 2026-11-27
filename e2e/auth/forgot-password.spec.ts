import { test, expect, gotoReady } from "../helpers/test"

test.describe("forgot password", () => {
  test.beforeEach(async ({ page }) => {
    await gotoReady(page, "/forgot-password")
  })

  test("renders the form", async ({ page }) => {
    await expect(page.getByRole("heading", { name: "Quên mật khẩu" })).toBeVisible()
    await expect(page.getByLabel("Email")).toBeVisible()
    await expect(page.getByRole("button", { name: "Gửi mã đặt lại" })).toBeVisible()
    await expect(page.getByRole("link", { name: "Đăng nhập" })).toHaveAttribute("href", "/login")
  })

  test("requires a valid email", async ({ page }) => {
    await page.getByRole("button", { name: "Gửi mã đặt lại" }).click()
    await expect(page.getByText("Email không hợp lệ")).toBeVisible()

    await page.getByLabel("Email").fill("nope")
    await page.getByRole("button", { name: "Gửi mã đặt lại" }).click()
    await expect(page.getByText("Email không hợp lệ")).toBeVisible()
    await expect(page).toHaveURL(/\/forgot-password$/)
  })

  test("shows the rate-limit message when the API answers 429", async ({ page }) => {
    await page.getByLabel("Email").fill("limited@example.com")
    await page.getByRole("button", { name: "Gửi mã đặt lại" }).click()
    await expect(page.getByText("Bạn đã yêu cầu mã quá nhiều lần. Vui lòng thử lại sau 1 giờ.")).toBeVisible()
  })

  test("sends the code and continues to the reset page", async ({ page }) => {
    await page.getByLabel("Email").fill("minhanh@example.com")
    await page.getByRole("button", { name: "Gửi mã đặt lại" }).click()
    await expect(page).toHaveURL(/\/reset-password$/)
    await expect(page.getByRole("heading", { name: "Đặt lại mật khẩu" })).toBeVisible()
    await expect(page.getByText("mi•••@example.com")).toBeVisible()
  })
})

test.describe("reset password", () => {
  test("redirects to /forgot-password when no code was requested", async ({ page }) => {
    await page.goto("/reset-password")
    await expect(page).toHaveURL(/\/forgot-password$/)
  })

  test("resets the password and returns to login with a notice", async ({ page }) => {
    await gotoReady(page, "/forgot-password")
    await page.getByLabel("Email").fill("minhanh@example.com")
    await page.getByRole("button", { name: "Gửi mã đặt lại" }).click()
    await expect(page).toHaveURL(/\/reset-password$/)

    await page.getByLabel("Mã đặt lại").fill("123456")
    await page.getByLabel("Mật khẩu mới", { exact: true }).fill("NewPassword123")
    await page.getByLabel("Nhập lại mật khẩu mới").fill("Different123")
    await page.getByRole("button", { name: "Đặt lại mật khẩu" }).click()
    await expect(page.getByText("Mật khẩu nhập lại không khớp")).toBeVisible()

    await page.getByLabel("Nhập lại mật khẩu mới").fill("NewPassword123")
    await page.getByRole("button", { name: "Đặt lại mật khẩu" }).click()
    await expect(page).toHaveURL(/\/login\?reset=1$/)
    await expect(page.getByText("Đã đặt lại mật khẩu. Hãy đăng nhập bằng mật khẩu mới.")).toBeVisible()
  })

  test("rejects a wrong code", async ({ page }) => {
    await gotoReady(page, "/forgot-password")
    await page.getByLabel("Email").fill("minhanh@example.com")
    await page.getByRole("button", { name: "Gửi mã đặt lại" }).click()
    await expect(page).toHaveURL(/\/reset-password$/)

    await page.getByLabel("Mã đặt lại").fill("000000")
    await page.getByLabel("Mật khẩu mới", { exact: true }).fill("NewPassword123")
    await page.getByLabel("Nhập lại mật khẩu mới").fill("NewPassword123")
    await page.getByRole("button", { name: "Đặt lại mật khẩu" }).click()
    await expect(page.getByText(/Mã không đúng hoặc đã hết hạn/)).toBeVisible()
  })
})
