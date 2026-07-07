# 이지 하네스 소개 랜딩 사이트 + 시연영상 구현 계획

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 이지 하네스를 소개하고 OS에 맞는 설치 파일을 받게 하는 한 페이지 랜딩 사이트와, 클릭 몇 번으로 설치되는 과정을 담은 20~25초 무음+자막 시연영상을 만들어 임베드하고 Vercel(easyharness.needslab.ai)에 배포한다.

**Architecture:** 앱 리포 안에 `web/`(Vite+React+Tailwind 랜딩)와 `video/`(Remotion 프로젝트)를 추가한다. 다운로드 버튼은 클라이언트에서 GitHub API로 최신 릴리스 자산을 동적으로 물어와 버전이 바뀌어도 사이트 수정이 필요 없게 한다. 영상은 실제 앱 화면 캡처(마법사는 demo 모드)를 Remotion으로 애니메이션한 뒤 mp4로 렌더해 `web/public/demo.mp4`로 넣는다.

**Tech Stack:** Vite 7, React 19, TypeScript 5.8, Tailwind CSS 4(@tailwindcss/vite), Remotion(설치 시 최신), Vercel. 패키지 매니저 bun.

## Global Constraints

- 카피는 쉬운 한국어, 전문용어 0. **em dash(—) 금지. 이모지를 UI 요소로 쓰지 않는다.** (design-system.md)
- 브랜드 색·폰트는 `design/tokens.json`을 단일 원천으로: 주색 긴고아 골드 `#C9922B`, 그라디언트 `linear-gradient(90deg,#E8C15A,#C9922B)`, 배경 `#FCFAF6`(다크 `#181310`), 청록 포인트 `#7FD4DE`/`#12A5B8`는 제한 사용. 폰트 base "Pretendard Variable", mono "JetBrains Mono".
- 배포 리포는 `needslab-ai/easy-harness-releases`(public). 다운로드는 이 리포의 최신 릴리스 자산.
- 앱 소스(`src/`, `src-tauri/`)는 건드리지 않는다. 새 코드는 `web/`·`video/`에만.
- 새로 만든 것은 만든 뒤 실제로 브라우저/영상으로 눈으로 확인한다(시각 산출물).

## File Structure

```
web/                         # Vite+React 랜딩 (Vercel 루트 디렉터리)
  package.json               # vite/react/tailwind4/ts + vitest
  vite.config.ts             # react + @tailwindcss/vite
  tsconfig.json
  index.html                 # 메타/OG 태그, 폰트
  public/
    mascot.png wordmark.png favicon.png   # design/·src/assets에서 복사
    demo.mp4 demo-poster.png              # Task 9에서 생성
  src/
    main.tsx App.tsx index.css            # 앱 진입 + 토큰 CSS 변수
    lib/releases.ts                       # 다운로드 자산 리졸버(순수 로직)
    lib/__tests__/releases.test.ts
    components/Hero.tsx DemoVideo.tsx Steps.tsx Tools.tsx Footer.tsx
    components/DownloadButton.tsx
video/                       # Remotion 프로젝트
  package.json remotion.config.ts
  src/index.ts Root.tsx
  src/brand.ts               # 토큰 상수(색·폰트)
  src/Demo.tsx               # 메인 컴포지션(장면 조립)
  src/scenes/Title.tsx Catalog.tsx Wizard.tsx Success.tsx EndCard.tsx
  assets/                    # 캡처한 실제 앱 화면 png
out/demo.mp4                 # 렌더 산출물(→ web/public/로 복사)
```

---

### Task 1: web/ 스캐폴드 (Vite+React+TS+Tailwind4 + 브랜드 토큰)

**Files:**
- Create: `web/package.json`, `web/vite.config.ts`, `web/tsconfig.json`, `web/tsconfig.node.json`, `web/index.html`, `web/src/main.tsx`, `web/src/App.tsx`, `web/src/index.css`, `web/vitest.config.ts`
- Create: `web/public/mascot.png`, `web/public/wordmark.png`, `web/public/favicon.png` (복사)

**Interfaces:**
- Produces: `web/` dev/build 가능한 빈 앱. `index.css`에 브랜드 색이 CSS 변수 + Tailwind `@theme`로 등록됨(다른 태스크가 `bg-brand`, `text-txt-primary` 등으로 사용)

