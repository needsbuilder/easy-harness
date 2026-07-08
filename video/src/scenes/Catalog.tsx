import { AbsoluteFill, interpolate, useCurrentFrame, Easing } from "remotion";
import { GOLD } from "../brand";
import { DeviceShot } from "../components/DeviceShot";

// Claude Code 카드(좌상단) 대략 위치 (1280x720 프레임 기준)
const CARD_X = 440;
const CARD_Y = 250;

export const Catalog: React.FC = () => {
  const frame = useCurrentFrame();
  const cx = interpolate(frame, [24, 74], [920, CARD_X], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: Easing.inOut(Easing.cubic),
  });
  const cy = interpolate(frame, [24, 74], [580, CARD_Y], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: Easing.inOut(Easing.cubic),
  });
  const ripple = interpolate(frame, [76, 108], [0.4, 2], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const rippleOpacity = interpolate(frame, [76, 108], [0.7, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  return (
    <AbsoluteFill>
      <DeviceShot src="catalog.png" caption="쓰고 싶은 도구를 카드에서 골라요" zoom />
      {/* 클릭 물결 */}
      <div
        style={{
          position: "absolute",
          left: CARD_X,
          top: CARD_Y,
          width: 90,
          height: 90,
          marginLeft: -45,
          marginTop: -45,
          borderRadius: 999,
          border: `4px solid ${GOLD}`,
          transform: `scale(${ripple})`,
          opacity: rippleOpacity,
        }}
      />
      {/* 커서 */}
      <div
        style={{
          position: "absolute",
          left: cx,
          top: cy,
          width: 24,
          height: 24,
          marginLeft: -12,
          marginTop: -12,
          borderRadius: 999,
          background: "#fff",
          border: "3px solid #2A2018",
          boxShadow: "0 2px 8px rgba(0,0,0,0.3)",
        }}
      />
    </AbsoluteFill>
  );
};
