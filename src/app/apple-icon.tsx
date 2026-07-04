import { ImageResponse } from "next/og";
import { readFile } from "node:fs/promises";
import { join } from "node:path";

// iOS ignores SVG for the home-screen icon, so we rasterize the brand mark to
// PNG at Apple's 180×180. The source icon.svg has transparent rounded corners;
// we sit it on a solid forest square so iOS's own corner mask doesn't
// double-round it.
export const size = { width: 180, height: 180 };
export const contentType = "image/png";

export default async function AppleIcon() {
  const svg = await readFile(join(process.cwd(), "src/app/icon.svg"), "base64");
  const src = `data:image/svg+xml;base64,${svg}`;

  return new ImageResponse(
    <div
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        width: "100%",
        height: "100%",
        background: "#4b5a23",
      }}
    >
      <img src={src} width={140} height={140} alt="" />
    </div>,
    { ...size },
  );
}