- [ ] **Step 1: web/package.json 생성**

```json
{
  "name": "easy-harness-web",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "tsc && vite build",
    "preview": "vite preview",
    "test": "vitest run"
  },
  "dependencies": {
    "react": "^19.1.0",
    "react-dom": "^19.1.0",
    "pretendard": "^1.3.9",
    "@fontsource-variable/jetbrains-mono": "^5.2.8"
  },
  "devDependencies": {
    "@tailwindcss/vite": "^4.3.2",
    "tailwindcss": "^4.3.2",
    "@vitejs/plugin-react": "^4.6.0",
    "@types/react": "^19.1.8",
    "@types/react-dom": "^19.1.6",
    "typescript": "~5.8.3",
    "vite": "^7.0.4",
    "vitest": "^4.1.9",
    "jsdom": "^29.1.1"
  }
}
```

- [ ] **Step 2: 설정 파일 생성**

`web/vite.config.ts`:
```ts
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
export default defineConfig({ plugins: [react(), tailwindcss()] });
```
`web/vitest.config.ts`:
```ts
import { defineConfig } from "vitest/config";
export default defineConfig({ test: { environment: "jsdom" } });
```
`web/tsconfig.json`: 앱의 `tsconfig.json`을 복사하되 `references` 제거, `include: ["src"]`. `web/tsconfig.node.json`은 앱 것 복사.

- [ ] **Step 3: index.css에 브랜드 토큰 등록**

`design/tokens.json`의 값을 Tailwind 4 `@theme`로 매핑. 최소 셋:
```css
@import "tailwindcss";
@import "pretendard/dist/web/variable/pretendardvariable.css";
@import "@fontsource-variable/jetbrains-mono";
@theme {
  --color-brand: #C9922B;
  --color-brand-hover: #B07708;
  --color-surface-bg: #FCFAF6;
  --color-surface-card: #FFFFFF;
  --color-surface-gold-tint: #F8EFDB;
  --color-cloud-mint: #7FD4DE;
  --color-cloud-deep: #12A5B8;
  --color-txt-primary: #2A2018;
  --color-txt-secondary: #6B5F52;
  --color-txt-gold: #8A6A14;
  --color-line: #EAE3D8;
  --color-line-gold: #D8AC3B;
  --font-sans: "Pretendard Variable", system-ui, sans-serif;
  --font-mono: "JetBrains Mono", monospace;
}
:root { color-scheme: light dark; }
body { background: var(--color-surface-bg); color: var(--color-txt-primary); font-family: var(--font-sans); }
.bg-gold-gradient { background-image: linear-gradient(90deg, #E8C15A, #C9922B); }
```
(다크 모드 색은 필요 태스크에서 `@media (prefers-color-scheme: dark)`로 추가.)

- [ ] **Step 4: main/App/index.html 생성**

`web/src/main.tsx`:
```tsx
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";
createRoot(document.getElementById("root")!).render(<StrictMode><App /></StrictMode>);
```
`web/src/App.tsx`:
```tsx
export default function App() {
  return <main className="min-h-screen">이지 하네스</main>;
}
```
`web/index.html`: `<div id="root">`, `<script type="module" src="/src/main.tsx">`, `<title>이지 하네스</title>`, `lang="ko"`, viewport 메타.

- [ ] **Step 5: 자산 복사**

```bash
cp src/assets/mascot.png web/public/mascot.png
# 워드마크: design/final 또는 design/wordmark-variants.png에서 적절한 것을 web/public/wordmark.png로. 없으면 텍스트 워드마크로 대체(Task 3에서 처리)
```

- [ ] **Step 6: 빌드·실행 확인**

Run: `cd web && bun install && bun run build`
Expected: 타입체크·빌드 성공(에러 0). `bun run dev` 후 브라우저에서 골드빛 배경에 "이지 하네스" 텍스트가 Pretendard로 보임(직접 확인).

- [ ] **Step 7: Commit**

```bash
git add web && git commit -m "feat(web): 랜딩 사이트 스캐폴드 + 브랜드 토큰"
```

---

### Task 2: 다운로드 자산 리졸버 (순수 로직, TDD)

**Files:**
- Create: `web/src/lib/releases.ts`, `web/src/lib/__tests__/releases.test.ts`

