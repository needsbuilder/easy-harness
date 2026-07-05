# 마일스톤 2: 앱 뼈대 + 레시피 엔진 + 스텝 러너 + 드라이런 — 구현 계획

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Tauri 2 데스크톱 앱 뼈대(6화면 라우팅 + 디자인 토큰) 위에 레시피 엔진·스텝 러너·상태 저장소·환경 진단기를 Rust로 구현하고, 번들 레시피 전체를 실제 설치 없이 검증하는 드라이런을 CI에 올린다.

**Architecture:** Rust 코어(src-tauri)가 레시피 JSON을 타입으로 파싱해 플랫폼별 설치 계획(의존성 순서 포함)을 만들고, 스텝 러너가 단계를 실행하며 진행 상황을 Tauri 이벤트로 프론트에 스트리밍한다. React 프론트(HashRouter)는 목업 6화면을 재현하고, 마법사 화면은 드라이런 데모 모드로 엔진과 끝까지 연결된 것을 보여준다. 실행이 위험하거나 생태계가 어린 스텝(download_run 실행, pty_session 실연결)은 타입·드라이런만 이번에 하고 실행기는 마일스톤 3에서 배선한다.

**Tech Stack:** Tauri 2.11.x (Rust) · React 19.2.7 + TypeScript + Vite · react-router 7.18.1 (HashRouter) · Tailwind CSS 4.3.2 · Vitest 4.1.9 + Testing Library · serde/serde_json + thiserror 2 · tokio (Tauri 내장)

## Global Constraints

스펙: `docs/superpowers/specs/2026-07-05-easy-harness-design.md` · 디자인: `design/README.md`, `design/tokens.json`, `design/design-system.md`, 목업 `design/mockups/01~06`

- **번들 ID**: `ai.needslab.easyharness` (스펙 2절 확정값)
- **UI 언어 한국어. 전문용어 금지** — 모든 화면 문구는 "개발 지식 0인 사람이 처음 읽어도 이해되는가"로 검수
- **UI 카피에 em dash(—) 금지, 이모지 금지** (체크·벨은 도형/글리프로) — `design/design-system.md` 원칙 4
- **주 색은 긴고아 골드** (`--color-primary #C9922B`), 청록(cloudMint/cloudDeep)은 진행·정보성 포인트에만
- **라이트/다크 테마 모두 지원** (tokens.json의 `*Dark` 토큰)
- 폰트: 본문 Pretendard Variable, 로그·버전만 JetBrains Mono Variable (둘 다 OFL-1.1, 앱에 번들)
- **버전 (2026-07-05 라이브 검증 완료, npm/crates.io 직접 조회)**: tauri crate 2.11.5 / @tauri-apps/cli 2.11.4 / @tauri-apps/api 2.11.1 / tailwindcss·@tailwindcss/vite 4.3.2 / pretendard 1.3.9 / @fontsource-variable/jetbrains-mono 5.2.8 / react 19.2.7 / react-router 7.18.1 / vitest 4.1.9 / jsdom 29.1.1 / @testing-library/react 16.3.2 (+@testing-library/dom 10.4.1, jest-dom 6.9.1) / serde 1 / serde_json 1 / thiserror 2 / tempfile 3 (dev)
- Cargo.toml·package.json에는 메이저 범위로 선언(`tauri = "2"`, `"^4.3.2"` 등), 재현성은 lock 파일로
- **마일스톤 2 범위 제외 (마일스톤 3+로 명시적 연기)**: 실물 하네스 레시피 · download_run 실제 다운로드 실행기(reqwest) · pty_session 실제 PTY 배선(tauri-plugin-pty 0.3.0, 2026-06 활성이지만 소규모라 M3 착수 시 재확인) · 레시피 원격 갱신 + ed25519 서명 검증 · 앱 자동 업데이트(tauri-plugin-updater, M5)
- 커밋 메시지 끝에 `Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>`
- 모든 Rust/프론트 코드는 TDD: 실패 테스트 → 최소 구현 → 통과 → 커밋

## 파일 구조 (이번 마일스톤에서 생성)

```
easy-harness/                      # 레포 루트 = Tauri 앱 루트
├── package.json  vite.config.ts  vitest.config.ts  vitest.setup.ts  index.html
├── src/                           # React 프론트
│   ├── main.tsx  App.tsx          # HashRouter 라우팅
│   ├── styles/main.css            # Tailwind 4 @theme 토큰 (tokens.json 변환)
│   ├── assets/mascot.png  logo-horizontal.png
│   ├── lib/types.ts               # Rust 타입 미러 (Recipe/Plan/Event/State)
│   ├── lib/ipc.ts                 # invoke·listen 래퍼
│   ├── lib/runReducer.ts          # 진행 이벤트 → 마법사 상태 리듀서
│   ├── components/ (AppShell·ToolCard·Badge·Buttons·WizardStepper·LogPanel·ErrorPanel·MascotBubble)
│   └── screens/ (Welcome·Catalog·Wizard·Auth·Success·Dashboard·Plugins·Settings)
├── src-tauri/
│   ├── Cargo.toml  tauri.conf.json  capabilities/default.json  icons/(생성)
│   ├── recipes/                   # 번들 레시피 (M2: 픽스처 3종, M3에서 실물 교체)
│   │   ├── mock-prereq.json  mock-tool.json  mock-plugin.json
│   └── src/
│       ├── main.rs  lib.rs        # tauri builder + invoke_handler
│       ├── error.rs               # thiserror 에러 타입
│       ├── recipe/mod.rs  schema.rs  loader.rs  plan.rs
│       ├── runner/mod.rs  process.rs  events.rs  step_runner.rs  dry_run.rs
│       ├── state.rs               # 상태 저장소 (installed.json)
│       ├── probe.rs               # 환경 진단기
│       └── commands.rs            # #[tauri::command] 모음
└── .github/workflows/ci.yml
```

책임 분리: `recipe/`는 "레시피를 읽고 계획을 만든다"(순수 로직, I/O는 loader만), `runner/`는 "계획을 실행하고 이벤트를 쏜다"(프로세스 실행은 `process.rs`의 trait 뒤로 격리), `state.rs`·`probe.rs`는 각각 독립 파일. 프론트는 화면(screens)과 재사용 부품(components), 로직(lib)을 나눈다.

---

### Task 1: 브랜치 + Tauri 2 스캐폴드 + 번들 ID + 앱 아이콘

**Files:**
- Create: `package.json`, `vite.config.ts`, `index.html`, `src/**`, `src-tauri/**` (create-tauri-app 산출물)
- Modify: `src-tauri/tauri.conf.json`
- Create: `src-tauri/icons/*` (tauri icon 생성물)

**Interfaces:**
- Consumes: `design/final/app-icon-1024.png` (마일스톤 1 산출물)
- Produces: `bun run tauri dev`로 실행되는 빈 앱. 이후 모든 태스크의 토대. 창 제목 "이지 하네스", identifier `ai.needslab.easyharness`

- [ ] **Step 1: 브랜치 생성**

```bash
git checkout main && git pull && git checkout -b feature/m2-skeleton-engine
```

- [ ] **Step 2: 스캐폴드 생성 후 레포 루트로 이동**

레포 루트에 기존 파일(design/, docs/ 등)이 있어 직접 스캐폴드가 안 되므로 임시 디렉토리에 만들고 옮긴다:

```bash
cd /Users/ai-code-lab/projects/easy-harness
bun create tauri-app scaffold-tmp --template react-ts
rsync -a scaffold-tmp/ ./ --exclude .git
rm -rf scaffold-tmp
bun install
```

- [ ] **Step 3: tauri.conf.json 핵심 설정**

`src-tauri/tauri.conf.json`에서 아래 값으로 수정 (나머지 필드는 템플릿 유지):

```json
{
  "productName": "Easy Harness",
  "identifier": "ai.needslab.easyharness",
  "app": {
    "windows": [
      {
        "title": "이지 하네스",
        "width": 1100,
        "height": 720,
        "minWidth": 960,
        "minHeight": 640
      }
    ]
  }
}
```

productName은 빌드 산출물 파일명에 쓰이므로 ASCII(`Easy Harness`), 사용자가 보는 창 제목만 한국어.

- [ ] **Step 4: 앱 아이콘 생성**

```bash
bun run tauri icon design/final/app-icon-1024.png
```

Expected: `src-tauri/icons/`에 icon.icns(맥)·icon.ico(윈도우)·32x32.png 등 생성.

- [ ] **Step 5: 실행 확인**

```bash
bun run tauri dev
```

Expected: "이지 하네스" 제목의 창이 뜨고 템플릿 화면이 보인다. 독/작업표시줄에 오공이 아이콘. 확인 후 종료.

- [ ] **Step 6: 커밋**

```bash
git add -A
git commit -m "feat: Tauri 2 앱 스캐폴드 (react-ts, 번들 ID, 오공이 아이콘)"
```

---

### Task 2: Tailwind 4 + 디자인 토큰 + 폰트 번들 + 다크모드

**Files:**
- Create: `src/styles/main.css`
- Modify: `vite.config.ts`, `src/main.tsx`
- Delete: 템플릿의 `src/App.css`, `src/index.css` (main.css로 대체)

**Interfaces:**
- Consumes: `design/tokens.json`의 토큰 값 (아래 CSS에 그대로 변환됨)
- Produces: 전 화면에서 쓰는 Tailwind 유틸리티. 색 `bg-primary` `text-txt-primary` `bg-surface-bg` 등, 폰트 `font-sans`(Pretendard)·`font-mono`(JetBrains Mono), 그림자 `shadow-card` `shadow-gold-button`, 라운드 `rounded-card`(16px)·`rounded-button`(12px)·`rounded-badge`. 다크모드는 `.dark` 클래스 토글

- [ ] **Step 1: 패키지 설치**

```bash
bun add tailwindcss @tailwindcss/vite pretendard @fontsource-variable/jetbrains-mono
```

- [ ] **Step 2: vite.config.ts에 플러그인 추가**

```ts
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

// 템플릿의 기존 host/port/clearScreen 등 Tauri 관련 설정은 그대로 두고 plugins만 바꾼다
export default defineConfig({
  plugins: [react(), tailwindcss()],
});
```

- [ ] **Step 3: src/styles/main.css 작성 (tokens.json → Tailwind 4 @theme)**

```css
@import "pretendard/dist/web/variable/pretendardvariable.css";
@import "@fontsource-variable/jetbrains-mono";
@import "tailwindcss";

@custom-variant dark (&:where(.dark, .dark *));

@theme {
  /* design/tokens.json 값 그대로. 변경 금지, 새 색 추가 금지 */
  --color-primary: #C9922B;
  --color-primary-hover: #B07708;
  --color-cloud-mint: #7FD4DE;
  --color-cloud-deep: #12A5B8;
  --color-surface-bg: #FCFAF6;
  --color-surface-card: #FFFFFF;
  --color-surface-card-hover: #FDF8EE;
  --color-surface-gold-tint: #F8EFDB;
  --color-surface-bg-dark: #181310;
  --color-surface-card-dark: #221B15;
  --color-surface-card-hover-dark: #2A2119;
  --color-txt-primary: #2A2018;
  --color-txt-secondary: #6B5F52;
  --color-txt-tertiary: #9C8F80;
  --color-txt-gold: #8A6A14;
  --color-txt-on-brand: #FFFFFF;
  --color-txt-primary-dark: #F3EDE4;
  --color-txt-secondary-dark: #B3A797;
  --color-status-success: #22A55E;
  --color-status-warning: #E8A317;
  --color-status-error: #DE4B3B;
  --color-status-info: #12A5B8;
  --color-line: #EAE3D8;
  --color-line-gold: #D8AC3B;
  --color-line-dark: #3A3128;

  --font-sans: "Pretendard Variable", "Apple SD Gothic Neo", sans-serif;
  --font-mono: "JetBrains Mono Variable", monospace;

  --text-display: 28px;
  --text-title: 20px;
  --text-subtitle: 17px;
  --text-body: 15px;
  --text-caption: 13px;
  --text-badge: 12px;

  --radius-card: 16px;
  --radius-button: 12px;
  --radius-input: 12px;
  --radius-badge: 999px;
  --radius-mascot-bubble: 20px;

  --shadow-card: 0 1px 4px rgba(42, 32, 24, 0.06);
  --shadow-card-hover: 0 4px 14px rgba(42, 32, 24, 0.10);
  --shadow-gold-button: 0 2px 10px rgba(201, 146, 43, 0.35);
  --shadow-modal: 0 12px 40px rgba(42, 32, 24, 0.18);
}

/* 그라디언트는 @theme 색 유틸로 못 만들므로 컴포넌트 클래스로 제공 */
@layer components {
  .bg-gold-gradient {
    background-image: linear-gradient(90deg, #E8C15A, #C9922B);
  }
}

body {
  font-family: var(--font-sans);
  font-size: var(--text-body);
  background: var(--color-surface-bg);
  color: var(--color-txt-primary);
}
.dark body {
  background: var(--color-surface-bg-dark);
  color: var(--color-txt-primary-dark);
}
```

- [ ] **Step 4: main.tsx에서 main.css만 import 하도록 변경, 템플릿 CSS 삭제**

`src/main.tsx`의 CSS import를 `import "./styles/main.css";` 하나로 바꾸고:

```bash
rm -f src/App.css src/index.css
```

- [ ] **Step 5: 스모크 확인**

`src/App.tsx`의 최상위 div에 `className="min-h-screen bg-surface-bg dark:bg-surface-bg-dark"`와 `<h1 className="text-display font-extrabold text-txt-primary">이지 하네스</h1>`를 임시로 넣고:

```bash
bun run tauri dev
```

