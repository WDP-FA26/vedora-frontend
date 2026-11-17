import { KNOWLEDGE_ID, knowledgeDocument } from "../fixtures/data-extra.mjs"
import { signInAs } from "../helpers/auth"
import { mockApi } from "../helpers/api"
import { test, expect, appAlerts } from "../helpers/test"

const DOC_PATH = `/knowledge/documents/${KNOWLEDGE_ID}`

test.describe("knowledge documents (admin list)", () => {
  test.beforeEach(async ({ context }) => {
    await signInAs(context, "admin")
  })

  test("lists documents with status badges", async ({ page }) => {
    await page.goto("/admin/knowledge")
    await expect(page).toHaveTitle(/Tài liệu kiến thức · Vedora Quản trị/)
    await expect(page.getByRole("row", { name: /Dinh dưỡng thực vật\.pdf/ })).toContainText("Chờ duyệt")
    await expect(page.getByRole("row", { name: /Protein từ đậu\.pdf/ })).toContainText("Sẵn sàng")
  })

  test("filters by status view", async ({ page }) => {
    await page.goto("/admin/knowledge")
    await page.getByRole("button", { name: "Sẵn sàng", exact: true }).click()
    await expect(page.getByRole("row", { name: /Protein từ đậu\.pdf/ })).toBeVisible()
    await expect(page.getByRole("row", { name: /Dinh dưỡng thực vật\.pdf/ })).toHaveCount(0)
  })

  test("shows the upload hint when there are no documents", async ({ page }) => {
    await mockApi(page, "/knowledge/documents", { body: [] }, "GET")
    await page.goto("/admin/knowledge")
    await expect(page.getByText(/Chưa có tài liệu nào\. Kéo thả PDF vào đây/)).toBeVisible()
  })

  test("shows an error when the list cannot be loaded", async ({ page }) => {
    await mockApi(page, "/knowledge/documents", { status: 500, body: { statusCode: 500, message: "boom" } }, "GET")
    await page.goto("/admin/knowledge")
    await expect(appAlerts(page)).toContainText("Không tải được danh sách tài liệu.")
  })

  test("a member is redirected away", async ({ browser }) => {
    const context = await browser.newContext()
    await signInAs(context, "member")
    const page = await context.newPage()
    await page.goto("http://localhost:3000/admin/knowledge")
    await expect(page).toHaveURL(/\/home$/)
    await context.close()
  })
})