**Interfaces:**
- Produces:
  - `type OS = "mac" | "windows" | "other"`
  - `detectOS(ua: string, platform?: string): OS`
  - `type Asset = { name: string; url: string }`
  - `type Picks = { macArm?: Asset; macIntel?: Asset; winExe?: Asset; winMsi?: Asset }`
  - `pickAssets(assets: Asset[]): Picks` — 릴리스 자산 배열에서 파일명 규칙으로 분류
  - `RELEASES_API = "https://api.github.com/repos/needslab-ai/easy-harness-releases/releases/latest"`
  - `RELEASES_LATEST_PAGE = "https://github.com/needslab-ai/easy-harness-releases/releases/latest"`

- [ ] **Step 1: 실패 테스트 작성**

`web/src/lib/__tests__/releases.test.ts`:
```ts
import { describe, it, expect } from "vitest";
import { detectOS, pickAssets } from "../releases";

const assets = [
  { name: "Easy.Harness_0.1.2_aarch64.dmg", url: "u/arm.dmg" },
  { name: "Easy.Harness_0.1.2_x64.dmg", url: "u/intel.dmg" },
  { name: "Easy.Harness_0.1.2_x64-setup.exe", url: "u/setup.exe" },
  { name: "Easy.Harness_0.1.2_x64_en-US.msi", url: "u/app.msi" },
  { name: "Easy.Harness_0.1.2_aarch64.app.tar.gz", url: "u/x" },
  { name: "latest.json", url: "u/latest.json" },
];

describe("detectOS", () => {
  it("맥 UA는 mac", () => {
    expect(detectOS("Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)")).toBe("mac");
  });
  it("윈도우 UA는 windows", () => {
    expect(detectOS("Mozilla/5.0 (Windows NT 10.0; Win64; x64)")).toBe("windows");
  });
  it("그 외는 other", () => {
    expect(detectOS("Mozilla/5.0 (X11; Linux x86_64)")).toBe("other");
  });
});

describe("pickAssets", () => {
  it("파일명 규칙으로 맥 arm/intel·윈도우 exe/msi를 고르고 tar.gz/latest.json은 뺀다", () => {
    const p = pickAssets(assets);
    expect(p.macArm?.name).toContain("aarch64.dmg");
    expect(p.macIntel?.name).toContain("x64.dmg");
    expect(p.winExe?.name).toContain("x64-setup.exe");
    expect(p.winMsi?.name).toContain("x64_en-US.msi");
  });
  it("dmg가 아닌 aarch64.app.tar.gz를 macArm으로 잘못 고르지 않는다", () => {
    expect(pickAssets(assets).macArm?.name.endsWith(".dmg")).toBe(true);
  });
});
```

- [ ] **Step 2: 테스트 실패 확인**

Run: `cd web && bun run test`
Expected: FAIL (`../releases` 모듈/export 없음)

- [ ] **Step 3: releases.ts 구현**

```ts
export type OS = "mac" | "windows" | "other";
export type Asset = { name: string; url: string };
export type Picks = { macArm?: Asset; macIntel?: Asset; winExe?: Asset; winMsi?: Asset };

export const RELEASES_API =
  "https://api.github.com/repos/needslab-ai/easy-harness-releases/releases/latest";
export const RELEASES_LATEST_PAGE =
  "https://github.com/needslab-ai/easy-harness-releases/releases/latest";

export function detectOS(ua: string, platform = ""): OS {
  const s = `${ua} ${platform}`.toLowerCase();
  if (s.includes("win")) return "windows";
  if (s.includes("mac")) return "mac";
  return "other";
}

export function pickAssets(assets: Asset[]): Picks {
  const find = (pred: (n: string) => boolean) => assets.find((a) => pred(a.name));
  return {
    macArm: find((n) => n.endsWith("aarch64.dmg")),
    macIntel: find((n) => n.endsWith("x64.dmg")),
    winExe: find((n) => n.endsWith("x64-setup.exe")),
    winMsi: find((n) => n.endsWith("_en-US.msi")),
  };
}
```

- [ ] **Step 4: 테스트 통과 확인**

Run: `cd web && bun run test`
Expected: PASS (5 tests)

- [ ] **Step 5: Commit**

```bash
git add web/src/lib && git commit -m "feat(web): 다운로드 자산 리졸버(OS 감지·파일명 분류) + 테스트"
```

---

