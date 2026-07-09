import {
  AbsoluteFill,
  Img,
  staticFile,
  interpolate,
  spring,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import { COLORS, FONT, MONO } from "../theme";

const TOOLS = [
  { name: "Claude Code", icon: "icons/claude-code.png", desc: "앤트로픽의 AI 코딩 도구" },
  { name: "Codex", icon: "icons/codex.png", desc: "오픈AI의 코딩 도구" },
  { name: "GajaeCode", icon: "icons/gajaecode.png", desc: "한국어에 강한 도구" },
  { name: "OpenClaw", icon: "icons/openclaw.png", desc: "가벼운 오픈소스 도구" },
  { name: "Hermes", icon: "icons/hermes.png", desc: "누스 리서치의 도구" },
  { name: "OpenCode", icon: "icons/opencode.png", desc: "터미널 기반 도구" },
];

// 씬 2: 앱 카탈로그에서 도구를 고르는 화면 (커서가 첫 카드를 클릭)
export const PickTool: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps, durationInFrames } = useVideoConfig();

  const inOp = interpolate(frame, [0, 15], [0, 1], { extrapolateRight: "clamp" });
  const outOp = interpolate(
    frame,
    [durationInFrames - 15, durationInFrames],
    [1, 0],
    { extrapolateLeft: "clamp" },
  );
  const capOp = interpolate(frame, [6, 22], [0, 1], { extrapolateRight: "clamp" });

  const cursorProg = interpolate(frame, [72, 120], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const cursorX = interpolate(cursorProg, [0, 1], [820, 175]);
  const cursorY = interpolate(cursorProg, [0, 1], [560, 300]);
  const clicked = frame >= 124;
  const clickPop = spring({ frame: frame - 124, fps, config: { damping: 9 } });
  // 클릭 순간 살짝 튕겼다가(sin 0→최대→0) 원래 크기(1.0)로 복귀 — 크기는 균일하게 유지
  const firstCardScale = clicked
    ? 1 + Math.sin(Math.min(clickPop, 1) * Math.PI) * 0.03
    : 1;

  return (
    <AbsoluteFill
      style={{
        opacity: inOp * outOp,
        fontFamily: FONT,
        justifyContent: "center",
        alignItems: "center",
      }}
    >
      <div
        style={{
          opacity: capOp,
          fontFamily: MONO,
          fontSize: 18,
          letterSpacing: "0.2em",
          color: COLORS.goldTx,
          fontWeight: 600,
          marginBottom: 18,
          textTransform: "uppercase",
        }}
      >
        쓰고 싶은 도구를 골라요
      </div>
      <div
        style={{
          width: 980,
          borderRadius: 20,
          background: COLORS.card,
          border: `1px solid ${COLORS.line}`,
          boxShadow: "0 24px 60px rgba(42,32,24,0.16)",
          overflow: "hidden",
          position: "relative",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            padding: "15px 20px",
            background: "linear-gradient(180deg,#fdf7ea,#f8efdb)",
            borderBottom: `1px solid ${COLORS.line}`,
          }}
        >
          <div style={{ width: 13, height: 13, borderRadius: "50%", background: "#E8A317" }} />
          <div style={{ width: 13, height: 13, borderRadius: "50%", background: COLORS.line }} />
          <div style={{ width: 13, height: 13, borderRadius: "50%", background: COLORS.line }} />
          <div style={{ marginLeft: 14, fontFamily: MONO, fontSize: 14, color: COLORS.ink3 }}>
            이지 하네스
          </div>
        </div>
        <div style={{ padding: 28 }}>
          <div style={{ fontSize: 22, fontWeight: 800, color: COLORS.ink }}>도구 고르기</div>
          <div style={{ fontSize: 15, color: COLORS.ink3, marginTop: 4 }}>
            쓰고 싶은 도구를 골라 보세요
          </div>
          <div
            style={{
              marginTop: 20,
              display: "grid",
              gridTemplateColumns: "repeat(3,1fr)",
              gap: 14,
            }}
          >
            {TOOLS.map((t, i) => {
              const cardIn = spring({ frame: frame - (10 + i * 6), fps, config: { damping: 16 } });
              const cy = interpolate(cardIn, [0, 1], [24, 0]);
              const isFirst = i === 0;
              const hot = isFirst && clicked;
              return (
                <div
                  key={t.name}
                  style={{
                    opacity: cardIn,
                    transform: `translateY(${cy}px) scale(${isFirst ? firstCardScale : 1})`,
                    background: COLORS.card,
                    border: `${hot ? 2 : 1}px solid ${hot ? COLORS.gold : COLORS.line}`,
                    borderRadius: 14,
                    padding: 18,
                    minHeight: 128,
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "flex-start",
                    boxShadow: hot
                      ? "0 10px 24px rgba(201,146,43,0.24)"
                      : "0 1px 4px rgba(42,32,24,0.06)",
                  }}
                >
                  <Img
                    src={staticFile(t.icon)}
                    style={{ width: 42, height: 42, borderRadius: 11, objectFit: "cover" }}
                  />
                  <div style={{ fontWeight: 800, fontSize: 16, marginTop: 12, color: COLORS.ink }}>
                    {t.name}
                  </div>
                  <div style={{ fontSize: 12.5, color: COLORS.ink3, marginTop: 4 }}>{t.desc}</div>
                </div>
              );
            })}
          </div>
        </div>
        <div
          style={{
            position: "absolute",
            left: cursorX,
            top: cursorY,
            transform: `scale(${clicked ? interpolate(clickPop, [0, 1], [0.8, 1]) : 1})`,
          }}
        >
          <svg width="32" height="32" viewBox="0 0 24 24" fill="none">
            <path
              d="M4 2l6 15 2.6-6.6L19.5 8 4 2z"
              fill="#2A2018"
              stroke="#fff"
              strokeWidth="1.5"
              strokeLinejoin="round"
            />
          </svg>
        </div>
      </div>
    </AbsoluteFill>
  );
};
