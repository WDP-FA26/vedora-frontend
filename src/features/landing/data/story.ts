import {
  BadgeCheckIcon,
  BookOpenIcon,
  ClapperboardIcon,
  FlowerIcon,
  SproutIcon,
  type LucideIcon,
} from "lucide-react"

export const bodyBenefits = [
  {
    title: "Chất xơ dồi dào",
    body: "Rau, đậu và ngũ cốc nguyên hạt nuôi hệ vi sinh đường ruột và giúp bạn no lâu một cách tự nhiên.",
  },
  {
    title: "Trái tim nhẹ nhõm",
    body: "Bữa ăn giàu thực vật thường ít chất béo bão hoà và không chứa cholesterol từ thực phẩm.",
  },
  {
    title: "Năng lượng bền bỉ",
    body: "Tinh bột phức hợp giải phóng năng lượng từ từ, giúp bạn đi hết ngày dài nhẹ nhàng hơn.",
  },
] as const

/**
 * Poore & Nemecek (2018), Science 360(6392): moving from current diets to one
 * without animal products, global food-system reductions.
 */
export const planetStats = [
  { value: 76, label: "diện tích đất dành cho sản xuất thực phẩm" },
  { value: 49, label: "khí nhà kính phát thải từ thực phẩm" },
  { value: 19, label: "lượng nước ngọt khai thác, tính theo mức khan hiếm" },
] as const

export const platformFeatures: Array<{
  icon: LucideIcon
  title: string
  body: string
}> = [
  {
    icon: ClapperboardIcon,
    title: "Video công thức ngắn",
    body: "Từng bước nấu gọn trong một phút. Lưu lại, nấu theo, rồi đăng phiên bản của riêng bạn.",
  },
  {
    icon: BookOpenIcon,
    title: "Blog và nghiên cứu",
    body: "Bài viết dài về dinh dưỡng, nguyên liệu theo mùa và khoa học thực phẩm, đọc ngay trên dòng thời gian.",
  },
  {
    icon: BadgeCheckIcon,
    title: "Đầu bếp đã xác minh",
    body: "Huy hiệu cho đầu bếp và chuyên gia thực vật để bạn biết mình đang học từ ai. Ai cũng có thể đăng bài.",
  },
  {
    icon: SproutIcon,
    title: "Sprout thay cho Like",
    body: "Thả Sprout cho món bạn thích. Con số được giữ kín đáo, để món ăn được chú ý hơn lượt tương tác.",
  },
  {
    icon: FlowerIcon,
    title: "Từ vườn đến đĩa",
    body: "Khoe mùa thu hoạch, mẹo trồng rau ban công và những bữa ăn từ chính khu vườn của bạn.",
  },
]
