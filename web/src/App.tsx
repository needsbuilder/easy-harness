import { useLatestRelease } from "./lib/useLatestRelease";
import { Hero } from "./components/Hero";
import { DemoVideo } from "./components/DemoVideo";
import { Steps } from "./components/Steps";
import { Tools } from "./components/Tools";
import { Footer } from "./components/Footer";

export default function App() {
  const release = useLatestRelease();
  return (
    <main>
      <Hero picks={release.picks} failed={release.failed} />
      <DemoVideo />
      <Steps />
      <Tools />
      <Footer version={release.version} />
    </main>
  );
}