Expected: 크림색(#FCFAF6) 배경 + Pretendard로 렌더된 "이지 하네스". 확인 후 임시 마크업은 다음 태스크에서 교체되므로 그대로 둬도 된다.

```bash
bun run build
```

Expected: vite build 성공 (타입 에러 0).

- [ ] **Step 6: 커밋**

```bash
git add -A
git commit -m "feat: Tailwind 4 디자인 토큰 + Pretendard/JetBrains Mono 번들 + 다크모드 변형"
```

---

### Task 3: Rust 의존성 + 레시피 스키마·파서

**Files:**
- Modify: `src-tauri/Cargo.toml`, `src-tauri/src/lib.rs`
- Create: `src-tauri/src/error.rs`, `src-tauri/src/recipe/mod.rs`, `src-tauri/src/recipe/schema.rs`

**Interfaces:**
- Produces (이후 태스크 전부가 사용):
  - `recipe::schema::Recipe { schema_version: u32, id: String, name: String, kind: ToolKind, easy_description: String, pricing: Pricing, supported_models: Vec<ModelBadge>, recommended: bool, requires: Vec<String>, platforms: Platforms }`
  - `enum ToolKind { Harness, Plugin, Prerequisite }` · `struct Pricing { label: String, kind: PricingKind }` · `enum PricingKind { Free, Paid, Freemium }` · `struct ModelBadge { model_label: String, account_label: Option<String> }`
  - `struct Platforms { mac: Option<PlatformSpec>, windows: Option<PlatformSpec> }` · `enum Platform { Mac, Windows }` · `Platforms::get(&self, p: Platform) -> Option<&PlatformSpec>`
  - `struct PlatformSpec { prerequisites: Vec<String>, detect: Vec<Step>, install: Vec<Step>, auth: Option<AuthSpec>, verify: Vec<Step>, update: Vec<Step>, uninstall: Vec<Step>, rollback: Vec<Step> }`
  - `struct AuthSpec { pattern: AuthPattern, steps: Vec<Step>, guide: Vec<String> }` · `enum AuthPattern { BrowserLogin, ApiKey, InteractiveTerminal }`
  - `enum Step` (태그 `type`, snake_case): `CheckCommand { friendly, command, args }` `RunCommand { friendly, command, args }` `DownloadRun { friendly, url, file_name, args }` `OpenUrl { friendly, url }` `InputSecret { friendly, label }` `PtySession { friendly, command, args }` `PathCheck { friendly, path }` — 모든 variant의 `friendly: String`은 비개발자용 진행 문구
  - `Step::friendly(&self) -> &str` · `Step::type_name(&self) -> &'static str` (드라이런 리포트용, `"check_command"` 등 JSON 태그와 동일 문자열)
  - `Recipe::parse(json: &str) -> Result<Recipe, EngineError>` — schemaVersion != 1 거부, JSON 오류를 사람이 읽을 메시지로
  - `error::EngineError` (thiserror 2): `RecipeParse { file: String, message: String }`, `UnknownRecipe(String)`, `DependencyCycle(Vec<String>)`, `PlatformUnsupported { recipe: String, platform: String }`, `Io(#[from] std::io::Error)` — 이후 태스크에서 variant 추가

- [ ] **Step 1: Cargo.toml 의존성 추가**

`src-tauri/Cargo.toml`의 `[dependencies]`에 (템플릿의 tauri·serde 계열은 유지):

```toml
serde = { version = "1", features = ["derive"] }
serde_json = "1"
thiserror = "2"

[dev-dependencies]
tempfile = "3"
```

- [ ] **Step 2: 실패 테스트 작성** — `src-tauri/src/recipe/schema.rs` 하단에:

```rust
#[cfg(test)]
mod tests {
    use super::*;

    const VALID: &str = r#"{
        "schemaVersion": 1,
        "id": "mock-tool",
        "name": "모의 도구",
        "kind": "harness",
        "easyDescription": "테스트용 가짜 도구예요",
        "pricing": { "label": "무료", "kind": "free" },
        "supportedModels": [ { "modelLabel": "Claude 모델", "accountLabel": "Anthropic 계정" } ],
        "recommended": true,
        "requires": [],
        "platforms": {
            "mac": {
                "prerequisites": ["mock-prereq"],
                "detect": [ { "type": "check_command", "friendly": "이미 설치돼 있는지 볼게요", "command": "mock-tool", "args": ["--version"] } ],
                "install": [ { "type": "run_command", "friendly": "모의 도구를 설치하고 있어요", "command": "echo", "args": ["install"] } ],
                "auth": {
                    "pattern": "browser_login",
                    "steps": [ { "type": "open_url", "friendly": "로그인 창을 열어 드릴게요", "url": "https://example.com/login" } ],
                    "guide": ["아래 버튼을 누르면 인터넷 창이 열려요"]
                },
                "verify": [ { "type": "check_command", "friendly": "잘 되는지 시험해 볼게요", "command": "echo", "args": ["ok"] } ],
                "update": [], "uninstall": [], "rollback": []
            },
            "windows": null
        }
    }"#;

    #[test]
    fn parses_valid_recipe() {
        let r = Recipe::parse(VALID).unwrap();
        assert_eq!(r.id, "mock-tool");
        assert_eq!(r.kind, ToolKind::Harness);
        let mac = r.platforms.get(Platform::Mac).unwrap();
        assert_eq!(mac.prerequisites, vec!["mock-prereq"]);
        assert_eq!(mac.detect[0].friendly(), "이미 설치돼 있는지 볼게요");
        assert_eq!(mac.detect[0].type_name(), "check_command");
        assert!(r.platforms.get(Platform::Windows).is_none());
        let auth = mac.auth.as_ref().unwrap();
        assert_eq!(auth.pattern, AuthPattern::BrowserLogin);
    }

    #[test]
    fn rejects_unknown_step_type() {
        let bad = VALID.replace("check_command", "teleport");
        let err = Recipe::parse(&bad).unwrap_err();
        assert!(matches!(err, EngineError::RecipeParse { .. }));
    }

    #[test]
    fn rejects_wrong_schema_version() {
        let bad = VALID.replace("\"schemaVersion\": 1", "\"schemaVersion\": 99");
        assert!(Recipe::parse(&bad).is_err());
    }

    #[test]
    fn rejects_unknown_top_level_field() {
        let bad = VALID.replacen("\"id\"", "\"surprise\": true, \"id\"", 1);
        assert!(Recipe::parse(&bad).is_err());
    }
}
```

- [ ] **Step 3: 테스트 실패 확인**

```bash
cd src-tauri && cargo test recipe::
```

Expected: FAIL (컴파일 에러 — Recipe 미정의).

- [ ] **Step 4: 최소 구현** — `src-tauri/src/error.rs`:

```rust
use thiserror::Error;

#[derive(Debug, Error)]
pub enum EngineError {
    #[error("레시피 파일을 읽을 수 없어요 ({file}): {message}")]
    RecipeParse { file: String, message: String },
    #[error("레시피를 찾을 수 없어요: {0}")]
    UnknownRecipe(String),
    #[error("레시피끼리 서로를 기다리고 있어요: {0:?}")]
    DependencyCycle(Vec<String>),
    #[error("{recipe} 레시피는 {platform}을 지원하지 않아요")]
    PlatformUnsupported { recipe: String, platform: String },
    #[error(transparent)]
    Io(#[from] std::io::Error),
}
```

`src-tauri/src/recipe/schema.rs` (테스트 위에):

```rust
use serde::{Deserialize, Serialize};

use crate::error::EngineError;

#[derive(Debug, Clone, PartialEq, Deserialize, Serialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct Recipe {
    pub schema_version: u32,
    pub id: String,
    pub name: String,
    pub kind: ToolKind,
    pub easy_description: String,
    pub pricing: Pricing,
    #[serde(default)]
    pub supported_models: Vec<ModelBadge>,
    #[serde(default)]
    pub recommended: bool,
    #[serde(default)]
    pub requires: Vec<String>,
    pub platforms: Platforms,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Deserialize, Serialize)]
#[serde(rename_all = "lowercase")]
pub enum ToolKind { Harness, Plugin, Prerequisite }

#[derive(Debug, Clone, PartialEq, Deserialize, Serialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct Pricing { pub label: String, pub kind: PricingKind }

#[derive(Debug, Clone, Copy, PartialEq, Eq, Deserialize, Serialize)]
#[serde(rename_all = "lowercase")]
pub enum PricingKind { Free, Paid, Freemium }

#[derive(Debug, Clone, PartialEq, Deserialize, Serialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct ModelBadge {
    pub model_label: String,
    #[serde(default)]
    pub account_label: Option<String>,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum Platform { Mac, Windows }

impl Platform {
    pub fn as_str(&self) -> &'static str {
        match self { Platform::Mac => "mac", Platform::Windows => "windows" }
    }
    /// 실행 중인 OS를 레시피 플랫폼 키로. 그 외 OS는 None (v1은 맥·윈도우만)
    pub fn current() -> Option<Platform> {
        match std::env::consts::OS {
            "macos" => Some(Platform::Mac),
            "windows" => Some(Platform::Windows),
            _ => None,
        }
    }
}

#[derive(Debug, Clone, PartialEq, Deserialize, Serialize)]
#[serde(deny_unknown_fields)]
pub struct Platforms {
    #[serde(default)]
    pub mac: Option<PlatformSpec>,
    #[serde(default)]
    pub windows: Option<PlatformSpec>,
}

impl Platforms {
    pub fn get(&self, p: Platform) -> Option<&PlatformSpec> {
        match p { Platform::Mac => self.mac.as_ref(), Platform::Windows => self.windows.as_ref() }
    }
}

#[derive(Debug, Clone, PartialEq, Deserialize, Serialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct PlatformSpec {
    #[serde(default)]
    pub prerequisites: Vec<String>,
    #[serde(default)]
    pub detect: Vec<Step>,
    #[serde(default)]
    pub install: Vec<Step>,
    #[serde(default)]
    pub auth: Option<AuthSpec>,
    #[serde(default)]
    pub verify: Vec<Step>,
    #[serde(default)]
    pub update: Vec<Step>,
    #[serde(default)]
    pub uninstall: Vec<Step>,
    #[serde(default)]
    pub rollback: Vec<Step>,
}

#[derive(Debug, Clone, PartialEq, Deserialize, Serialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct AuthSpec {
    pub pattern: AuthPattern,
    #[serde(default)]
    pub steps: Vec<Step>,
    /// 화면 옆에 보여줄 한국어 안내 문구 (순서대로 카드 3개)
    #[serde(default)]
    pub guide: Vec<String>,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Deserialize, Serialize)]
#[serde(rename_all = "snake_case")]
pub enum AuthPattern { BrowserLogin, ApiKey, InteractiveTerminal }

/// 주의: 내부 태그드 enum(tag="type")에는 serde 제약상 deny_unknown_fields를
/// 걸 수 없다. 모르는 "type" 값은 에러가 나지만(원하는 동작), variant 안의
/// 오타 필드는 조용히 무시될 수 있다. 레시피 필드 오타는 드라이런 테스트로 잡는다.
#[derive(Debug, Clone, PartialEq, Deserialize, Serialize)]
#[serde(tag = "type", rename_all = "snake_case")]
pub enum Step {
    CheckCommand { friendly: String, command: String, #[serde(default)] args: Vec<String> },
    RunCommand { friendly: String, command: String, #[serde(default)] args: Vec<String> },
    DownloadRun { friendly: String, url: String, file_name: String, #[serde(default)] args: Vec<String> },
    OpenUrl { friendly: String, url: String },
    InputSecret { friendly: String, label: String },
    PtySession { friendly: String, command: String, #[serde(default)] args: Vec<String> },
    PathCheck { friendly: String, path: String },
}

impl Step {
    pub fn friendly(&self) -> &str {
        match self {
            Step::CheckCommand { friendly, .. } | Step::RunCommand { friendly, .. }
            | Step::DownloadRun { friendly, .. } | Step::OpenUrl { friendly, .. }
            | Step::InputSecret { friendly, .. } | Step::PtySession { friendly, .. }
            | Step::PathCheck { friendly, .. } => friendly,
        }
    }
    pub fn type_name(&self) -> &'static str {
        match self {
            Step::CheckCommand { .. } => "check_command",
            Step::RunCommand { .. } => "run_command",
            Step::DownloadRun { .. } => "download_run",
            Step::OpenUrl { .. } => "open_url",
            Step::InputSecret { .. } => "input_secret",
            Step::PtySession { .. } => "pty_session",
            Step::PathCheck { .. } => "path_check",
        }
    }
}

pub const SCHEMA_VERSION: u32 = 1;

impl Recipe {
    pub fn parse(json: &str) -> Result<Recipe, EngineError> {
        let recipe: Recipe = serde_json::from_str(json).map_err(|e| EngineError::RecipeParse {
            file: "<inline>".into(),
            message: e.to_string(),
        })?;
        if recipe.schema_version != SCHEMA_VERSION {
            return Err(EngineError::RecipeParse {
                file: recipe.id.clone(),
                message: format!("지원하지 않는 schemaVersion: {}", recipe.schema_version),
            });
        }
        Ok(recipe)
    }
}
```

`src-tauri/src/recipe/mod.rs`:

```rust
pub mod schema;
```

`src-tauri/src/lib.rs` 상단에 모듈 등록 (템플릿의 run() 함수는 유지):

```rust
pub mod error;
pub mod recipe;
```

- [ ] **Step 5: 테스트 통과 확인**

```bash
cd src-tauri && cargo test recipe::
```

Expected: PASS 4건.

- [ ] **Step 6: 커밋**

```bash
git add src-tauri
git commit -m "feat: 레시피 스키마(스텝 7종 태그드 enum) + 파서 TDD"
```

---

### Task 4: 픽스처 레시피 3종 + 카탈로그 로더

**Files:**
- Create: `src-tauri/recipes/mock-prereq.json`, `src-tauri/recipes/mock-tool.json`, `src-tauri/recipes/mock-plugin.json`
- Create: `src-tauri/src/recipe/loader.rs`
- Modify: `src-tauri/src/recipe/mod.rs`, `src-tauri/tauri.conf.json` (bundle.resources)

**Interfaces:**
- Consumes: `Recipe::parse` (Task 3)
- Produces:
  - `recipe::loader::Catalog { recipes: Vec<Recipe> }`
  - `Catalog::load_dir(dir: &Path) -> Result<Catalog, EngineError>` — `*.json` 전부 파싱, 중복 id는 `EngineError::RecipeParse`로 거부
  - `Catalog::get(&self, id: &str) -> Option<&Recipe>`
  - `Catalog::bundled_dir() -> PathBuf` — 개발 빌드는 `CARGO_MANIFEST_DIR/recipes`(cargo test·tauri dev 공용), 릴리스 빌드는 Tauri 리소스 경로는 마일스톤 3에서 원격 갱신과 함께 정리 (M2는 debug 경로만 실사용)
  - 픽스처 3종: `mock-prereq`(kind=prerequisite) ← `mock-tool`(kind=harness, prerequisites=[mock-prereq]) ← `mock-plugin`(kind=plugin, requires=[mock-tool]). 마일스톤 3에서 실물 레시피로 교체되는 자리 표시자이며, 실행해도 무해한 `echo` 명령만 쓴다

- [ ] **Step 1: 픽스처 작성** — `src-tauri/recipes/mock-prereq.json`:

```json
{
  "schemaVersion": 1,
  "id": "mock-prereq",
  "name": "모의 준비물",
  "kind": "prerequisite",
  "easyDescription": "도구가 달리는 도로 같은 준비물이에요",
  "pricing": { "label": "무료", "kind": "free" },
  "platforms": {
    "mac": {
      "detect": [ { "type": "check_command", "friendly": "준비물이 이미 있는지 볼게요", "command": "echo", "args": ["found"] } ],
      "install": [ { "type": "run_command", "friendly": "지금 준비물을 설치하고 있어요", "command": "echo", "args": ["installing prereq"] } ],
      "verify": [ { "type": "check_command", "friendly": "준비물이 잘 깔렸는지 볼게요", "command": "echo", "args": ["ok"] } ],
      "rollback": [ { "type": "run_command", "friendly": "설치하다 만 흔적을 정리하고 있어요", "command": "echo", "args": ["rollback prereq"] } ]
    },
    "windows": {
      "detect": [ { "type": "check_command", "friendly": "준비물이 이미 있는지 볼게요", "command": "cmd", "args": ["/C", "echo found"] } ],
      "install": [ { "type": "run_command", "friendly": "지금 준비물을 설치하고 있어요", "command": "cmd", "args": ["/C", "echo installing prereq"] } ],
      "verify": [ { "type": "check_command", "friendly": "준비물이 잘 깔렸는지 볼게요", "command": "cmd", "args": ["/C", "echo ok"] } ],
      "rollback": [ { "type": "run_command", "friendly": "설치하다 만 흔적을 정리하고 있어요", "command": "cmd", "args": ["/C", "echo rollback"] } ]
    }
  }
}
```

`src-tauri/recipes/mock-tool.json` (Task 3 테스트의 VALID와 동일 구조 + windows 섹션을 mock-prereq처럼 cmd /C로, `"prerequisites": ["mock-prereq"]`, auth.guide 3줄):

```json
{
  "schemaVersion": 1,
  "id": "mock-tool",
  "name": "모의 도구",
  "kind": "harness",
  "easyDescription": "설치 흐름을 시험하는 가짜 도구예요",
  "pricing": { "label": "무료", "kind": "free" },
  "supportedModels": [ { "modelLabel": "Claude 모델", "accountLabel": "Anthropic 계정" } ],
  "recommended": true,
  "platforms": {
    "mac": {
      "prerequisites": ["mock-prereq"],
      "detect": [ { "type": "check_command", "friendly": "이미 설치돼 있는지 볼게요", "command": "echo", "args": ["not-found"] } ],
      "install": [
        { "type": "run_command", "friendly": "지금 모의 도구를 설치하고 있어요", "command": "echo", "args": ["installing tool"] },
        { "type": "path_check", "friendly": "설치된 자리를 확인하고 있어요", "path": "/tmp" }
      ],
      "auth": {
        "pattern": "browser_login",
        "steps": [ { "type": "open_url", "friendly": "로그인 창을 열어 드릴게요", "url": "https://example.com/login" } ],
        "guide": [
          "아래 버튼을 누르면 인터넷 창이 열려요",
          "쓰던 계정으로 로그인하세요",
          "허용 버튼만 누르면 끝나요"
        ]
      },
      "verify": [ { "type": "check_command", "friendly": "첫 인사를 시켜 볼게요", "command": "echo", "args": ["hello"] } ],
      "update": [ { "type": "run_command", "friendly": "새 버전으로 바꾸고 있어요", "command": "echo", "args": ["updating"] } ],
      "uninstall": [ { "type": "run_command", "friendly": "깨끗하게 지우고 있어요", "command": "echo", "args": ["uninstalling"] } ],
      "rollback": [ { "type": "run_command", "friendly": "설치하다 만 흔적을 정리하고 있어요", "command": "echo", "args": ["rollback tool"] } ]
    },
    "windows": {
      "prerequisites": ["mock-prereq"],
      "detect": [ { "type": "check_command", "friendly": "이미 설치돼 있는지 볼게요", "command": "cmd", "args": ["/C", "echo not-found"] } ],
      "install": [ { "type": "run_command", "friendly": "지금 모의 도구를 설치하고 있어요", "command": "cmd", "args": ["/C", "echo installing tool"] } ],
      "auth": {
        "pattern": "browser_login",
        "steps": [ { "type": "open_url", "friendly": "로그인 창을 열어 드릴게요", "url": "https://example.com/login" } ],
        "guide": [
          "아래 버튼을 누르면 인터넷 창이 열려요",
          "쓰던 계정으로 로그인하세요",
          "허용 버튼만 누르면 끝나요"
        ]
      },
      "verify": [ { "type": "check_command", "friendly": "첫 인사를 시켜 볼게요", "command": "cmd", "args": ["/C", "echo hello"] } ],
      "update": [], "uninstall": [], "rollback": []
    }
  }
}
```

`src-tauri/recipes/mock-plugin.json` (`"kind": "plugin"`, `"requires": ["mock-tool"]`, mac·windows 모두 detect/install/verify에 echo 한 줄씩, supportedModels 생략):

```json
{
  "schemaVersion": 1,
  "id": "mock-plugin",
  "name": "모의 플러그인",
  "kind": "plugin",
  "easyDescription": "모의 도구를 강화하는 가짜 플러그인이에요",
  "pricing": { "label": "무료", "kind": "free" },
  "requires": ["mock-tool"],
  "platforms": {
    "mac": {
      "detect": [ { "type": "check_command", "friendly": "이미 설치돼 있는지 볼게요", "command": "echo", "args": ["not-found"] } ],
      "install": [ { "type": "run_command", "friendly": "지금 플러그인을 붙이고 있어요", "command": "echo", "args": ["installing plugin"] } ],
      "verify": [ { "type": "check_command", "friendly": "잘 붙었는지 볼게요", "command": "echo", "args": ["ok"] } ]
    },
    "windows": {
      "detect": [ { "type": "check_command", "friendly": "이미 설치돼 있는지 볼게요", "command": "cmd", "args": ["/C", "echo not-found"] } ],
      "install": [ { "type": "run_command", "friendly": "지금 플러그인을 붙이고 있어요", "command": "cmd", "args": ["/C", "echo installing plugin"] } ],
      "verify": [ { "type": "check_command", "friendly": "잘 붙었는지 볼게요", "command": "cmd", "args": ["/C", "echo ok"] } ]
    }
  }
}
```

- [ ] **Step 2: 실패 테스트 작성** — `src-tauri/src/recipe/loader.rs`:

```rust
#[cfg(test)]
mod tests {
    use super::*;
    use std::fs;

    #[test]
    fn loads_bundled_fixture_recipes() {
        let catalog = Catalog::load_dir(&Catalog::bundled_dir()).unwrap();
        assert_eq!(catalog.recipes.len(), 3);
        assert!(catalog.get("mock-tool").is_some());
        assert!(catalog.get("no-such-id").is_none());
    }

    #[test]
    fn rejects_duplicate_ids() {
        let dir = tempfile::tempdir().unwrap();
        let src = Catalog::bundled_dir().join("mock-tool.json");
        fs::copy(&src, dir.path().join("a.json")).unwrap();
        fs::copy(&src, dir.path().join("b.json")).unwrap();
        let err = Catalog::load_dir(dir.path()).unwrap_err();
        assert!(err.to_string().contains("mock-tool"));
    }

    #[test]
    fn reports_broken_json_with_file_name() {
        let dir = tempfile::tempdir().unwrap();
        fs::write(dir.path().join("broken.json"), "{ not json").unwrap();
        let err = Catalog::load_dir(dir.path()).unwrap_err();
        assert!(err.to_string().contains("broken.json"));
    }
}
```

- [ ] **Step 3: 테스트 실패 확인**

```bash
cd src-tauri && cargo test recipe::loader
```

Expected: FAIL (Catalog 미정의).

- [ ] **Step 4: 최소 구현** — `src-tauri/src/recipe/loader.rs` 상단:

```rust
use std::collections::HashSet;
use std::path::{Path, PathBuf};

use crate::error::EngineError;
use crate::recipe::schema::Recipe;

#[derive(Debug, Clone)]
pub struct Catalog {
    pub recipes: Vec<Recipe>,
}

impl Catalog {
    /// M2: 개발 빌드 전용 경로. 릴리스 리소스 경로·원격 갱신은 마일스톤 3에서.
    pub fn bundled_dir() -> PathBuf {
        PathBuf::from(env!("CARGO_MANIFEST_DIR")).join("recipes")
    }

    pub fn load_dir(dir: &Path) -> Result<Catalog, EngineError> {
        let mut recipes = Vec::new();
        let mut seen: HashSet<String> = HashSet::new();
        let mut entries: Vec<PathBuf> = std::fs::read_dir(dir)?
            .filter_map(|e| e.ok().map(|e| e.path()))
            .filter(|p| p.extension().is_some_and(|x| x == "json"))
            .collect();
        entries.sort(); // 결정적 순서 (테스트·드라이런 리포트 안정성)
        for path in entries {
            let file = path.file_name().unwrap_or_default().to_string_lossy().to_string();
            let text = std::fs::read_to_string(&path)?;
            let recipe = Recipe::parse(&text).map_err(|e| match e {
                EngineError::RecipeParse { message, .. } => EngineError::RecipeParse { file: file.clone(), message },
                other => other,
            })?;
            if !seen.insert(recipe.id.clone()) {
                return Err(EngineError::RecipeParse {
                    file,
                    message: format!("id가 겹쳐요: {}", recipe.id),
                });
            }
            recipes.push(recipe);
        }
        Ok(Catalog { recipes })
    }

    pub fn get(&self, id: &str) -> Option<&Recipe> {
        self.recipes.iter().find(|r| r.id == id)
    }
}
```

`src-tauri/src/recipe/mod.rs`에 `pub mod loader;` 추가.

- [ ] **Step 5: 번들 리소스 등록** — `src-tauri/tauri.conf.json`의 `bundle`에 (릴리스 대비, M2에선 미사용):

```json
"resources": ["recipes/*.json"]
```

- [ ] **Step 6: 테스트 통과 확인**

```bash
cd src-tauri && cargo test recipe::loader
```

Expected: PASS 3건.

- [ ] **Step 7: 커밋**

```bash
git add src-tauri
git commit -m "feat: 픽스처 레시피 3종 + 카탈로그 로더 (중복 id·깨진 JSON 방어)"
```

---

### Task 5: 플랜 빌더 (requires·prerequisites 해소 + 사이클 검출)

**Files:**
- Create: `src-tauri/src/recipe/plan.rs`
- Modify: `src-tauri/src/recipe/mod.rs`

**Interfaces:**
- Consumes: `Catalog`, `Recipe`, `Platform`, `Step`, `EngineError` (Task 3·4)
- Produces:
  - `enum Section { Detect, Install, Auth, Verify, Update, Uninstall, Rollback }` + `Section::as_str(&self) -> &'static str` (`"detect"` 등)
  - `enum Flow { Install, Update, Uninstall }` — 마법사(설치)와 대시보드(업데이트/삭제)가 같은 빌더를 쓴다
  - `struct PlannedStep { pub recipe_id: String, pub recipe_name: String, pub section: Section, pub step: Step }`
  - `struct InstallPlan { pub target_id: String, pub steps: Vec<PlannedStep>, pub tool_order: Vec<String> }`
  - `build_plan(catalog: &Catalog, target_id: &str, platform: Platform, flow: Flow, installed: &[String]) -> Result<InstallPlan, EngineError>`
  - 규칙: Flow::Install이면 target의 requires ∪ prerequisites를 DFS 후위순회로 풀어 **의존성 먼저** 배치(이미 `installed`에 있는 id는 생략). 각 의존성은 detect→install→verify, target은 detect→install→auth.steps→verify 순. Flow::Update/Uninstall은 target의 해당 섹션만(의존성 안 건드림). 미지 id는 `UnknownRecipe`, 순환은 `DependencyCycle`, 플랫폼 섹션 없으면 `PlatformUnsupported`
  - rollback 스텝은 플랜에 넣지 않는다 — 실패 시 러너가 해당 레시피의 rollback 섹션을 즉석 조회(Task 8)

- [ ] **Step 1: 실패 테스트 작성** — `src-tauri/src/recipe/plan.rs` 하단:

```rust
#[cfg(test)]
mod tests {
    use super::*;
    use crate::recipe::loader::Catalog;
    use crate::recipe::schema::{Platform, Recipe};

    fn catalog() -> Catalog {
        Catalog::load_dir(&Catalog::bundled_dir()).unwrap()
    }

    #[test]
    fn plugin_plan_pulls_tool_then_prereq_first() {
        let plan = build_plan(&catalog(), "mock-plugin", Platform::Mac, Flow::Install, &[]).unwrap();
        assert_eq!(plan.tool_order, vec!["mock-prereq", "mock-tool", "mock-plugin"]);
        // 첫 스텝은 가장 깊은 의존성의 detect
        assert_eq!(plan.steps[0].recipe_id, "mock-prereq");
        assert!(matches!(plan.steps[0].section, Section::Detect));
        // target의 auth 스텝이 verify보다 앞에
        let auth_idx = plan.steps.iter().position(|s| matches!(s.section, Section::Auth)).unwrap();
        let target_verify_idx = plan.steps.iter()
            .position(|s| s.recipe_id == "mock-plugin" && matches!(s.section, Section::Verify));
        // mock-plugin에는 auth가 없으니 auth 스텝은 mock-tool 것
        assert_eq!(plan.steps[auth_idx].recipe_id, "mock-tool");
        assert!(target_verify_idx.unwrap() > auth_idx);
    }

    #[test]
    fn installed_dependencies_are_skipped() {
        let plan = build_plan(&catalog(), "mock-plugin", Platform::Mac, Flow::Install,
            &["mock-tool".into(), "mock-prereq".into()]).unwrap();
        assert_eq!(plan.tool_order, vec!["mock-plugin"]);
    }

    #[test]
    fn unknown_target_errors() {
        let err = build_plan(&catalog(), "ghost", Platform::Mac, Flow::Install, &[]).unwrap_err();
        assert!(matches!(err, crate::error::EngineError::UnknownRecipe(_)));
    }

    #[test]
    fn cycle_is_detected() {
        let mut cat = catalog();
        // mock-tool이 mock-plugin을 requires 하도록 조작해 순환 생성
        let tool = cat.recipes.iter_mut().find(|r| r.id == "mock-tool").unwrap();
        tool.requires.push("mock-plugin".into());
        let err = build_plan(&cat, "mock-plugin", Platform::Mac, Flow::Install, &[]).unwrap_err();
        assert!(matches!(err, crate::error::EngineError::DependencyCycle(_)));
    }

    #[test]
    fn update_flow_uses_only_target_update_section() {
        let plan = build_plan(&catalog(), "mock-tool", Platform::Mac, Flow::Update, &[]).unwrap();
        assert_eq!(plan.tool_order, vec!["mock-tool"]);
        assert!(plan.steps.iter().all(|s| matches!(s.section, Section::Update)));
        assert!(!plan.steps.is_empty());
    }
}
```

- [ ] **Step 2: 테스트 실패 확인**

```bash
cd src-tauri && cargo test recipe::plan
```

Expected: FAIL (build_plan 미정의).

- [ ] **Step 3: 최소 구현** — `src-tauri/src/recipe/plan.rs` 상단:

```rust
use serde::Serialize;

use crate::error::EngineError;
use crate::recipe::loader::Catalog;
use crate::recipe::schema::{Platform, PlatformSpec, Recipe, Step};

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize)]
#[serde(rename_all = "lowercase")]
pub enum Section { Detect, Install, Auth, Verify, Update, Uninstall, Rollback }

impl Section {
    pub fn as_str(&self) -> &'static str {
        match self {
            Section::Detect => "detect", Section::Install => "install", Section::Auth => "auth",
            Section::Verify => "verify", Section::Update => "update",
            Section::Uninstall => "uninstall", Section::Rollback => "rollback",
        }
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum Flow { Install, Update, Uninstall }

#[derive(Debug, Clone)]
pub struct PlannedStep {
    pub recipe_id: String,
    pub recipe_name: String,
    pub section: Section,
    pub step: Step,
}

#[derive(Debug, Clone)]
pub struct InstallPlan {
    pub target_id: String,
    pub steps: Vec<PlannedStep>,
    pub tool_order: Vec<String>,
}

pub fn build_plan(
    catalog: &Catalog,
    target_id: &str,
    platform: Platform,
    flow: Flow,
    installed: &[String],
) -> Result<InstallPlan, EngineError> {
    let target = catalog.get(target_id)
        .ok_or_else(|| EngineError::UnknownRecipe(target_id.to_string()))?;

    let tool_order = match flow {
        Flow::Install => resolve_order(catalog, target, installed)?,
        Flow::Update | Flow::Uninstall => vec![target_id.to_string()],
    };

    let mut steps = Vec::new();
    for id in &tool_order {
        let recipe = catalog.get(id).ok_or_else(|| EngineError::UnknownRecipe(id.clone()))?;
        let spec = platform_spec(recipe, platform)?;
        let is_target = id == target_id;
        match flow {
            Flow::Install => {
                push(&mut steps, recipe, Section::Detect, &spec.detect);
                push(&mut steps, recipe, Section::Install, &spec.install);
                if is_target {
                    if let Some(auth) = &spec.auth {
                        push(&mut steps, recipe, Section::Auth, &auth.steps);
                    }
                }
                push(&mut steps, recipe, Section::Verify, &spec.verify);
            }
            Flow::Update => push(&mut steps, recipe, Section::Update, &spec.update),
            Flow::Uninstall => push(&mut steps, recipe, Section::Uninstall, &spec.uninstall),
        }
    }
    Ok(InstallPlan { target_id: target_id.to_string(), steps, tool_order })
}

fn push(steps: &mut Vec<PlannedStep>, recipe: &Recipe, section: Section, list: &[Step]) {
    for step in list {
        steps.push(PlannedStep {
            recipe_id: recipe.id.clone(),
            recipe_name: recipe.name.clone(),
            section,
            step: step.clone(),
        });
    }
}

fn platform_spec(recipe: &Recipe, platform: Platform) -> Result<&PlatformSpec, EngineError> {
    recipe.platforms.get(platform).ok_or_else(|| EngineError::PlatformUnsupported {
        recipe: recipe.id.clone(),
        platform: platform.as_str().to_string(),
    })
}

/// DFS 후위순회. visiting 스택으로 순환 검출. installed는 서브트리째 생략.
/// prerequisites는 빌드 대상 platform의 섹션에서 읽는다 (실행 OS와 무관).
fn resolve_order(
    catalog: &Catalog, target: &Recipe, platform: Platform, installed: &[String],
) -> Result<Vec<String>, EngineError> {
    let mut order = Vec::new();
    let mut visiting = Vec::new();
    let mut done = Vec::new();
    visit(catalog, &target.id, platform, installed, &mut visiting, &mut done, &mut order)?;
    Ok(order)
}

fn visit(
    catalog: &Catalog, id: &str, platform: Platform, installed: &[String],
    visiting: &mut Vec<String>, done: &mut Vec<String>, order: &mut Vec<String>,
) -> Result<(), EngineError> {
    if done.iter().any(|d| d == id) { return Ok(()); }
    if visiting.iter().any(|v| v == id) {
        let mut cycle = visiting.clone();
        cycle.push(id.to_string());
        return Err(EngineError::DependencyCycle(cycle));
    }
    let recipe = catalog.get(id).ok_or_else(|| EngineError::UnknownRecipe(id.to_string()))?;
    visiting.push(id.to_string());
    let mut deps: Vec<String> = recipe.requires.clone();
    let spec = platform_spec(recipe, platform)?;
    deps.extend(spec.prerequisites.clone());
    for dep in deps {
        if !installed.iter().any(|i| i == &dep) {
            visit(catalog, &dep, platform, installed, visiting, done, order)?;
        }
    }
    visiting.pop();
    done.push(id.to_string());
    order.push(id.to_string());
    Ok(())
}
```

`build_plan`의 `Flow::Install` 분기는 `resolve_order(catalog, target, platform, installed)?`로 호출한다.

- [ ] **Step 4: 테스트 통과 확인**

```bash
cd src-tauri && cargo test recipe::plan
```

Expected: PASS 5건.

- [ ] **Step 5: 커밋**

```bash
git add src-tauri
git commit -m "feat: 설치 플랜 빌더 (의존성 후위순회·사이클 검출·설치됨 생략·3플로우)"
```

---

### Task 6: ProcessRunner 추상화 + 실행기 1차 (check_command · run_command · path_check)

**Files:**
- Create: `src-tauri/src/runner/mod.rs`, `src-tauri/src/runner/process.rs`
- Modify: `src-tauri/src/lib.rs` (`pub mod runner;`)

**Interfaces:**
- Consumes: `Step` (Task 3)
- Produces:
  - `runner::process::ProcessOutput { pub exit_code: i32, pub stdout: String, pub stderr: String }`
  - `trait ProcessRunner: Send + Sync { fn run(&self, command: &str, args: &[String]) -> impl Future<Output = std::io::Result<ProcessOutput>> + Send; }` — async fn in trait(AFIT, Rust 1.75+)로 제네릭 정적 디스패치. dyn 불필요
  - `struct TokioProcessRunner` — 실구현. 윈도우에선 콘솔 창이 번쩍 뜨지 않게 `CREATE_NO_WINDOW`(0x08000000) 적용
  - `struct FakeProcessRunner` (`#[cfg(test)]` 아님 — 프론트 없는 통합 테스트에서도 쓰므로 일반 pub, 단 `#[doc(hidden)]`): 예약된 응답 큐 + 호출 기록(`calls: Mutex<Vec<(String, Vec<String>)>>`)
  - `runner::execute_step(step: &Step, runner: &impl ProcessRunner) -> StepOutcome` — 이번 태스크에선 CheckCommand·RunCommand·PathCheck 3종 처리, 나머지는 `StepOutcome::Unsupported`(Task 7에서 교체)
  - `enum StepOutcome { Success { log: String }, Failure { message: String, log: String }, Unsupported }` — Failure.message는 비개발자용 문구, log는 stdout/stderr 원문

- [ ] **Step 1: 실패 테스트 작성** — `src-tauri/src/runner/mod.rs` 하단:

```rust
#[cfg(test)]
mod tests {
    use super::*;
    use crate::recipe::schema::Step;
    use crate::runner::process::{FakeProcessRunner, ProcessOutput};

    fn ok(stdout: &str) -> std::io::Result<ProcessOutput> {
        Ok(ProcessOutput { exit_code: 0, stdout: stdout.into(), stderr: String::new() })
    }
    fn fail(stderr: &str) -> std::io::Result<ProcessOutput> {
        Ok(ProcessOutput { exit_code: 1, stdout: String::new(), stderr: stderr.into() })
    }

    #[tokio::test]
    async fn run_command_success_and_failure() {
        let runner = FakeProcessRunner::new(vec![ok("done"), fail("boom")]);
        let step = Step::RunCommand { friendly: "설치 중".into(), command: "brew".into(), args: vec!["install".into()] };
        assert!(matches!(execute_step(&step, &runner).await, StepOutcome::Success { .. }));
        assert!(matches!(execute_step(&step, &runner).await, StepOutcome::Failure { .. }));
        assert_eq!(runner.calls()[0], ("brew".to_string(), vec!["install".to_string()]));
    }

    #[tokio::test]
    async fn spawn_error_becomes_failure_not_panic() {
        // 응답 큐가 빈 FakeProcessRunner는 NotFound io::Error를 돌려준다
        let runner = FakeProcessRunner::new(vec![]);
        let step = Step::CheckCommand { friendly: "확인 중".into(), command: "ghost".into(), args: vec![] };
        let StepOutcome::Failure { message, .. } = execute_step(&step, &runner).await else {
            panic!("Failure여야 함");
        };
        assert!(!message.is_empty());
    }

    #[tokio::test]
    async fn path_check_uses_filesystem() {
        let dir = tempfile::tempdir().unwrap();
        let good = Step::PathCheck { friendly: "자리 확인".into(), path: dir.path().to_string_lossy().into() };
        let bad = Step::PathCheck { friendly: "자리 확인".into(), path: dir.path().join("없는곳").to_string_lossy().into() };
        let runner = FakeProcessRunner::new(vec![]);
        assert!(matches!(execute_step(&good, &runner).await, StepOutcome::Success { .. }));
        assert!(matches!(execute_step(&bad, &runner).await, StepOutcome::Failure { .. }));
    }

    #[tokio::test]
    async fn real_runner_runs_echo() {
        use crate::runner::process::{ProcessRunner, TokioProcessRunner};
        let out = if cfg!(windows) {
            TokioProcessRunner.run("cmd", &["/C".into(), "echo hi".into()]).await.unwrap()
        } else {
            TokioProcessRunner.run("echo", &["hi".into()]).await.unwrap()
        };
        assert_eq!(out.exit_code, 0);
        assert!(out.stdout.contains("hi"));
    }

    #[tokio::test]
    async fn unwired_steps_report_unsupported() {
        let runner = FakeProcessRunner::new(vec![]);
        let step = Step::PtySession { friendly: "터미널".into(), command: "x".into(), args: vec![] };
        assert!(matches!(execute_step(&step, &runner).await, StepOutcome::Unsupported));
    }
}
```

- [ ] **Step 2: 테스트 실패 확인**

```bash
cd src-tauri && cargo test runner::
```

Expected: FAIL (모듈 미정의). `tokio::test` 매크로를 쓰므로 Cargo.toml `[dev-dependencies]`에 `tokio = { version = "1", features = ["macros", "rt"] }` 추가가 필요하다 (본 의존성은 tauri가 이미 tokio를 내장).

- [ ] **Step 3: 최소 구현** — `src-tauri/src/runner/process.rs`:

```rust
use std::sync::Mutex;

#[derive(Debug, Clone, PartialEq)]
pub struct ProcessOutput {
    pub exit_code: i32,
    pub stdout: String,
    pub stderr: String,
}

pub trait ProcessRunner: Send + Sync {
    fn run(
        &self,
        command: &str,
        args: &[String],
    ) -> impl std::future::Future<Output = std::io::Result<ProcessOutput>> + Send;
}

pub struct TokioProcessRunner;

impl ProcessRunner for TokioProcessRunner {
    async fn run(&self, command: &str, args: &[String]) -> std::io::Result<ProcessOutput> {
        let mut cmd = tokio::process::Command::new(command);
        cmd.args(args);
        #[cfg(windows)]
        {
            // 콘솔 창 번쩍임 방지
            cmd.creation_flags(0x0800_0000); // CREATE_NO_WINDOW
        }
        let out = cmd.output().await?;
        Ok(ProcessOutput {
            exit_code: out.status.code().unwrap_or(-1),
            stdout: String::from_utf8_lossy(&out.stdout).into_owned(),
            stderr: String::from_utf8_lossy(&out.stderr).into_owned(),
        })
    }
}

/// 테스트·드라이런용 가짜 러너. 응답을 순서대로 소비하고 호출을 기록한다.
#[doc(hidden)]
pub struct FakeProcessRunner {
    responses: Mutex<Vec<std::io::Result<ProcessOutput>>>,
    calls: Mutex<Vec<(String, Vec<String>)>>,
}

impl FakeProcessRunner {
    pub fn new(mut responses: Vec<std::io::Result<ProcessOutput>>) -> Self {
        responses.reverse(); // pop()으로 앞에서부터 소비
        FakeProcessRunner { responses: Mutex::new(responses), calls: Mutex::new(Vec::new()) }
    }
    pub fn calls(&self) -> Vec<(String, Vec<String>)> {
        self.calls.lock().unwrap().clone()
    }
}

impl ProcessRunner for FakeProcessRunner {
    async fn run(&self, command: &str, args: &[String]) -> std::io::Result<ProcessOutput> {
        self.calls.lock().unwrap().push((command.to_string(), args.to_vec()));
        self.responses.lock().unwrap().pop().unwrap_or_else(|| {
            Err(std::io::Error::new(std::io::ErrorKind::NotFound, "no scripted response"))
        })
    }
}
```

윈도우 creation_flags에는 `use std::os::windows::process::CommandExt;`가 필요하므로 `#[cfg(windows)] use ...`로 파일 상단에 추가.

`src-tauri/src/runner/mod.rs`:

```rust
pub mod process;

use crate::recipe::schema::Step;
use process::{ProcessRunner};

#[derive(Debug)]
pub enum StepOutcome {
    Success { log: String },
    Failure { message: String, log: String },
    Unsupported,
}

pub async fn execute_step(step: &Step, runner: &impl ProcessRunner) -> StepOutcome {
    match step {
        Step::CheckCommand { command, args, .. } | Step::RunCommand { command, args, .. } => {
            match runner.run(command, args).await {
                Ok(out) if out.exit_code == 0 => StepOutcome::Success {
                    log: format!("{}{}", out.stdout, out.stderr),
                },
                Ok(out) => StepOutcome::Failure {
                    message: "이 단계가 잘 끝나지 않았어요. 다시 시도해 볼까요?".into(),
                    log: format!("exit={}\n{}{}", out.exit_code, out.stdout, out.stderr),
                },
                Err(e) => StepOutcome::Failure {
                    message: "명령을 시작하지 못했어요. 다시 시도해 볼까요?".into(),
                    log: e.to_string(),
                },
            }
        }
        Step::PathCheck { path, .. } => {
            if std::path::Path::new(path).exists() {
                StepOutcome::Success { log: format!("확인됨: {path}") }
            } else {
                StepOutcome::Failure {
                    message: "설치된 자리를 찾지 못했어요.".into(),
                    log: format!("없음: {path}"),
                }
            }
        }
        Step::OpenUrl { .. } | Step::InputSecret { .. }
        | Step::DownloadRun { .. } | Step::PtySession { .. } => StepOutcome::Unsupported,
    }
}
```

- [ ] **Step 4: 테스트 통과 확인**

```bash
cd src-tauri && cargo test runner::
```

Expected: PASS 5건.

- [ ] **Step 5: 커밋**

```bash
git add src-tauri
git commit -m "feat: ProcessRunner 추상화(tokio 실구현+Fake) + 실행기 1차 3종"
```

---

### Task 7: 실행기 2차 (open_url · input_secret 치환·마스킹 / download_run · pty_session 스텁)

**Files:**
- Create: `src-tauri/src/runner/secrets.rs`
- Modify: `src-tauri/src/runner/mod.rs`

**Interfaces:**
- Consumes: Task 6의 `execute_step`·`StepOutcome`
- Produces:
  - `runner::secrets::SecretVault { new(), insert(label: &str, value: &str), substitute(&self, text: &str) -> String, mask(&self, text: &str) -> String }` — 레시피 문자열 속 `{{secret:LABEL}}`을 실제 값으로 치환하고, 로그에선 값을 `•••`로 마스킹
  - `execute_step` 시그니처 확장: `execute_step(step: &Step, runner: &impl ProcessRunner, vault: &SecretVault, opener: &impl UrlOpener) -> StepOutcome`
  - `trait UrlOpener: Send + Sync { fn open(&self, url: &str) -> Result<(), String>; }` + `FakeUrlOpener { opened: Mutex<Vec<String>> }` — 실구현(tauri-plugin-opener 배선)은 Task 12
  - OpenUrl → opener 호출 성공 시 Success. InputSecret → vault에 label이 이미 있으면 Success, 없으면 `Failure`가 아니라 `StepOutcome::NeedsSecret { label: String, friendly: String }` (새 variant — 러너가 이걸 받으면 프론트에 입력 요청 이벤트를 내고 대기, Task 8). DownloadRun·PtySession → `Unsupported` 유지 (마일스톤 3 배선; 드라이런에서는 정상 항목으로 나열됨)
  - command·args·url은 실행 직전 `vault.substitute` 적용, 모든 log는 `vault.mask` 적용

- [ ] **Step 1: 실패 테스트 작성** — `src-tauri/src/runner/secrets.rs` 하단:

```rust
#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn substitute_and_mask_roundtrip() {
        let mut vault = SecretVault::new();
        vault.insert("api_key", "sk-live-1234");
        assert_eq!(vault.substitute("--key={{secret:api_key}}"), "--key=sk-live-1234");
        assert_eq!(vault.substitute("{{secret:none}}"), "{{secret:none}}"); // 미등록은 그대로
        assert_eq!(vault.mask("token sk-live-1234 ok"), "token ••• ok");
        assert!(vault.has("api_key"));
        assert!(!vault.has("none"));
    }
}
```

`src-tauri/src/runner/mod.rs`의 tests 모듈에 추가:

```rust
    #[tokio::test]
    async fn open_url_goes_through_opener() {
        let runner = FakeProcessRunner::new(vec![]);
        let opener = FakeUrlOpener::default();
        let vault = SecretVault::new();
        let step = Step::OpenUrl { friendly: "로그인 창".into(), url: "https://example.com".into() };
        assert!(matches!(execute_step(&step, &runner, &vault, &opener).await, StepOutcome::Success { .. }));
        assert_eq!(opener.opened(), vec!["https://example.com".to_string()]);
    }

    #[tokio::test]
    async fn input_secret_requests_when_missing_and_passes_when_present() {
        let runner = FakeProcessRunner::new(vec![]);
        let opener = FakeUrlOpener::default();
        let step = Step::InputSecret { friendly: "키를 넣어 주세요".into(), label: "api_key".into() };
        let vault = SecretVault::new();
        assert!(matches!(
            execute_step(&step, &runner, &vault, &opener).await,
            StepOutcome::NeedsSecret { .. }
        ));
        let mut vault2 = SecretVault::new();
        vault2.insert("api_key", "v");
        assert!(matches!(execute_step(&step, &runner, &vault2, &opener).await, StepOutcome::Success { .. }));
    }

    #[tokio::test]
    async fn secret_is_substituted_into_args_and_masked_in_log() {
        let runner = FakeProcessRunner::new(vec![Ok(ProcessOutput {
            exit_code: 1, stdout: "sk-live-1234 rejected".into(), stderr: String::new(),
        })]);
        let opener = FakeUrlOpener::default();
        let mut vault = SecretVault::new();
        vault.insert("api_key", "sk-live-1234");
        let step = Step::RunCommand {
            friendly: "키 등록 중".into(), command: "tool".into(),
            args: vec!["--key={{secret:api_key}}".into()],
        };
        let StepOutcome::Failure { log, .. } = execute_step(&step, &runner, &vault, &opener).await else {
            panic!("Failure여야 함");
        };
        assert_eq!(runner.calls()[0].1, vec!["--key=sk-live-1234".to_string()]); // 실행엔 실값
        assert!(!log.contains("sk-live-1234")); // 로그엔 마스킹
        assert!(log.contains("•••"));
    }
```

(기존 Task 6 테스트들의 `execute_step(&step, &runner)` 호출은 전부 `execute_step(&step, &runner, &SecretVault::new(), &FakeUrlOpener::default())`로 갱신한다.)

- [ ] **Step 2: 테스트 실패 확인**

```bash
cd src-tauri && cargo test runner::
```

Expected: FAIL (SecretVault·UrlOpener 미정의).

- [ ] **Step 3: 최소 구현** — `src-tauri/src/runner/secrets.rs`:

```rust
use std::collections::HashMap;

#[derive(Default)]
pub struct SecretVault {
    values: HashMap<String, String>,
}

impl SecretVault {
    pub fn new() -> Self { Self::default() }

    pub fn insert(&mut self, label: &str, value: &str) {
        self.values.insert(label.to_string(), value.to_string());
    }

    pub fn has(&self, label: &str) -> bool { self.values.contains_key(label) }

    /// "{{secret:LABEL}}" 자리에 실값. 미등록 라벨은 건드리지 않는다.
    pub fn substitute(&self, text: &str) -> String {
        let mut out = text.to_string();
        for (label, value) in &self.values {
            out = out.replace(&format!("{{{{secret:{label}}}}}"), value);
        }
        out
    }

    /// 로그·이벤트로 나가는 모든 문자열에 적용. 실값을 •••로.
    pub fn mask(&self, text: &str) -> String {
        let mut out = text.to_string();
        for value in self.values.values() {
            if !value.is_empty() {
                out = out.replace(value, "•••");
            }
        }
        out
    }
}
```

`src-tauri/src/runner/mod.rs` 변경점:

```rust
pub mod process;
pub mod secrets;

use crate::recipe::schema::Step;
use process::ProcessRunner;
use secrets::SecretVault;
use std::sync::Mutex;

#[derive(Debug)]
pub enum StepOutcome {
    Success { log: String },
    Failure { message: String, log: String },
    NeedsSecret { label: String, friendly: String },
    Unsupported,
}

pub trait UrlOpener: Send + Sync {
    fn open(&self, url: &str) -> Result<(), String>;
}

#[derive(Default)]
pub struct FakeUrlOpener {
    opened: Mutex<Vec<String>>,
}

impl FakeUrlOpener {
    pub fn opened(&self) -> Vec<String> { self.opened.lock().unwrap().clone() }
}

impl UrlOpener for FakeUrlOpener {
    fn open(&self, url: &str) -> Result<(), String> {
        self.opened.lock().unwrap().push(url.to_string());
        Ok(())
    }
}

pub async fn execute_step(
    step: &Step,
    runner: &impl ProcessRunner,
    vault: &SecretVault,
    opener: &impl UrlOpener,
) -> StepOutcome {
    match step {
        Step::CheckCommand { command, args, .. } | Step::RunCommand { command, args, .. } => {
            let command = vault.substitute(command);
            let args: Vec<String> = args.iter().map(|a| vault.substitute(a)).collect();
            match runner.run(&command, &args).await {
                Ok(out) if out.exit_code == 0 => StepOutcome::Success {
                    log: vault.mask(&format!("{}{}", out.stdout, out.stderr)),
                },
                Ok(out) => StepOutcome::Failure {
                    message: "이 단계가 잘 끝나지 않았어요. 다시 시도해 볼까요?".into(),
                    log: vault.mask(&format!("exit={}\n{}{}", out.exit_code, out.stdout, out.stderr)),
                },
                Err(e) => StepOutcome::Failure {
                    message: "명령을 시작하지 못했어요. 다시 시도해 볼까요?".into(),
                    log: vault.mask(&e.to_string()),
                },
            }
        }
        Step::PathCheck { path, .. } => {
            if std::path::Path::new(path).exists() {
                StepOutcome::Success { log: format!("확인됨: {path}") }
            } else {
                StepOutcome::Failure {
                    message: "설치된 자리를 찾지 못했어요.".into(),
                    log: format!("없음: {path}"),
                }
            }
        }
        Step::OpenUrl { url, .. } => match opener.open(&vault.substitute(url)) {
            Ok(()) => StepOutcome::Success { log: format!("열림: {url}") },
            Err(e) => StepOutcome::Failure {
                message: "인터넷 창을 열지 못했어요.".into(),
                log: vault.mask(&e),
            },
        },
        Step::InputSecret { label, friendly } => {
            if vault.has(label) {
                StepOutcome::Success { log: format!("입력 받음: {label}") }
            } else {
                StepOutcome::NeedsSecret { label: label.clone(), friendly: friendly.clone() }
            }
        }
        // 마일스톤 3에서 배선 (download_run: reqwest 실행기, pty_session: tauri-plugin-pty)
        Step::DownloadRun { .. } | Step::PtySession { .. } => StepOutcome::Unsupported,
    }
}
```

- [ ] **Step 4: 테스트 통과 확인**

```bash
cd src-tauri && cargo test runner:: secrets
```

Expected: PASS (Task 6 갱신분 포함 전부).

- [ ] **Step 5: 커밋**

```bash
git add src-tauri
git commit -m "feat: 실행기 2차 (URL 열기, 비밀값 치환·마스킹, 미배선 스텝 명시)"
```

---

### Task 8: 진행 이벤트 + 스텝 러너 오케스트레이션 + 실패 시 rollback

**Files:**
- Create: `src-tauri/src/runner/events.rs`, `src-tauri/src/runner/step_runner.rs`
- Modify: `src-tauri/src/runner/mod.rs`

**Interfaces:**
- Consumes: `InstallPlan`·`PlannedStep`·`Section`(Task 5), `execute_step`·`StepOutcome`·`SecretVault`·`UrlOpener`(Task 7), `Catalog`(Task 4)
- Produces:
  - `runner::events::ProgressEvent { pub run_id: String, pub recipe_id: String, pub recipe_name: String, pub section: String, pub step_index: usize, pub total_steps: usize, pub friendly: String, pub status: StepStatus }` (Serialize, camelCase)
  - `enum StepStatus { Running, Succeeded, Failed { message: String }, WaitingSecret { label: String }, Done { success: bool } }` (Serialize, `#[serde(tag = "kind", rename_all = "camelCase")]`) — `Done`은 전체 종료 신호(마지막 이벤트)
  - `trait ProgressEmitter: Send + Sync { fn progress(&self, ev: &ProgressEvent); fn log(&self, run_id: &str, line: &str); }` + `CollectingEmitter`(테스트용: `events()`, `logs()` 게터)
  - `runner::step_runner::run_plan(plan: &InstallPlan, catalog: &Catalog, run_id: &str, deps: RunDeps<'_, P, E, O>, secret_rx: &mut tokio::sync::mpsc::Receiver<(String, String)>) -> RunReport` — `RunDeps { process: &P, emitter: &E, opener: &O, vault: SecretVault }`
  - 동작: 각 스텝마다 Running 이벤트 → `execute_step` → Succeeded/Failed 이벤트 + log. `NeedsSecret`이면 WaitingSecret 이벤트 후 `secret_rx.recv()` 대기 → vault에 넣고 같은 스텝 재실행. Failure면 즉시 중단하고 해당 레시피의 rollback 섹션을 best-effort 실행(실패 무시, log만) 후 `Done { success: false }`. 전부 성공 시 `Done { success: true }`
  - `RunReport { pub success: bool, pub failed_step: Option<ProgressEvent> }`
  - detect 섹션 규약(M2): CheckCommand 실패 = "미설치"이므로 detect 섹션의 Failure는 **실패가 아니라 계속 진행** (Succeeded로 이벤트, log에 "설치 필요"). 이미 설치된 도구 생략 판단은 마일스톤 3에서 정교화

- [ ] **Step 1: 실패 테스트 작성** — `src-tauri/src/runner/step_runner.rs` 하단:

```rust
#[cfg(test)]
mod tests {
    use super::*;
    use crate::recipe::loader::Catalog;
    use crate::recipe::plan::{build_plan, Flow};
    use crate::recipe::schema::Platform;
    use crate::runner::events::{CollectingEmitter, StepStatus};
    use crate::runner::process::{FakeProcessRunner, ProcessOutput};
    use crate::runner::secrets::SecretVault;
    use crate::runner::FakeUrlOpener;

    fn ok() -> std::io::Result<ProcessOutput> {
        Ok(ProcessOutput { exit_code: 0, stdout: "ok".into(), stderr: String::new() })
    }
    fn fail() -> std::io::Result<ProcessOutput> {
        Ok(ProcessOutput { exit_code: 1, stdout: String::new(), stderr: "boom".into() })
    }

    fn deps<'a>(
        p: &'a FakeProcessRunner, e: &'a CollectingEmitter, o: &'a FakeUrlOpener,
    ) -> RunDeps<'a, FakeProcessRunner, CollectingEmitter, FakeUrlOpener> {
        RunDeps { process: p, emitter: e, opener: o, vault: SecretVault::new() }
    }

    #[tokio::test]
    async fn happy_path_emits_running_succeeded_done() {
        let catalog = Catalog::load_dir(&Catalog::bundled_dir()).unwrap();
        let plan = build_plan(&catalog, "mock-tool", Platform::Mac, Flow::Install, &[]).unwrap();
        // 프로세스를 쓰는 스텝은 6개: mock-prereq의 check·run·check 3 + mock-tool의
        // detect check 1, install run_command 1, verify check 1 (path_check·open_url은 프로세스 안 씀)
        let process = FakeProcessRunner::new((0..6).map(|_| ok()).collect());
        let emitter = CollectingEmitter::default();
        let opener = FakeUrlOpener::default();
        let (_tx, mut rx) = tokio::sync::mpsc::channel(1);
        let report = run_plan(&plan, &catalog, Platform::Mac, "run-1", deps(&process, &emitter, &opener), &mut rx).await;
        assert!(report.success);
        let evs = emitter.events();
        assert!(matches!(evs.last().unwrap().status, StepStatus::Done { success: true }));
        assert_eq!(evs.iter().filter(|e| matches!(e.status, StepStatus::Running)).count(), plan.steps.len());
        assert_eq!(opener.opened().len(), 1); // auth의 open_url
    }

    #[tokio::test]
    async fn install_failure_triggers_rollback_of_failing_recipe() {
        let catalog = Catalog::load_dir(&Catalog::bundled_dir()).unwrap();
        let plan = build_plan(&catalog, "mock-prereq", Platform::Mac, Flow::Install, &[]).unwrap();
        // detect ok → install fail → (rollback echo가 이어서 호출됨)
        let process = FakeProcessRunner::new(vec![ok(), fail(), ok()]);
        let emitter = CollectingEmitter::default();
        let opener = FakeUrlOpener::default();
        let (_tx, mut rx) = tokio::sync::mpsc::channel(1);
        let report = run_plan(&plan, &catalog, Platform::Mac, "run-2", deps(&process, &emitter, &opener), &mut rx).await;
        assert!(!report.success);
        assert!(report.failed_step.is_some());
        // rollback의 echo까지 3번 호출됐는지
        assert_eq!(process.calls().len(), 3);
        assert!(process.calls()[2].1.join(" ").contains("rollback"));
        assert!(matches!(emitter.events().last().unwrap().status, StepStatus::Done { success: false }));
    }

    #[tokio::test]
    async fn detect_failure_is_not_fatal() {
        let catalog = Catalog::load_dir(&Catalog::bundled_dir()).unwrap();
        let plan = build_plan(&catalog, "mock-prereq", Platform::Mac, Flow::Install, &[]).unwrap();
        // detect fail(미설치 의미) → install ok → verify ok
        let process = FakeProcessRunner::new(vec![fail(), ok(), ok()]);
        let emitter = CollectingEmitter::default();
        let opener = FakeUrlOpener::default();
        let (_tx, mut rx) = tokio::sync::mpsc::channel(1);
        let report = run_plan(&plan, &catalog, Platform::Mac, "run-3", deps(&process, &emitter, &opener), &mut rx).await;
        assert!(report.success);
    }

    #[tokio::test]
    async fn waiting_secret_then_resume() {
        let catalog = Catalog::load_dir(&Catalog::bundled_dir()).unwrap();
        // input_secret 스텝을 가진 임시 플랜을 직접 구성
        use crate::recipe::plan::{InstallPlan, PlannedStep, Section};
        use crate::recipe::schema::Step;
        let plan = InstallPlan {
            target_id: "mock-tool".into(),
            tool_order: vec!["mock-tool".into()],
            steps: vec![PlannedStep {
                recipe_id: "mock-tool".into(), recipe_name: "모의 도구".into(),
                section: Section::Auth,
                step: Step::InputSecret { friendly: "키를 넣어 주세요".into(), label: "api_key".into() },
            }],
        };
        let process = FakeProcessRunner::new(vec![]);
        let emitter = CollectingEmitter::default();
        let opener = FakeUrlOpener::default();
        let (tx, mut rx) = tokio::sync::mpsc::channel(1);
        tx.send(("api_key".to_string(), "sk-1".to_string())).await.unwrap();
        let report = run_plan(&plan, &catalog, Platform::Mac, "run-4", deps(&process, &emitter, &opener), &mut rx).await;
        assert!(report.success);
        assert!(emitter.events().iter().any(|e| matches!(&e.status, StepStatus::WaitingSecret { label } if label == "api_key")));
    }
}
```

- [ ] **Step 2: 테스트 실패 확인**

```bash
cd src-tauri && cargo test runner::step_runner
```

Expected: FAIL (events·step_runner 미정의).

- [ ] **Step 3: 최소 구현** — `src-tauri/src/runner/events.rs`:

```rust
use serde::Serialize;
use std::sync::Mutex;

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ProgressEvent {
    pub run_id: String,
    pub recipe_id: String,
    pub recipe_name: String,
    pub section: String,
    pub step_index: usize,
    pub total_steps: usize,
    pub friendly: String,
    pub status: StepStatus,
}

#[derive(Debug, Clone, Serialize)]
#[serde(tag = "kind", rename_all = "camelCase")]
pub enum StepStatus {
    Running,
    Succeeded,
    Failed { message: String },
    WaitingSecret { label: String },
    Done { success: bool },
}

pub trait ProgressEmitter: Send + Sync {
    fn progress(&self, ev: &ProgressEvent);
    fn log(&self, run_id: &str, line: &str);
}

#[derive(Default)]
pub struct CollectingEmitter {
    events: Mutex<Vec<ProgressEvent>>,
    logs: Mutex<Vec<String>>,
}

impl CollectingEmitter {
    pub fn events(&self) -> Vec<ProgressEvent> { self.events.lock().unwrap().clone() }
    pub fn logs(&self) -> Vec<String> { self.logs.lock().unwrap().clone() }
}

impl ProgressEmitter for CollectingEmitter {
    fn progress(&self, ev: &ProgressEvent) { self.events.lock().unwrap().push(ev.clone()); }
    fn log(&self, _run_id: &str, line: &str) { self.logs.lock().unwrap().push(line.to_string()); }
}
```

`src-tauri/src/runner/step_runner.rs`:

```rust
use tokio::sync::mpsc::Receiver;

use crate::recipe::loader::Catalog;
use crate::recipe::plan::{InstallPlan, PlannedStep, Section};
use crate::runner::events::{ProgressEmitter, ProgressEvent, StepStatus};
use crate::runner::process::ProcessRunner;
use crate::runner::secrets::SecretVault;
use crate::runner::{execute_step, StepOutcome, UrlOpener};

pub struct RunDeps<'a, P: ProcessRunner, E: ProgressEmitter, O: UrlOpener> {
    pub process: &'a P,
    pub emitter: &'a E,
    pub opener: &'a O,
    pub vault: SecretVault,
}

pub struct RunReport {
    pub success: bool,
    pub failed_step: Option<ProgressEvent>,
}

pub async fn run_plan<P: ProcessRunner, E: ProgressEmitter, O: UrlOpener>(
    plan: &InstallPlan,
    catalog: &Catalog,
    platform: Platform,
    run_id: &str,
    mut deps: RunDeps<'_, P, E, O>,
    secret_rx: &mut Receiver<(String, String)>,
) -> RunReport {
    let total = plan.steps.len();
    for (i, planned) in plan.steps.iter().enumerate() {
        let ev = |status: StepStatus| ProgressEvent {
            run_id: run_id.to_string(),
            recipe_id: planned.recipe_id.clone(),
            recipe_name: planned.recipe_name.clone(),
            section: planned.section.as_str().to_string(),
            step_index: i,
            total_steps: total,
            friendly: planned.step.friendly().to_string(),
            status,
        };
        deps.emitter.progress(&ev(StepStatus::Running));
        loop {
            let outcome = execute_step(&planned.step, deps.process, &deps.vault, deps.opener).await;
            match outcome {
                StepOutcome::Success { log } => {
                    deps.emitter.log(run_id, &log);
                    deps.emitter.progress(&ev(StepStatus::Succeeded));
                    break;
                }
                StepOutcome::Unsupported => {
                    // M2에서 미배선 스텝(download_run·pty_session)은 실실행 경로에 오면 실패로 처리
                    let failed = ev(StepStatus::Failed {
                        message: "이 단계는 아직 준비 중이에요.".into(),
                    });
                    deps.emitter.progress(&failed);
                    rollback(planned, catalog, run_id, &deps).await;
                    deps.emitter.progress(&ev(StepStatus::Done { success: false }));
                    return RunReport { success: false, failed_step: Some(failed) };
                }
                StepOutcome::NeedsSecret { label, friendly: _ } => {
                    deps.emitter.progress(&ev(StepStatus::WaitingSecret { label: label.clone() }));
                    match secret_rx.recv().await {
                        Some((l, v)) => { deps.vault.insert(&l, &v); continue; }
                        None => {
                            let failed = ev(StepStatus::Failed { message: "입력이 취소됐어요.".into() });
                            deps.emitter.progress(&failed);
                            deps.emitter.progress(&ev(StepStatus::Done { success: false }));
                            return RunReport { success: false, failed_step: Some(failed) };
                        }
                    }
                }
                StepOutcome::Failure { message, log } => {
                    deps.emitter.log(run_id, &log);
                    if matches!(planned.section, Section::Detect) {
                        // detect 실패 = 미설치. 계속 진행
                        deps.emitter.log(run_id, "설치가 필요해 보여요. 계속 진행할게요.");
                        deps.emitter.progress(&ev(StepStatus::Succeeded));
                        break;
                    }
                    let failed = ev(StepStatus::Failed { message });
                    deps.emitter.progress(&failed);
                    rollback(planned, catalog, run_id, &deps).await;
                    deps.emitter.progress(&ev(StepStatus::Done { success: false }));
                    return RunReport { success: false, failed_step: Some(failed) };
                }
            }
        }
    }
    deps.emitter.progress(&ProgressEvent {
        run_id: run_id.to_string(),
        recipe_id: plan.target_id.clone(),
        recipe_name: String::new(),
        section: "done".into(),
        step_index: total,
        total_steps: total,
        friendly: "모두 끝났어요".into(),
        status: StepStatus::Done { success: true },
    });
    RunReport { success: true, failed_step: None }
}

/// 실패한 레시피의 rollback 섹션을 best-effort 실행 (결과는 log로만).
/// 플랜과 같은 platform 인자를 쓴다 — 실행 OS 추측(Platform::current) 금지,
/// 그래야 어느 CI 러너에서든 양쪽 플랫폼 플랜을 테스트할 수 있다.
async fn rollback<P: ProcessRunner, E: ProgressEmitter, O: UrlOpener>(
    failed: &PlannedStep, catalog: &Catalog, platform: Platform,
    run_id: &str, deps: &RunDeps<'_, P, E, O>,
) {
    let Some(spec) = catalog.get(&failed.recipe_id).and_then(|r| r.platforms.get(platform)) else { return };
    for step in &spec.rollback {
        deps.emitter.log(run_id, &format!("정리 중: {}", step.friendly()));
        let _ = execute_step(step, deps.process, &deps.vault, deps.opener).await;
    }
}
```

파일 상단 use에 `use crate::recipe::schema::Platform;`을 추가하고, `run_plan` 본문의 `rollback(...)` 두 호출부는 `rollback(planned, catalog, platform, run_id, &deps).await`로 쓴다 (위 Step 1의 테스트 4건은 이미 `Platform::Mac`을 넘기는 형태다).

`src-tauri/src/runner/mod.rs`에 `pub mod events; pub mod step_runner;` 추가.

참고: `Done` 이벤트의 `step_index`는 total과 같다 (프론트 진행바는 `step_index/total_steps`로 계산하므로 완료 시 100%가 된다).

- [ ] **Step 4: 테스트 통과 확인**

```bash
cd src-tauri && cargo test runner::step_runner
```

Expected: PASS 4건 (기존 runner:: 테스트 포함 전부 GREEN).

- [ ] **Step 5: 커밋**

```bash
git add src-tauri
git commit -m "feat: 스텝 러너 (진행 이벤트 스트림, 비밀값 대기·재개, 실패 시 rollback)"
```

---

### Task 9: 드라이런 리포트 + 전 레시피 × 2 OS 검증 테스트 (CI의 심장)

**Files:**
- Create: `src-tauri/src/runner/dry_run.rs`
- Modify: `src-tauri/src/runner/mod.rs`

**Interfaces:**
- Consumes: `Catalog`·`build_plan`·`Flow`·`Platform`·`Section`(Task 4·5)
- Produces:
  - `runner::dry_run::DryRunStep { pub recipe_id: String, pub recipe_name: String, pub section: String, pub step_type: String, pub friendly: String }` (Serialize, camelCase)
  - `DryRunReport { pub target_id: String, pub platform: String, pub tool_order: Vec<String>, pub steps: Vec<DryRunStep> }` (Serialize)
  - `dry_run(catalog: &Catalog, target_id: &str, platform: Platform) -> Result<DryRunReport, EngineError>` — 실행 없이 플랜을 해석만 한다. 마법사 화면의 "몇 단계짜리인지" 미리보기와 CI 검증 둘 다 이걸 쓴다
  - **핵심 테스트 `all_bundled_recipes_dry_run_on_both_platforms`**: 번들 레시피 전부 × [Mac, Windows]로 dry_run이 성공하고, 스텝이 1개 이상이며, friendly 문구가 비어 있지 않고 em dash(—)를 포함하지 않음을 검증. 마일스톤 3에서 실물 레시피 11종이 들어오면 **이 테스트가 자동으로 11종 × 2 OS 검증이 된다** (스펙 8절)

- [ ] **Step 1: 실패 테스트 작성** — `src-tauri/src/runner/dry_run.rs` 하단:

```rust
#[cfg(test)]
mod tests {
    use super::*;
    use crate::recipe::loader::Catalog;
    use crate::recipe::schema::Platform;

    #[test]
    fn report_lists_steps_in_dependency_order() {
        let catalog = Catalog::load_dir(&Catalog::bundled_dir()).unwrap();
        let report = dry_run(&catalog, "mock-plugin", Platform::Mac).unwrap();
        assert_eq!(report.tool_order, vec!["mock-prereq", "mock-tool", "mock-plugin"]);
        assert_eq!(report.platform, "mac");
        assert!(report.steps.iter().all(|s| !s.friendly.is_empty()));
        assert_eq!(report.steps[0].step_type, "check_command");
    }

    #[test]
    fn all_bundled_recipes_dry_run_on_both_platforms() {
        let catalog = Catalog::load_dir(&Catalog::bundled_dir()).unwrap();
        assert!(!catalog.recipes.is_empty());
        for recipe in &catalog.recipes {
            for platform in [Platform::Mac, Platform::Windows] {
                let report = dry_run(&catalog, &recipe.id, platform)
                    .unwrap_or_else(|e| panic!("{} @ {:?}: {e}", recipe.id, platform));
                assert!(!report.steps.is_empty(), "{} @ {:?}: 스텝 0개", recipe.id, platform);
                for s in &report.steps {
                    assert!(!s.friendly.trim().is_empty(), "{}: friendly 빈 문구", recipe.id);
                    assert!(!s.friendly.contains('—'), "{}: 카피에 em dash 금지", recipe.id);
                }
            }
        }
    }
}
```

- [ ] **Step 2: 테스트 실패 확인**

```bash
cd src-tauri && cargo test runner::dry_run
```

Expected: FAIL (dry_run 미정의).

- [ ] **Step 3: 최소 구현** — `src-tauri/src/runner/dry_run.rs` 상단:

```rust
use serde::Serialize;

use crate::error::EngineError;
use crate::recipe::loader::Catalog;
use crate::recipe::plan::{build_plan, Flow};
use crate::recipe::schema::Platform;

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DryRunStep {
    pub recipe_id: String,
    pub recipe_name: String,
    pub section: String,
    pub step_type: String,
    pub friendly: String,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DryRunReport {
    pub target_id: String,
    pub platform: String,
    pub tool_order: Vec<String>,
    pub steps: Vec<DryRunStep>,
}

pub fn dry_run(catalog: &Catalog, target_id: &str, platform: Platform) -> Result<DryRunReport, EngineError> {
    let plan = build_plan(catalog, target_id, platform, Flow::Install, &[])?;
    Ok(DryRunReport {
        target_id: plan.target_id.clone(),
        platform: platform.as_str().to_string(),
        tool_order: plan.tool_order.clone(),
        steps: plan.steps.iter().map(|p| DryRunStep {
            recipe_id: p.recipe_id.clone(),
            recipe_name: p.recipe_name.clone(),
            section: p.section.as_str().to_string(),
            step_type: p.step.type_name().to_string(),
            friendly: p.step.friendly().to_string(),
        }).collect(),
    })
}
```

`src-tauri/src/runner/mod.rs`에 `pub mod dry_run;` 추가.

- [ ] **Step 4: 테스트 통과 확인**

```bash
cd src-tauri && cargo test runner::dry_run
```

Expected: PASS 2건.

- [ ] **Step 5: 커밋**

```bash
git add src-tauri
git commit -m "feat: 드라이런 리포트 + 번들 레시피 전수 x 2 OS 자동 검증"
```

---

### Task 10: 상태 저장소 (installed.json)

**Files:**
- Create: `src-tauri/src/state.rs`
- Modify: `src-tauri/src/lib.rs` (`pub mod state;`)

**Interfaces:**
- Consumes: 없음 (독립 모듈)
- Produces:
  - `state::Installation { pub recipe_id: String, pub version: Option<String>, pub installed_at: u64, pub auth_done: bool, pub verified_at: Option<u64> }` (Serialize/Deserialize, camelCase; 시간은 unix 초 — 크레이트 추가 없이 `SystemTime`)
  - `state::AppState { pub installations: Vec<Installation> }` (Serialize/Deserialize)
  - `state::StateStore::new(path: PathBuf) -> StateStore`
  - `StateStore::load(&self) -> AppState` — 파일 없으면 기본값, 깨진 JSON이면 기본값 + `.bak`으로 원본 보존 (사용자 데이터라 조용히 버리지 않는다)
  - `StateStore::save(&self, state: &AppState) -> Result<(), EngineError>` — 임시 파일에 쓰고 rename (원자적 저장)
  - `StateStore::upsert(&self, item: Installation) -> Result<AppState, EngineError>` / `StateStore::remove(&self, recipe_id: &str) -> Result<AppState, EngineError>`
  - `state::now_unix() -> u64`

- [ ] **Step 1: 실패 테스트 작성** — `src-tauri/src/state.rs` 하단:

```rust
#[cfg(test)]
mod tests {
    use super::*;

    fn item(id: &str) -> Installation {
        Installation {
            recipe_id: id.into(), version: Some("1.0.0".into()),
            installed_at: now_unix(), auth_done: false, verified_at: None,
        }
    }

    #[test]
    fn load_missing_file_returns_default() {
        let dir = tempfile::tempdir().unwrap();
        let store = StateStore::new(dir.path().join("installed.json"));
        assert!(store.load().installations.is_empty());
    }

    #[test]
    fn upsert_then_reload_roundtrip() {
        let dir = tempfile::tempdir().unwrap();
        let store = StateStore::new(dir.path().join("installed.json"));
        store.upsert(item("mock-tool")).unwrap();
        let mut updated = item("mock-tool");
        updated.auth_done = true;
        let state = store.upsert(updated).unwrap();
        assert_eq!(state.installations.len(), 1); // 덮어쓰기지 중복 아님
        assert!(store.load().installations[0].auth_done);
    }

    #[test]
    fn remove_deletes_entry() {
        let dir = tempfile::tempdir().unwrap();
        let store = StateStore::new(dir.path().join("installed.json"));
        store.upsert(item("a")).unwrap();
        store.upsert(item("b")).unwrap();
        let state = store.remove("a").unwrap();
        assert_eq!(state.installations.len(), 1);
        assert_eq!(state.installations[0].recipe_id, "b");
    }

    #[test]
    fn corrupted_file_backs_up_and_resets() {
        let dir = tempfile::tempdir().unwrap();
        let path = dir.path().join("installed.json");
        std::fs::write(&path, "{ 깨진 json").unwrap();
        let store = StateStore::new(path.clone());
        assert!(store.load().installations.is_empty());
        assert!(path.with_extension("json.bak").exists());
    }
}
```

- [ ] **Step 2: 테스트 실패 확인**

```bash
cd src-tauri && cargo test state::
```

Expected: FAIL.

- [ ] **Step 3: 최소 구현** — `src-tauri/src/state.rs` 상단:

```rust
use std::path::PathBuf;

use serde::{Deserialize, Serialize};

use crate::error::EngineError;

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Installation {
    pub recipe_id: String,
    pub version: Option<String>,
    pub installed_at: u64,
    pub auth_done: bool,
    pub verified_at: Option<u64>,
}

#[derive(Debug, Clone, Default, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AppState {
    pub installations: Vec<Installation>,
}

pub fn now_unix() -> u64 {
    std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .map(|d| d.as_secs())
        .unwrap_or(0)
}

pub struct StateStore {
    path: PathBuf,
}

impl StateStore {
    pub fn new(path: PathBuf) -> Self { StateStore { path } }

    pub fn load(&self) -> AppState {
        let Ok(text) = std::fs::read_to_string(&self.path) else {
            return AppState::default();
        };
        match serde_json::from_str(&text) {
            Ok(state) => state,
            Err(_) => {
                // 깨진 파일은 백업해 두고 초기화 (사용자 데이터 조용히 삭제 금지)
                let _ = std::fs::rename(&self.path, self.path.with_extension("json.bak"));
                AppState::default()
            }
        }
    }

    pub fn save(&self, state: &AppState) -> Result<(), EngineError> {
        if let Some(parent) = self.path.parent() {
            std::fs::create_dir_all(parent)?;
        }
        let tmp = self.path.with_extension("json.tmp");
        std::fs::write(&tmp, serde_json::to_string_pretty(state).expect("직렬화 실패 불가"))?;
        std::fs::rename(&tmp, &self.path)?; // 원자적 교체
        Ok(())
    }

    pub fn upsert(&self, item: Installation) -> Result<AppState, EngineError> {
        let mut state = self.load();
        state.installations.retain(|i| i.recipe_id != item.recipe_id);
        state.installations.push(item);
        state.installations.sort_by(|a, b| a.recipe_id.cmp(&b.recipe_id));
        self.save(&state)?;
        Ok(state)
    }

    pub fn remove(&self, recipe_id: &str) -> Result<AppState, EngineError> {
        let mut state = self.load();
        state.installations.retain(|i| i.recipe_id != recipe_id);
        self.save(&state)?;
        Ok(state)
    }
}
```

- [ ] **Step 4: 테스트 통과 확인**

```bash
cd src-tauri && cargo test state::
```

Expected: PASS 4건.

- [ ] **Step 5: 커밋**

```bash
git add src-tauri
git commit -m "feat: 상태 저장소 (원자적 저장, 깨진 파일 백업 복구)"
```

---

### Task 11: 환경 진단기 (env prober)

**Files:**
- Create: `src-tauri/src/probe.rs`
- Modify: `src-tauri/src/lib.rs` (`pub mod probe;`)

**Interfaces:**
- Consumes: `ProcessRunner`(Task 6)
- Produces:
  - `probe::EnvCheck { pub id: String, pub label: String, pub found: bool, pub version: Option<String> }` (Serialize, camelCase) — label은 비개발자용 ("Node.js 준비물", "git 준비물")
  - `probe::EnvReport { pub os: String, pub os_label: String, pub arch: String, pub checks: Vec<EnvCheck>, pub missing_count: usize }` (Serialize)
  - `probe::probe_env(runner: &impl ProcessRunner) -> EnvReport` — os는 `std::env::consts::OS`→"mac"/"windows"/기타, os_label은 "맥"/"윈도우", arch는 `consts::ARCH`(“aarch64”=Apple Silicon 표기용). checks: node(`node --version`), git(`git --version`). 명령 실패/부재 = found:false. 환영 화면 문구("준비물 N개가 필요해요")의 데이터 소스가 missing_count

- [ ] **Step 1: 실패 테스트 작성** — `src-tauri/src/probe.rs` 하단:

```rust
#[cfg(test)]
mod tests {
    use super::*;
    use crate::runner::process::{FakeProcessRunner, ProcessOutput};

    fn ok(stdout: &str) -> std::io::Result<ProcessOutput> {
        Ok(ProcessOutput { exit_code: 0, stdout: stdout.into(), stderr: String::new() })
    }

    #[tokio::test]
    async fn reports_versions_when_tools_exist() {
        let runner = FakeProcessRunner::new(vec![ok("v24.16.0\n"), ok("git version 2.49.0\n")]);
        let report = probe_env(&runner).await;
        assert_eq!(report.checks.len(), 2);
        assert!(report.checks[0].found);
        assert_eq!(report.checks[0].version.as_deref(), Some("v24.16.0"));
        assert_eq!(report.missing_count, 0);
        assert!(!report.os_label.is_empty());
    }

    #[tokio::test]
    async fn missing_tool_counts() {
        let runner = FakeProcessRunner::new(vec![]); // 응답 없음 = 전부 실패
        let report = probe_env(&runner).await;
        assert_eq!(report.missing_count, 2);
        assert!(report.checks.iter().all(|c| !c.found && c.version.is_none()));
    }
}
```

- [ ] **Step 2: 테스트 실패 확인**

```bash
cd src-tauri && cargo test probe::
```

Expected: FAIL.

- [ ] **Step 3: 최소 구현** — `src-tauri/src/probe.rs` 상단:

```rust
use serde::Serialize;

use crate::runner::process::ProcessRunner;

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct EnvCheck {
    pub id: String,
    pub label: String,
    pub found: bool,
    pub version: Option<String>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct EnvReport {
    pub os: String,
    pub os_label: String,
    pub arch: String,
    pub checks: Vec<EnvCheck>,
    pub missing_count: usize,
}

pub async fn probe_env(runner: &impl ProcessRunner) -> EnvReport {
    let (os, os_label) = match std::env::consts::OS {
        "macos" => ("mac", "맥"),
        "windows" => ("windows", "윈도우"),
        other => (other, other),
    };
    let mut checks = Vec::new();
    for (id, label, command, args) in [
        ("node", "Node.js 준비물", "node", vec!["--version".to_string()]),
        ("git", "git 준비물", "git", vec!["--version".to_string()]),
    ] {
        let result = runner.run(command, &args).await;
        let (found, version) = match result {
            Ok(out) if out.exit_code == 0 => {
                (true, Some(out.stdout.trim().to_string()).filter(|s| !s.is_empty()))
            }
            _ => (false, None),
        };
        checks.push(EnvCheck { id: id.into(), label: label.into(), found, version });
    }
    let missing_count = checks.iter().filter(|c| !c.found).count();
    EnvReport {
        os: os.into(),
        os_label: os_label.into(),
        arch: std::env::consts::ARCH.into(),
        checks,
        missing_count,
    }
}
```

- [ ] **Step 4: 테스트 통과 확인**

```bash
cd src-tauri && cargo test probe::
```

Expected: PASS 2건.

- [ ] **Step 5: 커밋**

```bash
git add src-tauri
git commit -m "feat: 환경 진단기 (OS·아키텍처·node·git 감지)"
```

---

### Task 12: Tauri 커맨드·이벤트 배선 + capabilities + 프론트 IPC 타입

**Files:**
- Create: `src-tauri/src/commands.rs`, `src/lib/types.ts`, `src/lib/ipc.ts`
- Modify: `src-tauri/src/lib.rs`, `src-tauri/capabilities/default.json`

**Interfaces:**
- Consumes: 지금까지의 전 모듈
- Produces (프론트 화면 전부가 이것만 사용):
  - Tauri 커맨드 6개: `get_env_report() -> EnvReport` · `list_catalog() -> Vec<CatalogEntry>` · `get_dry_run(toolId: string) -> DryRunReport` · `start_flow(toolId: string, flow: "install"|"update"|"uninstall", demo: boolean) -> string(runId)` · `provide_secret(runId: string, label: string, value: string)` · `get_app_state() -> AppState`
  - `CatalogEntry { id, name, kind, easyDescription, pricing: { label, kind }, supportedModels: [{ modelLabel, accountLabel }], recommended, requires: string[], installed: boolean, installedVersion: string|null, missingRequires: string[] }` (Rust `commands::CatalogEntry` Serialize camelCase ↔ TS 동일 형태)
  - 이벤트 채널 2개: `"install://progress"`(payload=ProgressEvent) · `"install://log"`(payload=`{ runId: string, line: string }`)
  - `demo: true`(마법사 드라이런 데모)는 실행 없이 스텝마다 400ms 간격으로 Running→Succeeded를 흘리고 `Done { success: true }`로 끝난다. M2 화면 시연·QA용, 실물 레시피가 오면 `demo: false` 경로가 실설치
  - TS 타입 미러는 `src/lib/types.ts` 한 파일에만 둔다 (중복 정의 금지). `src/lib/ipc.ts`는 `invoke` 래퍼(`getEnvReport()`, `listCatalog()`, `getDryRun(toolId)`, `startFlow(toolId, flow, demo)`, `provideSecret(runId, label, value)`, `getAppState()`)와 `onProgress(runId, cb)`·`onLog(runId, cb)` 구독 함수(언리스너 반환)를 export

- [ ] **Step 1: 순수 매핑 로직부터 테스트** — `src-tauri/src/commands.rs` 하단:

```rust
#[cfg(test)]
mod tests {
    use super::*;
    use crate::recipe::loader::Catalog;
    use crate::state::{AppState, Installation};

    #[test]
    fn catalog_entries_carry_install_state_and_missing_requires() {
        let catalog = Catalog::load_dir(&Catalog::bundled_dir()).unwrap();
        let state = AppState {
            installations: vec![Installation {
                recipe_id: "mock-prereq".into(), version: Some("0.1.0".into()),
                installed_at: 1, auth_done: true, verified_at: Some(2),
            }],
        };
        let entries = to_catalog_entries(&catalog, &state);
        let prereq = entries.iter().find(|e| e.id == "mock-prereq").unwrap();
        assert!(prereq.installed);
        assert_eq!(prereq.installed_version.as_deref(), Some("0.1.0"));
        let plugin = entries.iter().find(|e| e.id == "mock-plugin").unwrap();
        assert!(!plugin.installed);
        assert_eq!(plugin.missing_requires, vec!["mock-tool"]); // mock-tool 미설치라 경고 배지감
    }
}
```

- [ ] **Step 2: 테스트 실패 확인**

```bash
cd src-tauri && cargo test commands::
```

Expected: FAIL.

- [ ] **Step 3: 구현** — `src-tauri/src/commands.rs`:

```rust
use std::collections::HashMap;
use std::sync::atomic::{AtomicU64, Ordering};
use std::sync::Mutex;

use serde::Serialize;
use tauri::{AppHandle, Emitter, Manager, State};
use tokio::sync::mpsc;

use crate::error::EngineError;
use crate::probe::{probe_env, EnvReport};
use crate::recipe::loader::Catalog;
use crate::recipe::plan::{build_plan, Flow};
use crate::recipe::schema::{Platform, ToolKind};
use crate::runner::dry_run::{dry_run, DryRunReport};
use crate::runner::events::{ProgressEmitter, ProgressEvent, StepStatus};
use crate::runner::process::TokioProcessRunner;
use crate::runner::secrets::SecretVault;
use crate::runner::step_runner::{run_plan, RunDeps};
use crate::runner::UrlOpener;
use crate::state::{now_unix, AppState, Installation, StateStore};

/// 앱 전역 상태 (lib.rs에서 .manage()로 등록)
pub struct AppContext {
    pub catalog: Catalog,
    pub store: StateStore,
    pub runs: Mutex<HashMap<String, mpsc::Sender<(String, String)>>>,
    pub run_seq: AtomicU64,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CatalogEntry {
    pub id: String,
    pub name: String,
    pub kind: String,
    pub easy_description: String,
    pub pricing: crate::recipe::schema::Pricing,
    pub supported_models: Vec<crate::recipe::schema::ModelBadge>,
    pub recommended: bool,
    pub requires: Vec<String>,
    pub installed: bool,
    pub installed_version: Option<String>,
    pub missing_requires: Vec<String>,
}

pub fn to_catalog_entries(catalog: &Catalog, state: &AppState) -> Vec<CatalogEntry> {
    let installed_ids: Vec<&str> = state.installations.iter().map(|i| i.recipe_id.as_str()).collect();
    catalog.recipes.iter().map(|r| {
        let installation = state.installations.iter().find(|i| i.recipe_id == r.id);
        CatalogEntry {
            id: r.id.clone(),
            name: r.name.clone(),
            kind: match r.kind {
                ToolKind::Harness => "harness", ToolKind::Plugin => "plugin",
                ToolKind::Prerequisite => "prerequisite",
            }.to_string(),
            easy_description: r.easy_description.clone(),
            pricing: r.pricing.clone(),
            supported_models: r.supported_models.clone(),
            recommended: r.recommended,
            requires: r.requires.clone(),
            installed: installation.is_some(),
            installed_version: installation.and_then(|i| i.version.clone()),
            missing_requires: r.requires.iter()
                .filter(|id| !installed_ids.contains(&id.as_str()))
                .cloned().collect(),
        }
    }).collect()
}

fn current_platform() -> Result<Platform, String> {
    Platform::current().ok_or_else(|| "지원하지 않는 운영체제예요".to_string())
}

fn err_str(e: EngineError) -> String { e.to_string() }

struct TauriEmitter { app: AppHandle }

#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
struct LogPayload { run_id: String, line: String }

impl ProgressEmitter for TauriEmitter {
    fn progress(&self, ev: &ProgressEvent) {
        let _ = self.app.emit("install://progress", ev);
    }
    fn log(&self, run_id: &str, line: &str) {
        let _ = self.app.emit("install://log", &LogPayload {
            run_id: run_id.to_string(), line: line.to_string(),
        });
    }
}

struct PluginUrlOpener { app: AppHandle }

impl UrlOpener for PluginUrlOpener {
    fn open(&self, url: &str) -> Result<(), String> {
        tauri_plugin_opener::open_url(url, None::<String>).map_err(|e| e.to_string())
    }
}

#[tauri::command]
pub async fn get_env_report() -> EnvReport {
    probe_env(&TokioProcessRunner).await
}

#[tauri::command]
pub fn list_catalog(ctx: State<'_, AppContext>) -> Vec<CatalogEntry> {
    to_catalog_entries(&ctx.catalog, &ctx.store.load())
}

#[tauri::command]
pub fn get_dry_run(tool_id: String, ctx: State<'_, AppContext>) -> Result<DryRunReport, String> {
    let platform = current_platform()?;
    dry_run(&ctx.catalog, &tool_id, platform).map_err(err_str)
}

#[tauri::command]
pub fn get_app_state(ctx: State<'_, AppContext>) -> AppState {
    ctx.store.load()
}

#[tauri::command]
pub fn provide_secret(
    run_id: String, label: String, value: String, ctx: State<'_, AppContext>,
) -> Result<(), String> {
    let sender = ctx.runs.lock().unwrap().get(&run_id).cloned()
        .ok_or_else(|| "진행 중인 작업을 찾지 못했어요".to_string())?;
    sender.try_send((label, value)).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn start_flow(
    tool_id: String, flow: String, demo: bool,
    app: AppHandle, ctx: State<'_, AppContext>,
) -> Result<String, String> {
    let platform = current_platform()?;
    let flow = match flow.as_str() {
        "install" => Flow::Install,
        "update" => Flow::Update,
        "uninstall" => Flow::Uninstall,
        other => return Err(format!("모르는 작업이에요: {other}")),
    };
    let installed: Vec<String> = ctx.store.load().installations.iter()
        .map(|i| i.recipe_id.clone()).collect();
    let plan = build_plan(&ctx.catalog, &tool_id, platform, flow, &installed).map_err(err_str)?;

    let run_id = format!("run-{}", ctx.run_seq.fetch_add(1, Ordering::Relaxed));
    let (tx, mut rx) = mpsc::channel::<(String, String)>(4);
    ctx.runs.lock().unwrap().insert(run_id.clone(), tx);

    let catalog = ctx.catalog.clone();
    let store_path = ctx.store_path();
    let id_for_task = run_id.clone();
    tauri::async_runtime::spawn(async move {
        let emitter = TauriEmitter { app: app.clone() };
        let success = if demo {
            run_demo(&plan, &id_for_task, &emitter).await
        } else {
            let deps = RunDeps {
                process: &TokioProcessRunner,
                emitter: &emitter,
                opener: &PluginUrlOpener { app: app.clone() },
                vault: SecretVault::new(),
            };
            run_plan(&plan, &catalog, platform, &id_for_task, deps, &mut rx).await.success
        };
        if success && !demo {
            let store = StateStore::new(store_path);
            match flow {
                Flow::Install | Flow::Update => {
                    let _ = store.upsert(Installation {
                        recipe_id: plan.target_id.clone(), version: None,
                        installed_at: now_unix(), auth_done: true, verified_at: Some(now_unix()),
                    });
                    // 의존성으로 함께 설치된 도구들도 기록
                    for id in &plan.tool_order {
                        if id != &plan.target_id {
                            let _ = store.upsert(Installation {
                                recipe_id: id.clone(), version: None,
                                installed_at: now_unix(), auth_done: false, verified_at: Some(now_unix()),
                            });
                        }
                    }
                }
                Flow::Uninstall => { let _ = store.remove(&plan.target_id); }
            }
        }
        if let Some(ctx) = app.try_state::<AppContext>() {
            ctx.runs.lock().unwrap().remove(&id_for_task);
        }
    });
    Ok(run_id)
}

/// M2 시연용: 실행 없이 진행 이벤트만 스텝당 400ms 간격으로 흘린다
async fn run_demo(
    plan: &crate::recipe::plan::InstallPlan, run_id: &str, emitter: &impl ProgressEmitter,
) -> bool {
    let total = plan.steps.len();
    for (i, planned) in plan.steps.iter().enumerate() {
        let base = ProgressEvent {
            run_id: run_id.to_string(),
            recipe_id: planned.recipe_id.clone(),
            recipe_name: planned.recipe_name.clone(),
            section: planned.section.as_str().to_string(),
            step_index: i,
            total_steps: total,
            friendly: planned.step.friendly().to_string(),
            status: StepStatus::Running,
        };
        emitter.progress(&base);
        emitter.log(run_id, &format!("[시연] {}", planned.step.friendly()));
        tokio::time::sleep(std::time::Duration::from_millis(400)).await;
        emitter.progress(&ProgressEvent { status: StepStatus::Succeeded, ..base.clone() });
    }
    emitter.progress(&ProgressEvent {
        run_id: run_id.to_string(), recipe_id: plan.target_id.clone(),
        recipe_name: String::new(), section: "done".into(),
        step_index: total, total_steps: total,
        friendly: "모두 끝났어요".into(), status: StepStatus::Done { success: true },
    });
    true
}
```

`AppContext`에 `store_path()` 게터가 필요하므로 (spawn 안으로 StateStore를 새로 만들어 넘김 — StateStore는 Clone이 아니어도 됨):

```rust
impl AppContext {
    pub fn store_path(&self) -> std::path::PathBuf { self.store.path().to_path_buf() }
}
```

그리고 `StateStore`에 `pub fn path(&self) -> &std::path::Path { &self.path }` 게터 추가 (Task 10 파일).
`ProgressEvent`가 `..base.clone()` 구조 갱신을 쓰므로 `Clone` derive가 이미 있는지 확인 (Task 8에서 derive함).
`Catalog`는 `#[derive(Clone)]` 필요 (Task 4에서 derive함).

- [ ] **Step 4: lib.rs 배선** — `src-tauri/src/lib.rs`를 다음 형태로 (템플릿 greet 커맨드 삭제):

```rust
pub mod commands;
pub mod error;
pub mod probe;
pub mod recipe;
pub mod runner;
pub mod state;

use std::collections::HashMap;
use std::sync::atomic::AtomicU64;
use std::sync::Mutex;

use tauri::Manager;

use commands::AppContext;
use recipe::loader::Catalog;
use state::StateStore;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .setup(|app| {
            let catalog = Catalog::load_dir(&Catalog::bundled_dir())
                .expect("번들 레시피 로딩 실패");
            let data_dir = app.path().app_data_dir()?;
            let store = StateStore::new(data_dir.join("installed.json"));
            app.manage(AppContext {
                catalog,
                store,
                runs: Mutex::new(HashMap::new()),
                run_seq: AtomicU64::new(1),
            });
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            commands::get_env_report,
            commands::list_catalog,
            commands::get_dry_run,
            commands::get_app_state,
            commands::provide_secret,
            commands::start_flow,
        ])
        .run(tauri::generate_context!())
        .expect("이지 하네스 실행 실패");
}
```

`src-tauri/capabilities/default.json` (템플릿 파일 수정):

```json
{
  "$schema": "../gen/schemas/desktop-schema.json",
  "identifier": "default",
  "description": "메인 창 기본 권한",
  "windows": ["main"],
  "permissions": ["core:default", "opener:default"]
}
```

- [ ] **Step 5: 프론트 IPC 타입·래퍼** — `src/lib/types.ts`:

```ts
export type Platform = "mac" | "windows";
export type ToolKind = "harness" | "plugin" | "prerequisite";
export type FlowKind = "install" | "update" | "uninstall";

export interface Pricing { label: string; kind: "free" | "paid" | "freemium" }
export interface ModelBadge { modelLabel: string; accountLabel?: string | null }

export interface CatalogEntry {
  id: string; name: string; kind: ToolKind; easyDescription: string;
  pricing: Pricing; supportedModels: ModelBadge[]; recommended: boolean;
  requires: string[]; installed: boolean; installedVersion: string | null;
  missingRequires: string[];
}

export interface EnvCheck { id: string; label: string; found: boolean; version: string | null }
export interface EnvReport {
  os: string; osLabel: string; arch: string; checks: EnvCheck[]; missingCount: number;
}

export interface DryRunStep {
  recipeId: string; recipeName: string; section: string; stepType: string; friendly: string;
}
export interface DryRunReport {
  targetId: string; platform: string; toolOrder: string[]; steps: DryRunStep[];
}

export type StepStatus =
  | { kind: "running" }
  | { kind: "succeeded" }
  | { kind: "failed"; message: string }
  | { kind: "waitingSecret"; label: string }
  | { kind: "done"; success: boolean };

export interface ProgressEvent {
  runId: string; recipeId: string; recipeName: string; section: string;
  stepIndex: number; totalSteps: number; friendly: string; status: StepStatus;
}

export interface Installation {
  recipeId: string; version: string | null; installedAt: number;
  authDone: boolean; verifiedAt: number | null;
}
export interface AppState { installations: Installation[] }
```

`src/lib/ipc.ts`:

```ts
import { invoke } from "@tauri-apps/api/core";
import { listen, type UnlistenFn } from "@tauri-apps/api/event";
import type {
  AppState, CatalogEntry, DryRunReport, EnvReport, FlowKind, ProgressEvent,
} from "./types";

export const getEnvReport = () => invoke<EnvReport>("get_env_report");
export const listCatalog = () => invoke<CatalogEntry[]>("list_catalog");
export const getDryRun = (toolId: string) => invoke<DryRunReport>("get_dry_run", { toolId });
export const getAppState = () => invoke<AppState>("get_app_state");
export const provideSecret = (runId: string, label: string, value: string) =>
  invoke<void>("provide_secret", { runId, label, value });
export const startFlow = (toolId: string, flow: FlowKind, demo: boolean) =>
  invoke<string>("start_flow", { toolId, flow, demo });

export function onProgress(runId: string, cb: (ev: ProgressEvent) => void): Promise<UnlistenFn> {
  return listen<ProgressEvent>("install://progress", (e) => {
    if (e.payload.runId === runId) cb(e.payload);
  });
}

export function onLog(runId: string, cb: (line: string) => void): Promise<UnlistenFn> {
  return listen<{ runId: string; line: string }>("install://log", (e) => {
    if (e.payload.runId === runId) cb(e.payload.line);
  });
}
```

- [ ] **Step 6: 검증**

```bash
cd src-tauri && cargo test && cargo clippy -- -D warnings
cd .. && bun run build
bun run tauri dev
```

Expected: cargo 테스트 전부 PASS, clippy 경고 0, vite build 성공, 앱 창 정상 기동 (화면은 아직 템플릿).

주의: Rust 커맨드의 파라미터명은 snake_case(`tool_id`)지만 Tauri가 프론트 camelCase(`toolId`) 인자를 자동 매핑한다. `#[tauri::command]` 기본 동작이므로 별도 설정 불필요.

- [ ] **Step 7: 커밋**

```bash
git add -A
git commit -m "feat: Tauri 커맨드 6종 + 진행 이벤트 배선 + 프론트 IPC 타입 미러"
```

---

### Task 13: 프론트 테스트 셋업 + UI 킷 + HashRouter 라우팅 + AppShell

**Files:**
- Create: `vitest.config.ts`, `vitest.setup.ts`, `src/components/Buttons.tsx`, `src/components/Badge.tsx`, `src/components/MascotBubble.tsx`, `src/components/AppShell.tsx`, `src/screens/` 8개 파일(빈 뼈대), `src/assets/mascot.png`, `src/assets/logo-horizontal.png`
- Modify: `package.json`(scripts), `src/App.tsx`

**Interfaces:**
- Consumes: Task 2 토큰 유틸리티, Task 12 ipc(화면 뼈대에선 아직 미사용)
- Produces:
  - `<PrimaryButton onClick disabled>` — 골드 그라디언트(`bg-gold-gradient`)+`shadow-gold-button`, 화면당 1개 원칙 · `<SecondaryButton>` — card 배경+line 테두리 · `<DangerButton>` — 삭제 확인에만
  - `<Badge variant="model"|"account"|"pricing"|"recommended"|"warning">텍스트</Badge>` — design-system.md 배지 규칙 그대로
  - `<MascotBubble text>` — 마스코트 48px + 말풍선(radius 20px)
  - `<AppShell>` — 좌측 사이드바(로고 + 메뉴: 홈/하네스/플러그인 · 오픈소스/내 도구/설정, NavLink 활성 = goldTint 배경) + `<Outlet/>`
  - 라우팅(HashRouter): 사이드바 없는 풀스크린 = `/welcome` `/wizard/:toolId` `/auth/:toolId` `/success/:toolId`, AppShell 하위 = `/catalog` `/plugins` `/tools` `/settings`. index는 `/welcome`으로 Navigate
  - 테스트 명령: `bun run test` (vitest run)

- [ ] **Step 1: 의존성 설치 + 스크립트**

```bash
bun add react-router@^7.18.1
bun add -d vitest@^4.1.9 jsdom@^29.1.1 @testing-library/react@^16.3.2 @testing-library/dom@^10.4.1 @testing-library/jest-dom@^6.9.1
```

`package.json` scripts에 `"test": "vitest run", "test:watch": "vitest"` 추가.

- [ ] **Step 2: vitest 설정** — `vitest.config.ts`:

```ts
import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  test: {
    environment: "jsdom",
    setupFiles: ["./vitest.setup.ts"],
  },
});
```

`vitest.setup.ts` (Tauri 공식 mocking 문서의 WebCrypto 폴리필 포함):

```ts
import "@testing-library/jest-dom/vitest";
import { randomFillSync } from "node:crypto";

Object.defineProperty(window, "crypto", {
  value: { getRandomValues: (buffer: ArrayBufferView) => randomFillSync(buffer as never) },
});
```

- [ ] **Step 3: 마스코트 자산 복사**

```bash
cp design/final/logo-symbol.png src/assets/mascot.png
cp design/final/logo-horizontal.png src/assets/logo-horizontal.png
```

- [ ] **Step 4: 실패 테스트 작성** — `src/components/__tests__/uikit.test.tsx`:

```tsx
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { MemoryRouter } from "react-router";
import { PrimaryButton } from "../Buttons";
import { Badge } from "../Badge";
import { AppShell } from "../AppShell";

describe("UI 킷", () => {
  it("주 버튼은 골드 그라디언트와 클릭 핸들러를 가진다", () => {
    const onClick = vi.fn();
    render(<PrimaryButton onClick={onClick}>도구 고르러 가기</PrimaryButton>);
    const btn = screen.getByRole("button", { name: "도구 고르러 가기" });
    expect(btn.className).toContain("bg-gold-gradient");
    btn.click();
    expect(onClick).toHaveBeenCalledOnce();
  });

  it("배지는 변형별 스타일 클래스를 가진다", () => {
    render(<Badge variant="recommended">입문자 추천</Badge>);
    expect(screen.getByText("입문자 추천").className).toContain("bg-gold-gradient");
  });

  it("AppShell 사이드바에 메뉴 5개가 있다", () => {
    render(
      <MemoryRouter>
        <AppShell />
      </MemoryRouter>,
    );
    for (const label of ["홈", "하네스", "플러그인 · 오픈소스", "내 도구", "설정"]) {
      expect(screen.getByText(label)).toBeInTheDocument();
    }
  });
});
```

- [ ] **Step 5: 테스트 실패 확인**

```bash
bun run test
```

Expected: FAIL (컴포넌트 미존재).

- [ ] **Step 6: 구현** — `src/components/Buttons.tsx`:

```tsx
import type { ButtonHTMLAttributes } from "react";

type Props = ButtonHTMLAttributes<HTMLButtonElement>;

export function PrimaryButton({ className = "", ...rest }: Props) {
  return (
    <button
      className={`bg-gold-gradient text-txt-on-brand shadow-gold-button rounded-button px-6 py-3 font-bold disabled:opacity-50 ${className}`}
      {...rest}
    />
  );
}

export function SecondaryButton({ className = "", ...rest }: Props) {
  return (
    <button
      className={`bg-surface-card dark:bg-surface-card-dark border border-line dark:border-line-dark text-txt-primary dark:text-txt-primary-dark rounded-button px-5 py-2.5 font-semibold ${className}`}
      {...rest}
    />
  );
}

export function DangerButton({ className = "", ...rest }: Props) {
  return (
    <button
      className={`bg-status-error text-txt-on-brand rounded-button px-5 py-2.5 font-semibold ${className}`}
      {...rest}
    />
  );
}
```

`src/components/Badge.tsx`:

```tsx
import type { ReactNode } from "react";

const styles = {
  model: "bg-surface-gold-tint text-txt-primary",
  account: "border border-line text-txt-secondary",
  pricing: "bg-surface-card-hover text-status-success border border-line",
  recommended: "bg-gold-gradient text-txt-on-brand",
  warning: "border border-status-warning text-status-warning",
} as const;

export function Badge({ variant, children }: { variant: keyof typeof styles; children: ReactNode }) {
  return (
    <span className={`rounded-badge px-2.5 py-1 text-badge font-semibold ${styles[variant]}`}>
      {children}
    </span>
  );
}
```

`src/components/MascotBubble.tsx`:

```tsx
import mascot from "../assets/mascot.png";

export function MascotBubble({ text }: { text: string }) {
  return (
    <div className="flex items-center gap-3">
      <img src={mascot} alt="오공이" className="h-12 w-12 object-contain" />
      <div className="rounded-[20px] bg-surface-card dark:bg-surface-card-dark shadow-card px-4 py-3 text-body">
        {text}
      </div>
    </div>
  );
}
```

`src/components/AppShell.tsx`:

```tsx
import { NavLink, Outlet } from "react-router";
import mascot from "../assets/mascot.png";

const menu = [
  { to: "/welcome", label: "홈" },
  { to: "/catalog", label: "하네스" },
  { to: "/plugins", label: "플러그인 · 오픈소스" },
  { to: "/tools", label: "내 도구" },
  { to: "/settings", label: "설정" },
];

export function AppShell() {
  return (
    <div className="flex min-h-screen bg-surface-bg dark:bg-surface-bg-dark">
      <aside className="w-56 shrink-0 border-r border-line dark:border-line-dark bg-surface-card dark:bg-surface-card-dark px-3 py-5">
        <div className="mb-6 flex items-center gap-2 px-2">
          <img src={mascot} alt="" className="h-8 w-8 object-contain" />
          <span className="font-extrabold tracking-tight">이지 하네스</span>
        </div>
        <nav className="flex flex-col gap-1">
          {menu.map((m) => (
            <NavLink
              key={m.to}
              to={m.to}
              className={({ isActive }) =>
                `rounded-button px-3 py-2 text-body ${
                  isActive
                    ? "bg-surface-gold-tint font-bold text-txt-primary"
                    : "text-txt-secondary hover:bg-surface-card-hover dark:hover:bg-surface-card-hover-dark"
                }`
              }
            >
              {m.label}
            </NavLink>
          ))}
        </nav>
      </aside>
      <main className="min-w-0 flex-1 px-10 py-8">
        <Outlet />
      </main>
    </div>
  );
}
```

화면 8개 뼈대 (각각 `src/screens/<이름>.tsx`, 다음 태스크들에서 채움):

```tsx
// Welcome.tsx · Catalog.tsx · Wizard.tsx · Auth.tsx · Success.tsx · Dashboard.tsx · Plugins.tsx · Settings.tsx
// 예: Plugins.tsx (M2에선 자리만)
export function Plugins() {
  return (
    <div>
      <h1 className="text-title font-extrabold">플러그인 · 오픈소스</h1>
      <p className="mt-2 text-txt-secondary">다음 업데이트에서 열려요.</p>
    </div>
  );
}
```

(Settings.tsx도 동일 요령. Welcome 등 나머지는 우선 `<div />` 반환으로 컴파일만 되게.)

`src/App.tsx`:

```tsx
import { HashRouter, Navigate, Route, Routes } from "react-router";
import { AppShell } from "./components/AppShell";
import { Auth } from "./screens/Auth";
import { Catalog } from "./screens/Catalog";
import { Dashboard } from "./screens/Dashboard";
import { Plugins } from "./screens/Plugins";
import { Settings } from "./screens/Settings";
import { Success } from "./screens/Success";
import { Welcome } from "./screens/Welcome";
import { Wizard } from "./screens/Wizard";

export default function App() {
  return (
    <HashRouter>
      <Routes>
        <Route path="/" element={<Navigate to="/welcome" replace />} />
        <Route path="/welcome" element={<Welcome />} />
        <Route path="/wizard/:toolId" element={<Wizard />} />
        <Route path="/auth/:toolId" element={<Auth />} />
        <Route path="/success/:toolId" element={<Success />} />
        <Route element={<AppShell />}>
          <Route path="/catalog" element={<Catalog />} />
          <Route path="/plugins" element={<Plugins />} />
          <Route path="/tools" element={<Dashboard />} />
          <Route path="/settings" element={<Settings />} />
        </Route>
      </Routes>
    </HashRouter>
  );
}
```

- [ ] **Step 7: 테스트 통과 + 빌드 확인**

```bash
bun run test && bun run build
```

Expected: PASS 3건, 빌드 성공.

- [ ] **Step 8: 커밋**

```bash
git add -A
git commit -m "feat: UI 킷(버튼 위계·배지·말풍선) + HashRouter 라우팅 + AppShell 사이드바"
```

---

### Task 14: 환영 화면 + 카탈로그 화면

**Files:**
- Create: `src/components/ToolCard.tsx`, `src/screens/__tests__/welcome.test.tsx`, `src/components/__tests__/toolcard.test.tsx`
- Modify: `src/screens/Welcome.tsx`, `src/screens/Catalog.tsx`

**Interfaces:**
- Consumes: `getEnvReport`·`listCatalog`(Task 12 ipc), UI 킷(Task 13), 목업 `design/mockups/01-welcome.png`·`02-catalog.png`
- Produces:
  - `<ToolCard entry={CatalogEntry} onSelect={(id) => void}>` — 아이콘 자리(이니셜 타일 48px), 이름(subtitle/bold), 한 줄 설명, 배지 행(입문자 추천→모델→계정→요금제→선행 도구 경고), 설치됨이면 우상단 골드 체크 + "설치됨 · v버전" 캡션
  - Welcome: 마스코트 + "AI 도구, 3분이면 준비 끝나요"(display) + 부제 + "내 컴퓨터 점검 결과" 카드(EnvReport 렌더: OS 확인 줄 + 준비물 N개 줄, 진단만 하고 설치 안 함) + `도구 고르러 가기` 주버튼 → `/catalog`
  - Catalog: "어떤 AI 도구를 써볼까요?"(title) + 부제 + `kind === "harness"`만 카드 그리드(3열) + 하단 캡션("플러그인과 오픈소스는 왼쪽 메뉴에 따로 모아둬요"). 카드 클릭 → `/wizard/:toolId`

- [ ] **Step 1: 실패 테스트 작성** — `src/components/__tests__/toolcard.test.tsx`:

```tsx
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { ToolCard } from "../ToolCard";
import type { CatalogEntry } from "../../lib/types";

const entry: CatalogEntry = {
  id: "mock-tool", name: "모의 도구", kind: "harness",
  easyDescription: "설치 흐름을 시험하는 가짜 도구예요",
  pricing: { label: "무료", kind: "free" },
  supportedModels: [{ modelLabel: "Claude 모델", accountLabel: "Anthropic 계정" }],
  recommended: true, requires: [], installed: false, installedVersion: null,
  missingRequires: [],
};

describe("ToolCard", () => {
  it("이름·설명·배지를 그린다", () => {
    render(<ToolCard entry={entry} onSelect={() => {}} />);
    expect(screen.getByText("모의 도구")).toBeInTheDocument();
    expect(screen.getByText("입문자 추천")).toBeInTheDocument();
    expect(screen.getByText("Claude 모델")).toBeInTheDocument();
    expect(screen.getByText("Anthropic 계정")).toBeInTheDocument();
    expect(screen.getByText("무료")).toBeInTheDocument();
  });

  it("설치된 카드는 버전 캡션을 보여주고, 선행 도구가 빠졌으면 경고 배지", () => {
    render(<ToolCard entry={{ ...entry, installed: true, installedVersion: "1.2.3" }} onSelect={() => {}} />);
    expect(screen.getByText(/설치됨/)).toHaveTextContent("설치됨 · v1.2.3");
    render(<ToolCard entry={{ ...entry, missingRequires: ["codex"] }} onSelect={() => {}} />);
    expect(screen.getByText("codex 필요")).toBeInTheDocument();
  });

  it("클릭하면 onSelect에 id를 넘긴다", () => {
    const onSelect = vi.fn();
    render(<ToolCard entry={entry} onSelect={onSelect} />);
    screen.getByRole("button", { name: /모의 도구/ }).click();
    expect(onSelect).toHaveBeenCalledWith("mock-tool");
  });
});
```

`src/screens/__tests__/welcome.test.tsx` (mockIPC로 진단 결과 주입):

```tsx
import { render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { mockIPC, clearMocks } from "@tauri-apps/api/mocks";
import { MemoryRouter } from "react-router";
import { Welcome } from "../Welcome";

describe("환영 화면", () => {
  afterEach(() => clearMocks());

  it("진단 결과를 쉬운 말로 보여준다", async () => {
    mockIPC((cmd) => {
      if (cmd === "get_env_report") {
        return {
          os: "mac", osLabel: "맥", arch: "aarch64",
          checks: [
            { id: "node", label: "Node.js 준비물", found: true, version: "v24.16.0" },
            { id: "git", label: "git 준비물", found: false, version: null },
          ],
          missingCount: 1,
        };
      }
    });
    render(<MemoryRouter><Welcome /></MemoryRouter>);
    expect(await screen.findByText(/준비물 1개가 필요해요/)).toBeInTheDocument();
    expect(screen.getByText(/맥에서 사용할 수 있어요/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "도구 고르러 가기" })).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: 테스트 실패 확인**

```bash
bun run test
```

Expected: FAIL.

- [ ] **Step 3: 구현** — `src/components/ToolCard.tsx`:

```tsx
import { Badge } from "./Badge";
import type { CatalogEntry } from "../lib/types";

export function ToolCard({ entry, onSelect }: { entry: CatalogEntry; onSelect: (id: string) => void }) {
  return (
    <button
      type="button"
      onClick={() => onSelect(entry.id)}
      className="relative rounded-card bg-surface-card dark:bg-surface-card-dark shadow-card hover:shadow-card-hover hover:bg-surface-card-hover dark:hover:bg-surface-card-hover-dark border border-line dark:border-line-dark p-5 text-left transition-shadow"
    >
      {entry.installed && (
        <span className="absolute right-4 top-4 flex h-6 w-6 items-center justify-center rounded-full bg-gold-gradient text-txt-on-brand text-badge" aria-hidden>
          ✓
        </span>
      )}
      <span className="flex h-12 w-12 items-center justify-center rounded-[12px] bg-surface-gold-tint text-title font-extrabold text-txt-gold">
        {entry.name.charAt(0)}
      </span>
      <h3 className="mt-3 text-subtitle font-bold">{entry.name}</h3>
      <p className="mt-1 text-body text-txt-secondary dark:text-txt-secondary-dark">{entry.easyDescription}</p>
      <div className="mt-3 flex flex-wrap gap-1.5">
        {entry.recommended && <Badge variant="recommended">입문자 추천</Badge>}
        {entry.supportedModels.map((m) => (
          <span key={m.modelLabel} className="contents">
            <Badge variant="model">{m.modelLabel}</Badge>
            {m.accountLabel && <Badge variant="account">{m.accountLabel}</Badge>}
          </span>
        ))}
        <Badge variant="pricing">{entry.pricing.label}</Badge>
        {entry.missingRequires.map((id) => (
          <Badge key={id} variant="warning">{id} 필요</Badge>
        ))}
      </div>
      {entry.installed && (
        <p className="mt-3 text-caption text-txt-tertiary font-mono">
          설치됨 · v{entry.installedVersion ?? "?"}
        </p>
      )}
    </button>
  );
}
```

`src/screens/Welcome.tsx`:

```tsx
import { useEffect, useState } from "react";
import { useNavigate } from "react-router";
import { PrimaryButton } from "../components/Buttons";
import { getEnvReport } from "../lib/ipc";
import type { EnvReport } from "../lib/types";
import mascot from "../assets/mascot.png";

export function Welcome() {
  const [report, setReport] = useState<EnvReport | null>(null);
  const navigate = useNavigate();

  useEffect(() => {
    getEnvReport().then(setReport).catch(() => setReport(null));
  }, []);

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-surface-bg dark:bg-surface-bg-dark px-6 py-10">
      <img src={mascot} alt="근두운을 탄 오공이" className="h-40 w-40 object-contain" />
      <h1 className="mt-6 text-display font-extrabold">AI 도구, 3분이면 준비 끝나요</h1>
      <p className="mt-2 text-txt-secondary dark:text-txt-secondary-dark">
        어려운 설치는 오공이가 대신해요. 버튼만 눌러 주세요.
      </p>
      <section className="mt-8 w-full max-w-xl rounded-card border border-line dark:border-line-dark bg-surface-card dark:bg-surface-card-dark p-6 shadow-card">
        <h2 className="text-caption font-bold text-txt-secondary dark:text-txt-secondary-dark">내 컴퓨터 점검 결과</h2>
        {report ? (
          <ul className="mt-4 space-y-3">
            <li className="flex items-center gap-3">
              <span className="flex h-7 w-7 items-center justify-center rounded-full bg-surface-gold-tint text-status-success" aria-hidden>✓</span>
              <span className="font-bold">{report.osLabel}에서 사용할 수 있어요</span>
            </li>
            {report.missingCount === 0 ? (
              <li className="flex items-center gap-3">
                <span className="flex h-7 w-7 items-center justify-center rounded-full bg-surface-gold-tint text-status-success" aria-hidden>✓</span>
                <span className="font-bold">준비물도 모두 갖춰져 있어요</span>
              </li>
            ) : (
              <li className="flex items-start gap-3">
                <span className="flex h-7 w-7 items-center justify-center rounded-full bg-surface-gold-tint font-bold text-txt-gold" aria-hidden>
                  {report.missingCount}
                </span>
                <span>
                  <span className="font-bold">준비물 {report.missingCount}개가 필요해요</span>
                  <br />
                  <span className="text-caption text-txt-tertiary">
                    도구를 설치할 때 오공이가 알아서 챙겨요. 지금은 몰라도 돼요
                  </span>
                </span>
              </li>
            )}
          </ul>
        ) : (
          <p className="mt-4 text-txt-tertiary">점검 중이에요...</p>
        )}
      </section>
      <PrimaryButton className="mt-8" onClick={() => navigate("/catalog")}>
        도구 고르러 가기
      </PrimaryButton>
    </div>
  );
}
```

`src/screens/Catalog.tsx`:

```tsx
import { useEffect, useState } from "react";
import { useNavigate } from "react-router";
import { ToolCard } from "../components/ToolCard";
import { listCatalog } from "../lib/ipc";
import type { CatalogEntry } from "../lib/types";