test.describe("knowledge review page (admin)", () => {
  test.beforeEach(async ({ context }) => {
    await signInAs(context, "admin")
  })

  test("shows the OCR text of the first page with page controls", async ({ page }) => {
    await page.goto(`/admin/knowledge/${KNOWLEDGE_ID}`)
    await expect(page).toHaveTitle(/Duyệt tài liệu · Vedora Quản trị/)
    await expect(page.getByRole("heading", { name: "Dinh dưỡng thực vật.pdf" })).toBeVisible()
    await expect(page.getByRole("textbox", { name: "Văn bản trang 1" })).toHaveValue("Trang một: đạm thực vật.")
    await expect(page.getByRole("button", { name: "Trang trước" })).toBeVisible()
    await expect(page.locator('iframe[title="PDF gốc"]')).toBeVisible()
  })

  test("pages with OCR flags show a warning", async ({ page }) => {
    await page.goto(`/admin/knowledge/${KNOWLEDGE_ID}`)
    await page.getByRole("button", { name: "Trang sau" }).click()
    await expect(page.getByRole("textbox", { name: "Văn bản trang 2" })).toHaveValue("Trang hai: vi chất.")
    await expect(page.locator('[role="alert"]:not(#__next-route-announcer__)').first()).toBeVisible()
  })

  test("editing a page enables saving and PATCHes the text", async ({ page }) => {
    const patches = await mockApi(page, `${DOC_PATH}/pages/1`, { body: {} }, "PATCH")
    await page.goto(`/admin/knowledge/${KNOWLEDGE_ID}`)
    const approve = page.getByRole("button", { name: "Duyệt và đưa vào kho" })
    await expect(approve).toBeEnabled()
    const save = page.getByRole("button", { name: /^Lưu chỉnh sửa/ })
    await expect(save).toBeDisabled()

    await page.getByRole("textbox", { name: "Văn bản trang 1" }).fill("Trang một đã sửa.")
    await expect(page.getByRole("button", { name: "Lưu chỉnh sửa (1 trang)" })).toBeEnabled()
    // Unsaved edits must be saved before approving.
    await expect(approve).toBeDisabled()
    await page.getByRole("button", { name: "Lưu chỉnh sửa (1 trang)" }).click()
    await expect.poll(() => patches.length).toBe(1)
    expect(patches[0].body).toEqual({ text: "Trang một đã sửa." })
  })

  test("discarding edits restores the text", async ({ page }) => {
    await page.goto(`/admin/knowledge/${KNOWLEDGE_ID}`)
    const box = page.getByRole("textbox", { name: "Văn bản trang 1" })
    await box.fill("Tạm sửa")
    await page.getByRole("button", { name: "Bỏ thay đổi" }).click()
    await expect(box).toHaveValue("Trang một: đạm thực vật.")
  })

  test("approving asks for confirmation then posts approve", async ({ page }) => {
    const approvals = await mockApi(
      page,
      `${DOC_PATH}/approve`,
      { body: knowledgeDocument({ status: "INDEXING" }) },
      "POST"
    )
    await page.goto(`/admin/knowledge/${KNOWLEDGE_ID}`)
    await page.getByRole("button", { name: "Duyệt và đưa vào kho" }).click()
    const confirm = page.getByRole("alertdialog")
    await expect(confirm.getByText("Đưa tài liệu vào kho kiến thức?")).toBeVisible()
    await confirm.getByRole("button", { name: "Duyệt", exact: true }).click()
    await expect.poll(() => approvals.length).toBe(1)
  })

  test("rejecting sends the optional note", async ({ page }) => {
    const rejects = await mockApi(
      page,
      `${DOC_PATH}/reject`,
      { body: knowledgeDocument({ status: "REJECTED", reviewNote: "Scan mờ" }) },
      "POST"
    )
    await page.goto(`/admin/knowledge/${KNOWLEDGE_ID}`)
    await page.getByRole("button", { name: "Từ chối", exact: true }).click()
    const dialog = page.getByRole("dialog")
    await expect(dialog.getByText("Từ chối tài liệu")).toBeVisible()
    await dialog.getByLabel("Ghi chú").fill("Scan mờ")
    await dialog.getByRole("button", { name: "Từ chối", exact: true }).click()
    await expect.poll(() => rejects.length).toBe(1)
    expect(rejects[0].body).toEqual({ note: "Scan mờ" })
  })

  test("a failed approval keeps the page and shows an error", async ({ page }) => {
    await mockApi(page, `${DOC_PATH}/approve`, { status: 500, body: { statusCode: 500, message: "boom" } }, "POST")
    await page.goto(`/admin/knowledge/${KNOWLEDGE_ID}`)
    await page.getByRole("button", { name: "Duyệt và đưa vào kho" }).click()
    await page.getByRole("alertdialog").getByRole("button", { name: "Duyệt", exact: true }).click()
    await expect(page.getByText("Không duyệt được tài liệu. Thử lại nhé.")).toBeVisible()
  })

  test("deleting asks for confirmation and returns to the list", async ({ page }) => {
    const deletes = await mockApi(page, DOC_PATH, { status: 204 }, "DELETE")
    await page.goto(`/admin/knowledge/${KNOWLEDGE_ID}`)
    await page.getByRole("button", { name: "Xoá", exact: true }).click()
    const confirm = page.getByRole("alertdialog")
    await expect(confirm.getByText("Xoá tài liệu này?")).toBeVisible()
    await confirm.getByRole("button", { name: "Xoá", exact: true }).click()
    await expect(page).toHaveURL(/\/admin\/knowledge$/)
    expect(deletes).toHaveLength(1)
  })

  test("a ready document is read-only", async ({ page }) => {
    await mockApi(page, DOC_PATH, { body: knowledgeDocument({ status: "READY" }) }, "GET")
    await page.goto(`/admin/knowledge/${KNOWLEDGE_ID}`)
    await expect(page.getByText("Tài liệu đã nằm trong kho kiến thức.")).toBeVisible()
    await expect(page.getByRole("textbox", { name: "Văn bản trang 1" })).not.toBeEditable()
    await expect(page.getByRole("button", { name: "Duyệt và đưa vào kho" })).toHaveCount(0)
  })

  test("a rejected document can be reopened", async ({ page }) => {
    await mockApi(page, DOC_PATH, { body: knowledgeDocument({ status: "REJECTED", reviewNote: "Scan mờ" }) }, "GET")
    const reopens = await mockApi(page, `${DOC_PATH}/reopen`, { body: knowledgeDocument() }, "POST")
    await page.goto(`/admin/knowledge/${KNOWLEDGE_ID}`)
    await expect(page.getByText(/Đã từ chối: Scan mờ/)).toBeVisible()
    await page.getByRole("button", { name: "Mở lại để duyệt" }).click()
    await expect.poll(() => reopens.length).toBe(1)
  })

  test("an unknown document shows an error", async ({ page }) => {
    await page.goto("/admin/knowledge/k0000000-0000-4000-8000-0000000000ff")
    await expect(appAlerts(page)).toContainText("Không tải được tài liệu. Có thể nó đã bị xoá.")
  })
})