### Task 3: 다운로드 버튼 컴포넌트 (GitHub API 연동 + 폴백)

**Files:**
- Create: `web/src/components/DownloadButton.tsx`, `web/src/lib/useLatestRelease.ts`
- Test: `web/src/lib/__tests__/useLatestRelease.test.ts`

**Interfaces:**
- Consumes: `pickAssets`, `detectOS`, `RELEASES_API`, `RELEASES_LATEST_PAGE`, `Asset`, `Picks`, `OS` (Task 2)
- Produces:
  - `useLatestRelease(): { picks: Picks; version: string | null; failed: boolean }` — 마운트 시 `RELEASES_API` fetch → `{ tag_name, assets:[{name, browser_download_url}] }`를 `Picks`로 변환. 실패 시 `failed=true`
  - `<DownloadButton os={OS} picks={Picks} failed={boolean} />` — 기본 CTA + "다른 버전 보기" 펼침

- [ ] **Step 1: useLatestRelease 실패 테스트 작성**

`web/src/lib/__tests__/useLatestRelease.test.ts`: `vi.stubGlobal("fetch", ...)`로 GitHub API 응답을 목킹하고, `renderHook`으로 `picks.macArm`·`version`이 채워지는지, fetch 실패 시 `failed===true`인지 검증.
```ts
import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { useLatestRelease } from "../useLatestRelease";

const body = {
  tag_name: "v0.1.2",
  assets: [
    { name: "Easy.Harness_0.1.2_aarch64.dmg", browser_download_url: "u/arm.dmg" },
    { name: "Easy.Harness_0.1.2_x64-setup.exe", browser_download_url: "u/setup.exe" },
  ],
};
beforeEach(() => { vi.unstubAllGlobals(); });

describe("useLatestRelease", () => {
  it("성공 시 picks와 version을 채운다", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => ({ ok: true, json: async () => body })));
    const { result } = renderHook(() => useLatestRelease());
    await waitFor(() => expect(result.current.version).toBe("v0.1.2"));
    expect(result.current.picks.macArm?.url).toBe("u/arm.dmg");
    expect(result.current.failed).toBe(false);
  });
  it("실패 시 failed=true", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => { throw new Error("net"); }));
    const { result } = renderHook(() => useLatestRelease());
    await waitFor(() => expect(result.current.failed).toBe(true));
  });
});
```
`web/package.json` devDependencies에 `@testing-library/react`(^16.3.2)·`@testing-library/dom`(^10.4.1)·`@testing-library/jest-dom`(^6.9.1) 추가하고 `bun install`.

- [ ] **Step 2: 테스트 실패 확인**

Run: `cd web && bun run test`
Expected: FAIL (`useLatestRelease` 없음)

- [ ] **Step 3: useLatestRelease 구현**

```ts
import { useEffect, useState } from "react";
import { pickAssets, RELEASES_API, type Picks } from "./releases";

export function useLatestRelease() {
  const [picks, setPicks] = useState<Picks>({});
  const [version, setVersion] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    let cancelled = false;
    fetch(RELEASES_API)
      .then((r) => { if (!r.ok) throw new Error(`HTTP ${r.status}`); return r.json(); })
      .then((data: { tag_name: string; assets: { name: string; browser_download_url: string }[] }) => {
        if (cancelled) return;
        setVersion(data.tag_name);
        setPicks(pickAssets(data.assets.map((a) => ({ name: a.name, url: a.browser_download_url }))));
      })
      .catch(() => { if (!cancelled) setFailed(true); });
    return () => { cancelled = true; };
  }, []);
  return { picks, version, failed };
}
```

- [ ] **Step 4: 테스트 통과 확인**

Run: `cd web && bun run test`
Expected: PASS

- [ ] **Step 5: DownloadButton 구현**

`web/src/components/DownloadButton.tsx` — 감지된 OS면 그 버튼을 크게(맥이면 macArm, 윈도우면 winExe), 아니면 맥·윈도우 둘 다. `failed`거나 자산이 없으면 `RELEASES_LATEST_PAGE`로 링크. "다른 버전 보기" 토글로 macArm/macIntel/winExe/winMsi 전체를 파일명과 함께 노출. 버튼은 `.bg-gold-gradient rounded-[12px] px-6 py-3 font-extrabold text-white`. 카피: "맥용 다운로드" / "윈도우용 다운로드" / "다른 버전 보기" / "인텔 맥" / "윈도우 (MSI)". 코드 전체를 이 스텝에 작성한다(70줄 내외, 위 인터페이스·토큰·카피 사용).

