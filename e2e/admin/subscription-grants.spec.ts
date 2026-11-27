import type { Page } from "@playwright/test"
import type { AdminPlans } from "../../features/admin/subscription-plans/schema"
import type { GrantUserDetail, SubscriptionGrant } from "../../features/admin/subscription-plans/grant-schema"
import { signInAs } from "../helpers/auth"
import { mockApi } from "../helpers/api"
import { test, expect } from "../helpers/test"
import { billingOverview } from "../fixtures/data-extra.mjs"

const userId = "00000000-0000-4000-8000-000000000102"
const actorId = "00000000-0000-4000-8000-000000000101"
const grantId = "00000000-0000-4000-8000-000000000103"
const catalog: AdminPlans = {
  id: "9fd37843-83f6-48a4-ad66-012caec15136", version: 0, source: "ENV", updatedAt: null, updatedById: null,
  planVersion: 2, paymentsEnabled: false, freeLimits: { textLimit: 5, imageLimit: 0 },
  plans: [
    { code: "PLUS", name: "Plus", priceVnd: "49000", durationDays: 30, textLimit: 300, imageLimit: 10 },
    { code: "PRO", name: "Pro", priceVnd: "99000", durationDays: 30, textLimit: 900, imageLimit: 40 },
  ],
}
const initial: GrantUserDetail = {
  user: { id: userId, username: "fixture.member", fullName: "Người dùng thử nghiệm", email: "fixture@example.test", role: "USER", status: "ACTIVE" },
  membership: { planCode: "PLUS", source: "PAYMENT", key: "payment:old-order", startsAt: "2026-11-01T00:00:00Z", expiresAt: "2026-12-01T00:00:00Z", textLimit: 300, imageLimit: 10 },
  pendingPayment: { id: "00000000-0000-4000-8000-000000000104", expiresAt: "2026-11-28T12:00:00Z" },
  recentGrants: [],
}
const receipt: SubscriptionGrant = { id: grantId, userId, actorId, reason: "Hỗ trợ người dùng", planCode: "PRO", catalogVersion: 0, durationDays: 30, textLimit: 900, imageLimit: 40, startsAt: "2026-11-28T00:00:00Z", expiresAt: "2026-12-28T00:00:00Z", createdAt: "2026-11-28T00:00:00Z" }
async function setup(page: Page) {
  const state = { detail: structuredClone(initial), status: 200, delay: 0, searchStatus: 200 }
  const catalogueReads = await mockApi(page, "/admin/subscription-plans", { body: catalog }, "GET")
  const searches = await mockApi(page, "/admin/subscription-plans/users", route => {
    const params = new URL(route.request().url()).searchParams
    const pageNumber = Number(params.get("page") ?? 1)
    return { status: state.searchStatus, body: state.searchStatus === 200 ? { items: params.get("q") === "missing" ? [] : [state.detail.user], total: params.get("q") === "missing" ? 0 : 11, page: pageNumber, limit: 10 } : { message: "Unavailable" } }
  }, "GET")
  const details = await mockApi(page, `/admin/subscription-plans/users/${userId}`, () => ({ body: state.detail }), "GET")
  const keys: string[] = []
  const saves = await mockApi(page, "/admin/subscription-plans/grants", async route => {
    keys.push(route.request().headers()["idempotency-key"])
    if (state.delay) await new Promise(resolve => setTimeout(resolve, state.delay))
    return { status: state.status, body: state.status === 200 ? receipt : { code: state.status === 409 ? "SUBSCRIPTION_PERIOD_CONFLICT" : "UNAVAILABLE", message: "Grant fixture failed" } }
  }, "POST")
  return { state, catalogueReads, searches, details, saves, keys }
}
async function open(page: Page) {
  await page.goto("/admin/subscription-plans")
  await page.getByRole("button", { name: "Cấp gói", exact: true }).click()
  const sheet = page.getByRole("dialog", { name: "Cấp gói cho người dùng", exact: true })
  await expect(sheet).toBeVisible()
  return sheet
}
async function select(page: Page) {
  const sheet = await open(page)
  await sheet.getByRole("button", { name: /Người dùng thử nghiệm @fixture.member/ }).click()
  await expect(sheet.getByLabel("Gói được cấp", { exact: true })).toBeVisible()
  return sheet
}
test.beforeEach(async ({ context }) => { await signInAs(context, "admin") })

