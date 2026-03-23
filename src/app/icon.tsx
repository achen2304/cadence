import { ImageResponse } from "next/og";

export const size = { width: 512, height: 512 };
export const contentType = "image/png";

export default function Icon() {
  return new ImageResponse(
    (
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          width: "100%",
          height: "100%",
          borderRadius: 110,
          background: "linear-gradient(135deg, #1C1C1E 0%, #2C2C2E 100%)",
          position: "relative",
        }}
      >
        {/* Bars */}
        <div style={{ display: "flex", alignItems: "flex-end", gap: 20, height: 280 }}>
          <div
            style={{
              width: 66,
              height: 128,
              borderRadius: 13,
              background: "linear-gradient(180deg, rgba(255,255,255,0.95), rgba(255,255,255,0.35))",
              opacity: 0.45,
            }}
          />
          <div
            style={{
              width: 66,
              height: 280,
              borderRadius: 13,
              background: "linear-gradient(180deg, rgba(255,255,255,0.95), rgba(255,255,255,0.35))",
              opacity: 1.0,
            }}
          />
          <div
            style={{
              width: 66,
              height: 204,
              borderRadius: 13,
              background: "linear-gradient(180deg, rgba(255,255,255,0.95), rgba(255,255,255,0.35))",
              opacity: 0.7,
            }}
          />
          <div
            style={{
              width: 66,
              height: 102,
              borderRadius: 13,
              background: "linear-gradient(180deg, rgba(255,255,255,0.95), rgba(255,255,255,0.35))",
              opacity: 0.35,
            }}
          />
        </div>
      </div>
    ),
    { ...size }
  );
}
