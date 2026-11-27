import { test, expect, gotoReady } from "../helpers/test"

async function fillRegistration(
  page: import("@playwright/test").Page,
  overrides: Partial<Record<"last" | "first" | "username" | "email" | "password" | "confirm", string>> = {}
) {
  const values = {
    last: "Nguyễn",
    first: "Văn An",
    username: "vanan",
    email: "vanan@example.com",
    password: "Password123",
    confirm: "Password123",
    ...overrides,
  }
  await page.getByLabel("Họ", { exact: true }).fill(values.last)
  await page.getByLabel("Tên", { exact: true }).fill(values.first)
  await page.getByLabel("Tên đăng nhập").fill(values.username)
  await page.getByLabel("Email").fill(values.email)
  await page.getByLabel("Mật khẩu", { exact: true }).fill(values.password)
  await page.getByLabel("Nhập lại mật khẩu").fill(values.confirm)
}

test.describe("register", () => {
  test.beforeEach(async ({ page }) => {
    await gotoReady(page, "/register")
  })

  test("renders the form with a link back to login", async ({ page }) => {
    await expect(page.getByRole("heading", { name: "Tham gia Vedora" })).toBeVisible()
    await expect(page.getByRole("button", { name: "Tạo tài khoản" })).toBeVisible()
    await expect(page.getByRole("link", { name: "Đăng nhập" })).toHaveAttribute("href", "/login")
  })

  test("validates every required field on empty submit", async ({ page }) => {
    await page.getByRole("button", { name: "Tạo tài khoản" }).click()
    await expect(page.getByText("Nhập họ")).toBeVisible()
    await expect(page.getByText("Nhập tên", { exact: true })).toBeVisible()
    await expect(page.getByText("Tên đăng nhập cần ít nhất 3 ký tự")).toBeVisible()
    await expect(page.getByText("Email không hợp lệ")).toBeVisible()
    await expect(page.getByText("Mật khẩu cần ít nhất 8 ký tự")).toBeVisible()
  })

  test("rejects an invalid email address", async ({ page }) => {
    await fillRegistration(page, { email: "not-an-email" })
    await page.getByRole("button", { name: "Tạo tài khoản" }).click()
    await expect(page.getByText("Email không hợp lệ")).toBeVisible()
  })

  test("rejects a username with unsupported characters", async ({ page }) => {
    await fillRegistration(page, { username: "Van An!" })
    await page.getByRole("button", { name: "Tạo tài khoản" }).click()
    await expect(page.getByText(/Chỉ dùng chữ thường, số/)).toBeVisible()
  })

  test("rejects a short password", async ({ page }) => {
    await fillRegistration(page, { password: "short", confirm: "short" })
    await page.getByRole("button", { name: "Tạo tài khoản" }).click()
    await expect(page.getByText("Mật khẩu cần ít nhất 8 ký tự")).toBeVisible()
  })

  test("rejects mismatched passwords", async ({ page }) => {
    await fillRegistration(page, { confirm: "Different123" })
    await page.getByRole("button", { name: "Tạo tài khoản" }).click()
    await expect(page.getByText("Mật khẩu nhập lại không khớp")).toBeVisible()
  })

  test("reports a taken username (API 409)", async ({ page }) => {
    await fillRegistration(page, { username: "taken" })
    await page.getByRole("button", { name: "Tạo tài khoản" }).click()
    await expect(page.getByText("Tên đăng nhập này đã có người dùng")).toBeVisible()
    await expect(page).toHaveURL(/\/register$/)
  })

  test("reports a taken email (API 409)", async ({ page }) => {
    await fillRegistration(page, { email: "taken@example.com" })
    await page.getByRole("button", { name: "Tạo tài khoản" }).click()
    await expect(page.getByText("Email này đã được đăng ký")).toBeVisible()
  })

  test("moves to email verification after a successful sign-up", async ({ page }) => {
    await fillRegistration(page)
    await page.getByRole("button", { name: "Tạo tài khoản" }).click()
    await expect(page).toHaveURL(/\/verify-email$/)
    await expect(page.getByRole("heading", { name: "Xác minh email" })).toBeVisible()
    await expect(page.getByText("va•••@example.com")).toBeVisible()
  })
})

test.describe("verify email", () => {
  test("is unreachable without a pending sign-up", async ({ page }) => {
    await page.goto("/verify-email")
    await expect(page).toHaveURL(/\/login$/)
  })

  test("a wrong code is rejected and the right one signs the user in", async ({ page }) => {
    await gotoReady(page, "/register")
    await fillRegistration(page)
    await page.getByRole("button", { name: "Tạo tài khoản" }).click()
    await expect(page).toHaveURL(/\/verify-email$/)

    await page.getByLabel("Mã xác minh").fill("000000")
    await expect(page.getByText(/Mã không đúng hoặc đã hết hạn/)).toBeVisible()

    await page.getByLabel("Mã xác minh").fill("123456")
    await expect(page).toHaveURL(/\/home$/)
  })
})