export function Catalog() {
  const [entries, setEntries] = useState<CatalogEntry[]>([]);
  const navigate = useNavigate();

  useEffect(() => {
    listCatalog().then(setEntries).catch(() => setEntries([]));
  }, []);

  const harnesses = entries.filter((e) => e.kind === "harness");

  return (
    <div>
      <h1 className="text-title font-extrabold">어떤 AI 도구를 써볼까요?</h1>
      <p className="mt-1 text-txt-secondary dark:text-txt-secondary-dark">
        카드를 누르면 설치부터 로그인까지 오공이가 다 해줘요.
      </p>
      <div className="mt-6 grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
        {harnesses.map((e) => (
          <ToolCard key={e.id} entry={e} onSelect={(id) => navigate(`/wizard/${id}`)} />
        ))}
      </div>
      <p className="mt-6 text-caption text-txt-tertiary">
        플러그인과 오픈소스는 왼쪽 메뉴에 따로 모아둬요.
      </p>
    </div>
  );
}
```

- [ ] **Step 4: 테스트 통과 확인**

```bash
bun run test
```

Expected: PASS (신규 4건 포함 전부).

- [ ] **Step 5: 눈 확인**

```bash
bun run tauri dev
```

Expected: 환영 화면(마스코트+점검 카드) → "도구 고르러 가기" → 카탈로그에 모의 도구 카드 1장(하네스만). 목업 01·02와 구도 비교.

- [ ] **Step 6: 커밋**

```bash
git add -A
git commit -m "feat: 환영(환경 진단 연동)·카탈로그(하네스만, 배지 규칙) 화면"
```

---

### Task 15: 마법사 화면 (스텝퍼·진행바·로그·에러 패널) + 드라이런 데모 + 인증·성공 화면

**Files:**
- Create: `src/lib/runReducer.ts`, `src/components/WizardStepper.tsx`, `src/components/LogPanel.tsx`, `src/components/ErrorPanel.tsx`, `src/lib/__tests__/runReducer.test.ts`, `src/components/__tests__/wizard-parts.test.tsx`
- Modify: `src/screens/Wizard.tsx`, `src/screens/Auth.tsx`, `src/screens/Success.tsx`

**Interfaces:**
- Consumes: `getDryRun`·`startFlow`·`onProgress`·`onLog`·`provideSecret`(Task 12), UI 킷, 목업 03·04·05
- Produces:
  - `runReducer(state: RunState, ev: ProgressEvent): RunState` — 순수 함수. `RunState { totalSteps, stepIndex, friendly, percent(0~100), phase(1|2|3|4), logs: string[], error: { message, friendly } | null, waitingSecret: string | null, done: boolean, success: boolean }`
  - UI 4단계 매핑(목업 03의 상단 스텝퍼): `section === "detect"` → 1 "컴퓨터 점검" · `recipeId !== targetId` → 2 "준비물 설치" · target의 `install` → 3 "본체 설치" · `auth`/`verify` → 4 "마무리"
  - `<WizardStepper current={1|2|3|4} toolName>` — 4단계 라벨: 컴퓨터 점검 / 준비물 설치 / {toolName} 설치 / 마무리, 완료 단계는 체크
  - `<LogPanel lines visible>` — mono 폰트, `bg-surface-card-dark` 고정(다크 배경), "자세한 과정 보기" 토글의 대상
  - `<ErrorPanel message friendly onRetry onCopyLog>` — 쉬운 말 요약 + 해결 제안 + [다시 시도] 주버튼 + [자세한 로그 복사] 보조버튼. 마스코트 소형 좌측. 빨간 배경 금지(테두리·아이콘만 error 색)
  - Wizard 화면: 마운트 시 `getDryRun(toolId)`로 총 단계 미리보기 → `startFlow(toolId, "install", true)`(**M2는 데모 모드 고정**) → 이벤트 구독으로 진행 렌더. 완료 시 `/success/:toolId` 이동. 실패 시 ErrorPanel
  - Auth 화면(뼈대): 레시피 auth.guide 3줄을 숫자 카드 3장으로 + "로그인 시작" 주버튼(M2는 `/success`로 이동만) — 목업 04 구도
  - Success 화면: 마스코트 대형 + 골드 컨페티 점(CSS) + "{도구 이름} 준비 완료!"(display) + "방금 첫 인사까지 나눠봤어요. 이제 뭐든 시켜보세요." + [바로 시작하기] + 하단 골드 라인+EASY HARNESS 워드마크 — 목업 05 구도

- [ ] **Step 1: 실패 테스트 작성** — `src/lib/__tests__/runReducer.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { initialRunState, runReducer } from "../runReducer";
import type { ProgressEvent } from "../types";

