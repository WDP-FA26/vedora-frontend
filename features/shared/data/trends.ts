import { authors } from "@/features/shared/data/users"
import type { Author } from "@/features/shared/types"
import type { Trend } from "@/features/shared/types"

// Illustrative fixtures; numbers are placeholders, not real metrics.

export const trends: Trend[] = [
  { id: "t1", context: "Cộng đồng toàn cầu", topic: "#Veganuary2026", sprouts: 48200 },
  { id: "t2", context: "Nghệ thuật ẩm thực", topic: "Phô mai hạt điều lên men", sprouts: 12500 },
  { id: "t3", context: "Du lịch & văn hóa", topic: "Cẩm nang ăn chay Tokyo 2026", sprouts: 8900 },
  { id: "t4", context: "Dinh dưỡng & thể hình", topic: "Mẹo tempeh giàu đạm", sprouts: 15100 },
]

export const suggestedCreators: Author[] = [
  {
    name: "Maya Patel",
    handle: "botanical_baker",
    initials: "MP",
    tone: "tomato",
    verified: "Đầu bếp đã xác minh",
  },
  authors.kenji,
  authors.amara,
  authors.noor,
  authors.julian,
]
