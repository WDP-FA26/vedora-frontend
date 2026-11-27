import { describe, expect, it } from "vitest"
import { adminPlansSchema, paidDraftSchema, freeDraftSchema, planRows, updatePayload, type AdminPlans } from "./schema"

const catalog: AdminPlans = {
  id: "9fd37843-83f6-48a4-ad66-012caec15136", version: 4, source: "DATABASE",
  updatedAt: "2026-11-28T00:00:00Z", updatedById: "admin-a", planVersion: 2, paymentsEnabled: true,
  freeLimits: { textLimit: 5, imageLimit: 0 },
  plans: [
    { code: "PLUS", name: "Plus", priceVnd: "49000", durationDays: 30, textLimit: 300, imageLimit: 10 },
    { code: "PRO", name: "Pro", priceVnd: "99000", durationDays: 30, textLimit: 900, imageLimit: 40 },
  ],
}

describe("subscription plan editing contracts", () => {
  it("changes only the selected paid plan while retaining the opened revision", () => {
    expect(updatePayload(catalog, "PLUS", { priceVnd: "59000", textLimit: "400", imageLimit: "15" })).toEqual({
      version: 4, freeLimits: { textLimit: 5, imageLimit: 0 },
      plans: [
        { code: "PLUS", priceVnd: 59000, textLimit: 400, imageLimit: 15 },
        { code: "PRO", priceVnd: 99000, textLimit: 900, imageLimit: 40 },
      ],
    })
    expect(catalog.plans[0].priceVnd).toBe("49000")
  })

  it("keeps Free free and leaves both paid plans unchanged", () => {
    const payload = updatePayload(catalog, "FREE", { priceVnd: "0", textLimit: "8", imageLimit: "2" })
    expect(payload.freeLimits).toEqual({ textLimit: 8, imageLimit: 2 })
    expect(payload.plans.map(({ priceVnd }) => priceVnd)).toEqual([49000, 99000])
    expect(planRows(catalog)[0]).toMatchObject({ code: "FREE", priceVnd: "0", durationDays: null })
    expect(planRows(catalog)).toHaveLength(3)
  })

  it.each(["", "-1", "1.5", "1e3", "1,000", "1000000001", "0"])("rejects invalid paid prices %j", (priceVnd) => {
    expect(paidDraftSchema.safeParse({ priceVnd, textLimit: "300", imageLimit: "10" }).success).toBe(false)
  })

  it("accepts zero quotas and validates the upper quota limit", () => {
    expect(freeDraftSchema.parse({ textLimit: "0", imageLimit: "0" })).toEqual({ textLimit: 0, imageLimit: 0 })
    expect(freeDraftSchema.safeParse({ textLimit: "1000001", imageLimit: "0" }).success).toBe(false)
    expect(freeDraftSchema.safeParse({ textLimit: "1.5", imageLimit: "0" }).success).toBe(false)
  })

  it("requires admin version metadata instead of accepting a public catalog as editable settings", () => {
    const { version, ...withoutVersion } = catalog
    expect(version).toBe(4)
    expect(adminPlansSchema.safeParse(withoutVersion).success).toBe(false)
  })
})
