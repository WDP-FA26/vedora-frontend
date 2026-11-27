import { describe, expect, it } from "vitest"

import { isWellFormedCitizenId } from "@/features/workspaces/citizen-id"

const TODAY = new Date("2026-11-27T00:00:00Z")

describe("isWellFormedCitizenId", () => {
  it("accepts a province code and a past birth year", () => {
    expect(isWellFormedCitizenId("001085012345", TODAY)).toBe(true)
    expect(isWellFormedCitizenId("079303012345", TODAY)).toBe(true)
  })

  it("rejects a code that is no province", () => {
    expect(isWellFormedCitizenId("003085012345", TODAY)).toBe(false)
    expect(isWellFormedCitizenId("099085012345", TODAY)).toBe(false)
  })

  it("rejects a birth after today", () => {
    expect(isWellFormedCitizenId("001227012345", TODAY)).toBe(false)
    expect(isWellFormedCitizenId("001485012345", TODAY)).toBe(false)
  })
})