const ev = (over: Partial<ProgressEvent>): ProgressEvent => ({
  runId: "r", recipeId: "mock-tool", recipeName: "모의 도구", section: "install",
  stepIndex: 0, totalSteps: 4, friendly: "설치 중", status: { kind: "running" },
  ...over,
});

describe("runReducer", () => {
  it("running 이벤트가 문구·퍼센트·페이즈를 갱신한다", () => {
    let s = initialRunState("mock-tool");
    s = runReducer(s, ev({ section: "detect", stepIndex: 0 }));
    expect(s.phase).toBe(1);
    s = runReducer(s, ev({ recipeId: "mock-prereq", stepIndex: 1 }));
    expect(s.phase).toBe(2); // 다른 레시피 = 준비물
    s = runReducer(s, ev({ stepIndex: 2 }));
    expect(s.phase).toBe(3);
    expect(s.friendly).toBe("설치 중");
    expect(s.percent).toBe(50); // 2/4
  });

  it("failed는 error를, done은 완료를 기록한다", () => {
    let s = initialRunState("mock-tool");
    s = runReducer(s, ev({ status: { kind: "failed", message: "이 단계가 잘 끝나지 않았어요. 다시 시도해 볼까요?" } }));
    expect(s.error?.message).toContain("다시 시도");
    s = runReducer(initialRunState("mock-tool"), ev({ stepIndex: 4, status: { kind: "done", success: true } }));
    expect(s.done).toBe(true);
    expect(s.success).toBe(true);
    expect(s.percent).toBe(100);
  });

  it("waitingSecret 라벨을 노출한다", () => {
    const s = runReducer(initialRunState("mock-tool"), ev({ status: { kind: "waitingSecret", label: "api_key" } }));
    expect(s.waitingSecret).toBe("api_key");
  });
});
```

`src/components/__tests__/wizard-parts.test.tsx`:

```tsx
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { WizardStepper } from "../WizardStepper";
import { ErrorPanel } from "../ErrorPanel";

