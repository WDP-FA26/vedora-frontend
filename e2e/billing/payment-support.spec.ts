import type { Page } from "@playwright/test"
import { PAYMENT_IDS, PIXEL_PNG, payment } from "../fixtures/data-extra.mjs"
import { signInAs } from "../helpers/auth"
import { mockApi } from "../helpers/api"
import { test, expect, appAlerts } from "../helpers/test"

const PAYMENT_URL = `/payment/${PAYMENT_IDS.pending}`
const SUPPORT_URL = `/home/support/payment/${PAYMENT_IDS.pending}`
const HELP_LABEL = "Tôi đã chuyển tiền nhưng chưa được xác nhận"
const TICKET_SUBJECT = "Đã chuyển tiền nhưng chưa được xác nhận"
const now = new Date().toISOString()
const ticket = {
  id: "payment-support-1",
  code: "TKT-PAY001",
  category: "PAYMENT_ISSUE",
  subject: TICKET_SUBJECT,
  status: "OPEN",
  appeal: null,
  referenceCode: "VEDORA12345",
  lastMessageAt: now,
  lastMessageByRole: "USER",
  messageCount: 1,
  waitingUserSince: null,
  autoCloseAt: null,
  resolvedAt: null,
  resolutionNote: null,
  createdAt: now,
  updatedAt: now,
  post: null,
  reopenableUntil: null,
  messages: [],
}

async function supportApi(page: Page) {
  await mockApi(
    page,
    "/support/tickets",
    {
      body: {
        items: [],
        meta: {
          page: 1,
          limit: 15,
          totalItems: 0,
          totalPages: 0,
          hasNextPage: false,
          hasPreviousPage: false,
        },
      },
    },
    "GET"
  )
  await mockApi(page, `/support/tickets/${ticket.id}`, { body: ticket }, "GET")
}

test.beforeEach(async ({ context, page }) => {
  await signInAs(context, "member")
  await page.route("https://vietqr.app/**", (route) =>
    route.fulfill({ contentType: "image/png", body: PIXEL_PNG })
  )
  await supportApi(page)
})

test("opens a prefilled payment ticket from the order without creating it until submitted", async ({
  page,
}) => {
  const created = await mockApi(page, "/support/tickets", { status: 201, body: ticket }, "POST")
  await page.goto(PAYMENT_URL)
  await page.getByRole("link", { name: HELP_LABEL, exact: true }).click()
  await expect(page).toHaveURL(SUPPORT_URL)
  const dialog = page.getByRole("dialog", { name: "Tạo yêu cầu hỗ trợ" })
  await expect(dialog.getByRole("radio", { name: /Thanh toán & Gói cước/ })).toBeChecked()
  await expect(dialog.getByLabel("Mã tham chiếu")).toHaveValue("VEDORA12345")
  await expect(dialog.getByLabel("Mô tả chi tiết")).toHaveValue(new RegExp(PAYMENT_IDS.pending))
  await expect(dialog.getByLabel("Mô tả chi tiết")).toHaveValue(/Số tiền của đơn:.*99\.000/)
  expect(created).toHaveLength(0)
  await page.screenshot({ path: test.info().outputPath("payment-support-desktop.png") })
  await dialog
    .getByLabel("Mô tả chi tiết")
    .fill(`Mã đơn: ${PAYMENT_IDS.pending}\nTôi chuyển lúc 10:30, mã ngân hàng FT123456.`)
  await dialog.getByRole("button", { name: "Gửi yêu cầu", exact: true }).click()
  await expect(page).toHaveURL(`/home/support/${ticket.id}`)
  expect(created).toHaveLength(1)
  expect(created[0].body).toMatchObject({
    category: "PAYMENT_ISSUE",
    subject: TICKET_SUBJECT,
    referenceCode: "VEDORA12345",
    message: expect.stringContaining("FT123456"),
  })
})

for (const reason of ["EXPIRED", "USER"] as const) {
  test(`offers support for a cancelled order (${reason}) and preserves the original order data`, async ({
    page,
  }) => {
    await mockApi(
      page,
      `/payment-intents/${PAYMENT_IDS.pending}`,
      {
        body: {
          ...payment("CANCELLED", PAYMENT_IDS.pending),
          cancellationReason: reason,
        },
      },
      "GET"
    )
    const created = await mockApi(page, "/support/tickets", { status: 201, body: ticket }, "POST")
    await page.goto(PAYMENT_URL)
    await page.getByRole("link", { name: HELP_LABEL }).click()
    const dialog = page.getByRole("dialog", { name: "Tạo yêu cầu hỗ trợ" })
    await expect(dialog.getByLabel("Mô tả chi tiết")).toHaveValue(
      /Trạng thái đơn khi mở yêu cầu: Đã hủy/
    )
    await expect(dialog.getByLabel("Mã tham chiếu")).toHaveValue("VEDORA12345")
    await dialog.getByRole("button", { name: "Huỷ", exact: true }).click()
    await expect(page).toHaveURL(/\/home\/support$/)
    expect(created).toHaveLength(0)
  })
}

