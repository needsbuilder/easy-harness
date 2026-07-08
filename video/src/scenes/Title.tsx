import {
  AbsoluteFill,
  Img,
  interpolate,
  spring,
  staticFile,
  useCurrentFrame,
  useVideoConfig,
  Easing,
} from "remotion";
import { GOLD_GRAD, FONT } from "../brand";

export const Title: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const mascotScale = spring({ fps, frame, config: { damping: 12, mass: 0.6 } });
  const textOpacity = interpolate(frame, [12, 32], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: Easing.out(Easing.cubic),
  });
  const textY = interpolate(frame, [12, 32], [24, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: Easing.out(Easing.cubic),
  });
  return (
    <AbsoluteFill
      style={{
        backgroundImage: GOLD_GRAD,
        alignItems: "center",
        justifyContent: "center",
        fontFamily: FONT,
      }}
    >
      <Img
        src={staticFile("mascot.png")}
        style={{
          width: 210,
          height: 210,
          objectFit: "contain",
          transform: `scale(${mascotScale})`,
          filter: "drop-shadow(0 12px 26px rgba(42,32,24,0.28))",
        }}
      />
      <div
        style={{
          marginTop: 22,
          color: "#fff",
          fontWeight: 800,
          fontSize: 58,
          lineHeight: 1.25,
          textAlign: "center",
          opacity: textOpacity,
          transform: `translateY(${textY}px)`,
        }}
      >
        터미널 없이
        <br />
        AI 코딩 도구 시작하기
      </div>
    </AbsoluteFill>
  );
};