describe("마법사 부품", () => {
  it("스텝퍼는 4단계와 현재 단계를 표시한다", () => {
    render(<WizardStepper current={2} toolName="모의 도구" />);
    for (const label of ["컴퓨터 점검", "준비물 설치", "모의 도구 설치", "마무리"]) {
      expect(screen.getByText(label)).toBeInTheDocument();
    }
    expect(screen.getByText("준비물 설치").className).toContain("font-bold");
  });

  it("에러 패널은 다시 시도 버튼을 부른다", () => {
    const onRetry = vi.fn();
    render(
      <ErrorPanel
        message="이 단계가 잘 끝나지 않았어요. 다시 시도해 볼까요?"
        friendly="지금 모의 도구를 설치하고 있어요"
        onRetry={onRetry}
        onCopyLog={() => {}}
      />,
    );
    screen.getByRole("button", { name: "다시 시도" }).click();
    expect(onRetry).toHaveBeenCalledOnce();
  });
});
```

- [ ] **Step 2: 테스트 실패 확인**

```bash
bun run test
```

Expected: FAIL.

- [ ] **Step 3: 구현** — `src/lib/runReducer.ts`:

```ts
import type { ProgressEvent } from "./types";

export interface RunState {
  targetId: string;
  totalSteps: number;
  stepIndex: number;
  friendly: string;
  percent: number;
  phase: 1 | 2 | 3 | 4;
  logs: string[];
  error: { message: string; friendly: string } | null;
  waitingSecret: string | null;
  done: boolean;
  success: boolean;
}

