import { ImageResponse } from "next/og";

export async function GET() {
  return new ImageResponse(
    (
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          width: "100%",
          height: "100%",
          borderRadius: 42,
          background: "linear-gradient(135deg, #1C1C1E 0%, #2C2C2E 100%)",
        }}
      >
        <div style={{ display: "flex", alignItems: "flex-end", gap: 8, height: 105 }}>
          <div style={{ width: 25, height: 48, borderRadius: 5, background: "linear-gradient(180deg, rgba(255,255,255,0.95), rgba(255,255,255,0.35))", opacity: 0.45 }} />
          <div style={{ width: 25, height: 105, borderRadius: 5, background: "linear-gradient(180deg, rgba(255,255,255,0.95), rgba(255,255,255,0.35))", opacity: 1.0 }} />
          <div style={{ width: 25, height: 76, borderRadius: 5, background: "linear-gradient(180deg, rgba(255,255,255,0.95), rgba(255,255,255,0.35))", opacity: 0.7 }} />
          <div style={{ width: 25, height: 38, borderRadius: 5, background: "linear-gradient(180deg, rgba(255,255,255,0.95), rgba(255,255,255,0.35))", opacity: 0.35 }} />
        </div>
      </div>
    ),
    { width: 192, height: 192 }
  );
}
