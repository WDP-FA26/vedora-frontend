export const pets = [
  { value: "sprout", label: "Mầm xanh" },
  { value: "salad", label: "Bé Salad" },
] as const

export type PetChoice = (typeof pets)[number]["value"]
export type PetOffset = { x: number; y: number }
export type PetPreference = { pet: PetChoice; offset: PetOffset }

export const PET_COOKIE = "vedora-pet"
export const PET_OFFSET_COOKIE = "vedora-pet-offset"
export const DEFAULT_PET: PetChoice = "sprout"
export const NO_OFFSET: PetOffset = { x: 0, y: 0 }

export function isPetChoice(value: unknown): value is PetChoice {
  return pets.some((pet) => pet.value === value)
}

export function parsePet(raw: string | undefined): PetChoice {
  return isPetChoice(raw) ? raw : DEFAULT_PET
}

export function parseOffset(raw: string | undefined): PetOffset {
  const [x, y] = (raw ?? "").split(",").map(Number)
  return Number.isFinite(x) && Number.isFinite(y) ? { x, y } : NO_OFFSET
}

export function serializeOffset({ x, y }: PetOffset) {
  return `${Math.round(x)},${Math.round(y)}`
}
