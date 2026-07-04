import { ImageResponse } from "next/og";

/**
 * Shared renderer for the branded 1200×630 social-share card, used by the
 * home and POI `opengraph-image`/`twitter-image` routes.
 *
 * A full-bleed background photo carries the mood; a forest gradient washes the
 * lower-left for legibility; cream text sits on top (eyebrow → headline →
 * subtitle). No custom font is loaded — next/og's built-in sans keeps the
 * route dependency-free and statically optimizable.
 *
 * `backgroundSrc` accepts a data URI (home hero, read from disk) or a remote
 * URL (POI photo) — next/og fetches remote `<img>` sources at build time.
 */
export const OG_SIZE = { width: 1200, height: 630 };
export const OG_CONTENT_TYPE = "image/png";

export function renderOgCard({
  eyebrow,
  title,
  subtitle,
  backgroundSrc,
}: {
  eyebrow: string;
  title: string;
  subtitle: string;
  backgroundSrc: string;
}) {
  return new ImageResponse(
    <div
      style={{
        display: "flex",
        position: "relative",
        width: "100%",
        height: "100%",
        background: "#4b5a23",
      }}
    >
      {/* Background photo, when available; the forest fill shows otherwise
            (e.g. the placeholder POI slug, which never renders a real page). */}
      {backgroundSrc ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={backgroundSrc}
          alt=""
          width={OG_SIZE.width}
          height={OG_SIZE.height}
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            width: "100%",
            height: "100%",
            objectFit: "cover",
          }}
        />
      ) : null}
      {/* Legibility wash: darker forest at the bottom-left fading up/right. */}
      <div
        style={{
          display: "flex",
          position: "absolute",
          inset: 0,
          background:
            "linear-gradient(120deg, rgba(43,52,21,0.92) 0%, rgba(43,52,21,0.55) 45%, rgba(43,52,21,0.05) 100%)",
        }}
      />
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          justifyContent: "flex-end",
          position: "relative",
          width: "100%",
          height: "100%",
          padding: 72,
          color: "#fffaf0",
        }}
      >
        <div
          style={{
            display: "flex",
            fontSize: 26,
            letterSpacing: 8,
            textTransform: "uppercase",
            opacity: 0.85,
            marginBottom: 20,
          }}
        >
          {eyebrow}
        </div>
        <div
          style={{
            display: "flex",
            fontSize: 76,
            fontWeight: 700,
            lineHeight: 1.05,
            maxWidth: 900,
          }}
        >
          {title}
        </div>
        <div
          style={{
            display: "flex",
            fontSize: 36,
            marginTop: 24,
            opacity: 0.92,
            maxWidth: 900,
          }}
        >
          {subtitle}
        </div>
      </div>
    </div>,
    { ...OG_SIZE },
  );
}
