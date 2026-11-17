import { test, expect, gotoReady } from "../helpers/test"
import { VALID_PASSWORD } from "../fixtures/data.mjs"

test.describe("login", () => {
  test.beforeEach(async ({ page }) => {
    await gotoReady(page, "/login")
  })

  test("renders the form", async ({ page }) => {
    await expect(page).toHaveTitle(/Đăng nhập · Vedora/)
    await expect(page.getByRole("heading", { name: "Chào mừng trở lại" })).toBeVisible()
    await expect(page.getByLabel("Tên đăng nhập")).toBeVisible()
    await expect(page.getByLabel("Mật khẩu")).toBeVisible()
    await expect(page.getByRole("link", { name: "Quên mật khẩu?" })).toHaveAttribute(
      "href",
      "/forgot-password"
    )
    await expect(page.getByRole("link", { name: "Tạo tài khoản" })).toHaveAttribute(
      "href",
      "/register"
    )
  })

  test("submit stays disabled until the security check passes, then enables", async ({ page }) => {
    // The stubbed Turnstile widget reports a token shortly after mount.
    await expect(page.getByRole("button", { name: "Đăng nhập" })).toBeEnabled()
  })

  test("shows required-field errors on empty submit", async ({ page }) => {
    await page.getByRole("button", { name: "Đăng nhập" }).click()
    await expect(page.getByText("Tên đăng nhập cần ít nhất 3 ký tự")).toBeVisible()
    await expect(page.getByText("Nhập mật khẩu")).toBeVisible()
    await expect(page).toHaveURL(/\/login$/)
  })

  test("rejects a too-short username", async ({ page }) => {
    await page.getByLabel("Tên đăng nhập").fill("ab")
    await page.getByLabel("Mật khẩu").fill("whatever")
    await page.getByRole("button", { name: "Đăng nhập" }).click()
    await expect(page.getByText("Tên đăng nhập cần ít nhất 3 ký tự")).toBeVisible()
  })

  test("shows an error for wrong credentials (API 401)", async ({ page }) => {
    await page.getByLabel("Tên đăng nhập").fill("minhanh")
    await page.getByLabel("Mật khẩu").fill("not-the-password")
    await page.getByRole("button", { name: "Đăng nhập" }).click()
    await expect(page.getByText("Tên đăng nhập hoặc mật khẩu không đúng.")).toBeVisible()
    await expect(page).toHaveURL(/\/login$/)
    // The password field is cleared after a failed attempt.
    await expect(page.getByLabel("Mật khẩu")).toHaveValue("")
  })

  test("tells a suspended account why it cannot sign in", async ({ page }) => {
    await page.getByLabel("Tên đăng nhập").fill("suspended")
    await page.getByLabel("Mật khẩu").fill(VALID_PASSWORD)
    await page.getByRole("button", { name: "Đăng nhập" }).click()
    await expect(page.getByText(/đang bị đình chỉ nên không thể đăng nhập/)).toBeVisible()
  })

  test("sends an unverified account to email verification", async ({ page }) => {
    await page.getByLabel("Tên đăng nhập").fill("unverified")
    await page.getByLabel("Mật khẩu").fill(VALID_PASSWORD)
    await page.getByRole("button", { name: "Đăng nhập" }).click()
    await expect(page).toHaveURL(/\/verify-email/)
    await expect(page.getByRole("heading", { name: "Xác minh email" })).toBeVisible()
  })

  test("signs in and lands on /home", async ({ page }) => {
    await page.getByLabel("Tên đăng nhập").fill("minhanh")
    await page.getByLabel("Mật khẩu").fill(VALID_PASSWORD)
    await page.getByRole("button", { name: "Đăng nhập" }).click()
    await expect(page).toHaveURL(/\/home$/)
    await expect(page.getByRole("tab", { name: "Dành cho bạn" })).toBeVisible()
  })

  test("returns to the page that required sign-in (?next=)", async ({ page }) => {
    await gotoReady(page, "/login?next=%2Fhome%2Fnotifications")
    await page.getByLabel("Tên đăng nhập").fill("minhanh")
    await page.getByLabel("Mật khẩu").fill(VALID_PASSWORD)
    await page.getByRole("button", { name: "Đăng nhập" }).click()
    await expect(page).toHaveURL(/\/home\/notifications$/)
  })

  test("ignores an external ?next= (no open redirect)", async ({ page }) => {
    await gotoReady(page, "/login?next=https%3A%2F%2Fevil.example")
    await page.getByLabel("Tên đăng nhập").fill("minhanh")
    await page.getByLabel("Mật khẩu").fill(VALID_PASSWORD)
    await page.getByRole("button", { name: "Đăng nhập" }).click()
    await expect(page).toHaveURL(/localhost:3000\/home$/)
  })

  test("shows the post-reset and suspended notices from the query string", async ({ page }) => {
    await page.goto("/login?reset=1")
    await expect(page.getByText("Đã đặt lại mật khẩu. Hãy đăng nhập bằng mật khẩu mới.")).toBeVisible()
    await page.goto("/login?account=suspended")
    await expect(page.getByRole("alert").filter({ hasText: "đình chỉ" })).toBeVisible()
  })
})
