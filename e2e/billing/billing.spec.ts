import {
  PAYMENT_IDS,
  PIXEL_PNG,
  billingCatalog,
  billingOverview,
  payment,
} from "../fixtures/data-extra.mjs"
import { signInAs } from "../helpers/auth"
import { mockApi } from "../helpers/api"
import { test, expect, appAlerts } from "../helpers/test"

test.describe("billing page", () => {
  test.beforeEach(async ({ context }) => {
    await signInAs(context, "member")
  })

  test("requires sign-in", async ({ browser }) => {
    const context = await browser.newContext()
    const page = await context.newPage()
    await page.goto("http://localhost:3000/billing")
    await expect(page).toHaveURL(/\/login\?next=%2Fbilling/)
    await context.close()
  })

  test("shows the current plan, usage and the paid plans", async ({ page }) => {
    await page.goto("/billing")
    await expect(page).toHaveTitle(/Gói của bạn · Vedora/)
    await expect(page.getByRole("heading", { name: "Thêm cảm hứng cho mỗi bữa ăn" })).toBeVisible()
    await expect(page.getByText("Gói của bạn · Miễn phí")).toBeVisible()
    await expect(page.getByText("7/10 lượt còn lại")).toBeVisible()
    await expect(page.getByText("Bạn đang dùng gói này.")).toBeVisible()
    for (const [name, price] of [
      ["Plus", "99.000"],
      ["Pro", "199.000"],
    ]) {
      await expect(page.getByText(name, { exact: true }).first()).toBeVisible()
      await expect(page.getByText(new RegExp(price)).first()).toBeVisible()
    }
    await expect(page.getByRole("button", { name: "Chọn Plus" })).toBeEnabled()
    await expect(page.getByRole("button", { name: "Chọn Pro" })).toBeEnabled()
  })

  test("lists recent payments with their status", async ({ page }) => {
    await page.goto("/billing")
    const history = page.getByRole("link", { name: /Plus · .*99\.000/ })
    await expect(history).toHaveAttribute("href", `/payment/${PAYMENT_IDS.succeeded}`)
    await expect(page.getByText("Đã thanh toán")).toBeVisible()
  })

  test("shows the empty history", async ({ page }) => {
    await mockApi(page, "/billing/me", { body: { ...billingOverview, recentPayments: [] } })
    await page.goto("/billing")
    await expect(page.getByText("Chưa có giao dịch.")).toBeVisible()
  })

  test("disables purchases while payments are closed", async ({ page }) => {
    await mockApi(page, "/billing/plans", { body: { ...billingCatalog, paymentsEnabled: false } })
    await page.goto("/billing")
    await expect(page.getByText("Thanh toán đang tạm đóng.")).toBeVisible()
    await expect(page.getByRole("button", { name: "Chọn Plus" })).toBeDisabled()
  })

  test("a pending payment blocks new purchases and offers to continue", async ({ page }) => {
    await mockApi(page, "/billing/me", {
      body: { ...billingOverview, pendingPayment: payment("PENDING", PAYMENT_IDS.pending) },
    })
    await page.goto("/billing")
    await expect(page.getByText(/Đang chờ thanh toán Plus/)).toBeVisible()
    await expect(page.locator("a", { hasText: "Tiếp tục thanh toán" })).toHaveAttribute(
      "href",
      `/payment/${PAYMENT_IDS.pending}`
    )
    await expect(page.getByRole("button", { name: "Chọn Plus" })).toBeDisabled()
  })

  test("shows a retryable error when the plans fail to load", async ({ page }) => {
    await mockApi(page, "/billing/plans", { status: 500, body: { statusCode: 500, message: "boom" } })
    await page.goto("/billing")
    await expect(page.getByText("Không tải được thông tin gói.")).toBeVisible()
    await expect(page.getByRole("button", { name: "Thử lại" })).toBeVisible()
  })

  test("choosing a plan confirms, creates the payment and opens its page", async ({ page }) => {
    await page.route("https://vietqr.app/**", (route) =>
      route.fulfill({ contentType: "image/png", body: PIXEL_PNG })
    )
    let idempotencyKey: string | undefined
    const created = await mockApi(
      page,
      "/billing/payment-intents",
      (route) => {
        idempotencyKey = route.request().headers()["idempotency-key"]
        return { status: 201, body: payment("PENDING", PAYMENT_IDS.pending) }
      },
      "POST"
    )
    await page.goto("/billing")
    await page.getByRole("button", { name: "Chọn Plus" }).click()
    const dialog = page.getByRole("dialog")
    await expect(dialog.getByRole("heading", { name: "Xác nhận chọn Plus" })).toBeVisible()
    await expect(dialog).toContainText("99.000")
    await expect(dialog).toContainText("30 ngày Plus")
    await dialog.getByRole("button", { name: "Tạo mã QR" }).click()

    await expect(page).toHaveURL(new RegExp(`/payment/${PAYMENT_IDS.pending}$`))
    expect(created).toHaveLength(1)
    expect(created[0].body).toEqual({ planCode: "PLUS", planVersion: 2 })
    expect(idempotencyKey).toMatch(/^[0-9a-f-]{36}$/)
  })

  test("the confirmation can be dismissed without creating a payment", async ({ page }) => {
    const created = await mockApi(page, "/billing/payment-intents", { status: 201, body: {} }, "POST")
    await page.goto("/billing")
    await page.getByRole("button", { name: "Chọn Pro" }).click()
    await page.getByRole("dialog").getByRole("button", { name: "Quay lại" }).click()
    await expect(page.getByRole("dialog")).toHaveCount(0)
    expect(created).toHaveLength(0)
  })

  test("explains a pending-payment conflict from the API", async ({ page }) => {
    await mockApi(
      page,
      "/billing/payment-intents",
      { status: 409, body: { statusCode: 409, code: "PENDING_PAYMENT_CONFLICT", message: "conflict" } },
      "POST"
    )
    await page.goto("/billing")
    await page.getByRole("button", { name: "Chọn Plus" }).click()
    await page.getByRole("dialog").getByRole("button", { name: "Tạo mã QR" }).click()
    await expect(appAlerts(page)).toContainText("Bạn có giao dịch đang chờ.")
  })

  test("shows a generic error when creating the payment fails", async ({ page }) => {
    await mockApi(page, "/billing/payment-intents", { status: 500, body: { statusCode: 500, message: "boom" } }, "POST")
    await page.goto("/billing")
    await page.getByRole("button", { name: "Chọn Plus" }).click()
    await page.getByRole("dialog").getByRole("button", { name: "Tạo mã QR" }).click()
    await expect(appAlerts(page)).toContainText("Chưa tạo được thanh toán.")
  })
})