export function initialRunState(targetId: string): RunState {
  return {
    targetId, totalSteps: 0, stepIndex: 0, friendly: "준비하고 있어요",
    percent: 0, phase: 1, logs: [], error: null, waitingSecret: null,
    done: false, success: false,
  };
}

function phaseOf(ev: ProgressEvent, targetId: string): 1 | 2 | 3 | 4 {
  if (ev.section === "detect") return 1;
  if (ev.recipeId !== targetId) return 2;
  if (ev.section === "install") return 3;
  return 4; // auth · verify · done
}

export function runReducer(state: RunState, ev: ProgressEvent): RunState {
  const percent = ev.totalSteps === 0 ? 0 : Math.round((ev.stepIndex / ev.totalSteps) * 100);
  const base = {
    ...state,
    totalSteps: ev.totalSteps,
    stepIndex: ev.stepIndex,
    friendly: ev.friendly,
    percent,
    phase: phaseOf(ev, state.targetId),
  };
  switch (ev.status.kind) {
    case "running":
      return { ...base, waitingSecret: null };
    case "succeeded":
      return { ...base, percent: Math.round(((ev.stepIndex + 1) / ev.totalSteps) * 100) };
    case "failed":
      return { ...base, error: { message: ev.status.message, friendly: ev.friendly } };
    case "waitingSecret":
      return { ...base, waitingSecret: ev.status.label };
    case "done":
      return { ...base, percent: 100, done: true, success: ev.status.success };
  }
}

