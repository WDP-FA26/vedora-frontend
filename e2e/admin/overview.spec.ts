import type { Page } from "@playwright/test"
import type { WorkQueue } from "../../features/admin/overview/schema"
import { signInAs } from "../helpers/auth"
import { mockApi } from "../helpers/api"
import { test, expect, appAlerts } from "../helpers/test"

const initial: WorkQueue = {
  generatedAt: "2026-11-24T10:00:00Z",
  refreshAfterSeconds: 30,
  previewLimit: 10,
  counts: {
    POST_REVIEW: 2,
    POST_REPORTS: 2,
    COMMENT_REPORTS: 1,
    VERIFICATION: 2,
    WORKSPACES: 1,
    SUPPORT: 3,
    KNOWLEDGE: 2,
  },
  badges: { total: 12, moderation: 4, verification: 2, workspaces: 1, support: 3, knowledge: 2 },
  support: { appeals: 1, assignedToMe: 1 },
  items: [
    {
      kind: "POST_REVIEW",
      id: "p-held",
      title: "Bài cần duyệt",
      sourceCount: 1,
      createdAt: "2026-11-20T10:00:00Z",
    },
    {
      kind: "POST_REPORTS",
      id: "p-1",
      title: "Bài bị báo cáo",
      sourceCount: 3,
      createdAt: "2026-11-21T10:00:00Z",
    },
    {
      kind: "COMMENT_REPORTS",
      id: "cr-1",
      title: "Bình luận cần xem",
      sourceCount: 2,
      createdAt: "2026-11-21T10:00:00Z",
    },
    {
      kind: "VERIFICATION",
      id: "v-1",
      title: "Yêu cầu chuyên gia",
      sourceCount: 1,
      createdAt: "2026-11-22T10:00:00Z",
    },
    {
      kind: "WORKSPACES",
      id: "w-1",
      title: "Nhà hàng cần duyệt",
      sourceCount: 1,
      createdAt: "2026-11-22T10:00:00Z",
    },
    {
      kind: "SUPPORT",
      id: "t-1",
      title: "SUP01: Cần hỗ trợ",
      sourceCount: 1,
      createdAt: "2026-11-23T10:00:00Z",
    },
    {
      kind: "KNOWLEDGE",
      id: "k0000000-0000-4000-8000-000000000001",
      title: "Tài liệu cần duyệt",
      sourceCount: 1,
      createdAt: null,
    },
  ],
}
async function setup(page: Page, value = initial) {
  const state = { data: structuredClone(value), status: 200, delay: 0 }
  const reads = await mockApi(
    page,
    "/admin/dashboard/work-queue",
    async () => {
      if (state.delay) await new Promise((resolve) => setTimeout(resolve, state.delay))
      return state.status === 200
        ? { body: state.data }
        : { status: state.status, body: { message: "Fixture error" } }
    },
    "GET"
  )
  return { state, reads }
}
test.beforeEach(async ({ context }) => {
  await signInAs(context, "admin")
})

test("admin entry opens the overview with queue cards, the shared table and consistent menu badges", async ({
  page,
}) => {
  await setup(page)
  await page.goto("/admin")
  await expect(page).toHaveURL(/\/admin\/overview$/)
  await expect(page).toHaveTitle(/Tổng quan/)
  await expect(page.getByRole("heading", { name: "Việc cần xử lý", exact: true })).toBeVisible()
  await expect(page.getByRole("table")).toBeVisible()
  await expect(
    page.getByRole("link", { name: "Tổng quan, 12 việc chưa xử lý", exact: true })
  ).toBeVisible()
  await expect(
    page.getByRole("link", { name: "Kiểm duyệt, 4 việc chưa xử lý", exact: true })
  ).toBeVisible()
  await expect(
    page.getByRole("link", { name: "Bài đăng, 2 việc chưa xử lý", exact: true })
  ).toBeVisible()
  await expect(
    page.getByRole("link", { name: "Hỗ trợ & Kháng cáo, 3 việc chưa xử lý", exact: true })
  ).toBeVisible()
  await expect(page.getByText("Trong đó 1 kháng cáo.", { exact: false })).toBeVisible()
  await expect(
    page.getByRole("link", { name: "Mở hàng đợi Bài viết bị báo cáo", exact: true })
  ).toHaveAttribute("href", "/admin/reports?view=report")
  await expect(
    page.getByRole("link", { name: "Xử lý SUP01: Cần hỗ trợ", exact: true })
  ).toHaveAttribute("href", "/admin/support/t-1")
  await page.screenshot({
    path: test.info().outputPath("overview-desktop.png"),
    fullPage: true,
    animations: "disabled",
  })
})

