import type { Page } from "@playwright/test"
import type { AdminPlans } from "../../features/admin/subscription-plans/schema"
import { signInAs } from "../helpers/auth"
import { mockApi } from "../helpers/api"
import { test, expect, appAlerts } from "../helpers/test"
import { payment, PAYMENT_IDS, PIXEL_PNG, billingOverview } from "../fixtures/data-extra.mjs"
import { users } from "../fixtures/data.mjs"

const initial: AdminPlans = {
  id: "9fd37843-83f6-48a4-ad66-012caec15136", version: 0, source: "ENV", updatedAt: null, updatedById: null,
  planVersion: 2, paymentsEnabled: true, freeLimits: { textLimit: 5, imageLimit: 0 },
  plans: [
    { code: "PLUS", name: "Plus", priceVnd: "49000", durationDays: 30, textLimit: 300, imageLimit: 10 },
    { code: "PRO", name: "Pro", priceVnd: "99000", durationDays: 30, textLimit: 900, imageLimit: 40 },
  ],
}
const upgraded: AdminPlans = {
  ...initial, version: 1, source: "DATABASE", updatedAt: "2026-11-28T00:00:00Z", updatedById: "admin-a",
  plans: [{ ...initial.plans[0], priceVnd: "59000", textLimit: 400, imageLimit: 15 }, initial.plans[1]],
}

async function setup(page: Page) {
  const state = { catalog: structuredClone(initial), next: structuredClone(upgraded), getStatus: 200, saveStatus: 200, delay: 0 }
  const reads = await mockApi(page, "/admin/subscription-plans", () => ({ status: state.getStatus, body: state.getStatus === 200 ? state.catalog : { message: "Fixture unavailable" } }), "GET")
  const saves = await mockApi(page, "/admin/subscription-plans", async () => {
    if (state.delay) await new Promise((resolve) => setTimeout(resolve, state.delay))
    if (state.saveStatus !== 200) return { status: state.saveStatus, body: { code: state.saveStatus === 409 ? "SUBSCRIPTION_CATALOG_CONFLICT" : "UNAVAILABLE", message: "Fixture save failed" } }
    state.catalog = structuredClone(state.next)
    return { body: state.catalog }
  }, "PUT")
  return { state, reads, saves }
}
const open = async (page: Page) => {
  await page.goto("/admin/subscription-plans")
  await expect(page.getByRole("table")).toBeVisible()
}
const editPlus = async (page: Page) => {
  await page.getByRole("button", { name: "Chỉnh sửa gói Plus", exact: true }).click()
  const sheet = page.getByRole("dialog", { name: "Chỉnh sửa gói Plus", exact: true })
  await expect(sheet).toBeVisible()
  return sheet
}

test.beforeEach(async ({ context }) => { await signInAs(context, "admin") })

test("uses the shared admin table and shows prices, units and the grandfathering policy", async ({ page }) => {
  await setup(page)
  await open(page)
  await expect(page.getByRole("link", { name: "Gói đăng ký", exact: true }).first()).toHaveAttribute("href", "/admin/subscription-plans")
  await expect(page.getByRole("table")).toContainText("Miễn phí")
  await expect(page.getByRole("table")).toContainText("Mỗi ngày")
  await expect(page.getByRole("table")).toContainText("30 ngày")
  await expect(page.getByText(/Đơn đã tạo QR và gói đang sử dụng giữ quyền lợi đã chốt/)).toBeVisible()
  await expect(page.getByText("Phiên bản 0", { exact: true })).toBeVisible()
  await page.screenshot({ path: test.info().outputPath("subscription-plans-desktop.png"), fullPage: true })
})

test("saves a paid plan with its revision and updates the table after success", async ({ page }) => {
  const { saves, state } = await setup(page)
  await open(page)
  const sheet = await editPlus(page)
  await expect(sheet.getByText(/QR đang chờ và gói đã mua giữ nguyên giá/)).toBeVisible()
  await sheet.getByLabel("Giá (VND)", { exact: true }).fill("59000")
  await sheet.getByLabel("Hạn mức AI chữ", { exact: true }).fill("400")
  await sheet.getByLabel("Hạn mức tạo ảnh", { exact: true }).fill("15")
  state.delay = 1000
  await sheet.getByRole("button", { name: "Lưu thay đổi", exact: true }).click()
  await expect(sheet.getByRole("button", { name: "Lưu thay đổi", exact: true })).toBeDisabled()
  await expect(sheet).not.toBeVisible()
  expect(saves).toHaveLength(1)
  expect(saves[0].body).toEqual({ version: 0, freeLimits: { textLimit: 5, imageLimit: 0 }, plans: [
    { code: "PLUS", priceVnd: 59000, textLimit: 400, imageLimit: 15 },
    { code: "PRO", priceVnd: 99000, textLimit: 900, imageLimit: 40 },
  ] })
  await expect(page.getByText("Phiên bản 1", { exact: true })).toBeVisible()
  await page.reload()
  await expect(page.getByRole("table")).toContainText("59.000")
})