- [ ] **Step 6: 확인 + Commit**

Run: `cd web && bun run build && bun run test`
Expected: 빌드·테스트 통과.
```bash
git add web && git commit -m "feat(web): 최신 릴리스 자동 감지 다운로드 버튼 + 폴백"
```

---

### Task 4: 히어로 섹션

**Files:**
- Create: `web/src/components/Hero.tsx`
- Modify: `web/src/App.tsx` (Hero 렌더)

**Interfaces:**
- Consumes: `useLatestRelease` + `detectOS` + `<DownloadButton>` (Task 3)
- Produces: `<Hero />`

- [ ] **Step 1: Hero 구현**

`web/src/components/Hero.tsx`: 워드마크(`/wordmark.png` 있으면 `<img>`, 없으면 텍스트 "이지 하네스" `font-extrabold text-txt-gold`), 오공이(`/mascot.png`), 헤드라인 `<h1>` "터미널 없이, 클릭 몇 번으로 AI 코딩 도구를 시작하세요"(display 크기 `text-4xl md:text-5xl font-extrabold`), 보조 카피 "복잡한 설치와 로그인은 오공이가 다 해드려요. 카드만 고르면 끝이에요." `text-txt-secondary`, `<DownloadButton os={detectOS(navigator.userAgent, navigator.platform)} {...useLatestRelease()} />`, 신뢰 문구 "무료로 쓸 수 있어요 · 애플 공증과 서명을 마친 안전한 앱이에요" `text-sm text-txt-secondary`, 버전 뱃지(version 있으면 `v0.1.2` mono). 중앙 정렬, 넉넉한 상하 패딩, 골드 tint 배경 은은하게. em dash·이모지 금지. 전체 JSX를 이 스텝에 작성.

- [ ] **Step 2: App에 배치 + 확인**

`App.tsx`에서 `<Hero />` 렌더. Run: `cd web && bun run dev` → 브라우저에서 헤드라인·마스코트·다운로드 버튼이 골드 톤으로 보이고, 버튼이 실제 최신 릴리스 자산(v0.1.2 dmg/exe)으로 연결되는지 확인(직접 클릭 확인). 콘솔 에러 0.

- [ ] **Step 3: Commit**

```bash
git add web && git commit -m "feat(web): 히어로 섹션(헤드라인·마스코트·다운로드 CTA)"
```

---

### Task 5: 시연영상 섹션(플레이스홀더 → Task 9에서 실제 mp4)

**Files:**
- Create: `web/src/components/DemoVideo.tsx`; Modify: `web/src/App.tsx`

**Interfaces:**
- Produces: `<DemoVideo />` — `<video autoPlay muted loop playsInline poster="/demo-poster.png">` `<source src="/demo.mp4" type="video/mp4">`

- [ ] **Step 1: DemoVideo 구현**

창 프레임(둥근 카드 `rounded-[16px] border border-line shadow` + 상단 신호등 점 3개) 안에 `<video>`. 파일이 아직 없어도 레이아웃이 깨지지 않게 `aspect-video bg-surface-gold-tint`. 섹션 제목 "눈으로 먼저 보세요"(선택). 전체 JSX 작성.

- [ ] **Step 2: 배치 + 확인**

`App.tsx`에 Hero 아래 `<DemoVideo />`. Run: `bun run dev` → 영상 자리(회색 프레임)와 레이아웃 확인. (실제 재생은 Task 9 후)

- [ ] **Step 3: Commit**

```bash
git add web && git commit -m "feat(web): 시연영상 섹션(영상 자리 프레임)"
```

---

### Task 6: 이렇게 쉬워요 + 되는 도구들 + 푸터

**Files:**
- Create: `web/src/components/Steps.tsx`, `web/src/components/Tools.tsx`, `web/src/components/Footer.tsx`; Modify: `web/src/App.tsx`

**Interfaces:**
- Consumes: `version`(Footer에서 표기, `useLatestRelease` 결과를 App에서 내려주거나 Footer가 자체 호출)
- Produces: `<Steps /> <Tools /> <Footer />`

