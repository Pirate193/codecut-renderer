type RenderResponse =
  | {
      success: true;
      projectId: string;
      renderUrl: string;
      totalFrames: number;
      durationMs: number;
    }
  | {
      success: false;
      projectId: string;
      error: string;
    };

const payload = {
  projectId: "test-project-001",
  fps: 30,
  width: 1280,
  height: 720,
  audio: {
    musicTrackUrl:
      "https://www.learningcontainer.com/wp-content/uploads/2020/02/Kalimba.mp3",
    musicVolume: 0.18,
  },
  scenes: [
    {
      _id: "scene-1",
      title: "Intro",
      order: 0,
      durationInFrames: 90,
      durationSeconds: 3,
      code: `
import React from "react";
import { AbsoluteFill, interpolate, useCurrentFrame } from "remotion";

export const Scene: React.FC = () => {
  const frame = useCurrentFrame();
  const opacity = interpolate(frame, [0, 20], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const translateY = interpolate(frame, [0, 30], [40, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  return (
    <AbsoluteFill
      style={{
        background: "linear-gradient(135deg, #0f172a 0%, #1e293b 100%)",
        alignItems: "center",
        justifyContent: "center",
        fontFamily: "Inter, Arial, sans-serif",
      }}
    >
      <div
        style={{
          opacity,
          transform: \`translateY(\${translateY}px)\`,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: 16,
        }}
      >
        <div
          style={{
            fontSize: 28,
            color: "#93c5fd",
            letterSpacing: 6,
            textTransform: "uppercase",
          }}
        >
          CodeCut
        </div>
        <div
          style={{
            fontSize: 84,
            fontWeight: 800,
            color: "white",
            lineHeight: 1,
          }}
        >
          AI Video Builder
        </div>
      </div>
    </AbsoluteFill>
  );
};
      `.trim(),
    },
    {
      _id: "scene-2",
      title: "Feature",
      order: 1,
      durationInFrames: 120,
      durationSeconds: 4,
      code: `
import React from "react";
import { AbsoluteFill, interpolate, useCurrentFrame } from "remotion";

const StatCard: React.FC<{
  title: string;
  value: string;
  delay: number;
}> = ({ title, value, delay }) => {
  const frame = useCurrentFrame();
  const opacity = interpolate(frame, [delay, delay + 20], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const scale = interpolate(frame, [delay, delay + 20], [0.9, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  return (
    <div
      style={{
        opacity,
        transform: \`scale(\${scale})\`,
        background: "rgba(255,255,255,0.08)",
        border: "1px solid rgba(255,255,255,0.14)",
        borderRadius: 24,
        padding: "24px 28px",
        width: 260,
        backdropFilter: "blur(8px)",
      }}
    >
      <div style={{ fontSize: 18, color: "#cbd5e1", marginBottom: 12 }}>
        {title}
      </div>
      <div style={{ fontSize: 42, fontWeight: 700, color: "white" }}>
        {value}
      </div>
    </div>
  );
};

export const Scene: React.FC = () => {
  const frame = useCurrentFrame();
  const titleOpacity = interpolate(frame, [0, 20], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  return (
    <AbsoluteFill
      style={{
        background: "radial-gradient(circle at top left, #1d4ed8 0%, #0f172a 45%, #020617 100%)",
        padding: 64,
        fontFamily: "Inter, Arial, sans-serif",
      }}
    >
      <div style={{ opacity: titleOpacity }}>
        <div style={{ fontSize: 24, color: "#93c5fd", marginBottom: 12 }}>
          Built for launch videos
        </div>
        <div
          style={{
            fontSize: 62,
            fontWeight: 800,
            color: "white",
            maxWidth: 820,
            lineHeight: 1.05,
            marginBottom: 40,
          }}
        >
          Turn scenes, assets, and prompts into a polished video
        </div>
      </div>

      <div style={{ display: "flex", gap: 20 }}>
        <StatCard title="Scenes" value="4" delay={10} />
        <StatCard title="Render" value="1080p" delay={20} />
        <StatCard title="Workflow" value="Fast" delay={30} />
      </div>
    </AbsoluteFill>
  );
};
      `.trim(),
    },
  ],
};

async function main() {
  const baseUrl = process.env.RENDER_BASE_URL ?? "http://localhost:4000";
  const renderSecret = process.env.RENDER_SECRET;

  const response = await fetch(`${baseUrl}/render`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      ...(renderSecret ? { "x-render-secret": renderSecret } : {}),
    },
    body: JSON.stringify(payload),
  });

  const json = (await response.json()) as RenderResponse;

  console.log("status:", response.status);
  console.dir(json, { depth: null });

  if (!response.ok || !json.success) {
    process.exit(1);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});