test("edits Free quota without offering a paid price or changing other plans", async ({ page }) => {
  const { saves, state } = await setup(page)
  state.next = { ...initial, version: 1, source: "DATABASE", freeLimits: { textLimit: 8, imageLimit: 2 } }
  await open(page)
  await page.getByRole("button", { name: "Chỉnh sửa gói Free", exact: true }).click()
  const sheet = page.getByRole("dialog", { name: "Chỉnh sửa gói Free", exact: true })
  await expect(sheet.getByLabel("Giá (VND)", { exact: true })).toHaveCount(0)
  await expect(sheet.getByText(/Số lượt đã dùng trong ngày vẫn được giữ/)).toBeVisible()
  await sheet.getByLabel("Hạn mức AI chữ", { exact: true }).fill("8")
  await sheet.getByLabel("Hạn mức tạo ảnh", { exact: true }).fill("2")
  await sheet.getByRole("button", { name: "Lưu thay đổi", exact: true }).click()
  await expect(sheet).not.toBeVisible()
  expect(saves[0].body).toMatchObject({ freeLimits: { textLimit: 8, imageLimit: 2 }, plans: [
    { code: "PLUS", priceVnd: 49000 }, { code: "PRO", priceVnd: 99000 },
  ] })
})

test("rejects invalid values locally and accepts zero quotas", async ({ page }) => {
  const { saves } = await setup(page)
  await open(page)
  const sheet = await editPlus(page)
  await sheet.getByLabel("Giá (VND)", { exact: true }).fill("1.5")
  await sheet.getByRole("button", { name: "Lưu thay đổi", exact: true }).click()
  await expect(sheet.getByRole("alert").filter({ hasText: "Giá phải là số nguyên" })).toBeVisible()
  expect(saves).toHaveLength(0)
  await sheet.getByLabel("Giá (VND)", { exact: true }).fill("59000")
  await sheet.getByLabel("Hạn mức AI chữ", { exact: true }).fill("-1")
  await sheet.getByRole("button", { name: "Lưu thay đổi", exact: true }).click()
  await expect(sheet.getByRole("alert").filter({ hasText: "Hạn mức AI chữ phải là số nguyên" })).toBeVisible()
  expect(saves).toHaveLength(0)
  await sheet.getByLabel("Hạn mức AI chữ", { exact: true }).fill("0")
  await sheet.getByLabel("Hạn mức tạo ảnh", { exact: true }).fill("0")
  await sheet.getByRole("button", { name: "Lưu thay đổi", exact: true }).click()
  await expect(sheet).not.toBeVisible()
  expect(saves[0].body).toMatchObject({ plans: [ { code: "PLUS", textLimit: 0, imageLimit: 0 }, { code: "PRO" } ] })
})

test("retains the draft on save failure and allows retry", async ({ page }) => {
  const { state, saves } = await setup(page)
  state.saveStatus = 500
  await open(page)
  const sheet = await editPlus(page)
  await sheet.getByLabel("Giá (VND)", { exact: true }).fill("59000")
  await sheet.getByRole("button", { name: "Lưu thay đổi", exact: true }).click()
  await expect(sheet.getByRole("alert").filter({ hasText: "Không lưu được cấu hình" })).toBeVisible()
  await expect(sheet.getByLabel("Giá (VND)", { exact: true })).toHaveValue("59000")
  state.saveStatus = 200
  await sheet.getByRole("button", { name: "Lưu thay đổi", exact: true }).click()
  await expect(sheet).not.toBeVisible()
  expect(saves).toHaveLength(2)
})

test("preserves a conflicting draft until the admin explicitly discards and reloads it", async ({ page }) => {
  const { state } = await setup(page)
  state.saveStatus = 409
  await open(page)
  const sheet = await editPlus(page)
  await sheet.getByLabel("Giá (VND)", { exact: true }).fill("59000")
  await sheet.getByRole("button", { name: "Lưu thay đổi", exact: true }).click()
  await expect(sheet.getByRole("alert").filter({ hasText: "quản trị viên khác" })).toBeVisible()
  await expect(sheet.getByLabel("Giá (VND)", { exact: true })).toHaveValue("59000")
  await expect(sheet.getByRole("button", { name: "Lưu thay đổi", exact: true })).toBeDisabled()
  state.catalog = { ...upgraded, version: 3 }
  await sheet.getByRole("button", { name: "Bỏ bản nháp và tải cấu hình mới", exact: true }).click()
  await expect(sheet).not.toBeVisible()
  await expect(page.getByText("Phiên bản 3", { exact: true })).toBeVisible()
})

test("can retry a failed initial load instead of showing fake defaults", async ({ page }) => {
  const { state } = await setup(page)
  state.getStatus = 503
  await page.goto("/admin/subscription-plans")
  await expect(appAlerts(page)).toContainText("Không tải được cấu hình gói")
  await expect(page.getByRole("table")).toHaveCount(0)
  state.getStatus = 200
  await page.getByRole("button", { name: "Thử lại", exact: true }).click()
  await expect(page.getByRole("table")).toBeVisible()
})