test("an item opens the correct reported-post view and post detail", async ({ page }) => {
  await setup(page)
  await page.goto("/admin/overview")
  await page.getByRole("link", { name: "Xử lý Bài bị báo cáo", exact: true }).click()
  await expect(page).toHaveURL(/view=report&postId=p-1/)
  await expect(page.getByRole("dialog", { name: "Bài đăng", exact: true })).toContainText(
    "Phở chay"
  )
  await page.keyboard.press("Escape")
  await expect(page.getByRole("button", { name: "Bị báo cáo", exact: true })).toHaveAttribute(
    "aria-pressed",
    "true"
  )
})

test("a comment item opens the comment tab and selected report", async ({ page }) => {
  await setup(page)
  const author = { id: "u-chef", username: "bepchay", fullName: "Lê Bếp Chay", avatarUrl: null }
  const report = {
    id: "cr-1",
    postId: "p-1",
    commentId: "c-1",
    reason: "SPAM",
    details: null,
    status: "PENDING",
    createdAt: "2026-11-24T10:00:00Z",
    reviewedAt: null,
    reviewedById: null,
    action: null,
    reporter: author,
    postAvailable: true,
    comment: {
      id: "c-1",
      parentId: null,
      body: "Minh chứng bình luận",
      author,
      currentBody: "Minh chứng bình luận",
      isAvailable: true,
      replyCount: 0,
    },
  }
  await mockApi(
    page,
    "/admin/comment-reports",
    {
      body: {
        items: [report],
        meta: { page: 1, hasNextPage: false, hasPreviousPage: false, totalItems: 1 },
      },
    },
    "GET"
  )
  await page.goto("/admin/overview")
  await page.getByRole("link", { name: "Xử lý Bình luận cần xem", exact: true }).click()
  await expect(page.getByRole("tab", { name: "Bình luận", exact: true })).toHaveAttribute(
    "aria-selected",
    "true"
  )
  await expect(
    page.getByRole("dialog", { name: "Bình luận bị báo cáo", exact: true })
  ).toContainText("Minh chứng bình luận")
})

test("approving verification refreshes the badge immediately on the review page", async ({
  page,
}) => {
  const { state, reads } = await setup(page)
  state.data.counts.VERIFICATION = 1
  state.data.badges.verification = 1
  state.data.badges.total = 11
  await mockApi(
    page,
    "/verification/requests/v-1/review",
    () => {
      state.data.counts.VERIFICATION = 0
      state.data.badges.verification = 0
      state.data.badges.total = 10
      return {
        body: {
          id: "v-1",
          status: "APPROVED",
          statement: "Approved request",
          reviewNote: null,
          reviewedAt: "2026-11-24T10:00:00Z",
          createdAt: "2026-11-20T10:00:00Z",
          proofCount: 0,
          user: {
            id: "u-chef",
            username: "bepchay",
            fullName: "Lê Bếp Chay",
            email: "chef@example.com",
            avatarUrl: null,
          },
        },
      }
    },
    "POST"
  )
  await page.goto("/admin/overview")
  await page.getByRole("link", { name: "Xử lý Yêu cầu chuyên gia", exact: true }).click()
  const sheet = page.getByRole("dialog", { name: "Yêu cầu xác minh", exact: true })
  await expect(sheet).toBeVisible()
  const before = reads.length
  await sheet.getByRole("button", { name: "Duyệt", exact: true }).click()
  await expect(page.getByRole("link", { name: "Xác minh chuyên gia", exact: true })).toBeVisible()
  await expect(
    page.getByRole("link", { name: "Xác minh chuyên gia, 1 việc chưa xử lý", exact: true })
  ).toHaveCount(0)
  await expect.poll(() => reads.length).toBeGreaterThan(before)
})

