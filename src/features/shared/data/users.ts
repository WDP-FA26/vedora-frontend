import type { Author } from "@/features/shared/types"

// Illustrative people; names and handles are placeholders.

export const authors = {
  marcus: {
    name: "Đầu bếp Marcus Green",
    handle: "marcus_plantcraft",
    initials: "MG",
    tone: "basil",
    verified: "Đầu bếp đã xác minh",
  },
  sarah: {
    name: "TS. Sarah Lin",
    handle: "sarahlin_nutrition",
    initials: "SL",
    tone: "sage",
    verified: "Nhà nghiên cứu dinh dưỡng đã xác minh",
  },
  julian: {
    name: "Julian Gomez",
    handle: "julian_grows",
    initials: "JG",
    tone: "tomato",
  },
  amara: {
    name: "Đầu bếp Amara Okafor",
    handle: "amara_cooks_green",
    initials: "AO",
    tone: "grain",
    verified: "Đầu bếp đã xác minh",
  },
  kenji: {
    name: "Kenji Takahashi",
    handle: "kyoto_miso_lab",
    initials: "KT",
    tone: "beet",
    verified: "Đầu bếp đã xác minh",
  },
  noor: {
    name: "Noor Haddad",
    handle: "noor_bakes_plants",
    initials: "NH",
    tone: "grain",
  },
} satisfies Record<string, Author>

export const currentUser: Author = {
  name: "Elena Rostova",
  handle: "elena_vegan",
  initials: "ER",
  tone: "sage",
}