test("cancels edits without writing settings", async ({ page }) => {
  const { saves } = await setup(page)
  await open(page)
  const sheet = await editPlus(page)
  await sheet.getByLabel("Giá (VND)", { exact: true }).fill("59000")
  await sheet.getByRole("button", { name: "Hủy", exact: true }).click()
  await expect(sheet).not.toBeVisible()
  expect(saves).toHaveLength(0)
  const reopened = await editPlus(page)
  await expect(reopened.getByLabel("Giá (VND)", { exact: true })).toHaveValue("49000")
})

test("keeps the mobile editor usable without overflowing the viewport", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await setup(page)
  await open(page)
  const sheet = await editPlus(page)
  await expect(sheet.getByLabel("Giá (VND)", { exact: true })).toBeVisible()
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true)
  await page.screenshot({ path: test.info().outputPath("subscription-plan-mobile.png"), fullPage: true })
})

test("denies members access to plan management", async ({ page, context }) => {
  await context.clearCookies()
  await signInAs(context, "member")
  const { reads } = await setup(page)
  await page.goto("/admin/subscription-plans")
  await expect(page).toHaveURL(/\/home(?:\?|$)/)
  expect(reads).toHaveLength(0)
})

test("shows the old order allowances on its QR page when the new catalog has different limits", async ({ page, context }) => {
  await context.clearCookies()
  await signInAs(context, "member")
  const old = { ...payment("PENDING", PAYMENT_IDS.pending), textLimit: 300, imageLimit: 10 }
  await mockApi(page, `/payment-intents/${old.id}`, { body: old }, "GET")
  const catalogReads = await mockApi(page, "/billing/plans", { body: upgraded }, "GET")
  await page.route("https://vietqr.app/**", (route) => route.fulfill({ contentType: "image/png", body: PIXEL_PNG }))
  await page.goto(`/payment/${old.id}`)
  await expect(page.getByText(/Quyền lợi của đơn này: 300 lượt AI chữ và 10 lượt tạo ảnh trong 30 ngày/)).toBeVisible()
  await expect(page.getByText(/Giá và hạn mức được giữ theo thời điểm tạo đơn/)).toBeVisible()
  expect(catalogReads).toHaveLength(0)
})

for (const planCode of ["FREE", "PLUS", "PRO"]) {
  test(`${planCode} voice gate checks entitlement and text quota before microphone or session requests`, async ({ page, context }) => {
    await context.clearCookies()
    await signInAs(context, "member")
    const voiceCalls: string[] = []
    await mockApi(page, "/auth/me", { body: { ...users.member, accountType: "PERSONAL", actor: null } })
    await mockApi(page, "/dietary/me", { body: { allergies: [], preferences: [] } })
    await mockApi(page, "/dietary/nutrition", { body: {
      heightCm: 165, weightKg: 60, targetWeightKg: null, birthYear: 2000,
      biologicalSex: "FEMALE", activityLevel: "MODERATE", nutritionGoal: "MAINTAIN",
      bmi: 22, bmiCategory: "NORMAL", suggestedGoal: "MAINTAIN", effectiveGoal: "MAINTAIN",
      idealWeightMinKg: 50, idealWeightMaxKg: 62, bmr: 1400, tdee: 2000,
      dailyCalorieTarget: 2000, dailyCalorieMin: 1800, dailyCalorieMax: 2200, safetyNote: null, history: [],
    } })
    await mockApi(page, "/meal-plan/chat/threads", { body: { items: [], meta: { page: 1, limit: 50, totalItems: 0, totalPages: 0, hasNextPage: false, hasPreviousPage: false } } }, "GET")
    await page.addInitScript(() => {
      navigator.mediaDevices.getUserMedia = () => Promise.reject(new Error("Microphone should not be opened for non-Pro"))
    })
    await page.route("**/api/meal-planner/voice/session**", (route) => {
      voiceCalls.push(route.request().url())
      return route.fulfill({ status: 403, json: { code: "PRO_REQUIRED", message: "Need Pro" } })
    })
    await mockApi(page, "/billing/me", { body: { ...billingOverview, membership: { planCode, startsAt: null, expiresAt: null },
      ...(planCode === "PRO" ? { usage: { ...billingOverview.usage, text: { ...billingOverview.usage.text, used: 10, remaining: 0 } } } : {}),
    } })
    await page.goto("/meal-planner")
    await page.getByRole("button", { name: "Trò chuyện bằng giọng nói", exact: true }).first().click()
    if (planCode === "PRO") {
      await expect(page.getByText("Bạn đã dùng hết lượt AI chữ của chu kỳ này. Voice dùng chung hạn mức AI chữ.")).toBeVisible()
      await expect(page.getByRole("button", { name: "Kết nối lại" })).toBeDisabled()
    } else {
      await expect(page.getByRole("heading", { name: "Thoại AI hai chiều dành cho Pro", exact: true })).toBeVisible()
      await expect(page.getByRole("link", { name: "Xem gói Pro", exact: true })).toHaveAttribute("href", "/billing")
    }
    expect(voiceCalls).toHaveLength(0)
  })
}