test("searches and paginates personal users within subscription management", async ({ page }) => {
  const { searches } = await setup(page)
  const sheet = await open(page)
  await sheet.getByRole("button", { name: "Sau", exact: true }).click()
  await expect(sheet.getByText("Trang 2 · 11 người dùng")).toBeVisible()
  await sheet.getByLabel("Tìm người dùng").fill("fixture@example.test")
  await sheet.getByRole("button", { name: "Tìm", exact: true }).click()
  await expect.poll(() => searches.at(-1)?.url).toContain("page=1")
  expect(searches.at(-1)?.url).toContain("q=fixture%40example.test")
  await sheet.getByLabel("Tìm người dùng").fill("missing")
  await sheet.getByRole("button", { name: "Tìm", exact: true }).click()
  await expect(sheet.getByText("Không tìm thấy người dùng phù hợp.")).toBeVisible()
})

test("previews replacement, pending QR and Pro voice then grants once with revision and period guards", async ({ page }) => {
  const { saves, keys, state } = await setup(page)
  const sheet = await select(page)
  await expect(sheet.getByText(/QR giữ giá và quyền lợi cũ/)).toBeVisible()
  await expect(sheet.getByText(/Không cộng dồn thời gian còn lại/)).toBeVisible()
  await sheet.getByLabel("Gói được cấp", { exact: true }).selectOption("PRO")
  await expect(sheet.getByText(/900 lượt AI chữ · 40 lượt tạo ảnh/)).toBeVisible()
  await expect(sheet.getByText("Có thoại AI hai chiều, không tính hạn mức phút.")).toBeVisible()
  await sheet.getByLabel("Lý do cấp gói").fill("Hỗ trợ người dùng")
  state.delay = 1000
  await sheet.getByRole("button", { name: "Xác nhận cấp gói", exact: true }).click()
  await expect(sheet.getByRole("button", { name: "Xác nhận cấp gói", exact: true })).toBeDisabled()
  await expect(sheet.getByText(/Đã cấp Pro cho @fixture.member/)).toBeVisible()
  expect(saves).toHaveLength(1)
  expect(saves[0].body).toEqual({ userId, planCode: "PRO", catalogVersion: 0, expectedPeriodKey: "payment:old-order", reason: "Hỗ trợ người dùng" })
  expect(keys[0]).toMatch(/^[a-f0-9-]{36}$/)
  await sheet.getByRole("button", { name: "Hoàn tất", exact: true }).click()
  await expect(sheet).not.toBeVisible()
})

test("retains one request and locks its draft across uncertain failures and retries", async ({ page }) => {
  const { state, saves, keys } = await setup(page)
  state.status = 503
  const sheet = await select(page)
  await sheet.getByLabel("Lý do cấp gói").fill("Hỗ trợ người dùng")
  await sheet.getByRole("button", { name: "Xác nhận cấp gói", exact: true }).click()
  await expect(sheet.getByText(/Thử lại sẽ giữ nguyên yêu cầu/)).toBeVisible()
  await expect(sheet.getByLabel("Lý do cấp gói")).toBeDisabled()
  await expect(sheet.getByLabel("Gói được cấp", { exact: true })).toBeDisabled()
  state.status = 200
  await sheet.getByRole("button", { name: "Xác nhận cấp gói", exact: true }).click()
  await expect(sheet.getByText(/Đã cấp Pro/)).toBeVisible()
  expect(saves).toHaveLength(2)
  expect(keys[1]).toBe(keys[0])
  expect(saves[1].body).toEqual(saves[0].body)
})

