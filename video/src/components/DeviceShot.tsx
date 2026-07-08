import { AbsoluteFill, Img, staticFile, interpolate, useCurrentFrame } from "remotion";
import { BG, FONT } from "../brand";

/** 실제 앱 화면(목업 png)을 창처럼 띄우고, 페이드인 + 은은한 줌 + 자막을 얹는다. */
export const DeviceShot: React.FC<{
  src: string;
  caption?: string;
  zoom?: boolean;
}> = ({ src, caption, zoom }) => {
  const frame = useCurrentFrame();
  const fade = interpolate(frame, [0, 12], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const scale = zoom
    ? interpolate(frame, [0, 200], [1, 1.05], { extrapolateRight: "clamp" })
    : 1;
  const capFade = interpolate(frame, [12, 26], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  return (
    <AbsoluteFill
      style={{
        backgroundColor: BG,
        alignItems: "center",
        justifyContent: "center",
        opacity: fade,
      }}
    >
      <Img
        src={staticFile(src)}
        style={{
          width: "82%",
          borderRadius: 18,
          boxShadow: "0 24px 60px rgba(42,32,24,0.20)",
          transform: `scale(${scale})`,
        }}
      />
      {caption && (
        <div
          style={{
            position: "absolute",
            bottom: 46,
            background: "rgba(42,32,24,0.88)",
            color: "#fff",
            padding: "14px 28px",
            borderRadius: 999,
            fontSize: 30,
            fontWeight: 700,
            fontFamily: FONT,
            opacity: capFade,
          }}
        >
          {caption}
        </div>
      )}
    </AbsoluteFill>
  );
};
