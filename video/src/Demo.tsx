import { AbsoluteFill, Sequence } from "remotion";
import { BG } from "./brand";
import { Title } from "./scenes/Title";
import { Catalog } from "./scenes/Catalog";
import { Installing } from "./scenes/Installing";
import { Success } from "./scenes/Success";
import { EndCard } from "./scenes/EndCard";

export const Demo: React.FC = () => {
  return (
    <AbsoluteFill style={{ backgroundColor: BG }}>
      <Sequence durationInFrames={80}>
        <Title />
      </Sequence>
      <Sequence from={75} durationInFrames={205}>
        <Catalog />
      </Sequence>
      <Sequence from={275} durationInFrames={215}>
        <Installing />
      </Sequence>
      <Sequence from={485} durationInFrames={110}>
        <Success />
      </Sequence>
      <Sequence from={590} durationInFrames={70}>
        <EndCard />
      </Sequence>
    </AbsoluteFill>
  );
};