- [ ] **Step 1: Steps 구현**

3열(모바일 1열) 카드. 각 카드: 번호(원형 골드 tint), 제목, 한 줄 설명. 내용 고정:
1. "도구 고르기" / "쓰고 싶은 AI 코딩 도구를 카드에서 골라요."
2. "오공이가 설치하고 로그인해요" / "준비물부터 로그인까지 알아서 챙겨요."
3. "바로 사용" / "설치가 잘 됐는지 확인까지 하고 끝나요."
전체 JSX 작성. 이모지 금지(번호는 숫자 글리프).

- [ ] **Step 2: Tools 구현**

하네스 이름 배지 목록(고정): Claude Code, Codex, GajaeCode, OpenClaw, Hermes, OpenCode. 배지 스타일 `rounded-full border border-line px-4 py-2`. 아래 한 줄 "플러그인과 오픈소스도 함께 챙겨요." 전체 JSX 작성.

- [ ] **Step 3: Footer 구현**

좌: "이지 하네스 · needslab.ai". 우: GitHub 릴리스 링크(`RELEASES_LATEST_PAGE`)·버전 표기·저작권 "© 2026 needslab". 전체 JSX 작성.

- [ ] **Step 4: 배치 + 확인 + Commit**

`App.tsx` 순서: Hero → DemoVideo → Steps → Tools → Footer. Run: `bun run dev`로 전체 페이지 흐름·반응형(창 줄여 1열) 확인.
```bash
git add web && git commit -m "feat(web): 3단계·도구목록·푸터 섹션"
```

---

### Task 7: 반응형·다크모드·메타/OG 마감

**Files:**
- Modify: `web/src/index.css`(다크 색), `web/index.html`(OG/설명 메타), 각 컴포넌트(반응형 클래스 점검)
- Create: `web/public/og.png`(선택, 히어로 스크린샷)

- [ ] **Step 1: 다크모드 색 추가**

`index.css`에 `@media (prefers-color-scheme: dark)`로 `--color-surface-bg:#181310` 등 다크 토큰 적용, body 색 전환.

- [ ] **Step 2: 메타 태그**

`index.html`에 `<meta name="description" content="터미널 없이 클릭 몇 번으로 AI 코딩 도구를 설치·로그인·확인하는 맥·윈도우 앱">`, OG 태그(title/description/image/url), `<link rel="icon" href="/favicon.png">`.

- [ ] **Step 3: 확인 + Commit**

Run: `bun run build && bun run dev`. 라이트/다크(OS 테마 토글)·모바일 폭에서 확인.
```bash
git add web && git commit -m "feat(web): 다크모드·반응형·메타 태그 마감"
```

---

### Task 8: video/ Remotion 스캐폴드 + 브랜드 상수 + 실제 화면 캡처

**Files:**
- Create: `video/package.json`, `video/remotion.config.ts`, `video/tsconfig.json`, `video/src/index.ts`, `video/src/Root.tsx`, `video/src/brand.ts`, `video/src/Demo.tsx`(빈 컴포지션)
- Create: `video/assets/*.png`(캡처)

**Interfaces:**
- Produces:
  - `brand.ts`: `export const GOLD="#C9922B"`, `GOLD_GRAD`, `BG="#FCFAF6"`, `TXT="#2A2018"`, `FONT="Pretendard Variable, sans-serif"` 등
  - Remotion 컴포지션 id `"Demo"`, 1280x720, 30fps, durationInFrames 720(24초)

- [ ] **Step 1: Remotion 설치(최신 확인)**

프로젝트 루트에서 `video/`를 만들고 Remotion을 설치한다. **설치 직전 context7/공식 문서로 최신 버전·패키지 구성을 확인**(`remotion`, `@remotion/cli`, `@remotion/renderer`, `@remotion/bundler`). 인터랙티브 프롬프트를 피하려 수동 셋업:
```bash
mkdir -p video/src/scenes video/assets
cd video && bun init -y
bun add remotion @remotion/cli @remotion/renderer @remotion/bundler react react-dom
bun add -d @types/react @types/react-dom typescript
```
`video/remotion.config.ts`(해상도·코덱 기본), `video/tsconfig.json`(react-jsx), `video/src/index.ts`:
```ts
import { registerRoot } from "remotion";
import { RemotionRoot } from "./Root";
registerRoot(RemotionRoot);
```
`video/src/Root.tsx`: `<Composition id="Demo" component={Demo} durationInFrames={720} fps={30} width={1280} height={720} />`. `Demo.tsx`는 일단 골드 배경 `<AbsoluteFill>`만.

