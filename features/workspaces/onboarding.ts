import {
  VN_PROVINCE_CODES,
  VN_PROVINCES,
  type VnProvinceCode,
} from "@/features/workspaces/vn-provinces"

export { VN_PROVINCE_CODES, VN_PROVINCES, type VnProvinceCode }

const VIETNAMESE = new Intl.Collator("vi")

function sortName(name: string) {
  return name.replace(/^(Thành phố|Tỉnh) /, "")
}

export const VN_PROVINCES_BY_NAME = [...VN_PROVINCE_CODES].sort((a, b) =>
  VIETNAMESE.compare(sortName(VN_PROVINCES[a]), sortName(VN_PROVINCES[b]))
)

export function isVnProvinceCode(code: string): code is VnProvinceCode {
  return Object.hasOwn(VN_PROVINCES, code)
}

export function provinceName(code: string): string | null {
  if (!isVnProvinceCode(code)) return null
  return VN_PROVINCES[code]
}

export const BUSINESS_FORMS = ["RESTAURANT", "EATERY", "STALL", "ONLINE"] as const
export type BusinessForm = (typeof BUSINESS_FORMS)[number]

export const BUSINESS_FORM_LABELS: Record<BusinessForm, string> = {
  RESTAURANT: "Nhà hàng",
  EATERY: "Quán ăn",
  STALL: "Xe đẩy, quầy hàng",
  ONLINE: "Chỉ bán mang đi / online",
}

export const VEGETARIAN_LEVELS = ["VEGAN", "LACTO_OVO", "VEGETARIAN_MENU"] as const
export type VegetarianLevel = (typeof VEGETARIAN_LEVELS)[number]

export const VEGETARIAN_LEVEL_LABELS: Record<VegetarianLevel, string> = {
  VEGAN: "Thuần chay",
  LACTO_OVO: "Chay có trứng, sữa",
  VEGETARIAN_MENU: "Có thực đơn chay riêng",
}

export const LEGAL_ENTITY_TYPES = ["COMPANY", "HOUSEHOLD", "INDIVIDUAL"] as const
export type LegalEntityType = (typeof LEGAL_ENTITY_TYPES)[number]

type LegalEntityView = {
  label: string
  description: string
  taxCodeHint: string
  legalNameLabel: string | null
  legalAddressLabel: string
  representativeLabel: string
}

export const LEGAL_ENTITY_VIEWS: Record<LegalEntityType, LegalEntityView> = {
  COMPANY: {
    label: "Doanh nghiệp",
    description: "Công ty có giấy chứng nhận đăng ký doanh nghiệp.",
    taxCodeHint: "10 số, chi nhánh thêm -3 số (ví dụ 0312345678-001).",
    legalNameLabel: "Tên công ty",
    legalAddressLabel: "Địa chỉ công ty",
    representativeLabel: "Người đại diện theo pháp luật",
  },
  HOUSEHOLD: {
    label: "Hộ kinh doanh",
    description: "Có giấy chứng nhận đăng ký hộ kinh doanh.",
    taxCodeHint: "Mã số thuế 10 số, hoặc số CCCD 12 số của chủ hộ.",
    legalNameLabel: "Tên hộ kinh doanh",
    legalAddressLabel: "Địa chỉ hộ kinh doanh",
    representativeLabel: "Người đứng tên hộ kinh doanh",
  },
  INDIVIDUAL: {
    label: "Cá nhân",
    description: "Bán nhỏ, chưa đăng ký kinh doanh (xe đẩy, bếp tại nhà…).",
    taxCodeHint: "Số CCCD 12 số, cũng là mã số thuế cá nhân.",
    legalNameLabel: null,
    legalAddressLabel: "Địa chỉ thường trú",
    representativeLabel: "Họ và tên (đúng như trên CCCD)",
  },
}

export function isTaxCodeFor(entityType: LegalEntityType, taxCode: string): boolean {
  const company = /^\d{10}(-\d{3})?$/
  const citizenId = /^\d{12}$/
  if (entityType === "COMPANY") return company.test(taxCode)
  if (entityType === "INDIVIDUAL") return citizenId.test(taxCode)
  return company.test(taxCode) || citizenId.test(taxCode)
}

