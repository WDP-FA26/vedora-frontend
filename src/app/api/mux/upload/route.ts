import { NextResponse } from "next/server";
import Mux from "@mux/ts";

const client = new Mux({
  tokenId: process.env["MUX_TOKEN_ID"],
  tokenSecret: process.env["MUX_TOKEN_SECRET"],
});

export async function POST() {
  const directUpload = await client.video.uploads.create({
    cors_origin: "*",
    new_asset_settings: {
      playback_policy: ["public"],
    },
  });

  return NextResponse.json({ url: directUpload.url });
}