test.describe("payment page", () => {
  test.beforeEach(async ({ context, page }) => {
    await signInAs(context, "member")
    await page.route("https://vietqr.app/**", (route) =>
      route.fulfill({ contentType: "image/png", body: PIXEL_PNG })
    )
  })

  test("a pending payment shows the QR code and transfer details", async ({ page }) => {
    await page.goto(`/payment/${PAYMENT_IDS.pending}`)
    await expect(page).toHaveTitle(/Thanh toán · Vedora/)
    await expect(page.getByRole("heading", { name: "Thanh toán Plus" })).toBeVisible()
    await expect(page.getByText("Chờ chuyển khoản")).toBeVisible()
    await expect(page.getByRole("img", { name: /QR chuyển khoản .* cho gói Plus/ })).toBeVisible()
    const details = page.locator("dl")
    await expect(details).toContainText("MBBank")
    await expect(details).toContainText("0123456789")
    await expect(details).toContainText("CONG TY VEDORA")
    await expect(details).toContainText("VEDORA12345")
    await expect(page.getByRole("button", { name: "Tôi đã thanh toán · Kiểm tra" })).toBeEnabled()
  })

  test("'I have paid' re-checks the status from the API", async ({ page }) => {
    const checks = await mockApi(
      page,
      `/payment-intents/${PAYMENT_IDS.pending}`,
      { body: payment("PENDING", PAYMENT_IDS.pending) },
      "GET"
    )
    await page.goto(`/payment/${PAYMENT_IDS.pending}`)
    await expect(page.getByText("Chờ chuyển khoản")).toBeVisible()
    const before = checks.length
    await page.getByRole("button", { name: "Tôi đã thanh toán · Kiểm tra" }).click()
    await expect.poll(() => checks.length).toBeGreaterThan(before)
    await expect(page.getByText("Chờ chuyển khoản")).toBeVisible()
  })

  test("counts down using the server deadline and keeps the same deadline after reload", async ({ page }) => {
    const serverTime = new Date().toISOString()
    const expiresAt = new Date(Date.parse(serverTime) + 90_000).toISOString()
    await mockApi(page, `/payment-intents/${PAYMENT_IDS.pending}`, () => ({
      body: { ...payment("PENDING", PAYMENT_IDS.pending), serverTime: new Date().toISOString(), expiresAt },
    }))
    await page.goto(`/payment/${PAYMENT_IDS.pending}`)
    const timer = page.getByRole("timer")
    await expect(timer).toHaveText(/01:[0-3]\d/)
    await expect(timer).not.toHaveText("01:30", { timeout: 5000 })
    await page.reload()
    await expect(timer).toHaveText(/01:[0-2]\d/)
  })

  test("hides the QR and refreshes payment status when the countdown reaches zero", async ({ page }) => {
    let deadline: string | undefined
    const checks = await mockApi(page, `/payment-intents/${PAYMENT_IDS.pending}`, () => {
      deadline ??= new Date(Date.now() + 5000).toISOString()
      const expired = Date.now() >= Date.parse(deadline)
      return { body: {
        ...payment(expired ? "CANCELLED" : "PENDING", PAYMENT_IDS.pending),
        expiresAt: deadline,
        cancellationReason: expired ? "EXPIRED" : null,
      } }
    })
    await page.goto(`/payment/${PAYMENT_IDS.pending}`)
    await expect(page.getByRole("timer")).toBeVisible()
    await expect(page.getByText(/Đơn thanh toán đã hết hạn sau 30 phút/)).toBeVisible({ timeout: 10_000 })
    await expect(page.getByRole("img", { name: /QR chuyển khoản/ })).toHaveCount(0)
    await expect(page.getByRole("link", { name: "Tạo đơn thanh toán mới" })).toHaveAttribute("href", "/billing")
    expect(checks.length).toBeGreaterThan(1)
  })

  test("uses server time when the browser clock is incorrect", async ({ page }) => {
    await page.clock.setFixedTime(new Date("2035-01-01T00:00:00Z"))
    await mockApi(page, `/payment-intents/${PAYMENT_IDS.pending}`, () => ({
      body: payment("PENDING", PAYMENT_IDS.pending),
    }))
    await page.goto(`/payment/${PAYMENT_IDS.pending}`)
    await expect(page.getByRole("timer")).toHaveText(/19:\d{2}|20:00/)
    await expect(page.getByRole("img", { name: /QR chuyển khoản/ })).toBeVisible()
  })

  test("a pending payment flips to confirmed once the status poll sees it", async ({ page }) => {
    // The live stream is only a keep-alive in the mock, so the page falls back to polling.
    let paid = false
    await mockApi(page, `/payment-intents/${PAYMENT_IDS.pending}`, () => ({
      body: payment(paid ? "SUCCEEDED" : "PENDING", PAYMENT_IDS.pending),
    }))
    await page.goto(`/payment/${PAYMENT_IDS.pending}`)
    await expect(page.getByText("Chờ chuyển khoản")).toBeVisible()
    paid = true
    await expect(page.getByText("Đã xác nhận thanh toán")).toBeVisible({ timeout: 20_000 })
    await expect(page.locator("a", { hasText: "Xem gói hiện tại" })).toHaveAttribute("href", "/billing")
  })

  test("a succeeded payment shows the confirmation", async ({ page }) => {
    await page.goto(`/payment/${PAYMENT_IDS.succeeded}`)
    await expect(page.getByText("Đã xác nhận thanh toán")).toBeVisible()
    await expect(page.getByText(/Gói được kích hoạt từ/)).toBeVisible()
  })

  test("a cancelled payment warns not to use the old QR", async ({ page }) => {
    await page.goto(`/payment/${PAYMENT_IDS.cancelled}`)
    await expect(page.getByText(/Giao dịch đã hủy\. Không chuyển tiền theo QR cũ/)).toBeVisible()
  })

  test("cancelling asks for confirmation, then posts the cancel request", async ({ page }) => {
    let cancelled = false
    await mockApi(page, `/payment-intents/${PAYMENT_IDS.pending}`, () => ({
      body: payment(cancelled ? "CANCELLED" : "PENDING", PAYMENT_IDS.pending),
    }), "GET")
    const posts = await mockApi(
      page,
      `/payment-intents/${PAYMENT_IDS.pending}/cancel`,
      () => {
        cancelled = true
        return { body: payment("CANCELLED", PAYMENT_IDS.pending) }
      },
      "POST"
    )
    let confirmText = ""
    page.on("dialog", (dialog) => {
      confirmText = dialog.message()
      void dialog.accept()
    })
    await page.goto(`/payment/${PAYMENT_IDS.pending}`)
    await page.getByRole("button", { name: "Hủy giao dịch chưa chuyển tiền" }).click()
    await expect(page.getByText(/Giao dịch đã hủy\./)).toBeVisible()
    expect(confirmText).toContain("Chỉ hủy nếu bạn chưa chuyển tiền")
    expect(posts).toHaveLength(1)
  })

  test("declining the confirmation does not cancel", async ({ page }) => {
    const posts = await mockApi(page, `/payment-intents/${PAYMENT_IDS.pending}/cancel`, { body: {} }, "POST")
    page.on("dialog", (dialog) => void dialog.dismiss())
    await page.goto(`/payment/${PAYMENT_IDS.pending}`)
    await page.getByRole("button", { name: "Hủy giao dịch chưa chuyển tiền" }).click()
    await expect(page.getByText("Chờ chuyển khoản")).toBeVisible()
    expect(posts).toHaveLength(0)
  })

  test("an unknown payment shows not-found", async ({ page }) => {
    await page.goto("/payment/99999999-9999-4999-8999-999999999999")
    await expect(page.getByText("Không tìm thấy giao dịch thuộc tài khoản của bạn.")).toBeVisible()
    await expect(page.getByRole("link", { name: "Về gói của bạn" })).toHaveAttribute("href", "/billing")
  })

  test("a malformed id is a 404", async ({ page }) => {
    const response = await page.goto("/payment/not-a-uuid")
    expect(response?.status()).toBe(404)
  })
})
