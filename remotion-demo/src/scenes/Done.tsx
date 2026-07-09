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

// 씬 4: 준비 완료
export const Done: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const pop = spring({ frame, fps, config: { damping: 11, mass: 0.8 } });
  const checkScale = interpolate(pop, [0, 1], [0.3, 1]);
  const titleOp = interpolate(frame, [12, 30], [0, 1], { extrapolateRight: "clamp" });
  const titleY = interpolate(frame, [12, 30], [22, 0], { extrapolateRight: "clamp" });
  const subOp = interpolate(frame, [24, 44], [0, 1], { extrapolateRight: "clamp" });
  const mascotIn = spring({ frame: frame - 6, fps, config: { damping: 13 } });
  const mascotScale = interpolate(mascotIn, [0, 1], [0.6, 1]);
  const floatY = Math.sin(frame / 16) * 8;

  return (
    <AbsoluteFill
      style={{ fontFamily: FONT, justifyContent: "center", alignItems: "center" }}
    >
      <div
        style={{
          position: "absolute",
          width: 740,
          height: 740,
          borderRadius: "50%",
          background:
            "radial-gradient(circle, rgba(232,193,90,0.32), rgba(232,193,90,0) 66%)",
        }}
      />
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
        <div
          style={{
            width: 130,
            height: 130,
            borderRadius: "50%",
            background: `linear-gradient(103deg,${COLORS.goldL},${COLORS.gold})`,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            transform: `scale(${checkScale})`,
            boxShadow: "0 16px 34px rgba(201,146,43,0.36)",
          }}
        >
          <svg width="66" height="66" viewBox="0 0 24 24" fill="none">
            <path
              d="M5 12.5l4.5 4.5L19 7.5"
              stroke="#fff"
              strokeWidth="3"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </div>
        <div
          style={{
            opacity: titleOp,
            transform: `translateY(${titleY}px)`,
            fontSize: 60,
            fontWeight: 800,
            color: COLORS.ink,
            letterSpacing: "-0.03em",
            marginTop: 28,
          }}
        >
          준비 완료!
        </div>
        <div
          style={{ opacity: subOp, fontSize: 27, color: COLORS.ink2, marginTop: 12, fontWeight: 500 }}
        >
          이제 바로 코딩을 시작하세요
        </div>
        <Img
          src={staticFile("mascot.png")}
          style={{
            width: 150,
            marginTop: 22,
            transform: `translateY(${floatY}px) scale(${mascotScale})`,
            filter: "drop-shadow(0 14px 22px rgba(42,32,24,0.2))",
          }}
        />
      </div>
    </AbsoluteFill>
  );
};
