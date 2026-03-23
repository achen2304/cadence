import { ImageResponse } from "next/og";

export const size = { width: 180, height: 180 };
export const contentType = "image/png";

export default function AppleIcon() {
  return new ImageResponse(
    (
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          width: "100%",
          height: "100%",
          borderRadius: 40,
          background: "linear-gradient(135deg, #1C1C1E 0%, #2C2C2E 100%)",
        }}
      >
        <div style={{ display: "flex", alignItems: "flex-end", gap: 7, height: 98 }}>
          <div style={{ width: 23, height: 45, borderRadius: 5, background: "linear-gradient(180deg, rgba(255,255,255,0.95), rgba(255,255,255,0.35))", opacity: 0.45 }} />
          <div style={{ width: 23, height: 98, borderRadius: 5, background: "linear-gradient(180deg, rgba(255,255,255,0.95), rgba(255,255,255,0.35))", opacity: 1.0 }} />
          <div style={{ width: 23, height: 71, borderRadius: 5, background: "linear-gradient(180deg, rgba(255,255,255,0.95), rgba(255,255,255,0.35))", opacity: 0.7 }} />
          <div style={{ width: 23, height: 36, borderRadius: 5, background: "linear-gradient(180deg, rgba(255,255,255,0.95), rgba(255,255,255,0.35))", opacity: 0.35 }} />
        </div>
      </div>
    ),
    { ...size }
  );
}