test("blocks stale grants and requires explicitly reloading the membership and catalog", async ({ page }) => {
  const { state, saves, catalogueReads, details } = await setup(page)
  state.status = 409
  const sheet = await select(page)
  await sheet.getByLabel("Lý do cấp gói").fill("Giữ lý do khi bị conflict")
  await sheet.getByRole("button", { name: "Xác nhận cấp gói", exact: true }).click()
  await expect(sheet.getByText(/Gói hoặc tài khoản đã thay đổi/)).toBeVisible()
  await expect(sheet.getByRole("button", { name: "Xác nhận cấp gói", exact: true })).toHaveCount(0)
  await expect(sheet.getByLabel("Lý do cấp gói")).toHaveValue("Giữ lý do khi bị conflict")
  const reads = catalogueReads.length, detailReads = details.length
  await sheet.getByRole("button", { name: "Đóng và tải dữ liệu mới", exact: true }).click()
  await expect(sheet).not.toBeVisible()
  expect(catalogueReads.length).toBeGreaterThan(reads)
  expect(details.length).toBeGreaterThan(detailReads)
  expect(saves).toHaveLength(1)
})

test("warns about suspended accounts and keeps the grant form usable on mobile", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  const { state } = await setup(page)
  state.detail.user.status = "SUSPENDED"
  state.detail.recentGrants = [receipt]
  const sheet = await select(page)
  await expect(sheet.getByText(/Chu kỳ vẫn bắt đầu ngay/)).toBeVisible()
  await expect(sheet.getByRole("button", { name: "Xác nhận cấp gói", exact: true })).toBeDisabled()
  await sheet.getByLabel("Lý do cấp gói").fill("Cấp thử nghiệm Pro")
  await sheet.getByLabel("Gói được cấp", { exact: true }).selectOption("PRO")
  await expect(sheet.getByText("Các lần cấp gần đây")).toBeVisible()
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
  await page.screenshot({ path: test.info().outputPath("subscription-grant-mobile.png"), fullPage: true })
})

test("recovers from a user search failure without sending a grant", async ({ page }) => {
  const { state, saves } = await setup(page)
  state.searchStatus = 503
  const sheet = await open(page)
  await expect(sheet.getByText("Không tải được người dùng.", { exact: false })).toBeVisible()
  state.searchStatus = 200
  await sheet.getByRole("button", { name: "Thử lại", exact: true }).click()
  await expect(sheet.getByRole("button", { name: /Người dùng thử nghiệm @fixture.member/ })).toBeVisible()
  expect(saves).toHaveLength(0)
})

test("shows a granted Pro subscription and its source on the user's billing page", async ({ page }) => {
  await mockApi(page, "/billing/plans", { body: catalog }, "GET")
  await mockApi(page, "/billing/me", { body: { ...billingOverview, membership: { planCode: "PRO", source: "ADMIN_GRANT", startsAt: receipt.startsAt, expiresAt: receipt.expiresAt }, usage: { text: { used: 0, limit: 900, remaining: 900, resetsAt: receipt.expiresAt, period: "CYCLE" }, images: { used: 0, limit: 40, remaining: 40, resetsAt: receipt.expiresAt, period: "CYCLE" } }, pendingPayment: null, recentPayments: [] } }, "GET")
  await page.goto("/billing")
  await expect(page.getByText("Gói của bạn · Pro")).toBeVisible()
  await expect(page.getByText("Gói được quản trị viên cấp.")).toBeVisible()
  await expect(page.getByText("900/900 lượt còn lại")).toBeVisible()
})

test("labels gifted memberships in payment administration without inventing an invoice", async ({ page }) => {
  await mockApi(page, "/admin/payments/subscriptions", { body: { asOf: receipt.startsAt, total: 1, page: 1, limit: 25, items: [{ id: grantId, userId, source: "ADMIN_GRANT", planCode: "PRO", startsAt: receipt.startsAt, expiresAt: receipt.expiresAt, textLimit: 900, imageLimit: 40, customer: initial.user }] } }, "GET")
  await page.goto("/admin/payments")
  await page.getByRole("button", { name: "Gói còn hạn", exact: true }).click()
  await expect(page.getByText("Admin cấp · không thu tiền")).toBeVisible()
  await expect(page.getByText("fixture.member", { exact: true })).toBeVisible()
  await expect(page.locator(`a[href='/admin/payments/${grantId}']`)).toHaveCount(0)
})
