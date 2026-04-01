import type { AudioConfig, SceneData } from "./types";

/** JSON.stringify-based escaping — safe for injecting URLs into source code */
function esc(value: string): string {
  return JSON.stringify(value);
}

export function generateIndexFile(): string {
  return `import { registerRoot } from "remotion";
import { Root } from "./Root";
registerRoot(Root);`.trim();
}

export function generateRootFile(
  scenes: SceneData[],
  fps: number,
  width: number,
  height: number,
  audio?: AudioConfig,
): string {
  // Always sort by order — guarantee correct sequence regardless of input order
  const ordered = [...scenes].sort((a, b) => a.order - b.order);
  const totalFrames = ordered.reduce((sum, s) => sum + s.durationFrames, 0);

  const imports = ordered
    .map((_, i) => `import { Scene as Scene${i} } from "./scene-${i}";`)
    .join("\n");

  const sequences = ordered
    .map(
      (scene, i) =>
        `    <Series.Sequence durationInFrames={${scene.durationFrames}} layout="none">\n` +
        `      <Scene${i} />\n` +
        `    </Series.Sequence>`,
    )
    .join("\n");

  // Audio lines — outside <Series> so they never restart between scenes
  const hasAudio = !!(audio?.musicTrackUrl || audio?.voiceoverUrl);
  const audioImport = hasAudio ? ", Audio" : "";

  const audioLines: string[] = [];
  if (audio?.musicTrackUrl) {
    audioLines.push(
      `      <Audio src={${esc(audio.musicTrackUrl)}} volume={${audio.musicVolume ?? 0.5}} />`,
    );
  }
  if (audio?.voiceoverUrl) {
    audioLines.push(
      `      <Audio src={${esc(audio.voiceoverUrl)}} volume={${audio.voiceoverVolume ?? 1.0}} />`,
    );
  }

  const audioBlock = audioLines.length > 0
    ? `      {/* Global audio — outside Series, plays continuously */}\n${audioLines.join("\n")}\n`
    : "";

  return `import React from "react";
import { Composition, Series${audioImport} } from "remotion";
${imports}

const MasterVideo: React.FC = () => (
    <>
      ${audioBlock} 
    <Series>
      ${sequences}
    </Series>
    </>
);

export const Root: React.FC = () => (
  <Composition
    id="MasterVideo"
    component={MasterVideo}
    durationInFrames={${totalFrames}}
    fps={${fps}}
    width={${width}}
    height={${height}}
  />
);`;
}