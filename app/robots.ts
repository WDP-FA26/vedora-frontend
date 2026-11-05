import type { MetadataRoute } from "next"

import { absoluteUrl } from "@/lib/site"

/** Posts, profiles and the landing page are public; the app behind sign-in is not worth crawling. */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: [
        "/home",
        "/blogs/",
        "/admin",
        "/billing",
        "/payment/",
        "/auth/",
        "/forgot-password",
        "/reset-password",
        "/verify-email",
      ],
    },
    sitemap: absoluteUrl("/sitemap.xml"),
  }
}