- [ ] **Step 2: 스튜디오 실행 확인**

Run: `cd video && bunx remotion studio`
Expected: 스튜디오가 뜨고 "Demo" 컴포지션(골드 배경)이 미리보기됨(직접 확인). 확인 후 종료.

- [ ] **Step 3: 실제 앱 화면 캡처**

`bun run tauri dev`로 앱을 띄우고 아래 화면을 캡처해 `video/assets/`에 저장한다. 마법사 진행·완료는 `demo` 모드(`start_flow(..., demo:true)`)로 재현해 네트워크·실제설치 없이 담는다. 캡처 방법은 mac `screencapture -l<windowid>`(창 단독) 또는 cua-driver/컴퓨터유즈 도구로 앱 창 스크린샷.
- `catalog.png`(카탈로그, 카드 보이게), `wizard-1.png`~`wizard-4.png`(진행 단계), `success.png`(완료 화면)
확인: 각 png가 실제 앱 화면이고 글자가 선명한지 눈으로 확인.

- [ ] **Step 4: Commit**

```bash
git add video && git commit -m "feat(video): Remotion 스캐폴드 + 브랜드 상수 + 실제 앱 화면 캡처"
```

---

### Task 9: 영상 장면 조립 + 렌더 + 사이트 연결

**Files:**
- Create: `video/src/scenes/Title.tsx`, `Catalog.tsx`, `Wizard.tsx`, `Success.tsx`, `EndCard.tsx`; Modify: `video/src/Demo.tsx`
- Create(렌더 산출물): `out/demo.mp4` → `web/public/demo.mp4`, 첫 프레임 → `web/public/demo-poster.png`

**Interfaces:**
- Consumes: `brand.ts` 상수, `video/assets/*.png`, Remotion `AbsoluteFill/Img/Sequence/spring/interpolate/useCurrentFrame/useVideoConfig/Easing`

- [ ] **Step 1: 애니메이션 헬퍼 + Title 장면**

공통 패턴(페이드인 + 스프링 스케일)을 쓰는 `Title.tsx`를 먼저 완성해 템플릿으로 삼는다:
```tsx
import { AbsoluteFill, interpolate, spring, useCurrentFrame, useVideoConfig, Easing } from "remotion";
import { GOLD_GRAD, TXT } from "../brand";
export const Title: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const scale = spring({ fps, frame, config: { damping: 200 } });
  const opacity = interpolate(frame, [0, 15], [0, 1], { extrapolateRight: "clamp", easing: Easing.bezier(0.16, 1, 0.3, 1) });
  return (
    <AbsoluteFill style={{ backgroundImage: GOLD_GRAD, alignItems: "center", justifyContent: "center" }}>
      <div style={{ transform: `scale(${scale})`, opacity, color: "#fff", fontWeight: 800, fontSize: 64, fontFamily: "Pretendard Variable, sans-serif", textAlign: "center" }}>
        터미널 없이<br />AI 코딩 도구 시작하기
      </div>
    </AbsoluteFill>
  );
};
```

- [ ] **Step 2: 나머지 장면 (Title 패턴 재사용)**

같은 패턴으로:
- `Catalog.tsx`: `catalog.png`를 `<Img>`로 깔고, 커서(작은 원/화살표)를 카드 위치로 `interpolate` 이동 후 클릭(스케일 pop). 하단 자막 "카드만 고르면 돼요".
- `Wizard.tsx`: `wizard-1~4.png`를 프레임 구간별로 교체(`useCurrentFrame`으로 분기), 진행바/단계 자막 "준비물 챙기는 중" → "설치하는 중" → "로그인 도와드릴게요" → "확인 완료".
- `Success.tsx`: `success.png` + 자막 "다 됐어요".
- `EndCard.tsx`: 골드 배경 + "지금 다운로드" + 워드마크 텍스트.
각 파일 전체 코드 작성. 자막에 em dash·이모지 금지.

- [ ] **Step 3: Demo.tsx에서 Sequence로 타임라인 조립**