export function appendLog(state: RunState, line: string): RunState {
  return { ...state, logs: [...state.logs, line].slice(-500) };
}
```

`src/components/WizardStepper.tsx`:

```tsx
export function WizardStepper({ current, toolName }: { current: 1 | 2 | 3 | 4; toolName: string }) {
  const labels = ["컴퓨터 점검", "준비물 설치", `${toolName} 설치`, "마무리"];
  return (
    <ol className="flex items-center justify-center gap-3">
      {labels.map((label, i) => {
        const n = (i + 1) as 1 | 2 | 3 | 4;
        const done = n < current;
        const active = n === current;
        return (
          <li key={label} className="flex items-center gap-2">
            <span
              className={`flex h-7 w-7 items-center justify-center rounded-full text-badge font-bold ${
                done ? "bg-surface-gold-tint text-status-success"
                : active ? "bg-gold-gradient text-txt-on-brand"
                : "bg-surface-card-hover text-txt-tertiary"
              }`}
              aria-hidden
            >
              {done ? "✓" : n}
            </span>
            <span className={active ? "font-bold" : "text-txt-tertiary"}>{label}</span>
            {n < 4 && <span className="h-px w-10 bg-line dark:bg-line-dark" aria-hidden />}
          </li>
        );
      })}
    </ol>
  );
}
```

`src/components/LogPanel.tsx`:

```tsx
export function LogPanel({ lines, visible }: { lines: string[]; visible: boolean }) {
  if (!visible) return null;
  return (
    <pre className="mt-4 max-h-56 overflow-auto rounded-card bg-surface-card-dark p-4 font-mono text-caption text-txt-primary-dark">
      {lines.join("\n") || "아직 보여줄 과정이 없어요"}
    </pre>
  );
}
```

`src/components/ErrorPanel.tsx`:

```tsx
import { PrimaryButton, SecondaryButton } from "./Buttons";
import mascot from "../assets/mascot.png";

