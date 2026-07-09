import {
  AbsoluteFill,
  Img,
  staticFile,
  interpolate,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import { COLORS, FONT, MONO } from "../theme";

const STEPS = ["준비물 확인", "도구 설치", "로그인", "설치 확인"];

// 씬 3: 오공이가 근두운 타고 날아가며 대신 설치/로그인 (진행바)
export const Installing: React.FC = () => {
  const frame = useCurrentFrame();
  const { durationInFrames } = useVideoConfig();

  const inOp = interpolate(frame, [0, 15], [0, 1], { extrapolateRight: "clamp" });
  const outOp = interpolate(
    frame,
    [durationInFrames - 15, durationInFrames],
    [1, 0],
    { extrapolateLeft: "clamp" },
  );

  const flyX = interpolate(frame, [8, durationInFrames - 20], [-200, 1400], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  // 왼쪽 위에서 등장해 오른쪽 아래로 대각선 하강하며 날아간다(슈퍼맨처럼 전진)
  const flyY =
    interpolate(frame, [8, durationInFrames - 20], [40, 150], {
      extrapolateLeft: "clamp",
      extrapolateRight: "clamp",
    }) +
    Math.sin(frame / 13) * 12;
  // 진행 방향(오른쪽)으로 몸을 살짝 기울여 앞으로 돌진하는 자세
  const tilt = interpolate(frame, [8, 40], [0, 12], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  const pct = Math.round(
    interpolate(frame, [22, durationInFrames - 28], [0, 100], {
      extrapolateLeft: "clamp",
      extrapolateRight: "clamp",
    }),
  );
  const stepIdx = Math.min(Math.floor(pct / 25), 3);

  return (
    <AbsoluteFill style={{ opacity: inOp * outOp, fontFamily: FONT }}>
      <Img
        src={staticFile("mascot.png")}
        style={{
          position: "absolute",
          width: 200,
          left: flyX,
          top: flyY,
          zIndex: 5, // 설치창(카드) 앞을 가로질러 날아간다
          transform: `rotate(${tilt}deg)`,
          filter: "drop-shadow(0 22px 30px rgba(42,32,24,0.28))",
        }}
      />
      <div
        style={{
          position: "absolute",
          left: "50%",
          top: "54%",
          transform: "translate(-50%,-50%)",
          width: 640,
          background: COLORS.card,
          borderRadius: 22,
          border: `1px solid ${COLORS.line}`,
          boxShadow: "0 20px 50px rgba(42,32,24,0.14)",
          padding: "36px 42px",
        }}
      >
        <div style={{ fontSize: 25, fontWeight: 800, color: COLORS.ink }}>
          오공이가 대신 설치하고 있어요
        </div>
        <div
          style={{
            marginTop: 22,
            height: 14,
            borderRadius: 999,
            background: COLORS.goldTint,
            overflow: "hidden",
          }}
        >
          <div
            style={{
              width: `${pct}%`,
              height: "100%",
              background: `linear-gradient(90deg,${COLORS.goldL},${COLORS.gold})`,
              borderRadius: 999,
            }}
          />
        </div>
        <div
          style={{
            marginTop: 10,
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
          }}
        >
          <div style={{ fontSize: 15, color: COLORS.ink2 }}>{STEPS[stepIdx]} 중...</div>
          <div style={{ fontFamily: MONO, fontSize: 17, fontWeight: 700, color: COLORS.goldD }}>
            {pct}%
          </div>
        </div>
        <div style={{ marginTop: 24, display: "flex", flexDirection: "column", gap: 12 }}>
          {STEPS.map((s, i) => {
            const done = pct >= (i + 1) * 25;
            const active = !done && pct >= i * 25;
            return (
              <div key={s} style={{ display: "flex", alignItems: "center", gap: 12 }}>
                <div
                  style={{
                    width: 26,
                    height: 26,
                    borderRadius: "50%",
                    background: done ? `linear-gradient(103deg,${COLORS.goldL},${COLORS.gold})` : COLORS.goldTint,
                    border: `2px solid ${done || active ? COLORS.gold : COLORS.line}`,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  {done ? (
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
                      <path
                        d="M5 12l5 5L19 7"
                        stroke="#fff"
                        strokeWidth="3"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                  ) : null}
                </div>
                <div
                  style={{
                    fontSize: 16,
                    fontWeight: done ? 700 : 500,
                    color: done ? COLORS.ink : COLORS.ink3,
                  }}
                >
                  {s}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </AbsoluteFill>
  );
};