test("workspace deep link opens the application directly", async ({ page }) => {
  await setup(page)
  const workspace = {
    id: "w-1",
    pageUserId: null,
    username: "senchay",
    name: "Nhà hàng Sen Chay",
    bio: null,
    statement: "Đơn cần admin xem xét",
    status: "PENDING",
    reviewNote: null,
    reviewedAt: null,
    createdAt: "2026-11-20T10:00:00Z",
    proofCount: 0,
    owner: null,
    address: "Hồ Chí Minh",
    longitude: 106.7,
    latitude: 10.7,
    phone: null,
    website: null,
    proofs: [],
  }
  await mockApi(
    page,
    "/admin/workspaces",
    { body: { items: [workspace], meta: { hasNextPage: false } } },
    "GET"
  )
  await mockApi(page, "/admin/workspaces/w-1", { body: workspace }, "GET")
  await page.goto("/admin/overview")
  await page.getByRole("link", { name: "Xử lý Nhà hàng cần duyệt", exact: true }).click()
  await expect(page.getByRole("dialog")).toContainText("Nhà hàng Sen Chay")
})

test("knowledge card applies its pending-review filter", async ({ page }) => {
  await setup(page)
  await page.goto("/admin/overview")
  await page.getByRole("link", { name: "Mở hàng đợi Tài liệu chờ duyệt", exact: true }).click()
  await expect(page.getByRole("button", { name: "Chờ duyệt", exact: true })).toHaveAttribute(
    "aria-pressed",
    "true"
  )
})

test("failed counts show an error rather than zero and retry restores all badges", async ({
  page,
}) => {
  const { state } = await setup(page)
  state.status = 500
  await page.goto("/admin/overview")
  await expect(appAlerts(page)).toContainText("Các số đếm chưa xác định")
  await expect(page.getByLabel("Kiểm duyệt: chưa tải được số việc", { exact: true })).toBeVisible()
  await expect(page.getByRole("table")).toHaveCount(0)
  state.status = 200
  await page.getByRole("button", { name: "Thử lại", exact: true }).click()
  await expect(page.getByRole("table")).toBeVisible()
  await expect(
    page.getByRole("link", { name: "Kiểm duyệt, 4 việc chưa xử lý", exact: true })
  ).toBeVisible()
})

test("zero work has an empty state and no numbered navigation badges", async ({ page }) => {
  await page.goto("/admin/overview")
  await expect(page.getByText("Không còn việc đang chờ xử lý.", { exact: true })).toBeVisible()
  await expect(page.getByRole("link", { name: "Kiểm duyệt", exact: true })).toBeVisible()
  await expect(page.locator('[data-sidebar="menu-badge"]')).toHaveCount(0)
})

test("large counts use 99+ visually but retain the full accessible count", async ({ page }) => {
  const { state } = await setup(page)
  state.data.badges.support = 120
  await page.goto("/admin/overview")
  const link = page.getByRole("link", {
    name: "Hỗ trợ & Kháng cáo, 120 việc chưa xử lý",
    exact: true,
  })
  await expect(link.locator("..").getByText("99+", { exact: true })).toBeVisible()
})

