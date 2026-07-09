import "./index.css";
import { Composition } from "remotion";
import { MyComposition } from "./Composition";

export const RemotionRoot: React.FC = () => {
  return (
    <>
      <Composition
        id="EasyHarnessDemo"
        component={MyComposition}
        durationInFrames={720}
        fps={30}
        width={1280}
        height={720}
      />
    </>
  );
};
