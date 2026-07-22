import { BrowserRouter, Routes, Route } from "react-router-dom";
import { useLatestRelease } from "./lib/useLatestRelease";
import { useCanonical } from "./lib/useCanonical";
import { Nav } from "./components/Nav";
import { Hero } from "./components/Hero";
import { DemoVideo } from "./components/DemoVideo";
import { Steps } from "./components/Steps";
import { Tools } from "./components/Tools";
import { CtaSection } from "./components/CtaSection";
import { Footer } from "./components/Footer";
import Terms from "./pages/Terms";
import Privacy from "./pages/Privacy";

function Landing() {
  const release = useLatestRelease();
  return (
    <>
      <Nav />
      <main>
        <Hero picks={release.picks} failed={release.failed} />
        <DemoVideo />
        <Steps />
        <Tools />
        <CtaSection picks={release.picks} failed={release.failed} />
      </main>
      <Footer version={release.version} />
    </>
  );
}

/** 라우터 안쪽에서만 현재 경로를 알 수 있어서 별도 컴포넌트로 둔다 */
function CanonicalTag() {
  useCanonical();
  return null;
}

export default function App() {
  return (
    <BrowserRouter>
      <CanonicalTag />
      <Routes>
        <Route path="/" element={<Landing />} />
        <Route path="/terms" element={<Terms />} />
        <Route path="/privacy" element={<Privacy />} />
      </Routes>
    </BrowserRouter>
  );
}