export const PROOF_KINDS = [
  "ID_FRONT",
  "ID_BACK",
  "STOREFRONT",
  "BUSINESS_LICENSE",
  "FOOD_SAFETY",
  "MENU",
  "OTHER",
] as const
export type ProofKind = (typeof PROOF_KINDS)[number]

type ProofKindView = { label: string; hint: string; max: number }

export const PROOF_KIND_VIEWS: Record<ProofKind, ProofKindView> = {
  ID_FRONT: {
    label: "CCCD mặt trước",
    hint: "Của người đứng tên, rõ chữ và ảnh.",
    max: 1,
  },
  ID_BACK: { label: "CCCD mặt sau", hint: "Của người đứng tên.", max: 1 },
  STOREFRONT: {
    label: "Ảnh mặt tiền quán",
    hint: "Thấy rõ biển hiệu và số nhà.",
    max: 1,
  },
  BUSINESS_LICENSE: {
    label: "Giấy chứng nhận đăng ký kinh doanh",
    hint: "Doanh nghiệp hoặc hộ kinh doanh.",
    max: 1,
  },
  FOOD_SAFETY: {
    label: "Giấy chứng nhận an toàn thực phẩm",
    hint: "Không bắt buộc, nhưng giúp đơn được duyệt nhanh hơn.",
    max: 1,
  },
  MENU: { label: "Ảnh thực đơn", hint: "Không bắt buộc.", max: 3 },
  OTHER: { label: "Giấy tờ khác", hint: "Không bắt buộc.", max: 2 },
}

export function requiredProofKinds(entityType: LegalEntityType): ProofKind[] {
  const base: ProofKind[] = ["ID_FRONT", "ID_BACK", "STOREFRONT"]
  if (entityType === "INDIVIDUAL") return base
  return [...base, "BUSINESS_LICENSE"]
}

export const REJECT_REASONS = [
  "BLURRY_DOCUMENTS",
  "TAX_CODE_MISMATCH",
  "IDENTITY_MISMATCH",
  "STOREFRONT_MISMATCH",
  "UNREACHABLE",
  "NOT_VEGETARIAN",
  "DUPLICATE",
  "OTHER",
] as const
export type RejectReason = (typeof REJECT_REASONS)[number]

export const REJECT_REASON_LABELS: Record<RejectReason, string> = {
  BLURRY_DOCUMENTS: "Giấy tờ bị mờ hoặc thiếu",
  TAX_CODE_MISMATCH: "Mã số thuế không khớp tên pháp lý",
  IDENTITY_MISMATCH: "CCCD không khớp người đứng tên",
  STOREFRONT_MISMATCH: "Ảnh mặt tiền không khớp địa chỉ",
  UNREACHABLE: "Không liên lạc được qua số điện thoại",
  NOT_VEGETARIAN: "Quán không phục vụ món chay",
  DUPLICATE: "Trùng với trang đã có",
  OTHER: "Lý do khác",
}

export const WARNING_CODES = ["SAME_TAX_CODE", "NEARBY_PAGE", "RECENT_REJECTION"] as const
export type WarningCode = (typeof WARNING_CODES)[number]

export const WARNING_LABELS: Record<WarningCode, string> = {
  SAME_TAX_CODE: "Mã số thuế này đã có trang được duyệt (có thể là chi nhánh)",
  NEARBY_PAGE: "Có trang đã duyệt ghim cách dưới 100 m",
  RECENT_REJECTION: "Người gửi có đơn khác bị từ chối trong 30 ngày qua",
}

export const REVIEW_CHECKLIST_ITEMS = [
  "identityMatches",
  "taxCodeVerified",
  "storefrontMatches",
  "phoneConfirmed",
] as const
export type ReviewChecklistItem = (typeof REVIEW_CHECKLIST_ITEMS)[number]

export const REVIEW_CHECKLIST_LABELS: Record<ReviewChecklistItem, string> = {
  identityMatches: "Tên trên CCCD khớp người đứng tên",
  taxCodeVerified: "Mã số thuế tra cứu ra đúng tên pháp lý và còn hoạt động",
  storefrontMatches: "Ảnh mặt tiền khớp địa chỉ và ghim bản đồ",
  phoneConfirmed: "Đã gọi số điện thoại và được xác nhận",
}

export function taxCodeLookupUrl(taxCode: string) {
  return `https://masothue.com/Search/?q=${encodeURIComponent(taxCode)}&type=auto`
}