```tsx
import { AbsoluteFill, Sequence } from "remotion";
import { Title } from "./scenes/Title";
// ... imports
export const Demo: React.FC = () => (
  <AbsoluteFill style={{ backgroundColor: "#FCFAF6" }}>
    <Sequence durationInFrames={90}><Title /></Sequence>
    <Sequence from={90} durationInFrames={150}><Catalog /></Sequence>
    <Sequence from={240} durationInFrames={240}><Wizard /></Sequence>
    <Sequence from={480} durationInFrames={120}><Success /></Sequence>
    <Sequence from={600} durationInFrames={120}><EndCard /></Sequence>
  </AbsoluteFill>
);
```
(합 720프레임 = 24초. 스튜디오에서 각 장면 타이밍 눈으로 조정.)

- [ ] **Step 4: 스튜디오에서 미리보기 확인**

Run: `cd video && bunx remotion studio` → 전체 24초가 매끄럽게 흐르고 자막이 읽히는지 확인. 필요시 타이밍/자막 조정.

- [ ] **Step 5: mp4 렌더 + 포스터 추출 + 사이트로 복사**

```bash
cd video && bunx remotion render Demo ../out/demo.mp4 --codec h264
bunx remotion still Demo ../web/public/demo-poster.png --frame 0
cp ../out/demo.mp4 ../web/public/demo.mp4
```
확인: `out/demo.mp4`가 생성되고 로컬에서 재생됨(`open out/demo.mp4`), 파일 크기 수 MB.

- [ ] **Step 6: 사이트에서 재생 확인 + Commit**

Run: `cd web && bun run dev` → 시연영상 섹션에서 mp4가 자동재생·무음·반복되는지 확인.
```bash
git add video web/public/demo.mp4 web/public/demo-poster.png && git commit -m "feat(video): 시연영상 장면 조립·렌더 + 사이트 임베드"
```

---

### Task 10: Vercel 배포 + 커스텀 도메인

**Files:**
- Create: `web/vercel.json`(선택: SPA/정적 설정)

**Interfaces:**
- Consumes: 빌드된 `web/`(Vite)

- [ ] **Step 1: Vercel 프로젝트 연결**

사용자에게 Vercel 로그인/프로젝트 연결을 안내하거나(필요시 `dcli`로 자격 조회), `vercel` CLI로 `web/`를 배포한다. 루트 디렉터리 `web`, 빌드 커맨드 `bun run build`, 출력 `dist`. **배포 전 최종 서브도메인 이름을 사용자에게 확인**(기본 `easyharness.needslab.ai`).

- [ ] **Step 2: 프리뷰 확인**

Vercel 프리뷰 URL 접속 → 히어로·영상·다운로드 버튼(실제 자산 연결)·반응형 확인.

- [ ] **Step 3: 커스텀 도메인 연결**

Vercel 프로젝트에 `easyharness.needslab.ai` 추가. needslab.ai가 Vercel 네임서버면 자동, 아니면 CNAME 안내. HTTPS 발급 확인.

- [ ] **Step 4: 프로덕션 확인 + Commit**

커스텀 도메인 접속 → 전체 동작·다운로드 확인.
```bash
git add web/vercel.json && git commit -m "chore(web): Vercel 배포 설정"
```

---

## Self-Review

**Spec coverage:** 히어로/영상/3단계/도구/푸터(Task 4~6), 다운로드 동적 링크(Task 2~3), 하이브리드 무음+자막 영상(Task 8~9), Vercel+서브도메인(Task 10), 브랜드 토큰(Task 1) — 스펙 각 섹션이 태스크로 커버됨.
**Placeholder scan:** 시각 컴포넌트의 "전체 JSX 작성" 지시는 해당 스텝에서 실제 코드를 쓰라는 것(카피·토큰·구조를 명시). 로직(리졸버·훅)은 완전한 코드 포함. Remotion 버전은 "설치 시 최신 확인"으로 의도적 이연.
**Type consistency:** `Asset{name,url}`·`Picks`·`OS`가 Task 2에서 정의되어 Task 3에서 그대로 소비됨. `useLatestRelease` 반환 `{picks,version,failed}`가 Hero/DownloadButton에서 일치.

## Execution Handoff

계획 저장: `docs/superpowers/plans/2026-07-08-easy-harness-landing.md`. 실행 방식은 별도 안내에서 선택.
