import { ImageResponse } from "next/og";

export const OG_IMAGE_SIZE = {
  width: 1200,
  height: 630,
};

export const OG_CONTENT_TYPE = "image/png";

interface OgMetric {
  label: string;
  value: string;
  detail?: string;
}

interface EntityOgImageInput {
  badge: string;
  title: string;
  subtitle: string;
  accent: string;
  metrics: OgMetric[];
  primaryImage?: string;
  secondaryImage?: string;
  imageAlt: string;
}

export function createEntityOgImage({
  badge,
  title,
  subtitle,
  accent,
  metrics,
  primaryImage,
  secondaryImage,
  imageAlt,
}: EntityOgImageInput) {
  const titleSize = title.length > 30 ? 50 : title.length > 20 ? 58 : 68;

  return new ImageResponse(
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        justifyContent: "space-between",
        overflow: "hidden",
        position: "relative",
        padding: "48px 52px",
        color: "#f7f7f8",
        backgroundColor: "#080b10",
        backgroundImage:
          "radial-gradient(circle at 84% 26%, rgba(255,255,255,0.09), transparent 28%), linear-gradient(135deg, #101722 0%, #080b10 58%, #050608 100%)",
        fontFamily: "sans-serif",
      }}
    >
      <div
        style={{
          position: "absolute",
          inset: 0,
          display: "flex",
          opacity: 0.12,
          backgroundImage:
            "linear-gradient(rgba(255,255,255,0.08) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.08) 1px, transparent 1px)",
          backgroundSize: "42px 42px",
        }}
      />

      <div
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          width: "100%",
          height: 8,
          display: "flex",
          backgroundColor: accent,
        }}
      />

      <div
        style={{
          width: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          position: "relative",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
          <div
            style={{
              width: 28,
              height: 28,
              display: "flex",
              borderRadius: 8,
              backgroundColor: accent,
              boxShadow: `0 0 28px ${accent}`,
            }}
          />
          <div style={{ display: "flex", fontSize: 28, fontWeight: 800, letterSpacing: -1 }}>
            SquadStat
          </div>
        </div>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            border: "1px solid rgba(255,255,255,0.16)",
            borderRadius: 999,
            padding: "9px 16px",
            color: "#b7c0cc",
            backgroundColor: "rgba(255,255,255,0.05)",
            fontSize: 16,
            fontWeight: 700,
            letterSpacing: 2.2,
          }}
        >
          {badge.toUpperCase()}
        </div>
      </div>

      <div
        style={{
          flex: 1,
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 36,
          position: "relative",
        }}
      >
        <div
          style={{
            width: primaryImage ? 720 : "100%",
            display: "flex",
            flexDirection: "column",
            justifyContent: "center",
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              marginBottom: 14,
              color: accent,
              fontSize: 19,
              fontWeight: 800,
              letterSpacing: 1.4,
            }}
          >
            LIVE FOOTBALL DATA
          </div>
          <div
            style={{
              display: "flex",
              maxWidth: 750,
              color: "#ffffff",
              fontSize: titleSize,
              fontWeight: 850,
              lineHeight: 1.02,
              letterSpacing: -2.5,
            }}
          >
            {title}
          </div>
          <div
            style={{
              display: "flex",
              maxWidth: 720,
              marginTop: 18,
              color: "#aeb8c5",
              fontSize: 24,
              lineHeight: 1.35,
            }}
          >
            {subtitle}
          </div>
        </div>

        {primaryImage && (
          <div
            style={{
              width: 330,
              height: 330,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              position: "relative",
              flexShrink: 0,
              overflow: "hidden",
              border: "2px solid rgba(255,255,255,0.16)",
              borderRadius: 42,
              backgroundColor: "#f4f6f8",
              boxShadow: `0 24px 80px ${accent}38`,
            }}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={primaryImage}
              alt={imageAlt}
              width={300}
              height={300}
              style={{
                width: 300,
                height: 300,
                objectFit: "contain",
              }}
            />
            {secondaryImage && (
              <div
                style={{
                  position: "absolute",
                  right: 18,
                  bottom: 18,
                  width: 82,
                  height: 82,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  overflow: "hidden",
                  border: "4px solid #ffffff",
                  borderRadius: 22,
                  backgroundColor: "#ffffff",
                  boxShadow: "0 8px 24px rgba(0,0,0,0.28)",
                }}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={secondaryImage}
                  alt=""
                  width={68}
                  height={68}
                  style={{ width: 68, height: 68, objectFit: "contain" }}
                />
              </div>
            )}
          </div>
        )}
      </div>

      <div
        style={{
          width: "100%",
          display: "flex",
          alignItems: "stretch",
          justifyContent: "space-between",
          gap: 14,
          position: "relative",
        }}
      >
        <div style={{ display: "flex", gap: 14 }}>
          {metrics.slice(0, 3).map((metric) => (
            <div
              key={`${metric.label}-${metric.value}`}
              style={{
                width: 205,
                minHeight: 94,
                display: "flex",
                flexDirection: "column",
                justifyContent: "center",
                border: "1px solid rgba(255,255,255,0.13)",
                borderRadius: 20,
                padding: "14px 17px",
                backgroundColor: "rgba(255,255,255,0.055)",
              }}
            >
              <div
                style={{
                  display: "flex",
                  color: "#8e9aa8",
                  fontSize: 14,
                  fontWeight: 700,
                  letterSpacing: 1.4,
                  textTransform: "uppercase",
                }}
              >
                {metric.label}
              </div>
              <div
                style={{
                  display: "flex",
                  marginTop: 5,
                  color: "#ffffff",
                  fontFamily: "monospace",
                  fontSize: metric.value.length > 10 ? 22 : metric.value.length > 7 ? 25 : 29,
                  fontWeight: 700,
                  lineHeight: 1,
                  whiteSpace: "nowrap",
                }}
              >
                {metric.value}
              </div>
              {metric.detail && (
                <div
                  style={{
                    display: "flex",
                    marginTop: 6,
                    color: "#8e9aa8",
                    fontSize: 13,
                  }}
                >
                  {metric.detail}
                </div>
              )}
            </div>
          ))}
        </div>
        <div
          style={{
            display: "flex",
            alignItems: "flex-end",
            paddingBottom: 5,
            color: "#707c8a",
            fontSize: 17,
          }}
        >
          squadstat.com
        </div>
      </div>
    </div>,
    OG_IMAGE_SIZE,
  );
}
