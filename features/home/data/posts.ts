import { authors } from "@/features/shared/data/users"
import type { FeedTab, Post } from "@/features/home/types"

// Illustrative fixtures, kept in code for now. Names, handles, and
// numbers are placeholders, not real people or metrics.

const posts: Post[] = [
  {
    id: "p1",
    kind: "video",
    publishedAt: "2026-09-22T18:30:00Z",
    tags: ["BữaTối15Phút", "ĐậuHũ"],
    body: "Bí quyết để đậu hũ giòn rụm không chỉ nằm ở bột bắp. Hãy luộc đậu trong nước muối trước, rồi ép ráo và áp chảo bằng dầu mè ép lạnh. Đây là hướng dẫn đầy đủ kèm sốt phủ maple-tahini vàng óng. Xem kỹ thuật nhé!",
    author: authors.marcus,
    stats: { replies: 1200, reposts: 4800, sprouts: 14200, views: 212000 },
    sprouted: true,
    video: { source: "placeholder", duration: "2:45", caption: "Video từng bước", tone: "grain" },
  },
  {
    id: "p2",
    kind: "article",
    publishedAt: "2026-09-18T09:00:00Z",
    tags: ["DinhDưỡng", "NghiênCứu"],
    body: "Vì sao kết hợp sắt non-heme với axit citric có thể tăng khả năng hấp thu ở tế bào lên tới 300%. Chúng tôi phân tích dữ liệu mới về rau họ cải lên men, việc khử phytate bằng cách ngâm, và các phương pháp duy trì sức khỏe bền vững.",
    author: authors.sarah,
    stats: { replies: 342, reposts: 819, sprouts: 6100, views: 98400 },
    attachment: {
      title: "Kỹ thuật giảm phytate trên 12 loại ngũ cốc",
      source: "Cùng Nhóm Nghiên cứu Lâm sàng · 4 phút đọc",
      tone: "tomato",
    },
  },
  {
    id: "p3",
    kind: "photo",
    publishedAt: "2026-09-15T07:45:00Z",
    tags: ["LàmVườnĐôThị"],
    body: "Mẻ thu hoạch đầu tiên từ ban công căn hộ tầng 4! Cà chua gia truyền Cherokee Purple năm nay ngọt đậm. Mình giã cùng húng quế Genovese tươi và hạt thông rang để làm sốt pesto sống tươi mát. Còn ai trồng rau trong không gian nhỏ không?",
    author: authors.julian,
    stats: { replies: 189, reposts: 410, sprouts: 3900, views: 41700 },
    bookmarked: true,
    photos: [
      { alt: "Giỏ cà chua gia truyền", tone: "tomato" },
      { alt: "Sốt pesto húng quế trong cối", tone: "basil" },
    ],
  },
  {
    id: "p4",
    kind: "video",
    publishedAt: "2026-09-13T12:10:00Z",
    tags: ["LênMen", "Miso"],
    body: "Miso trắng làm nhanh bằng đậu gà thay cho đậu nành. Koji gạo, 6% muối và hơi ấm từ đèn lò nướng lo phần việc nặng. Mình cho xem kết cấu ở ngày thứ nhất, hai và ba để bạn biết thế nào là ‘đã xong’.",
    author: authors.kenji,
    stats: { replies: 256, reposts: 1100, sprouts: 8700, views: 126000 },
    video: { source: "placeholder", duration: "6:12", caption: "Kỹ thuật", tone: "beet" },
  },
  {
    id: "p5",
    kind: "article",
    publishedAt: "2026-09-10T16:20:00Z",
    tags: ["GhiChúBếp", "Umami"],
    body: "Tảo kombu, nấm porcini khô, miso trắng và men dinh dưỡng rang, mỗi thứ mang một tầng vị umami khác nhau. Đây là cách tôi phối chúng qua một tuần phục vụ, và chỗ mỗi loại âm thầm thất bại.",
    author: authors.amara,
    stats: { replies: 98, reposts: 520, sprouts: 4400, views: 57300 },
    attachment: {
      title: "Tủ bếp umami: 14 nguyên liệu, xếp hạng theo glutamate",
      source: "Tài liệu tham khảo của đầu bếp · 7 phút đọc",
      tone: "grain",
    },
  },
  {
    id: "p6",
    kind: "photo",
    publishedAt: "2026-09-08T08:05:00Z",
    tags: ["LàmBánhThuầnChay"],
    body: "Bánh brioche aquafaba, lần thử thứ chín. Đánh aquafaba bông cứng, trộn bơ thực vật lạnh trong hai ngày. Ruột bánh mềm xốp như lông vũ và xé ra y như bánh thật.",
    author: authors.noor,
    stats: { replies: 64, reposts: 132, sprouts: 1800, views: 19200 },
    photos: [{ alt: "Ổ brioche tết trên giá làm nguội", tone: "grain" }],
  },
]

const following = new Set(["marcus_plantcraft", "kyoto_miso_lab", "julian_grows"])

export function getFeed(tab: FeedTab): Post[] {
  switch (tab) {
    case "following":
      return posts.filter((post) => following.has(post.author.handle))
    case "blogs":
      return posts.filter((post) => post.kind === "article")
    case "recipes":
      return posts.filter((post) => post.kind === "video")
    default:
      return posts
  }
}
