import { NextResponse } from "next/server";
import Mux from "@mux/ts";

const client = new Mux({
  tokenId: process.env["MUX_TOKEN_ID"],
  tokenSecret: process.env["MUX_TOKEN_SECRET"],
});

// The route has no auth or rate limit yet, so in production anyone could mint
// upload URLs on the Mux account. It stays off there until explicitly enabled
// (add auth first).
const enabled =
  process.env.NODE_ENV !== "production" ||
  process.env["MUX_UPLOADS_ENABLED"] === "true";

export async function POST() {
  if (!enabled) {
    return new NextResponse(null, { status: 404 });
  }

  const directUpload = await client.video.uploads.create({
    cors_origin: "*",
    new_asset_settings: {
      playback_policy: ["public"],
    },
  });

  return NextResponse.json({ url: directUpload.url });
}