export function ErrorPanel({
  message, friendly, onRetry, onCopyLog,
}: {
  message: string; friendly: string; onRetry: () => void; onCopyLog: () => void;
}) {
  return (
    <div className="flex items-start gap-4 rounded-card border border-status-error/40 bg-surface-card dark:bg-surface-card-dark p-6 shadow-card">
      <img src={mascot} alt="" className="h-12 w-12 object-contain opacity-80" />
      <div className="min-w-0 flex-1">
        <h3 className="text-subtitle font-bold">멈춘 단계: {friendly}</h3>
        <p className="mt-1 text-txt-secondary dark:text-txt-secondary-dark">{message}</p>
        <div className="mt-4 flex gap-2">
          <PrimaryButton onClick={onRetry}>다시 시도</PrimaryButton>
          <SecondaryButton onClick={onCopyLog}>자세한 로그 복사</SecondaryButton>
        </div>
      </div>
    </div>
  );
}
```

`src/screens/Wizard.tsx`:

```tsx
import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router";
import { LogPanel } from "../components/LogPanel";
import { ErrorPanel } from "../components/ErrorPanel";
import { MascotBubble } from "../components/MascotBubble";
import { WizardStepper } from "../components/WizardStepper";
import { getDryRun, onLog, onProgress, startFlow } from "../lib/ipc";
import { appendLog, initialRunState, runReducer, type RunState } from "../lib/runReducer";

export function Wizard() {
  const { toolId = "" } = useParams();
  const navigate = useNavigate();
  const [state, setState] = useState<RunState>(() => initialRunState(toolId));
  const [toolName, setToolName] = useState(toolId);
  const [showLog, setShowLog] = useState(false);
  const started = useRef(false);

  const start = useCallback(async () => {
    setState(initialRunState(toolId));
    const preview = await getDryRun(toolId);
    const target = preview.steps.find((s) => s.recipeId === toolId);
    if (target) setToolName(target.recipeName);
    const runId = await startFlow(toolId, "install", true); // M2: 드라이런 데모 고정
    const unProgress = await onProgress(runId, (ev) => setState((s) => runReducer(s, ev)));
    const unLog = await onLog(runId, (line) => setState((s) => appendLog(s, line)));
    return () => { unProgress(); unLog(); };
  }, [toolId]);

  useEffect(() => {
    if (started.current) return;
    started.current = true;
    const cleanup = start();
    return () => { cleanup.then((fn) => fn?.()); };
  }, [start]);

  useEffect(() => {
    if (state.done && state.success) navigate(`/success/${toolId}`);
  }, [state.done, state.success, navigate, toolId]);

  return (
    <div className="flex min-h-screen flex-col items-center bg-surface-bg dark:bg-surface-bg-dark px-8 py-12">
      <WizardStepper current={state.phase} toolName={toolName} />
      <div className="mt-12 w-full max-w-2xl text-center">
        {state.error ? (
          <ErrorPanel
            message={state.error.message}
            friendly={state.error.friendly}
            onRetry={() => { started.current = false; setState(initialRunState(toolId)); start(); }}
            onCopyLog={() => navigator.clipboard.writeText(state.logs.join("\n"))}
          />
        ) : (
          <>
            <h1 className="text-display font-extrabold">
              {state.friendly} <span className="text-txt-gold">({Math.min(state.phase, 4)}/4단계)</span>
            </h1>
            <div className="mt-8 h-2 w-full overflow-hidden rounded-badge bg-line dark:bg-line-dark">
              <div className="bg-gold-gradient h-full transition-all" style={{ width: `${state.percent}%` }} />
            </div>
            <div className="mt-2 flex items-center justify-between text-caption text-txt-tertiary">
              <span>{state.stepIndex}/{state.totalSteps || "?"} 단계</span>
              <button type="button" className="hover:text-txt-secondary" onClick={() => setShowLog((v) => !v)}>
                자세한 과정 보기
              </button>
            </div>
            <LogPanel lines={state.logs} visible={showLog} />
            <div className="mt-10 flex justify-center">
              <MascotBubble text="제가 근두운 타고 후딱 받아오는 중이에요. 커피 한 잔 하고 오세요!" />
            </div>
          </>
        )}
      </div>
    </div>
  );
}
```

`src/screens/Auth.tsx` (뼈대, 목업 04 구도):

```tsx
import { useNavigate, useParams } from "react-router";
import { PrimaryButton } from "../components/Buttons";

const guide = [
  "아래 버튼을 누르면 인터넷 창이 열려요",
  "쓰던 계정으로 로그인하세요",
  "허용 버튼만 누르면 끝나요",
];

export function Auth() {
  const { toolId = "" } = useParams();
  const navigate = useNavigate();
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-surface-bg dark:bg-surface-bg-dark px-8">
      <h1 className="text-display font-extrabold">딱 한 번, 로그인만 하면 돼요</h1>
      <p className="mt-2 text-txt-secondary dark:text-txt-secondary-dark">
        설치는 끝났어요! 이제 계정을 연결해 줄 차례예요.
      </p>
      <div className="mt-10 grid w-full max-w-4xl grid-cols-1 gap-4 md:grid-cols-3">
        {guide.map((text, i) => (
          <div key={text} className="rounded-card border border-line dark:border-line-dark bg-surface-card dark:bg-surface-card-dark p-6 shadow-card">
            <span className="flex h-8 w-8 items-center justify-center rounded-full bg-surface-gold-tint font-bold text-txt-gold">{i + 1}</span>
            <p className="mt-3 font-bold">{text}</p>
          </div>
        ))}
      </div>
      <PrimaryButton className="mt-10" onClick={() => navigate(`/success/${toolId}`)}>
        로그인 시작
      </PrimaryButton>
      <button type="button" className="mt-3 text-caption text-txt-tertiary hover:text-txt-secondary">
        로그인 창이 안 뜨나요?
      </button>
    </div>
  );
}
```

(M2에서 auth.guide는 위 고정 문구. 레시피의 guide 배열 연동은 마법사가 실설치 모드가 되는 마일스톤 3에서.)

`src/screens/Success.tsx` (목업 05: 컨페티 점 + 워드마크 프레임):

```tsx
import { useNavigate, useParams } from "react-router";
import { PrimaryButton } from "../components/Buttons";
import mascot from "../assets/mascot.png";

const dots = [
  "left-[18%] top-[22%] bg-line-gold", "right-[20%] top-[18%] bg-line-gold",
  "left-[28%] top-[55%] bg-cloud-mint", "right-[22%] top-[42%] bg-cloud-deep",
  "left-[15%] bottom-[28%] bg-cloud-mint", "right-[16%] bottom-[34%] bg-line-gold",
];

export function Success() {
  const { toolId = "" } = useParams();
  const navigate = useNavigate();
  return (
    <div className="relative flex min-h-screen flex-col items-center justify-center overflow-hidden bg-surface-bg dark:bg-surface-bg-dark px-8">
      {dots.map((cls) => (
        <span key={cls} className={`absolute h-2 w-2 rounded-full ${cls}`} aria-hidden />
      ))}
      <img src={mascot} alt="근두운을 탄 오공이" className="h-52 w-52 object-contain" />
      <h1 className="mt-8 text-display font-extrabold">{toolId} 준비 완료!</h1>
      <p className="mt-2 text-txt-secondary dark:text-txt-secondary-dark">
        방금 첫 인사까지 나눠봤어요. 이제 뭐든 시켜보세요.
      </p>
      <PrimaryButton className="mt-8" onClick={() => navigate("/tools")}>바로 시작하기</PrimaryButton>
      <footer className="absolute bottom-10 flex flex-col items-center gap-2">
        <span className="bg-gold-gradient h-1 w-11 rounded-badge" aria-hidden />
        <span className="text-caption font-bold tracking-[0.42em] text-[#B9891F]">EASY HARNESS</span>
      </footer>
    </div>
  );
}
```

(Success의 제목은 M2에선 toolId 표기. 도구 표시명 연동은 대시보드처럼 `listCatalog`에서 찾아 쓰는 걸로 마일스톤 3에서 다듬는다.)

- [ ] **Step 4: 테스트 통과 확인**

```bash
bun run test
```

Expected: PASS (신규 5건 포함 전부).

- [ ] **Step 5: 데모 눈 확인 (이 마일스톤의 관문)**

```bash
bun run tauri dev
```

카탈로그 → 모의 도구 카드 클릭 → 마법사: 스텝퍼가 1→2→3→4로 이동, 골드 진행바 채워짐, "자세한 과정 보기" 토글에 [시연] 로그, 완료 시 성공 화면(컨페티+워드마크)으로 자동 이동. 목업 03·05와 구도 비교.

- [ ] **Step 6: 커밋**

```bash
git add -A
git commit -m "feat: 마법사(스텝퍼·진행바·로그·에러 패널) + 드라이런 데모 관통 + 인증·성공 화면"
```

---

### Task 16: 대시보드(내 도구) + CI 워크플로 + 마무리

**Files:**
- Create: `.github/workflows/ci.yml`, `src/screens/__tests__/dashboard.test.tsx`
- Modify: `src/screens/Dashboard.tsx`, `HANDOFF.md`

**Interfaces:**
- Consumes: `getAppState`·`listCatalog`·`startFlow`(Task 12), UI 킷, 목업 06
- Produces:
  - Dashboard: "내 도구" 제목 + "설치한 도구는 N개예요..." 부제 + 설치 목록(이니셜 타일, 이름, `v버전` mono, 상태 "최신 상태예요" 캡션, [삭제] 텍스트 버튼 → 확인 후 `startFlow(id, "uninstall", true)`) + 비었을 때 "아직 설치한 도구가 없어요" + [도구 고르러 가기]. 앱 업데이트 배너(골드 틴트)는 M2에선 정적 자리만(업데이터는 M5)
  - CI: push·PR마다 ① rust job(macos-latest·windows-latest 매트릭스: fmt·clippy·test — Task 9 드라이런 전수 검증 포함) ② front job(ubuntu: bun test·build)

- [ ] **Step 1: 실패 테스트 작성** — `src/screens/__tests__/dashboard.test.tsx`:

```tsx
import { render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { clearMocks, mockIPC } from "@tauri-apps/api/mocks";
import { MemoryRouter } from "react-router";
import { Dashboard } from "../Dashboard";

describe("내 도구", () => {
  afterEach(() => clearMocks());

  it("설치 목록과 버전을 보여준다", async () => {
    mockIPC((cmd) => {
      if (cmd === "get_app_state") {
        return { installations: [{ recipeId: "mock-tool", version: "1.2.3", installedAt: 1, authDone: true, verifiedAt: 2 }] };
      }
      if (cmd === "list_catalog") {
        return [{
          id: "mock-tool", name: "모의 도구", kind: "harness", easyDescription: "",
          pricing: { label: "무료", kind: "free" }, supportedModels: [], recommended: false,
          requires: [], installed: true, installedVersion: "1.2.3", missingRequires: [],
        }];
      }
    });
    render(<MemoryRouter><Dashboard /></MemoryRouter>);
    expect(await screen.findByText("모의 도구")).toBeInTheDocument();
    expect(screen.getByText("v1.2.3")).toBeInTheDocument();
    expect(screen.getByText(/설치한 도구는 1개예요/)).toBeInTheDocument();
  });

  it("빈 목록이면 카탈로그로 안내한다", async () => {
    mockIPC((cmd) => {
      if (cmd === "get_app_state") return { installations: [] };
      if (cmd === "list_catalog") return [];
    });
    render(<MemoryRouter><Dashboard /></MemoryRouter>);
    expect(await screen.findByText(/아직 설치한 도구가 없어요/)).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: 테스트 실패 확인**

```bash
bun run test
```

Expected: FAIL.

- [ ] **Step 3: 구현** — `src/screens/Dashboard.tsx`:

```tsx
import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router";
import { PrimaryButton } from "../components/Buttons";
import { getAppState, listCatalog, startFlow } from "../lib/ipc";
import type { AppState, CatalogEntry } from "../lib/types";

export function Dashboard() {
  const [state, setState] = useState<AppState | null>(null);
  const [catalog, setCatalog] = useState<CatalogEntry[]>([]);
  const navigate = useNavigate();

  const reload = useCallback(() => {
    getAppState().then(setState).catch(() => setState({ installations: [] }));
    listCatalog().then(setCatalog).catch(() => setCatalog([]));
  }, []);

  useEffect(reload, [reload]);

  const nameOf = (id: string) => catalog.find((c) => c.id === id)?.name ?? id;

  const uninstall = async (id: string) => {
    if (!window.confirm(`${nameOf(id)}을(를) 지울까요? 설정과 기록도 함께 정리돼요.`)) return;
    await startFlow(id, "uninstall", true); // M2: 데모 모드
    setTimeout(reload, 500);
  };

  if (!state) return null;
  const items = state.installations;

  return (
    <div>
      <h1 className="text-title font-extrabold">내 도구</h1>
      {items.length === 0 ? (
        <div className="mt-10 flex flex-col items-start gap-4">
          <p className="text-txt-secondary dark:text-txt-secondary-dark">
            아직 설치한 도구가 없어요. 첫 도구를 골라 볼까요?
          </p>
          <PrimaryButton onClick={() => navigate("/catalog")}>도구 고르러 가기</PrimaryButton>
        </div>
      ) : (
        <>
          <p className="mt-1 text-txt-secondary dark:text-txt-secondary-dark">
            설치한 도구는 {items.length}개예요. 오공이가 매일 새 버전이 있는지 확인해요.
          </p>
          <ul className="mt-6 divide-y divide-line dark:divide-line-dark rounded-card border border-line dark:border-line-dark bg-surface-card dark:bg-surface-card-dark shadow-card">
            {items.map((i) => (
              <li key={i.recipeId} className="flex items-center gap-4 px-5 py-4">
                <span className="flex h-11 w-11 items-center justify-center rounded-[12px] bg-surface-gold-tint font-extrabold text-txt-gold">
                  {nameOf(i.recipeId).charAt(0)}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="font-bold">{nameOf(i.recipeId)}</p>
                  <p className="font-mono text-caption text-txt-tertiary">v{i.version ?? "?"}</p>
                </div>
                <span className="text-caption font-semibold text-status-success">최신 상태예요</span>
                <button
                  type="button"
                  className="text-caption text-txt-tertiary hover:text-status-error"
                  onClick={() => uninstall(i.recipeId)}
                >
                  삭제
                </button>
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}
```

- [ ] **Step 4: CI 워크플로** — `.github/workflows/ci.yml` (액션 태그는 구현 시점에 최신 메이저 재확인):

```yaml
name: CI
on:
  push:
    branches: [main]
  pull_request:

jobs:
  rust:
    strategy:
      fail-fast: false
      matrix:
        os: [macos-latest, windows-latest]
    runs-on: ${{ matrix.os }}
    defaults:
      run:
        working-directory: src-tauri
    steps:
      - uses: actions/checkout@v4
      - uses: dtolnay/rust-toolchain@stable
        with:
          components: rustfmt, clippy
      - uses: Swatinem/rust-cache@v2
        with:
          workspaces: src-tauri
      - run: cargo fmt --check
      - run: cargo clippy -- -D warnings
      - run: cargo test

  front:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: oven-sh/setup-bun@v2
      - run: bun install --frozen-lockfile
      - run: bun run test
      - run: bun run build
```

rust job이 맥·윈도우 양쪽에서 돌므로 Task 9의 `all_bundled_recipes_dry_run_on_both_platforms`(레시피 전수 × 2 OS)와 실행기·러너 테스트가 실제 두 OS에서 검증된다.

- [ ] **Step 5: 전체 검증**

```bash
cd src-tauri && cargo test && cargo fmt --check && cargo clippy -- -D warnings
cd .. && bun run test && bun run build
bun run tauri dev
```

Expected: 전부 GREEN. 앱에서 환영→카탈로그→마법사(데모)→성공→내 도구 흐름 관통.

- [ ] **Step 6: HANDOFF.md 갱신 + 커밋 + 푸시**

`HANDOFF.md`를 "마일스톤 2 구현 완료, 다음: 마일스톤 3(하네스 6종 레시피, 라이브 검증 필수)"로 덮어쓰고:

```bash
git add -A
git commit -m "feat: 내 도구 대시보드 + CI(맥·윈도우 매트릭스, 드라이런 전수 검증)"
git push -u origin feature/m2-skeleton-engine
```

푸시 후 superpowers:finishing-a-development-branch 스킬로 머지/PR 결정.

---

## 계획 밖 참고 (마일스톤 3 예고)

- 실물 레시피 11종 작성 시 **각 도구 설치법·모델 목록 라이브 검증 필수** (스펙 9절)
- download_run 실행기(reqwest — 착수 시 버전 라이브 확인), pty_session 배선(tauri-plugin-pty 0.3.0, 2026-06-06 릴리스 — 착수 시 유지보수 상태 재확인), 레시피 원격 갱신 + ed25519 서명(ed25519-dalek 2.2.0 stable, 3.0은 rc — 착수 시 재확인)
- Success 화면 도구 표시명 연동, 마법사 실설치 모드 전환(`demo: false`), auth.guide 레시피 연동, 대시보드 업데이트 감지
- 진단 파일 내보내기(스펙 7절: 로그 zip + 비밀값 마스킹)와 흔한 실패 패턴 매칭 안내는 실설치가 생기는 마일스톤 3에서 (마스킹 기반은 이번 SecretVault::mask가 이미 깔아둠)

