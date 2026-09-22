"use client";

import MuxUploader from "@mux/mux-uploader-react";

async function getUploadEndpoint() {
  const res = await fetch("/api/mux/upload", { method: "POST" });
  const { url } = await res.json();
  return url as string;
}

export default function Page() {
  return <MuxUploader endpoint={getUploadEndpoint} />;
}