test("periodic refresh observes work completed elsewhere without navigating", async ({ page }) => {
  const { state } = await setup(page)
  state.data.refreshAfterSeconds = 5
  await page.goto("/admin/overview")
  await expect(
    page.getByRole("link", { name: "Xác minh chuyên gia, 2 việc chưa xử lý", exact: true })
  ).toBeVisible()
  state.data.badges.verification = 0
  state.data.counts.VERIFICATION = 0
  await expect(page.getByRole("link", { name: "Xác minh chuyên gia", exact: true })).toBeVisible({
    timeout: 10_000,
  })
})

test("mobile overview and badge navigation stay within the viewport", async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 800 })
  await setup(page)
  await page.goto("/admin/overview")
  await expect(page.getByRole("table")).toBeVisible()
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
  await page.screenshot({
    path: test.info().outputPath("overview-mobile.png"),
    fullPage: true,
    animations: "disabled",
  })
  await page.getByRole("button", { name: "Mở thanh bên", exact: true }).click()
  await expect(
    page.getByRole("link", { name: "Kiểm duyệt, 4 việc chưa xử lý", exact: true })
  ).toBeVisible()
  await page.screenshot({
    path: test.info().outputPath("overview-menu-mobile.png"),
    fullPage: true,
    animations: "disabled",
  })
})

test("members cannot open the admin overview", async ({ context, page }) => {
  await signInAs(context, "member")
  await page.goto("/admin/overview")
  await expect(page).toHaveURL(/\/home(?:\?|$)/)
})

test("returning to a previously visited queue uses the category selected on overview", async ({
  page,
}) => {
  await setup(page)
  await mockApi(
    page,
    "/admin/comment-reports",
    {
      body: {
        items: [],
        meta: { page: 1, hasNextPage: false, hasPreviousPage: false, totalItems: 0 },
      },
    },
    "GET"
  )
  await page.goto("/admin/reports?tab=comments")
  await expect(page.getByRole("tab", { name: "Bình luận", exact: true })).toHaveAttribute(
    "aria-selected",
    "true"
  )
  await page.getByRole("link", { name: "Tổng quan, 12 việc chưa xử lý", exact: true }).click()
  await page.getByRole("link", { name: "Mở hàng đợi Bài viết bị báo cáo", exact: true }).click()
  await expect(page.getByRole("tab", { name: "Bài viết", exact: true })).toHaveAttribute(
    "aria-selected",
    "true"
  )
  await expect(page.getByRole("button", { name: "Bị báo cáo", exact: true })).toHaveAttribute(
    "aria-pressed",
    "true"
  )
  await page.getByRole("link", { name: "Tổng quan, 12 việc chưa xử lý", exact: true }).click()
  await page.getByRole("link", { name: "Mở hàng đợi Bình luận bị báo cáo", exact: true }).click()
  await expect(page.getByRole("tab", { name: "Bình luận", exact: true })).toHaveAttribute(
    "aria-selected",
    "true"
  )
})

test("a conflicting review still refreshes work finished by another administrator", async ({
  page,
}) => {
  const { state } = await setup(page)
  state.data.counts.VERIFICATION = 1
  state.data.badges.verification = 1
  await mockApi(
    page,
    "/verification/requests/v-1/review",
    () => {
      state.data.counts.VERIFICATION = 0
      state.data.badges.verification = 0
      return { status: 409, body: { message: "Already reviewed", code: "CONFLICT" } }
    },
    "POST"
  )
  await page.goto("/admin/overview")
  await page.getByRole("link", { name: "Xử lý Yêu cầu chuyên gia", exact: true }).click()
  await page.getByRole("dialog").getByRole("button", { name: "Duyệt", exact: true }).click()
  await expect(appAlerts(page)).toContainText("Yêu cầu này đã được xét duyệt rồi")
  await page.keyboard.press("Escape")
  await expect(page.getByRole("link", { name: "Xác minh chuyên gia", exact: true })).toBeVisible()
})
