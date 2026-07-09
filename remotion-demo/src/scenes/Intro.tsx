import {
  AbsoluteFill,
  Img,
  staticFile,
  interpolate,
  spring,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import { COLORS, FONT } from "../theme";

// 씬 1: 오공이가 근두운 타고 등장 + 타이틀
export const Intro: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps, durationInFrames } = useVideoConfig();

  const enter = spring({ frame, fps, config: { damping: 14, mass: 0.9 } });
  const mascotY = interpolate(enter, [0, 1], [150, 0]);
  const mascotScale = interpolate(enter, [0, 1], [0.7, 1]);
  const floatY = Math.sin(frame / 16) * 10;

  const titleOp = interpolate(frame, [16, 36], [0, 1], { extrapolateRight: "clamp" });
  const titleY = interpolate(frame, [16, 36], [26, 0], { extrapolateRight: "clamp" });
  const subOp = interpolate(frame, [30, 52], [0, 1], { extrapolateRight: "clamp" });
  const outOp = interpolate(
    frame,
    [durationInFrames - 15, durationInFrames],
    [1, 0],
    { extrapolateLeft: "clamp" },
  );

  return (
    <AbsoluteFill
      style={{
        opacity: outOp,
        fontFamily: FONT,
        justifyContent: "center",
        alignItems: "center",
      }}
    >
      <div
        style={{
          position: "absolute",
          width: 860,
          height: 860,
          borderRadius: "50%",
          top: -140,
          background:
            "radial-gradient(circle at 50% 45%, rgba(232,193,90,0.35), rgba(232,193,90,0) 66%)",
        }}
      />
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
        <Img
          src={staticFile("mascot.png")}
          style={{
            width: 320,
            transform: `translateY(${mascotY + floatY}px) scale(${mascotScale})`,
            filter: "drop-shadow(0 24px 34px rgba(42,32,24,0.22))",
          }}
        />
        <div
          style={{
            opacity: titleOp,
            transform: `translateY(${titleY}px)`,
            fontSize: 66,
            fontWeight: 800,
            color: COLORS.ink,
            letterSpacing: "-0.03em",
            marginTop: 20,
          }}
        >
          이지 하네스
        </div>
        <div
          style={{
            opacity: subOp,
            fontSize: 29,
            color: COLORS.ink2,
            marginTop: 14,
            fontWeight: 500,
          }}
        >
          터미널 없이, 클릭 몇 번으로 AI 코딩 도구를 시작하세요
        </div>
      </div>
    </AbsoluteFill>
  );
};
