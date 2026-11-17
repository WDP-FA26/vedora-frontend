import { PIXEL_PNG, PROOF_URL, verificationRequest } from "../fixtures/data-extra.mjs"
import { signInAs } from "../helpers/auth"
import { mockApi } from "../helpers/api"
import { test, expect, appAlerts } from "../helpers/test"

test.describe("verification request (member)", () => {
  test.beforeEach(async ({ context }) => {
    await signInAs(context, "member")
  })

  test("shows the guidance and the request form", async ({ page }) => {
    await page.goto("/home/verification")
    await expect(page).toHaveTitle(/Xác minh chuyên gia · Vedora/)
    await expect(page.getByRole("heading", { name: "Xác minh chuyên gia", level: 1 })).toBeVisible()
    await expect(page.getByText(/Huy hiệu không mở thêm tính năng nào/)).toBeVisible()
    await expect(page.getByLabel("Công việc chuyên môn của bạn")).toBeVisible()
    await expect(page.getByRole("button", { name: "Gửi yêu cầu xác minh" })).toBeEnabled()
    await expect(page.locator('a[aria-label="Quay lại hồ sơ"]')).toHaveAttribute("href", "/profile/u-member")
  })

  test("validates the statement and the proof photos", async ({ page }) => {
    await page.goto("/home/verification")
    await page.getByRole("button", { name: "Gửi yêu cầu xác minh" }).click()
    await expect(page.getByText("Viết ít nhất 20 ký tự")).toBeVisible()
    await expect(page.getByText("Thêm ít nhất một ảnh minh chứng")).toBeVisible()

    await page.getByLabel("Công việc chuyên môn của bạn").fill("ngắn quá")
    await page.getByRole("button", { name: "Gửi yêu cầu xác minh" }).click()
    await expect(page.getByText("Viết ít nhất 20 ký tự")).toBeVisible()
  })

  test("rejects files that are not JPEG, PNG or WebP", async ({ page }) => {
    await page.goto("/home/verification")
    await page.locator('input[type="file"]').setInputFiles({
      name: "notes.txt",
      mimeType: "text/plain",
      buffer: Buffer.from("hello"),
    })
    await expect(appAlerts(page)).toContainText("Đã bỏ qua tệp không phải ảnh JPEG, PNG hoặc WebP.")
  })

  test("previews a picked photo and lets the user remove it", async ({ page }) => {
    await page.goto("/home/verification")
    await page.locator('input[type="file"]').setInputFiles({
      name: "proof.png",
      mimeType: "image/png",
      buffer: PIXEL_PNG,
    })
    await expect(page.getByRole("img", { name: /Ảnh minh chứng 1: proof\.png/ })).toBeVisible()
    await page.getByRole("button", { name: "Gỡ ảnh 1" }).click()
    await expect(page.getByRole("img", { name: /Ảnh minh chứng 1/ })).toHaveCount(0)
  })

  test("submits the statement with the uploaded proof ids", async ({ page }) => {
    // The proof goes straight to storage (presigned PUT), then the request is posted.
    await page.route("http://localhost:9000/**", (route) =>
      route.fulfill({ status: 200, headers: { "access-control-allow-origin": "*", etag: '"abc"' }, body: "" })
    )
    const submitted = await mockApi(
      page,
      "/verification/requests",
      (route) => ({
        status: 201,
        body: verificationRequest("PENDING", {
          statement: (JSON.parse(route.request().postData() ?? "{}") as { statement: string }).statement,
        }),
      }),
      "POST"
    )
    await page.goto("/home/verification")
    await page.getByLabel("Công việc chuyên môn của bạn").fill("Tôi là đầu bếp chay với 5 năm kinh nghiệm.")
    await page.locator('input[type="file"]').setInputFiles({
      name: "proof.png",
      mimeType: "image/png",
      buffer: PIXEL_PNG,
    })
    await page.getByRole("button", { name: "Gửi yêu cầu xác minh" }).click()
    await expect(page.getByText("Yêu cầu đang chờ duyệt")).toBeVisible()
    expect(submitted).toHaveLength(1)
    expect(submitted[0].body).toEqual({
      statement: "Tôi là đầu bếp chay với 5 năm kinh nghiệm.",
      proofIds: ["proof-1"],
    })
  })

  test("a pending request shows its status instead of the form", async ({ page }) => {
    await mockApi(page, "/verification/me", { body: { isProfessional: false, request: verificationRequest("PENDING") } })
    await page.goto("/home/verification")
    await expect(page.getByText("Yêu cầu đang chờ duyệt")).toBeVisible()
    await expect(page.getByText(/kèm 2 ảnh minh chứng/)).toBeVisible()
    await expect(page.getByRole("button", { name: "Gửi yêu cầu xác minh" })).toHaveCount(0)
  })

  test("a rejected request shows the admin's note and the form again", async ({ page }) => {
    await mockApi(page, "/verification/me", {
      body: {
        isProfessional: false,
        request: verificationRequest("REJECTED", { reviewNote: "Ảnh chưa rõ chứng chỉ." }),
      },
    })
    await page.goto("/home/verification")
    await expect(page.getByText("Yêu cầu trước chưa được duyệt")).toBeVisible()
    await expect(page.getByText(/Ảnh chưa rõ chứng chỉ\./)).toBeVisible()
    await expect(page.getByRole("button", { name: "Gửi yêu cầu xác minh" })).toBeVisible()
  })

  test("a verified professional sees the badge message", async ({ page }) => {
    await mockApi(page, "/verification/me", { body: { isProfessional: true, request: null } })
    await page.goto("/home/verification")
    await expect(page.getByText("Chuyên gia đã xác minh").first()).toBeVisible()
    await expect(page.getByText("Huy hiệu xác minh đang hiển thị cạnh tên bạn trên hồ sơ.")).toBeVisible()
  })

  test("shows an error when the status cannot be loaded", async ({ page }) => {
    await mockApi(page, "/verification/me", { status: 500, body: { statusCode: 500, message: "boom" } })
    await page.goto("/home/verification")
    await expect(appAlerts(page)).toContainText("Không tải được trạng thái xác minh.")
  })

  test("the profile links to the verification page for unverified owners", async ({ page }) => {
    await page.goto("/profile/u-member")
    await expect(page.getByRole("link", { name: "Xác minh tài khoản chuyên gia" })).toHaveAttribute(
      "href",
      "/home/verification"
    )
  })
})

