import type { Metadata } from "next"

import { Feed } from "@/features/home/components/feed"

export const metadata: Metadata = {
  title: "Khám phá · Vedora",
}

export default function Home() {
  return <Feed />
}
