import { AbsoluteFill, Sequence } from "remotion";
import { COLORS } from "./theme";
import { Intro } from "./scenes/Intro";
import { PickTool } from "./scenes/PickTool";
import { Installing } from "./scenes/Installing";
import { Done } from "./scenes/Done";

// 씬은 살짝 겹치게 배치해 크로스페이드처럼 이어지게 한다 (총 720프레임 = 24초)
export const MyComposition: React.FC = () => {
  return (
    <AbsoluteFill style={{ backgroundColor: COLORS.cream }}>
      <Sequence durationInFrames={125}>
        <Intro />
      </Sequence>
      <Sequence from={115} durationInFrames={205}>
        <PickTool />
      </Sequence>
      <Sequence from={310} durationInFrames={245}>
        <Installing />
      </Sequence>
      <Sequence from={545} durationInFrames={175}>
        <Done />
      </Sequence>
    </AbsoluteFill>
  );
};
