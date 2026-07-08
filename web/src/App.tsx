import { detectOS } from "./lib/releases";
import { useLatestRelease } from "./lib/useLatestRelease";
import { Hero } from "./components/Hero";
import { DemoVideo } from "./components/DemoVideo";
import { Steps } from "./components/Steps";
import { Tools } from "./components/Tools";
import { Footer } from "./components/Footer";

export default function App() {
  const release = useLatestRelease();
  const os = detectOS(navigator.userAgent, navigator.platform);
  return (
    <main>
      <Hero os={os} picks={release.picks} version={release.version} failed={release.failed} />
      <DemoVideo />
      <Steps />
      <Tools />
      <Footer version={release.version} />
    </main>
  );
}