test.describe("verification review (admin)", () => {
  test.beforeEach(async ({ context, page }) => {
    await signInAs(context, "admin")
    await page.route(PROOF_URL, (route) => route.fulfill({ contentType: "image/png", body: PIXEL_PNG }))
  })

  test("lists pending requests first and switches views", async ({ page }) => {
    await page.goto("/admin/verification")
    await expect(page).toHaveTitle(/Xác minh chuyên gia · Vedora Quản trị/)
    await expect(page.getByRole("row", { name: /Lê Bếp Chay/ })).toContainText("Chờ duyệt")
    await expect(page.getByRole("row", { name: /Nguyễn Minh Anh/ })).toHaveCount(0)
    await page.getByRole("button", { name: "Đã duyệt", exact: true }).click()
    await expect(page.getByRole("row", { name: /Nguyễn Minh Anh/ })).toContainText("Đã duyệt")
  })

  test("opens a request with its statement and proofs", async ({ page }) => {
    await page.goto("/admin/verification")
    await page.getByRole("button", { name: "Xét duyệt yêu cầu của Lê Bếp Chay" }).click()
    const sheet = page.getByRole("dialog")
    await expect(sheet.getByText("Yêu cầu xác minh").first()).toBeVisible()
    await expect(sheet).toContainText("Tôi là đầu bếp chay 5 năm kinh nghiệm tại nhà hàng Sen.")
    await expect(sheet).toContainText("chef@example.com")
    await expect(sheet.getByText("Ảnh minh chứng (1)")).toBeVisible()
    await expect(sheet.getByRole("img", { name: /Ảnh minh chứng 1/ })).toBeVisible()
  })

  test("approving sends the APPROVED decision", async ({ page }) => {
    const reviews = await mockApi(
      page,
      "/verification/requests/v-1/review",
      (route) => ({
        body: {
          ...verificationRequest("APPROVED"),
          user: { id: "u-chef", username: "bepchay", fullName: "Lê Bếp Chay", email: "chef@example.com", avatarUrl: null },
          reviewedAt: new Date().toISOString(),
          ...JSON.parse(route.request().postData() ?? "{}"),
          status: "APPROVED",
        },
      }),
      "POST"
    )
    await page.goto("/admin/verification")
    await page.getByRole("button", { name: "Xét duyệt yêu cầu của Lê Bếp Chay" }).click()
    await page.getByRole("dialog").getByRole("button", { name: "Duyệt", exact: true }).click()
    await expect(page.getByRole("dialog")).toHaveCount(0)
    expect(reviews).toHaveLength(1)
    expect(reviews[0].body).toEqual({ decision: "APPROVED" })
  })

  test("rejecting requires a reason and sends it", async ({ page }) => {
    const reviews = await mockApi(
      page,
      "/verification/requests/v-1/review",
      {
        body: {
          ...verificationRequest("REJECTED"),
          user: { id: "u-chef", username: "bepchay", fullName: "Lê Bếp Chay", email: "chef@example.com", avatarUrl: null },
        },
      },
      "POST"
    )
    await page.goto("/admin/verification")
    await page.getByRole("button", { name: "Xét duyệt yêu cầu của Lê Bếp Chay" }).click()
    const sheet = page.getByRole("dialog")
    await sheet.getByRole("button", { name: "Từ chối", exact: true }).click()
    await sheet.getByRole("button", { name: "Từ chối yêu cầu" }).click()
    await expect(sheet.getByText("Nhập lý do từ chối")).toBeVisible()
    expect(reviews).toHaveLength(0)

    await sheet.getByLabel("Lý do từ chối").fill("Ảnh chưa rõ chứng chỉ.")
    await sheet.getByRole("button", { name: "Từ chối yêu cầu" }).click()
    await expect(page.getByRole("dialog")).toHaveCount(0)
    expect(reviews[0].body).toEqual({ decision: "REJECTED", note: "Ảnh chưa rõ chứng chỉ." })
  })

  test("a reviewed request is read-only", async ({ page }) => {
    await page.goto("/admin/verification")
    await page.getByRole("button", { name: "Đã duyệt", exact: true }).click()
    await page.getByRole("button", { name: "Xem yêu cầu của Nguyễn Minh Anh" }).click()
    const sheet = page.getByRole("dialog")
    await expect(sheet.getByText("Kết quả")).toBeVisible()
    await expect(sheet.getByRole("button", { name: "Duyệt", exact: true })).toHaveCount(0)
  })

  test("shows an error when the requests cannot be loaded", async ({ page }) => {
    await mockApi(page, "/verification/requests", { status: 500, body: { statusCode: 500, message: "boom" } }, "GET")
    await page.goto("/admin/verification")
    await expect(appAlerts(page)).toContainText("Không tải được danh sách yêu cầu.")
  })

  test("a member is redirected away", async ({ browser }) => {
    const context = await browser.newContext()
    await signInAs(context, "member")
    const page = await context.newPage()
    await page.goto("http://localhost:3000/admin/verification")
    await expect(page).toHaveURL(/\/home$/)
    await context.close()
  })
})