test("does not offer the unpaid-order form for a succeeded payment, including a direct support link", async ({
  page,
}) => {
  await mockApi(
    page,
    `/payment-intents/${PAYMENT_IDS.pending}`,
    { body: payment("SUCCEEDED", PAYMENT_IDS.pending) },
    "GET"
  )
  const created = await mockApi(page, "/support/tickets", { status: 201, body: ticket }, "POST")
  await page.goto(PAYMENT_URL)
  await expect(page.getByText("Đã xác nhận thanh toán", { exact: true })).toBeVisible()
  await expect(page.getByRole("link", { name: HELP_LABEL })).toHaveCount(0)
  await page.goto(SUPPORT_URL)
  await expect(page.getByRole("dialog")).toContainText("Đơn này đã được xác nhận thanh toán")
  await expect(page.getByLabel("Mã tham chiếu")).toHaveCount(0)
  expect(created).toHaveLength(0)
})

test("does not prefill inaccessible orders or trust order details from the URL", async ({
  page,
}) => {
  await mockApi(
    page,
    `/payment-intents/${PAYMENT_IDS.pending}`,
    {
      status: 404,
      body: { statusCode: 404, code: "NOT_FOUND", message: "Not found" },
    },
    "GET"
  )
  const created = await mockApi(page, "/support/tickets", { status: 201, body: ticket }, "POST")
  await page.goto(`${SUPPORT_URL}?amount=1&paymentCode=FAKE`)
  await expect(page.getByRole("dialog")).toContainText(
    "Không tìm thấy đơn thanh toán thuộc tài khoản của bạn"
  )
  await expect(page.getByLabel("Mã tham chiếu")).toHaveCount(0)
  expect(created).toHaveLength(0)
})

test("keeps user input after a failed submission and retries without navigating away", async ({
  page,
}) => {
  let failed = true
  const created = await mockApi(
    page,
    "/support/tickets",
    () =>
      failed
        ? { status: 500, body: { message: "Temporary failure" } }
        : { status: 201, body: ticket },
    "POST"
  )
  await page.goto(SUPPORT_URL)
  const dialog = page.getByRole("dialog", { name: "Tạo yêu cầu hỗ trợ" })
  await dialog.getByLabel("Mô tả chi tiết").fill("Tôi đã chuyển, mã giao dịch FT999888.")
  await dialog.getByRole("button", { name: "Gửi yêu cầu", exact: true }).click()
  await expect(appAlerts(page)).toContainText("Không thể tạo hồ sơ hỗ trợ")
  await expect(page).toHaveURL(SUPPORT_URL)
  await expect(dialog.getByLabel("Mô tả chi tiết")).toHaveValue(
    "Tôi đã chuyển, mã giao dịch FT999888."
  )
  failed = false
  await dialog.getByRole("button", { name: "Gửi yêu cầu", exact: true }).click()
  await expect(page).toHaveURL(`/home/support/${ticket.id}`)
  expect(created).toHaveLength(2)
  expect(created[0].body).toEqual(created[1].body)
})

test("the mobile form scrolls within the viewport and cancellation sends no ticket", async ({
  page,
}) => {
  await page.setViewportSize({ width: 360, height: 800 })
  const created = await mockApi(page, "/support/tickets", { status: 201, body: ticket }, "POST")
  await page.goto(SUPPORT_URL)
  const dialog = page.getByRole("dialog", { name: "Tạo yêu cầu hỗ trợ" })
  await expect(dialog.getByLabel("Mã tham chiếu")).toHaveValue("VEDORA12345")
  expect(
    await dialog.evaluate((node) => node.getBoundingClientRect().height <= window.innerHeight)
  ).toBe(true)
  await dialog.getByRole("button", { name: "Gửi yêu cầu", exact: true }).scrollIntoViewIfNeeded()
  await expect(dialog.getByRole("button", { name: "Gửi yêu cầu", exact: true })).toBeInViewport()
  await page.screenshot({ path: test.info().outputPath("payment-support-mobile.png") })
  await dialog.getByRole("button", { name: "Huỷ", exact: true }).click()
  await expect(page).toHaveURL(/\/home\/support$/)
  expect(created).toHaveLength(0)
})

test("the ordinary support form still starts empty", async ({ page }) => {
  await page.goto("/home/support")
  await page.getByRole("button", { name: "Gửi yêu cầu", exact: true }).click()
  const dialog = page.getByRole("dialog", { name: "Tạo yêu cầu hỗ trợ" })
  await expect(dialog.getByLabel("Mã tham chiếu")).toHaveValue("")
  await expect(dialog.getByLabel("Mô tả chi tiết")).toHaveValue("")
})
