import {
  AbsoluteFill,
  Img,
  interpolate,
  spring,
  staticFile,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import { GOLD_GRAD, FONT } from "../brand";

export const EndCard: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const pop = spring({ fps, frame, config: { damping: 14 } });
  const fade = interpolate(frame, [0, 12], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  return (
    <AbsoluteFill
      style={{
        backgroundImage: GOLD_GRAD,
        alignItems: "center",
        justifyContent: "center",
        fontFamily: FONT,
        opacity: fade,
      }}
    >
      <Img
        src={staticFile("mascot.png")}
        style={{
          width: 150,
          height: 150,
          objectFit: "contain",
          transform: `scale(${pop})`,
        }}
      />
      <div style={{ marginTop: 14, color: "#fff", fontSize: 54, fontWeight: 800 }}>
        이지 하네스
      </div>
      <div style={{ marginTop: 10, color: "#fff", fontSize: 30, fontWeight: 700, opacity: 0.95 }}>
        지금 다운로드
      </div>
      <div
        style={{
          marginTop: 26,
          color: "#fff",
          fontSize: 24,
          fontWeight: 600,
          background: "rgba(255,255,255,0.18)",
          padding: "10px 22px",
          borderRadius: 999,
        }}
      >
        easyharness.needslab.ai
      </div>
    </AbsoluteFill>
  );
};
