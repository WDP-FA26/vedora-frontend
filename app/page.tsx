import type { Metadata } from "next"

import { Landing } from "@/features/landing/components/landing"

export const metadata: Metadata = {
  title: "Giới thiệu · Vedora",
  description:
    "Vì sao ăn xanh tốt cho cơ thể và Trái Đất, và Vedora giúp bạn nấu ăn thuần thực vật cùng cộng đồng như thế nào.",
}

export default function LandingPage() {
  return <Landing />
}
