# 마일스톤 3: 하네스 6종 실물 레시피 + 실설치 경로 구현 계획

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 하네스 6종(Claude Code, Codex, GajaeCode, OpenClaw, Hermes, OpenCode)의 실물 레시피(설치→인증→verify)와, 실설치에 필요한 엔진 이월 작업(download_run, PTY, 인증 UI, 실모드 전환, 서명·원격 갱신, 진단 zip)을 완성한다.

**Architecture:** M2에서 완성된 레시피 엔진·스텝 러너·드라이런 위에, (1) 미배선 스텝 실행기 2종(download_run은 reqwest 다운로더, pty_session은 portable-pty)을 붙이고, (2) 라이브 검증된 공식 설치·인증 절차를 레시피 JSON 6+2종으로 옮기며, (3) 마법사 UI를 demo:false 실모드로 전환한다. 레시피 번들에는 ed25519 서명 검증과 GitHub 원격 갱신 경로를 더한다.

**Tech Stack:** Tauri 2 (Rust) + React 19 + TypeScript + Vite + Tailwind 4. 신규 의존성(2026-07-05 crates.io/npm 라이브 확인): reqwest 0.13.4, portable-pty 0.9.0, ed25519-dalek 2.2.0, zip 8.6.0, @xterm/xterm 6.0.0.

## Global Constraints

- 사용자 노출 카피(레시피 friendly·guide, 화면 문구)는 전부 비개발자 눈높이 한국어. **em dash(—)와 이모지 금지** (드라이런 전수 테스트가 기계 검사).
- 레시피 `schemaVersion: 1` 유지. 스텝 variant 필드 추가는 허용(내부 태그드 enum이라 additive), 기존 필드 변경 금지.
- 비밀값은 화면·로그·진단 파일에 노출 금지. 모든 로그는 `SecretVault::mask` 경유. 앱은 키를 보관하지 않는다(도구 설정에 전달만).
- 검증 명령: `cargo test --manifest-path src-tauri/Cargo.toml`, `cargo clippy --manifest-path src-tauri/Cargo.toml --all-targets -- -D warnings`, `cargo fmt --manifest-path src-tauri/Cargo.toml --check`, `bun run test`, `bun run build`(tsc 포함).
- 커밋 메시지는 한국어 컨벤션(feat:/fix:/chore:), 본문 끝에 `Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>`.
- 이벤트 채널 이름 유지: `install://progress`, `install://log`. 새 채널은 `pty://data`, `catalog://updated`만 추가.
- TS 타입 미러는 `src/lib/types.ts` 단일 소스. Rust 쪽 serde 구조 변경 시 반드시 함께 갱신.
- 설치 명령·URL·모델 목록은 전부 2026-07-05 라이브 검증본(각 태스크에 출처 명시). 구현 시점에 재검증하지 말 것(레시피 원격 갱신이 이후 변경을 흡수한다).

## 파일 구조

```
src-tauri/
  Cargo.toml                          수정: reqwest·portable-pty·ed25519-dalek·zip 추가
  recipes/                            실물 레시피 8종 (mock 3종은 tests/fixtures로 이동)
    nodejs-lts.json  bun.json  claude-code.json  codex.json
    gajaecode.json  openclaw.json  hermes.json  opencode.json
  tests/fixtures/recipes/             mock-tool.json  mock-prereq.json  mock-plugin.json
  tests/real_recipes.rs               신규: 실물 레시피 전수 스펙 테스트
  src/
    lib.rs                            수정: 리소스 경로 로딩, PTY 상태, 신규 커맨드 등록
    commands.rs                       수정: RunDeps 배선, pty_input, export_diagnostics, get_dry_run auth 노출
    state.rs                          그대로
    recipe/
      schema.rs                       수정: DownloadRun에 command 필드
      loader.rs                       수정: fixture_dir, from_bundle
      signing.rs                      신규: ed25519 번들 검증
      remote.rs                       신규: 원격 갱신 fetch+캐시+폴백
    runner/
      mod.rs                          수정: execute_step에 downloader 배선
      download.rs                     신규: Downloader trait + ReqwestDownloader + FakeDownloader
      pty.rs                          신규: PtyRunner trait + PortablePtyRunner + FakePtyRunner
      step_runner.rs                  수정: RunDeps 확장, PtySession 분기
      secrets.rs                      수정: 긴 값 우선 마스킹
      events.rs                       수정: StepStatus::Terminal
      diagnostics.rs                  신규: 진단 zip 생성
  src/bin/sign_recipes.rs             신규: 레시피 번들 서명 도구 (개발자 전용)
src/
  lib/types.ts                        수정: terminal 상태, auth 정보 미러
  lib/ipc.ts                          수정: ptyInput, exportDiagnostics, onPtyData
  lib/runReducer.ts                   수정: 페이즈 역행 보정, terminal 상태
  components/SecretForm.tsx           신규: 비밀값 마스킹 입력 폼
  components/TerminalPanel.tsx        신규: xterm 터미널 + 한국어 도움말 패널
  components/AuthGuidePanel.tsx       신규: 인증 안내 카드 3장 (기존 Auth.tsx 대체)
  screens/Wizard.tsx                  수정: 실모드, 비밀값 폼, 터미널, 인증 가이드
  screens/Welcome.tsx  Catalog.tsx    수정: IPC 오류 상태 + 다시 시도
  screens/Settings.tsx                수정: 진단 파일 저장 버튼
  screens/Auth.tsx                    삭제 (Wizard 통합, App.tsx 라우트 제거)
```

## 실행 순서와 의존 관계

태스크 1~3은 독립(순서 무관). 태스크 4~5가 레시피 태스크 6~12의 기반. 태스크 13~16은 레시피가 있어야 의미가 있다. 태스크 17~19는 후반 독립 작업. 태스크 20이 최종 게이트.

## 범위·결정 노트 (라이브 검증 결과 반영)

- **공용 준비물은 Node.js LTS + Bun 2종.** git은 어느 하네스도 설치 필수가 아니라(Hermes는 설치 스크립트가 자동 해결, Claude Code에선 선택 사항) v1 레시피에서 제외. GajaeCode가 Node가 아니라 Bun(>= 1.3.14)을 요구하는 점이 라이브 검증의 발견.
- **하네스 6종의 공식 기본 설치는 전부 공식 설치 스크립트**(curl/PowerShell 한 줄) 또는 Bun 전역 설치다. Node용 npm 전역 설치를 기본으로 쓰는 곳은 OpenCode 윈도우 경로뿐.
- **인증은 6종 모두 대화형 터미널 또는 브라우저 OAuth가 공식 기본.** api_key 패턴(input_secret + SecretForm)은 엔진·UI를 완비하되(Task 4·13에서 테스트) v1 레시피에서는 쓰이지 않는다. M4 플러그인 레시피부터 실사용 예정.
- **detect 성공이어도 install은 재실행된다**(M2 엔진 동작). 6종 모두 공식 설치기가 재실행에 안전함을 확인했으므로 v1 수용.
- **Windows 절대 경로·명령 실검증은 마일스톤 6(윈도우 VM 스모크)에서.** 어긋나면 레시피 원격 갱신으로 수정.
- **Auth.tsx 단독 화면은 삭제하고 마법사에 통합**(인증 스텝이 설치 런 안에서 이벤트로 흐르므로).
- **레시피 원격 저장소**(`needslab-ai/easy-harness-recipes`)는 아직 없음. URL은 상수로 예약, 404면 조용히 번들 폴백 (저장소 생성은 M5 배포 파이프라인에서).
- 스펙 7절의 "stderr 패턴 매칭 맞춤 에러 안내"는 HANDOFF의 M3 이월 목록에 없어 이번 범위에서 제외 (M4+ 백로그, HANDOFF에 기록).

---

### Task 1: SecretVault 긴 값 우선 마스킹

겹치는 비밀값(한 비밀값이 다른 비밀값의 접두어)일 때 짧은 값이 먼저 치환되면 긴 값의 꼬리가 로그에 남는 부분 유출 버그를 고친다. HashMap 순회 순서가 비결정적이라 현재는 운에 따라 유출된다.

**Files:**
- Modify: `src-tauri/src/runner/secrets.rs`

**Interfaces:**
- Consumes: 없음 (독립)
- Produces: `SecretVault::mask(&self, text: &str) -> String` 시그니처 불변, 동작만 결정적으로.

- [ ] **Step 1: 실패하는 테스트 작성**

`src-tauri/src/runner/secrets.rs`의 tests 모듈에 추가:

```rust
#[test]
fn mask_replaces_longest_secret_first() {
    let mut vault = SecretVault::new();
    // 8개의 접두어 비밀값: 어느 하나라도 짧은 것이 먼저 치환되면 꼬리가 남는다
    let full = "abcdefgh";
    for len in 1..=full.len() {
        vault.insert(&format!("k{len}"), &full[..len]);
    }
    assert_eq!(vault.mask("token abcdefgh end"), "token ••• end");
}
```

- [ ] **Step 2: 실패 확인**

Run: `cargo test --manifest-path src-tauri/Cargo.toml mask_replaces_longest_secret_first`
Expected: FAIL (거의 확실히 `token •••bcdefgh end` 류의 꼬리 잔존. HashMap 순서상 8!분의 1 확률로 우연히 통과하면 한 번 더 실행해 실패를 확인)

- [ ] **Step 3: mask를 긴 값 우선으로 수정**

`secrets.rs`의 `mask`를 교체:

```rust
/// 로그·이벤트로 나가는 모든 문자열에 적용. 실값을 •••로.
/// 긴 값 먼저 치환한다. 짧은 비밀값이 긴 비밀값의 일부일 때
/// 짧은 것이 먼저 치환되면 긴 값의 나머지가 유출되기 때문.
pub fn mask(&self, text: &str) -> String {
    let mut out = text.to_string();
    let mut values: Vec<&String> = self.values.values().filter(|v| !v.is_empty()).collect();
    values.sort_by(|a, b| b.len().cmp(&a.len()).then_with(|| a.cmp(b)));
    for value in values {
        out = out.replace(value.as_str(), "•••");
    }
    out
}
```

- [ ] **Step 4: 통과 확인**

Run: `cargo test --manifest-path src-tauri/Cargo.toml secrets`
Expected: PASS (기존 `substitute_and_mask_roundtrip` 포함 전부)

- [ ] **Step 5: 커밋**

```bash
git add src-tauri/src/runner/secrets.rs
git commit -m "fix: SecretVault 마스킹을 긴 값 우선으로 (접두어 비밀값 부분 유출 방지, M2 이월)

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

### Task 2: runReducer 페이즈 역행 보정

의존성 설치(페이즈 2) 뒤에 대상 도구의 detect 이벤트가 오면 페이즈가 1로 되돌아가 스텝퍼가 뒤로 가는 문제를 고친다. 페이즈는 단조 증가해야 한다.

**Files:**
- Modify: `src/lib/runReducer.ts`
- Test: `src/lib/__tests__/runReducer.test.ts`

**Interfaces:**
- Consumes: 기존 `ev()` 테스트 헬퍼, `initialRunState`, `runReducer`
- Produces: `RunState.phase`가 한 런 안에서 절대 감소하지 않음. 시그니처 불변.

- [ ] **Step 1: 실패하는 테스트 작성**

`src/lib/__tests__/runReducer.test.ts`의 `describe("runReducer")` 안에 추가:

```ts
it("의존성 설치 후 대상 detect가 와도 페이즈가 뒤로 가지 않는다", () => {
  let s = initialRunState("mock-tool");
  s = runReducer(s, ev({ recipeId: "mock-prereq", section: "install", stepIndex: 1 }));
  expect(s.phase).toBe(2);
  s = runReducer(s, ev({ recipeId: "mock-tool", section: "detect", stepIndex: 2 }));
  expect(s.phase).toBe(2); // 버그 시 1로 후퇴
});
```

- [ ] **Step 2: 실패 확인**

Run: `bun run test -- runReducer`
Expected: FAIL, `expected 1 to be 2`

- [ ] **Step 3: 페이즈를 단조 증가로 보정**

`src/lib/runReducer.ts`의 `runReducer`에서 `base` 계산을 수정:

```ts
export function runReducer(state: RunState, ev: ProgressEvent): RunState {
  const percent = ev.totalSteps === 0 ? 0 : Math.round((ev.stepIndex / ev.totalSteps) * 100);
  const phase = Math.max(state.phase, phaseOf(ev, state.targetId)) as RunState["phase"];
  const base = {
    ...state,
    totalSteps: ev.totalSteps,
    stepIndex: ev.stepIndex,
    friendly: ev.friendly,
    percent,
    phase,
  };
  // ... switch 문은 그대로
```

- [ ] **Step 4: 통과 확인**

Run: `bun run test -- runReducer`
Expected: PASS (기존 "running 이벤트가 문구·퍼센트·페이즈를 갱신한다"는 단조 증가 순서라 그대로 통과)

- [ ] **Step 5: 커밋**

```bash
git add src/lib/runReducer.ts src/lib/__tests__/runReducer.test.ts
git commit -m "fix: 마법사 페이즈 역행 보정 (단조 증가, M2 이월)

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

### Task 3: Welcome·Catalog IPC 오류 상태와 다시 시도

지금은 IPC가 실패하면 Welcome이 "점검 중이에요..."에 영원히 머물고 Catalog는 빈 화면이 된다. 실패를 쉬운 말로 알리고 다시 시도 버튼을 준다.

**Files:**
- Modify: `src/screens/Welcome.tsx`, `src/screens/Catalog.tsx`
- Test: `src/screens/__tests__/welcome.test.tsx`

**Interfaces:**
- Consumes: `getEnvReport`, `listCatalog` (src/lib/ipc.ts, 변경 없음)
- Produces: 두 화면의 오류 상태 UI. 다른 태스크가 의존하지 않음.

- [ ] **Step 1: 실패하는 테스트 작성**

`src/screens/__tests__/welcome.test.tsx`에 추가 (기존 describe 안):

```tsx
it("진단 실패 시 안내와 다시 점검 버튼을 보여준다", async () => {
  let calls = 0;
  mockIPC((cmd) => {
    if (cmd === "get_env_report") {
      calls += 1;
      if (calls === 1) throw new Error("ipc down");
      return { os: "mac", osLabel: "맥", arch: "aarch64", checks: [], missingCount: 0 };
    }
  });
  render(<MemoryRouter><Welcome /></MemoryRouter>);
  expect(await screen.findByText(/점검이 잠깐 안 됐어요/)).toBeInTheDocument();
  screen.getByRole("button", { name: "다시 점검하기" }).click();
  expect(await screen.findByText(/준비물도 모두 갖춰져 있어요/)).toBeInTheDocument();
});
```

- [ ] **Step 2: 실패 확인**

Run: `bun run test -- welcome`
Expected: FAIL, `점검이 잠깐 안 됐어요` 텍스트 못 찾음

- [ ] **Step 3: Welcome에 오류 상태 구현**

`src/screens/Welcome.tsx`에서 로딩 로직과 점검 카드 분기를 교체:

```tsx
import { useCallback, useEffect, useState } from "react";
// (기존 import 유지)

export function Welcome() {
  const [report, setReport] = useState<EnvReport | null>(null);
  const [failed, setFailed] = useState(false);
  const navigate = useNavigate();

  const check = useCallback(() => {
    setFailed(false);
    setReport(null);
    getEnvReport().then(setReport).catch(() => setFailed(true));
  }, []);

  useEffect(check, [check]);
```

점검 카드의 `{report ? ( ... ) : ( ... )}` 분기를 3단으로:

```tsx
{report ? (
  /* 기존 성공 ul 그대로 */
) : failed ? (
  <div className="mt-4 flex flex-col items-start gap-3">
    <p className="font-bold">점검이 잠깐 안 됐어요</p>
    <p className="text-caption text-txt-tertiary">앱을 끄고 다시 켜도 좋고, 아래 버튼을 눌러도 돼요.</p>
    <button
      type="button"
      className="rounded-badge border border-line dark:border-line-dark px-4 py-2 font-bold hover:bg-surface-card-hover"
      onClick={check}
    >
      다시 점검하기
    </button>
  </div>
) : (
  <p className="mt-4 text-txt-tertiary">점검 중이에요...</p>
)}
```

- [ ] **Step 4: Catalog에 같은 패턴 구현**

`src/screens/Catalog.tsx`:

```tsx
import { useCallback, useEffect, useState } from "react";
// (기존 import 유지)

export function Catalog() {
  const [entries, setEntries] = useState<CatalogEntry[]>([]);
  const [failed, setFailed] = useState(false);
  const navigate = useNavigate();

  const load = useCallback(() => {
    setFailed(false);
    listCatalog().then(setEntries).catch(() => setFailed(true));
  }, []);

  useEffect(load, [load]);

  const harnesses = entries.filter((e) => e.kind === "harness");

  return (
    <div>
      <h1 className="text-title font-extrabold">어떤 AI 도구를 써볼까요?</h1>
      <p className="mt-1 text-txt-secondary dark:text-txt-secondary-dark">
        카드를 누르면 설치부터 로그인까지 오공이가 다 해줘요.
      </p>
      {failed ? (
        <div className="mt-6 flex flex-col items-start gap-3">
          <p className="font-bold">도구 목록을 가져오지 못했어요</p>
          <button
            type="button"
            className="rounded-badge border border-line dark:border-line-dark px-4 py-2 font-bold hover:bg-surface-card-hover"
            onClick={load}
          >
            다시 불러오기
          </button>
        </div>
      ) : (
        <div className="mt-6 grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          {harnesses.map((e) => (
            <ToolCard key={e.id} entry={e} onSelect={(id) => navigate(`/wizard/${id}`)} />
          ))}
        </div>
      )}
      <p className="mt-6 text-caption text-txt-tertiary">
        플러그인과 오픈소스는 왼쪽 메뉴에 따로 모아둬요.
      </p>
    </div>
  );
}
```

- [ ] **Step 5: 통과 확인**

Run: `bun run test`
Expected: PASS (전체 vitest GREEN)

- [ ] **Step 6: 커밋**

```bash
git add src/screens/Welcome.tsx src/screens/Catalog.tsx src/screens/__tests__/welcome.test.tsx
git commit -m "feat: 환영·카탈로그 IPC 오류 상태와 다시 시도 버튼 (M2 이월)

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

### Task 4: download_run 실행기 (reqwest 다운로더)

`download_run` 스텝을 실동작시킨다: URL에서 파일을 내려받아 임시 폴더에 저장한 뒤, 레시피가 지정한 명령으로 실행한다(`{{file}}` 자리에 내려받은 파일 경로). Node.js .pkg/.msi 같은 공식 인스톨러 실행이 목적.

의존성 결정(2026-07-05 crates.io 라이브 확인): reqwest 0.13.4 최신 stable. 0.13.0부터 기본 TLS가 rustls로 전환됐고, 스트리밍은 `stream` feature 필요. 이름 혼동을 피하려고 feature를 명시 고정한다.

**Files:**
- Modify: `src-tauri/Cargo.toml`, `src-tauri/src/recipe/schema.rs`, `src-tauri/src/runner/mod.rs`, `src-tauri/src/runner/step_runner.rs`, `src-tauri/src/commands.rs`
- Create: `src-tauri/src/runner/download.rs`

**Interfaces:**
- Consumes: `ProcessRunner`(기존), `SecretVault::substitute/mask`(기존)
- Produces:
  - `Step::DownloadRun { friendly, url, file_name, command, args }` (command 필드 신설, JSON 키는 snake_case: `"command"`)
  - `trait Downloader { async fn download(&self, url: &str, dest: &Path) -> Result<(), String> }` (runner/download.rs)
  - `ReqwestDownloader`(실구현), `FakeDownloader`(테스트: 응답 큐 + 호출 기록)
  - `execute_step(step, runner, vault, opener, downloader)` 시그니처 확장 (뒤 태스크 전부 이 시그니처 사용)
  - `RunDeps`에 `downloader: &'a D` 필드 추가

- [ ] **Step 1: Cargo.toml에 reqwest 추가**

`src-tauri/Cargo.toml`의 `[dependencies]`에 추가:

```toml
reqwest = { version = "0.13", default-features = false, features = ["rustls-tls", "stream"] }
futures-util = "0.3"
```

Run: `cargo check --manifest-path src-tauri/Cargo.toml`
Expected: 컴파일 OK (미사용 경고만)

- [ ] **Step 2: 실패하는 스키마 테스트 작성**

`src-tauri/src/recipe/schema.rs` tests 모듈에 추가:

```rust
#[test]
fn parses_download_run_with_command() {
    let json = r#"{
        "type": "download_run",
        "friendly": "설치 파일을 내려받아 실행하고 있어요",
        "url": "https://example.com/tool.pkg",
        "file_name": "tool.pkg",
        "command": "open",
        "args": ["-W", "{{file}}"]
    }"#;
    let step: Step = serde_json::from_str(json).unwrap();
    let Step::DownloadRun { command, file_name, .. } = &step else {
        panic!("DownloadRun이어야 함");
    };
    assert_eq!(command, "open");
    assert_eq!(file_name, "tool.pkg");
}
```

- [ ] **Step 3: 실패 확인**

Run: `cargo test --manifest-path src-tauri/Cargo.toml parses_download_run_with_command`
Expected: FAIL, `missing field` 또는 `unknown field command`

- [ ] **Step 4: 스키마에 command 필드 추가**

`schema.rs`의 `DownloadRun` variant를 교체:

```rust
DownloadRun {
    friendly: String,
    url: String,
    file_name: String,
    /// 내려받은 뒤 실행할 명령. args와 command의 "{{file}}"이 파일 경로로 치환된다.
    command: String,
    #[serde(default)]
    args: Vec<String>,
},
```

Run: `cargo test --manifest-path src-tauri/Cargo.toml parses_download_run_with_command`
Expected: PASS

- [ ] **Step 5: Downloader trait + Fake 작성 (테스트 먼저)**

Create `src-tauri/src/runner/download.rs`:

```rust
use std::path::Path;
use std::sync::Mutex;

use futures_util::StreamExt;

pub trait Downloader: Send + Sync {
    fn download(
        &self,
        url: &str,
        dest: &Path,
    ) -> impl std::future::Future<Output = Result<(), String>> + Send;
}

pub struct ReqwestDownloader;

impl Downloader for ReqwestDownloader {
    async fn download(&self, url: &str, dest: &Path) -> Result<(), String> {
        let resp = reqwest::get(url).await.map_err(|e| e.to_string())?;
        if !resp.status().is_success() {
            return Err(format!("다운로드 응답 오류: HTTP {}", resp.status()));
        }
        let mut file = tokio::fs::File::create(dest)
            .await
            .map_err(|e| e.to_string())?;
        let mut stream = resp.bytes_stream();
        while let Some(chunk) = stream.next().await {
            let chunk = chunk.map_err(|e| e.to_string())?;
            tokio::io::AsyncWriteExt::write_all(&mut file, &chunk)
                .await
                .map_err(|e| e.to_string())?;
        }
        Ok(())
    }
}

/// 테스트용 가짜 다운로더. 응답을 순서대로 소비하고 호출을 기록한다.
#[doc(hidden)]
#[derive(Default)]
pub struct FakeDownloader {
    responses: Mutex<Vec<Result<(), String>>>,
    calls: Mutex<Vec<(String, std::path::PathBuf)>>,
}

impl FakeDownloader {
    pub fn new(mut responses: Vec<Result<(), String>>) -> Self {
        responses.reverse();
        FakeDownloader {
            responses: Mutex::new(responses),
            calls: Mutex::new(Vec::new()),
        }
    }
    pub fn calls(&self) -> Vec<(String, std::path::PathBuf)> {
        self.calls.lock().unwrap().clone()
    }
}

impl Downloader for FakeDownloader {
    async fn download(&self, url: &str, dest: &Path) -> Result<(), String> {
        self.calls
            .lock()
            .unwrap()
            .push((url.to_string(), dest.to_path_buf()));
        self.responses.lock().unwrap().pop().unwrap_or(Ok(()))
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[tokio::test]
    async fn fake_records_calls_and_consumes_responses() {
        let fake = FakeDownloader::new(vec![Err("네트워크 끊김".into()), Ok(())]);
        let dest = std::env::temp_dir().join("x.bin");
        assert!(fake.download("https://a", &dest).await.is_err());
        assert!(fake.download("https://b", &dest).await.is_ok());
        assert_eq!(fake.calls().len(), 2);
        assert_eq!(fake.calls()[0].0, "https://a");
    }
}
```

`src-tauri/src/runner/mod.rs` 상단에 `pub mod download;` 추가.

Run: `cargo test --manifest-path src-tauri/Cargo.toml download`
Expected: PASS

- [ ] **Step 6: execute_step의 DownloadRun 분기 테스트 작성**

`src-tauri/src/runner/mod.rs` tests 모듈에 추가:

```rust
#[tokio::test]
async fn download_run_downloads_then_runs_with_file_substituted() {
    use crate::runner::download::FakeDownloader;
    let runner = FakeProcessRunner::new(vec![ok("installed")]);
    let vault = SecretVault::new();
    let opener = FakeUrlOpener::default();
    let downloader = FakeDownloader::new(vec![Ok(())]);
    let step = Step::DownloadRun {
        friendly: "설치 파일을 내려받아 실행하고 있어요".into(),
        url: "https://example.com/tool.pkg".into(),
        file_name: "tool.pkg".into(),
        command: "open".into(),
        args: vec!["-W".into(), "{{file}}".into()],
    };
    let out = execute_step(&step, &runner, &vault, &opener, &downloader).await;
    assert!(matches!(out, StepOutcome::Success { .. }));
    let expected = std::env::temp_dir().join("tool.pkg");
    assert_eq!(downloader.calls()[0].1, expected);
    let (cmd, args) = &runner.calls()[0];
    assert_eq!(cmd, "open");
    assert_eq!(args[1], expected.to_string_lossy());
}

#[tokio::test]
async fn download_run_failure_is_friendly() {
    use crate::runner::download::FakeDownloader;
    let runner = FakeProcessRunner::new(vec![]);
    let vault = SecretVault::new();
    let opener = FakeUrlOpener::default();
    let downloader = FakeDownloader::new(vec![Err("연결 끊김".into())]);
    let step = Step::DownloadRun {
        friendly: "설치 파일을 내려받아 실행하고 있어요".into(),
        url: "https://example.com/tool.pkg".into(),
        file_name: "tool.pkg".into(),
        command: "open".into(),
        args: vec![],
    };
    let StepOutcome::Failure { message, .. } =
        execute_step(&step, &runner, &vault, &opener, &downloader).await
    else {
        panic!("Failure여야 함");
    };
    assert_eq!(message, "내려받는 중에 인터넷이 잠깐 끊겼어요. 다시 시도해 볼까요?");
    assert!(runner.calls().is_empty()); // 실패 시 실행하지 않는다
}
```

(이 시점에는 `execute_step`이 4개 인자라 컴파일 실패가 곧 "실패하는 테스트"다.)

- [ ] **Step 7: execute_step 확장 구현**

`src-tauri/src/runner/mod.rs`:

```rust
use download::Downloader;

pub async fn execute_step(
    step: &Step,
    runner: &impl ProcessRunner,
    vault: &SecretVault,
    opener: &impl UrlOpener,
    downloader: &impl Downloader,
) -> StepOutcome {
    match step {
        // ... 기존 분기 그대로 ...
        Step::DownloadRun { url, file_name, command, args, .. } => {
            let url = vault.substitute(url);
            let dest = std::env::temp_dir().join(file_name);
            if let Err(e) = downloader.download(&url, &dest).await {
                return StepOutcome::Failure {
                    message: "내려받는 중에 인터넷이 잠깐 끊겼어요. 다시 시도해 볼까요?".into(),
                    log: vault.mask(&e),
                };
            }
            let file = dest.to_string_lossy();
            let command = vault.substitute(command).replace("{{file}}", &file);
            let args: Vec<String> = args
                .iter()
                .map(|a| vault.substitute(a).replace("{{file}}", &file))
                .collect();
            match runner.run(&command, &args).await {
                Ok(out) if out.exit_code == 0 => StepOutcome::Success {
                    log: vault.mask(&format!("{}{}", out.stdout, out.stderr)),
                },
                Ok(out) => StepOutcome::Failure {
                    message: "설치 프로그램이 잘 끝나지 않았어요. 다시 시도해 볼까요?".into(),
                    log: vault.mask(&format!(
                        "exit={}\n{}{}",
                        out.exit_code, out.stdout, out.stderr
                    )),
                },
                Err(e) => StepOutcome::Failure {
                    message: "설치 프로그램을 시작하지 못했어요. 다시 시도해 볼까요?".into(),
                    log: vault.mask(&e.to_string()),
                },
            }
        }
        // 마일스톤 3 후반(Task 14)에서 배선: pty_session은 run_plan이 직접 처리
        Step::PtySession { .. } => StepOutcome::Unsupported,
    }
}
```

호출부 확장:
- `step_runner.rs`: `RunDeps`에 `pub downloader: &'a D` 필드와 `D: Downloader` 제네릭 추가, `execute_step(...)` 두 호출(run_plan·rollback)에 `deps.downloader` 전달. 테스트 헬퍼 `deps()`는 `FakeDownloader`를 담도록 수정 (파라미터가 늘어나니 헬퍼 안에서 `Box::leak` 대신 호출부에서 만들어 참조 전달).
- `commands.rs` `start_flow`: `let downloader = crate::runner::download::ReqwestDownloader;` 만들어 `RunDeps`에 전달.
- `runner/mod.rs`의 기존 테스트들: `execute_step` 호출에 `&FakeDownloader::default()` 추가.

- [ ] **Step 8: 전체 통과 확인**

Run: `cargo test --manifest-path src-tauri/Cargo.toml && cargo clippy --manifest-path src-tauri/Cargo.toml --all-targets -- -D warnings`
Expected: PASS, clippy 클린

- [ ] **Step 9: 커밋**

```bash
git add src-tauri/Cargo.toml src-tauri/Cargo.lock src-tauri/src/recipe/schema.rs src-tauri/src/runner/
git commit -m "feat: download_run 실행기 (reqwest 0.13 스트리밍 다운로드, {{file}} 치환 실행)

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

### Task 5: 레시피 기반 정비 (리소스 경로·픽스처 분리·{{home}} 치환·카피 기계 검사 강화)

실물 레시피가 들어오기 전에 기반을 정리한다: (1) mock 레시피 3종을 테스트 픽스처로 옮기고, (2) 릴리스 빌드에서 번들 리소스 경로로 레시피를 읽게 하고, (3) 스텝의 `{{home}}` 자리에 사용자 홈 폴더를 치환하고(GUI 앱은 셸 PATH를 못 믿으므로 실물 레시피가 절대 경로를 쓴다), (4) 드라이런 전수 검사에 이모지 금지와 auth 가이드·이름·설명 카피 검사를 추가한다.

**Files:**
- Modify: `src-tauri/src/recipe/loader.rs`, `src-tauri/src/lib.rs`, `src-tauri/src/runner/mod.rs`, `src-tauri/src/runner/dry_run.rs`
- Move: `src-tauri/recipes/mock-{tool,prereq,plugin}.json` → `src-tauri/tests/fixtures/recipes/`
- 기존 mock 참조 테스트 전부 경로 교체 (plan.rs, step_runner.rs, loader.rs, dry_run.rs, commands.rs)

**Interfaces:**
- Consumes: `Catalog::load_dir`(기존), `execute_step`(Task 4 확장판)
- Produces:
  - `Catalog::fixture_dir() -> PathBuf` (mock 픽스처 경로, 테스트 전용이지만 pub)
  - `Catalog::bundled_dir()`은 그대로 (개발 경로), lib.rs가 릴리스에서 리소스 경로 우선 사용
  - `runner::expand_home(text: &str) -> String` (스텝의 command·args·path·url에 적용, `{{home}}` 치환)
  - 이후 레시피 태스크는 `src-tauri/recipes/`에 실물만 둔다

- [ ] **Step 1: mock 이동과 fixture_dir 추가**

```bash
mkdir -p src-tauri/tests/fixtures/recipes
git mv src-tauri/recipes/mock-tool.json src-tauri/tests/fixtures/recipes/
git mv src-tauri/recipes/mock-prereq.json src-tauri/tests/fixtures/recipes/
git mv src-tauri/recipes/mock-plugin.json src-tauri/tests/fixtures/recipes/
```

`loader.rs`의 impl Catalog에 추가:

```rust
/// mock 레시피 픽스처 (엔진 유닛 테스트 전용)
pub fn fixture_dir() -> PathBuf {
    PathBuf::from(env!("CARGO_MANIFEST_DIR")).join("tests/fixtures/recipes")
}
```

- [ ] **Step 2: 테스트 경로 일괄 교체**

mock을 쓰는 모든 테스트에서 `Catalog::bundled_dir()` → `Catalog::fixture_dir()`:
- `loader.rs::loads_bundled_fixture_recipes` (이름을 `loads_fixture_recipes`로 변경, `Catalog::fixture_dir()` 사용, 개수 3 유지)
- `loader.rs::rejects_duplicate_ids` (`fixture_dir().join("mock-tool.json")`)
- `plan.rs::catalog()` 헬퍼
- `step_runner.rs`의 3개 테스트
- `dry_run.rs::report_lists_steps_in_dependency_order`
- `commands.rs::catalog_entries_carry_install_state_and_missing_requires`

`dry_run.rs::all_bundled_recipes_dry_run_on_declared_platforms`는 `bundled_dir()` 유지하되, 디렉토리가 비어 있으면(실물 레시피 전) 통과하도록 `assert!(!catalog.recipes.is_empty())`를 제거하고 루프만 남긴다. (Task 6에서 실물이 들어오면 개수 검사를 real_recipes.rs가 담당.)

Run: `cargo test --manifest-path src-tauri/Cargo.toml`
Expected: PASS

- [ ] **Step 3: 릴리스 리소스 경로 로딩**

`src-tauri/src/lib.rs` setup에서 카탈로그 로딩을 교체:

```rust
let bundled = app
    .path()
    .resource_dir()
    .map(|d| d.join("recipes"))
    .ok()
    .filter(|d| std::fs::read_dir(d).map(|mut e| e.next().is_some()).unwrap_or(false))
    .unwrap_or_else(Catalog::bundled_dir);
let catalog = Catalog::load_dir(&bundled).expect("번들 레시피 로딩 실패");
```

(tauri.conf.json의 `"resources": ["recipes/*.json"]`이 이미 리소스로 복사한다. 개발 빌드에서 리소스 폴더가 비어 있으면 소스 트리 경로로 폴백.)

Run: `bun run tauri dev` 부팅 스모크 (카탈로그 화면이 뜨는지, 레시피 0종이어도 크래시 없는지)
Expected: 부팅 OK

- [ ] **Step 4: {{home}} 치환 (테스트 먼저)**

`src-tauri/src/runner/mod.rs` tests에 추가:

```rust
#[tokio::test]
async fn home_placeholder_is_expanded_in_command_and_args() {
    let runner = FakeProcessRunner::new(vec![ok("v1")]);
    let vault = SecretVault::new();
    let opener = FakeUrlOpener::default();
    let downloader = crate::runner::download::FakeDownloader::default();
    let step = Step::CheckCommand {
        friendly: "확인 중".into(),
        command: "{{home}}/.local/bin/tool".into(),
        args: vec!["--config={{home}}/.tool.json".into()],
    };
    let _ = execute_step(&step, &runner, &vault, &opener, &downloader).await;
    let home = crate::runner::home_dir();
    assert_eq!(runner.calls()[0].0, format!("{home}/.local/bin/tool"));
    assert_eq!(runner.calls()[0].1[0], format!("--config={home}/.tool.json"));
    assert!(!home.is_empty());
}
```

`runner/mod.rs`에 구현:

```rust
/// 사용자 홈 폴더 (mac: $HOME, windows: %USERPROFILE%)
pub fn home_dir() -> String {
    std::env::var("HOME")
        .or_else(|_| std::env::var("USERPROFILE"))
        .unwrap_or_default()
}

/// 스텝 문자열의 "{{home}}"을 홈 폴더로 치환
pub fn expand_home(text: &str) -> String {
    text.replace("{{home}}", &home_dir())
}
```

`execute_step`에서 vault.substitute를 쓰는 모든 자리(command, args, path, url)를 `expand_home(&vault.substitute(...))` 형태로 감싼다. `step_runner.rs`의 PtySession 분기(Task 14에서 추가될 때도 동일 규칙)와 DownloadRun 분기도 같다.

Run: `cargo test --manifest-path src-tauri/Cargo.toml home_placeholder`
Expected: PASS

- [ ] **Step 5: Windows PATH 신선화 (설치 직후 명령을 같은 세션에서 찾게)**

문제: GUI 앱이 스폰하는 자식 프로세스는 앱 시작 시점의 PATH를 물려받는다. 레시피가 설치한 CLI(설치기가 레지스트리 PATH에 등록)는 같은 세션의 다음 스텝에서 못 찾는다. macOS는 레시피가 `/bin/zsh -lc`로 감싸 로그인 셸이 rc를 다시 읽게 해서 해결하고, Windows는 러너가 레지스트리에서 PATH를 다시 읽어 주입한다.

`src-tauri/src/runner/process.rs`에 추가:

```rust
/// 레지스트리(머신+사용자)에서 현재 PATH를 다시 읽는다.
/// 설치기가 방금 등록한 PATH 항목을 앱 재시작 없이 반영하기 위함.
#[cfg(windows)]
fn fresh_path() -> Option<String> {
    fn query(hive_key: &str) -> Option<String> {
        let out = std::process::Command::new("reg")
            .args(["query", hive_key, "/v", "Path"])
            .creation_flags(0x0800_0000)
            .output()
            .ok()?;
        let text = String::from_utf8_lossy(&out.stdout).into_owned();
        text.lines().find_map(|line| {
            let line = line.trim();
            line.split_once("REG_EXPAND_SZ")
                .or_else(|| line.split_once("REG_SZ"))
                .map(|(_, value)| expand_percent_vars(value.trim()))
        })
    }
    let machine =
        query(r"HKLM\SYSTEM\CurrentControlSet\Control\Session Manager\Environment");
    let user = query(r"HKCU\Environment");
    match (machine, user) {
        (Some(m), Some(u)) => Some(format!("{m};{u}")),
        (Some(p), None) | (None, Some(p)) => Some(p),
        (None, None) => None,
    }
}

/// "%VAR%" 형태를 현재 환경변수 값으로 확장 (모르는 변수는 그대로 둔다)
#[cfg(windows)]
fn expand_percent_vars(text: &str) -> String {
    let mut out = String::new();
    let mut rest = text;
    while let Some(start) = rest.find('%') {
        out.push_str(&rest[..start]);
        let after = &rest[start + 1..];
        if let Some(end) = after.find('%') {
            let name = &after[..end];
            match std::env::var(name) {
                Ok(v) => out.push_str(&v),
                Err(_) => {
                    out.push('%');
                    out.push_str(name);
                    out.push('%');
                }
            }
            rest = &after[end + 1..];
        } else {
            out.push('%');
            rest = after;
        }
    }
    out.push_str(rest);
    out
}
```

`TokioProcessRunner::run`의 `#[cfg(windows)]` 블록에 주입:

```rust
#[cfg(windows)]
{
    cmd.creation_flags(0x0800_0000); // 기존: 콘솔 창 번쩍임 방지
    if let Some(path) = fresh_path() {
        cmd.env("PATH", path);
    }
}
```

윈도우 전용 테스트 추가 (CI 윈도우 러너에서만 돈다):

```rust
#[cfg(windows)]
#[test]
fn fresh_path_contains_system_dirs() {
    let path = fresh_path().expect("레지스트리 PATH 조회 실패");
    assert!(path.to_lowercase().contains("windows"));
}

#[cfg(windows)]
#[test]
fn percent_vars_expand() {
    std::env::set_var("EH_TEST_VAR", "C:\\probe");
    assert_eq!(expand_percent_vars("%EH_TEST_VAR%\\bin"), "C:\\probe\\bin");
    assert_eq!(expand_percent_vars("%NO_SUCH_VAR_X%"), "%NO_SUCH_VAR_X%");
}
```

Run: `cargo test --manifest-path src-tauri/Cargo.toml` (맥에서는 cfg로 스킵, CI 윈도우 매트릭스가 실검증)
Expected: PASS

- [ ] **Step 6: 드라이런 카피 검사에 이모지 금지 + 가이드·이름·설명 검사 추가**

`dry_run.rs` 전수 테스트를 보강한다. 검사 함수를 하나 만들어 friendly뿐 아니라 레시피 name, easyDescription, auth.guide 문자열 전부에 적용:

```rust
fn assert_copy_ok(recipe_id: &str, text: &str) {
    assert!(!text.trim().is_empty(), "{recipe_id}: 빈 카피");
    assert!(!text.contains('—'), "{recipe_id}: 카피에 em dash 금지: {text}");
    assert!(
        !text.chars().any(|c| {
            let cp = c as u32;
            (0x1F300..=0x1FAFF).contains(&cp) // 이모지 블록
                || (0x2600..=0x27BF).contains(&cp) // 기타 기호와 딩벳
                || cp == 0xFE0F // 변형 선택자
        }),
        "{recipe_id}: 카피에 이모지 금지: {text}"
    );
}
```

전수 테스트 루프에서:
- 각 스텝: `assert_copy_ok(&recipe.id, &s.friendly);` (기존 em dash 단독 검사 대체)
- 레시피 단위: `assert_copy_ok(&recipe.id, &recipe.easy_description);` 그리고 각 플랫폼 spec의 `auth`가 있으면 `for g in &auth.guide { assert_copy_ok(&recipe.id, g); }` (auth 접근을 위해 이 검사는 dry_run 리포트가 아니라 recipe 원본을 순회하는 별도 루프로 작성)

Run: `cargo test --manifest-path src-tauri/Cargo.toml dry_run`
Expected: PASS

- [ ] **Step 7: 커밋**

```bash
git add -A src-tauri
git commit -m "chore: 레시피 기반 정비 (픽스처 분리, 리소스 경로, {{home}} 치환, 윈도우 PATH 신선화, 카피 검사 강화)

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```
## 레시피 공통 규칙 (Task 6~12 전체 적용)

라이브 검증(2026-07-05, 멀티에이전트 교차 검증, 전 항목 confidence high) 결과를 그대로 옮긴다. 구현 중 재검증하지 않는다.

- **mac 스텝은 `/bin/zsh -lc "<명령>"`으로 감싼다.** GUI 앱의 자식 프로세스는 PATH가 좁은데, 로그인 셸이 rc 파일을 다시 읽어 설치 직후의 PATH 추가를 반영한다.
- **windows 스텝은 `cmd /C "<명령>"`으로 감싼다.** PATH 신선화(Task 5)가 레지스트리에서 새 PATH를 주입한다.
- 설치 위치가 결정적인 경우(bun 계열)는 `{{home}}` 절대 경로를 쓴다.
- pty 스텝도 같은 셸 규칙: mac `/bin/zsh -lc ...`, windows `cmd /C ...`.
- detect 실패 = 미설치 신호(엔진 규칙)라 안전. detect 성공이어도 install은 실행되는데, 6종 모두 공식 설치기가 재실행(덮어쓰기)에 안전함을 확인했다.
- 카피 규칙: 비개발자 눈높이, em dash·이모지 금지 (Task 5의 기계 검사가 강제).
- **알려진 한계**: Windows 실물 검증은 마일스톤 6(VM 스모크)에서 수행한다. 그때 어긋나는 경로·명령은 레시피 원격 갱신(Task 19)으로 앱 릴리스 없이 고친다.

### Task 6: 공용 준비물 레시피 (nodejs-lts, bun) + 실물 레시피 스펙 테스트 뼈대

Node.js는 OpenClaw(맥·윈도우)와 OpenCode(윈도우 npm 경로)가, Bun은 GajaeCode가 요구한다. git은 어느 하네스도 필수가 아니라(Hermes는 설치 스크립트가 자동 해결, Claude Code는 선택) v1 레시피에서 제외한다.

검증된 사실(2026-07-05): Node.js Active LTS = v24.18.0 "Krypton", 공식 .pkg URL 패턴 `https://nodejs.org/dist/vX.Y.Z/node-vX.Y.Z.pkg` (nodejs.org/dist/index.json 실존 확인). winget ID `OpenJS.NodeJS.LTS` 실존. Bun 최신 안정판 1.3.14, 공식 설치 스크립트 `https://bun.sh/install`(mac) / `https://bun.sh/install.ps1`(windows).

**Files:**
- Create: `src-tauri/recipes/nodejs-lts.json`, `src-tauri/recipes/bun.json`, `src-tauri/tests/real_recipes.rs`

**Interfaces:**
- Consumes: download_run(Task 4), {{home}}(Task 5)
- Produces: 레시피 id `nodejs-lts`, `bun` (하네스 레시피들의 prerequisites가 참조)

- [ ] **Step 1: 실패하는 스펙 테스트 작성**

Create `src-tauri/tests/real_recipes.rs`:

```rust
//! 실물 레시피 전수 스펙 테스트. 각 레시피 태스크가 아래에 자기 검증을 추가한다.
use easy_harness_lib::recipe::loader::Catalog;
use easy_harness_lib::recipe::plan::{build_plan, Flow};
use easy_harness_lib::recipe::schema::{Platform, ToolKind};

fn catalog() -> Catalog {
    Catalog::load_dir(&Catalog::bundled_dir()).unwrap()
}

#[test]
fn prerequisite_recipes_exist_on_both_platforms() {
    let cat = catalog();
    for id in ["nodejs-lts", "bun"] {
        let r = cat.get(id).unwrap_or_else(|| panic!("{id} 레시피 없음"));
        assert_eq!(r.kind, ToolKind::Prerequisite, "{id}");
        for p in [Platform::Mac, Platform::Windows] {
            let spec = r.platforms.get(p).unwrap_or_else(|| panic!("{id} {p:?} 섹션 없음"));
            assert!(!spec.detect.is_empty(), "{id} {p:?}: detect 필요");
            assert!(!spec.install.is_empty(), "{id} {p:?}: install 필요");
            assert!(spec.auth.is_none(), "{id} {p:?}: 준비물엔 auth 없음");
        }
    }
}
```

Run: `cargo test --manifest-path src-tauri/Cargo.toml --test real_recipes`
Expected: FAIL (`nodejs-lts 레시피 없음`)

- [ ] **Step 2: nodejs-lts.json 작성**

Create `src-tauri/recipes/nodejs-lts.json`:

```json
{
  "schemaVersion": 1,
  "id": "nodejs-lts",
  "name": "Node.js",
  "kind": "prerequisite",
  "easyDescription": "몇몇 도구가 움직이는 데 필요한 기본 부품이에요",
  "pricing": { "label": "무료", "kind": "free" },
  "supportedModels": [],
  "recommended": false,
  "requires": [],
  "platforms": {
    "mac": {
      "prerequisites": [],
      "detect": [
        { "type": "check_command", "friendly": "Node.js가 이미 있는지 볼게요", "command": "/bin/zsh", "args": ["-lc", "node --version"] }
      ],
      "install": [
        { "type": "download_run", "friendly": "Node.js 공식 설치 파일을 열고 있어요. 설치 창이 뜨면 계속을 눌러 주세요", "url": "https://nodejs.org/dist/v24.18.0/node-v24.18.0.pkg", "file_name": "node-v24.18.0.pkg", "command": "open", "args": ["-W", "{{file}}"] },
        { "type": "check_command", "friendly": "Node.js가 잘 설치됐는지 확인하고 있어요", "command": "/bin/zsh", "args": ["-lc", "node --version"] }
      ],
      "verify": [
        { "type": "check_command", "friendly": "Node.js에게 첫 인사를 시켜 볼게요", "command": "/bin/zsh", "args": ["-lc", "node --version"] }
      ],
      "update": [
        { "type": "download_run", "friendly": "Node.js를 새 버전으로 바꾸고 있어요. 설치 창이 뜨면 계속을 눌러 주세요", "url": "https://nodejs.org/dist/v24.18.0/node-v24.18.0.pkg", "file_name": "node-v24.18.0.pkg", "command": "open", "args": ["-W", "{{file}}"] }
      ],
      "uninstall": [],
      "rollback": []
    },
    "windows": {
      "prerequisites": [],
      "detect": [
        { "type": "check_command", "friendly": "Node.js가 이미 있는지 볼게요", "command": "cmd", "args": ["/C", "node --version"] }
      ],
      "install": [
        { "type": "run_command", "friendly": "Node.js를 설치하고 있어요. 파란 확인 창이 뜨면 예를 눌러 주세요", "command": "winget", "args": ["install", "--id", "OpenJS.NodeJS.LTS", "-e", "--silent", "--accept-package-agreements", "--accept-source-agreements"] },
        { "type": "check_command", "friendly": "Node.js가 잘 설치됐는지 확인하고 있어요", "command": "cmd", "args": ["/C", "node --version"] }
      ],
      "verify": [
        { "type": "check_command", "friendly": "Node.js에게 첫 인사를 시켜 볼게요", "command": "cmd", "args": ["/C", "node --version"] }
      ],
      "update": [
        { "type": "run_command", "friendly": "Node.js를 새 버전으로 바꾸고 있어요", "command": "winget", "args": ["upgrade", "--id", "OpenJS.NodeJS.LTS", "-e", "--silent", "--accept-package-agreements", "--accept-source-agreements"] }
      ],
      "uninstall": [],
      "rollback": []
    }
  }
}
```

주의: uninstall은 의도적으로 비워 둔다. Node.js .pkg는 공식 제거 절차가 없고, 다른 도구가 쓰는 공용 부품을 지우면 위험하다. 대시보드 노출 대상은 하네스 중심이라 v1 수용 (자기 리뷰에서 재확인).

- [ ] **Step 3: bun.json 작성**

Create `src-tauri/recipes/bun.json`:

```json
{
  "schemaVersion": 1,
  "id": "bun",
  "name": "Bun",
  "kind": "prerequisite",
  "easyDescription": "가재코드가 움직이는 데 필요한 기본 부품이에요",
  "pricing": { "label": "무료", "kind": "free" },
  "supportedModels": [],
  "recommended": false,
  "requires": [],
  "platforms": {
    "mac": {
      "prerequisites": [],
      "detect": [
        { "type": "check_command", "friendly": "Bun이 이미 있는지 볼게요", "command": "{{home}}/.bun/bin/bun", "args": ["--version"] }
      ],
      "install": [
        { "type": "download_run", "friendly": "Bun 공식 설치 프로그램을 실행하고 있어요", "url": "https://bun.sh/install", "file_name": "bun-install.sh", "command": "/bin/bash", "args": ["{{file}}"] },
        { "type": "check_command", "friendly": "Bun이 잘 설치됐는지 확인하고 있어요", "command": "{{home}}/.bun/bin/bun", "args": ["--version"] }
      ],
      "verify": [
        { "type": "check_command", "friendly": "Bun에게 첫 인사를 시켜 볼게요", "command": "{{home}}/.bun/bin/bun", "args": ["--version"] }
      ],
      "update": [
        { "type": "run_command", "friendly": "Bun을 새 버전으로 바꾸고 있어요", "command": "{{home}}/.bun/bin/bun", "args": ["upgrade"] }
      ],
      "uninstall": [],
      "rollback": []
    },
    "windows": {
      "prerequisites": [],
      "detect": [
        { "type": "check_command", "friendly": "Bun이 이미 있는지 볼게요", "command": "cmd", "args": ["/C", "\"%USERPROFILE%\\.bun\\bin\\bun.exe\" --version"] }
      ],
      "install": [
        { "type": "download_run", "friendly": "Bun 공식 설치 프로그램을 실행하고 있어요", "url": "https://bun.sh/install.ps1", "file_name": "bun-install.ps1", "command": "powershell", "args": ["-ExecutionPolicy", "Bypass", "-File", "{{file}}"] },
        { "type": "check_command", "friendly": "Bun이 잘 설치됐는지 확인하고 있어요", "command": "cmd", "args": ["/C", "\"%USERPROFILE%\\.bun\\bin\\bun.exe\" --version"] }
      ],
      "verify": [
        { "type": "check_command", "friendly": "Bun에게 첫 인사를 시켜 볼게요", "command": "cmd", "args": ["/C", "\"%USERPROFILE%\\.bun\\bin\\bun.exe\" --version"] }
      ],
      "update": [
        { "type": "run_command", "friendly": "Bun을 새 버전으로 바꾸고 있어요", "command": "cmd", "args": ["/C", "\"%USERPROFILE%\\.bun\\bin\\bun.exe\" upgrade"] }
      ],
      "uninstall": [],
      "rollback": []
    }
  }
}
```

- [ ] **Step 4: 통과 확인 + 커밋**

Run: `cargo test --manifest-path src-tauri/Cargo.toml`
Expected: PASS (real_recipes 스펙 + 드라이런 전수 카피 검사 포함)

```bash
git add src-tauri/recipes/ src-tauri/tests/real_recipes.rs
git commit -m "feat: 공용 준비물 레시피 (Node.js LTS v24, Bun) + 실물 레시피 스펙 테스트

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

### Task 7: Claude Code 레시피

검증된 사실(2026-07-05, code.claude.com/docs/en/setup + GitHub releases + winget-pkgs 교차 확인): 공식 1순위는 네이티브 설치 스크립트(`https://claude.ai/install.sh`, Node 불필요, 자동 업데이트). Windows 네이티브 지원(Win10 1809+, `https://claude.ai/install.ps1`). 설치 위치 mac `~/.local/bin/claude`. 인증 기본은 `claude` 첫 실행 시 브라우저 로그인(터미널 대화형). 무료 요금제엔 미포함(Pro $20/월부터 또는 API 키). 최신 2.1.201.

**Files:**
- Create: `src-tauri/recipes/claude-code.json`
- Modify: `src-tauri/tests/real_recipes.rs`

- [ ] **Step 1: 실패하는 스펙 테스트 추가**

`real_recipes.rs`에 추가:

```rust
#[test]
fn claude_code_recipe_spec() {
    let cat = catalog();
    let r = cat.get("claude-code").expect("claude-code 레시피 없음");
    assert_eq!(r.kind, ToolKind::Harness);
    assert!(r.recommended);
    for p in [Platform::Mac, Platform::Windows] {
        let spec = r.platforms.get(p).unwrap();
        let auth = spec.auth.as_ref().expect("auth 필요");
        assert_eq!(auth.guide.len(), 3);
        assert!(!spec.verify.is_empty());
        assert!(!spec.uninstall.is_empty());
    }
    // 준비물 없이 단독 설치 (네이티브 인스톨러라 Node 불필요)
    let plan = build_plan(&cat, "claude-code", Platform::Mac, Flow::Install, &[]).unwrap();
    assert_eq!(plan.tool_order, vec!["claude-code"]);
}
```

Run: `cargo test --manifest-path src-tauri/Cargo.toml --test real_recipes claude_code` → FAIL

- [ ] **Step 2: claude-code.json 작성**

```json
{
  "schemaVersion": 1,
  "id": "claude-code",
  "name": "Claude Code",
  "kind": "harness",
  "easyDescription": "말로 시키면 코딩을 대신해 주는 Anthropic 공식 AI 비서예요",
  "pricing": { "label": "구독 필요", "kind": "paid" },
  "supportedModels": [
    { "modelLabel": "Claude (Opus, Sonnet, Haiku)", "accountLabel": "Claude Pro 이상 구독 또는 API 키" }
  ],
  "recommended": true,
  "requires": [],
  "platforms": {
    "mac": {
      "prerequisites": [],
      "detect": [
        { "type": "check_command", "friendly": "Claude Code가 이미 있는지 볼게요", "command": "/bin/zsh", "args": ["-lc", "claude --version"] }
      ],
      "install": [
        { "type": "download_run", "friendly": "Claude Code 공식 설치 프로그램을 실행하고 있어요", "url": "https://claude.ai/install.sh", "file_name": "claude-install.sh", "command": "/bin/bash", "args": ["{{file}}"] },
        { "type": "check_command", "friendly": "설치가 잘 됐는지 확인하고 있어요", "command": "/bin/zsh", "args": ["-lc", "claude --version"] }
      ],
      "auth": {
        "pattern": "interactive_terminal",
        "steps": [
          { "type": "pty_session", "friendly": "Claude 계정을 연결하고 있어요", "command": "/bin/zsh", "args": ["-lc", "claude"] }
        ],
        "guide": [
          "까만 창에 로그인 안내가 나오면 Enter 키를 눌러 주세요. 인터넷 창이 자동으로 열려요",
          "쓰던 Claude 계정으로 로그인하고 허용을 눌러 주세요",
          "로그인이 끝나면 까만 창에 /exit 라고 입력해 마무리해 주세요"
        ]
      },
      "verify": [
        { "type": "run_command", "friendly": "Claude에게 첫 인사를 시켜 볼게요", "command": "/bin/zsh", "args": ["-lc", "claude -p '안녕이라고 한 단어로만 답해줘'"] }
      ],
      "update": [
        { "type": "run_command", "friendly": "Claude Code를 새 버전으로 바꾸고 있어요", "command": "/bin/zsh", "args": ["-lc", "claude update"] }
      ],
      "uninstall": [
        { "type": "run_command", "friendly": "Claude Code를 깨끗하게 지우고 있어요", "command": "/bin/zsh", "args": ["-lc", "rm -f ~/.local/bin/claude && rm -rf ~/.local/share/claude"] }
      ],
      "rollback": [
        { "type": "run_command", "friendly": "설치하다 만 흔적을 정리하고 있어요", "command": "/bin/zsh", "args": ["-lc", "rm -f ~/.local/bin/claude"] }
      ]
    },
    "windows": {
      "prerequisites": [],
      "detect": [
        { "type": "check_command", "friendly": "Claude Code가 이미 있는지 볼게요", "command": "cmd", "args": ["/C", "claude --version"] }
      ],
      "install": [
        { "type": "download_run", "friendly": "Claude Code 공식 설치 프로그램을 실행하고 있어요", "url": "https://claude.ai/install.ps1", "file_name": "claude-install.ps1", "command": "powershell", "args": ["-ExecutionPolicy", "Bypass", "-File", "{{file}}"] },
        { "type": "check_command", "friendly": "설치가 잘 됐는지 확인하고 있어요", "command": "cmd", "args": ["/C", "claude --version"] }
      ],
      "auth": {
        "pattern": "interactive_terminal",
        "steps": [
          { "type": "pty_session", "friendly": "Claude 계정을 연결하고 있어요", "command": "cmd", "args": ["/C", "claude"] }
        ],
        "guide": [
          "까만 창에 로그인 안내가 나오면 Enter 키를 눌러 주세요. 인터넷 창이 자동으로 열려요",
          "쓰던 Claude 계정으로 로그인하고 허용을 눌러 주세요",
          "로그인이 끝나면 까만 창에 /exit 라고 입력해 마무리해 주세요"
        ]
      },
      "verify": [
        { "type": "run_command", "friendly": "Claude에게 첫 인사를 시켜 볼게요", "command": "cmd", "args": ["/C", "claude -p \"안녕이라고 한 단어로만 답해줘\""] }
      ],
      "update": [
        { "type": "run_command", "friendly": "Claude Code를 새 버전으로 바꾸고 있어요", "command": "cmd", "args": ["/C", "claude update"] }
      ],
      "uninstall": [
        { "type": "run_command", "friendly": "Claude Code를 깨끗하게 지우고 있어요", "command": "powershell", "args": ["-Command", "Remove-Item -Force -ErrorAction SilentlyContinue \"$env:USERPROFILE\\.local\\bin\\claude.exe\"; Remove-Item -Recurse -Force -ErrorAction SilentlyContinue \"$env:USERPROFILE\\.local\\share\\claude\""] }
      ],
      "rollback": [
        { "type": "run_command", "friendly": "설치하다 만 흔적을 정리하고 있어요", "command": "powershell", "args": ["-Command", "Remove-Item -Force -ErrorAction SilentlyContinue \"$env:USERPROFILE\\.local\\bin\\claude.exe\""] }
      ]
    }
  }
}
```

- [ ] **Step 3: 통과 확인 + 커밋**

Run: `cargo test --manifest-path src-tauri/Cargo.toml`
Expected: PASS

```bash
git add src-tauri/recipes/claude-code.json src-tauri/tests/real_recipes.rs
git commit -m "feat: Claude Code 실물 레시피 (네이티브 설치 스크립트, 터미널 로그인, 2026-07-05 라이브 검증)

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

### Task 8: Codex 레시피

검증된 사실(2026-07-05, developers.openai.com/codex/quickstart·/cli·/windows 원문 대조): 공식 기본 설치는 `curl -fsSL https://chatgpt.com/codex/install.sh | sh`(mac) / `irm https://chatgpt.com/codex/install.ps1 | iex`(windows, 네이티브, Win11 기준선). 인증 기본은 `codex login`(브라우저 자동 열림, 완료 시 명령 종료). ChatGPT 무료 플랜부터 Codex 포함. 최신 0.142.5. 모델: gpt-5.5(기본), gpt-5.4, gpt-5.4-mini.

**Files:**
- Create: `src-tauri/recipes/codex.json`
- Modify: `src-tauri/tests/real_recipes.rs`

- [ ] **Step 1: 실패하는 스펙 테스트 추가**

```rust
#[test]
fn codex_recipe_spec() {
    let cat = catalog();
    let r = cat.get("codex").expect("codex 레시피 없음");
    assert_eq!(r.kind, ToolKind::Harness);
    for p in [Platform::Mac, Platform::Windows] {
        let spec = r.platforms.get(p).unwrap();
        let auth = spec.auth.as_ref().expect("auth 필요");
        assert_eq!(auth.guide.len(), 3);
        assert!(!spec.verify.is_empty());
    }
    let plan = build_plan(&cat, "codex", Platform::Windows, Flow::Install, &[]).unwrap();
    assert_eq!(plan.tool_order, vec!["codex"]);
}
```

Run: FAIL 확인 후 진행.

- [ ] **Step 2: codex.json 작성**

```json
{
  "schemaVersion": 1,
  "id": "codex",
  "name": "Codex",
  "kind": "harness",
  "easyDescription": "ChatGPT 계정으로 바로 쓰는 OpenAI의 AI 코딩 비서예요",
  "pricing": { "label": "무료로 시작", "kind": "freemium" },
  "supportedModels": [
    { "modelLabel": "GPT-5.5, GPT-5.4", "accountLabel": "ChatGPT 계정(무료 플랜 가능)" }
  ],
  "recommended": false,
  "requires": [],
  "platforms": {
    "mac": {
      "prerequisites": [],
      "detect": [
        { "type": "check_command", "friendly": "Codex가 이미 있는지 볼게요", "command": "/bin/zsh", "args": ["-lc", "codex --version"] }
      ],
      "install": [
        { "type": "download_run", "friendly": "Codex 공식 설치 프로그램을 실행하고 있어요", "url": "https://chatgpt.com/codex/install.sh", "file_name": "codex-install.sh", "command": "/bin/sh", "args": ["{{file}}"] },
        { "type": "check_command", "friendly": "설치가 잘 됐는지 확인하고 있어요", "command": "/bin/zsh", "args": ["-lc", "codex --version"] }
      ],
      "auth": {
        "pattern": "browser_login",
        "steps": [
          { "type": "pty_session", "friendly": "ChatGPT 계정을 연결하고 있어요", "command": "/bin/zsh", "args": ["-lc", "codex login"] }
        ],
        "guide": [
          "잠시 뒤 인터넷 창이 자동으로 열려요",
          "쓰던 ChatGPT 계정으로 로그인하고 허용을 눌러 주세요",
          "로그인이 끝나면 이 화면이 알아서 다음으로 넘어가요"
        ]
      },
      "verify": [
        { "type": "check_command", "friendly": "Codex가 잘 응답하는지 확인하고 있어요", "command": "/bin/zsh", "args": ["-lc", "codex login status"] }
      ],
      "update": [
        { "type": "download_run", "friendly": "Codex를 새 버전으로 바꾸고 있어요", "url": "https://chatgpt.com/codex/install.sh", "file_name": "codex-install.sh", "command": "/bin/sh", "args": ["{{file}}"] }
      ],
      "uninstall": [
        { "type": "run_command", "friendly": "Codex를 깨끗하게 지우고 있어요", "command": "/bin/zsh", "args": ["-lc", "rm -f \"$(command -v codex)\""] }
      ],
      "rollback": [
        { "type": "run_command", "friendly": "설치하다 만 흔적을 정리하고 있어요", "command": "/bin/zsh", "args": ["-lc", "rm -f \"$(command -v codex)\" || true"] }
      ]
    },
    "windows": {
      "prerequisites": [],
      "detect": [
        { "type": "check_command", "friendly": "Codex가 이미 있는지 볼게요", "command": "cmd", "args": ["/C", "codex --version"] }
      ],
      "install": [
        { "type": "download_run", "friendly": "Codex 공식 설치 프로그램을 실행하고 있어요", "url": "https://chatgpt.com/codex/install.ps1", "file_name": "codex-install.ps1", "command": "powershell", "args": ["-ExecutionPolicy", "Bypass", "-File", "{{file}}"] },
        { "type": "check_command", "friendly": "설치가 잘 됐는지 확인하고 있어요", "command": "cmd", "args": ["/C", "codex --version"] }
      ],
      "auth": {
        "pattern": "browser_login",
        "steps": [
          { "type": "pty_session", "friendly": "ChatGPT 계정을 연결하고 있어요", "command": "cmd", "args": ["/C", "codex login"] }
        ],
        "guide": [
          "잠시 뒤 인터넷 창이 자동으로 열려요",
          "쓰던 ChatGPT 계정으로 로그인하고 허용을 눌러 주세요",
          "로그인이 끝나면 이 화면이 알아서 다음으로 넘어가요"
        ]
      },
      "verify": [
        { "type": "check_command", "friendly": "Codex가 잘 응답하는지 확인하고 있어요", "command": "cmd", "args": ["/C", "codex login status"] }
      ],
      "update": [
        { "type": "download_run", "friendly": "Codex를 새 버전으로 바꾸고 있어요", "url": "https://chatgpt.com/codex/install.ps1", "file_name": "codex-install.ps1", "command": "powershell", "args": ["-ExecutionPolicy", "Bypass", "-File", "{{file}}"] }
      ],
      "uninstall": [
        { "type": "run_command", "friendly": "Codex를 깨끗하게 지우고 있어요", "command": "powershell", "args": ["-Command", "Remove-Item -Force -ErrorAction SilentlyContinue (Get-Command codex -ErrorAction SilentlyContinue).Source"] }
      ],
      "rollback": [
        { "type": "run_command", "friendly": "설치하다 만 흔적을 정리하고 있어요", "command": "powershell", "args": ["-Command", "Remove-Item -Force -ErrorAction SilentlyContinue (Get-Command codex -ErrorAction SilentlyContinue).Source"] }
      ]
    }
  }
}
```

- [ ] **Step 3: 통과 확인 + 커밋**

Run: `cargo test --manifest-path src-tauri/Cargo.toml` → PASS

```bash
git add src-tauri/recipes/codex.json src-tauri/tests/real_recipes.rs
git commit -m "feat: Codex 실물 레시피 (공식 설치 스크립트, 브라우저 로그인, 2026-07-05 라이브 검증)

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

### Task 9: GajaeCode 레시피

검증된 사실(2026-07-05, github.com/Yeachan-Heo/gajae-code README·docs 원문 + npm registry 실측): 실행 명령 `gjc`, Bun >= 1.3.14 필수(`engines.bun`), 설치 `bun install -g gajae-code`(mac·windows 네이티브, WSL은 tmux 기능에만 필요). 인증 기본은 브라우저 OAuth(`gjc auth-broker login anthropic`, 로컬 콜백 54545). 검증 `gjc --version`과 `gjc --smoke-test`. 전용 update/uninstall 명령 없음(bun 표준 명령 사용, docs 78개 파일 전수 조사로 부재 확인). 최신 0.8.1. MIT 무료.

**Files:**
- Create: `src-tauri/recipes/gajaecode.json`
- Modify: `src-tauri/tests/real_recipes.rs`

- [ ] **Step 1: 실패하는 스펙 테스트 추가**

```rust
#[test]
fn gajaecode_recipe_pulls_bun_first() {
    let cat = catalog();
    let r = cat.get("gajaecode").expect("gajaecode 레시피 없음");
    assert_eq!(r.kind, ToolKind::Harness);
    let plan = build_plan(&cat, "gajaecode", Platform::Mac, Flow::Install, &[]).unwrap();
    assert_eq!(plan.tool_order, vec!["bun", "gajaecode"]);
    let plan_installed = build_plan(&cat, "gajaecode", Platform::Mac, Flow::Install, &["bun".into()]).unwrap();
    assert_eq!(plan_installed.tool_order, vec!["gajaecode"]);
}
```

Run: FAIL 확인 후 진행.

- [ ] **Step 2: gajaecode.json 작성**

```json
{
  "schemaVersion": 1,
  "id": "gajaecode",
  "name": "가재코드",
  "kind": "harness",
  "easyDescription": "꼼꼼히 묻고 계획을 세운 뒤 코딩하는 한국산 AI 도우미예요",
  "pricing": { "label": "무료", "kind": "free" },
  "supportedModels": [
    { "modelLabel": "Claude", "accountLabel": "Claude 구독 또는 API 키" },
    { "modelLabel": "GPT", "accountLabel": "ChatGPT 구독 또는 API 키" },
    { "modelLabel": "Gemini 외 30여 가지", "accountLabel": "쓰려는 곳의 계정" }
  ],
  "recommended": false,
  "requires": [],
  "platforms": {
    "mac": {
      "prerequisites": ["bun"],
      "detect": [
        { "type": "check_command", "friendly": "가재코드가 이미 있는지 볼게요", "command": "{{home}}/.bun/bin/gjc", "args": ["--version"] }
      ],
      "install": [
        { "type": "run_command", "friendly": "가재코드를 설치하고 있어요", "command": "{{home}}/.bun/bin/bun", "args": ["install", "-g", "gajae-code"] },
        { "type": "check_command", "friendly": "설치가 잘 됐는지 확인하고 있어요", "command": "{{home}}/.bun/bin/gjc", "args": ["--version"] }
      ],
      "auth": {
        "pattern": "browser_login",
        "steps": [
          { "type": "pty_session", "friendly": "Claude 계정을 연결하고 있어요", "command": "/bin/zsh", "args": ["-lc", "{{home}}/.bun/bin/gjc auth-broker login anthropic"] }
        ],
        "guide": [
          "잠시 뒤 인터넷 창이 자동으로 열려요",
          "쓰던 Claude 계정으로 로그인하고 허용을 눌러 주세요",
          "로그인이 끝나면 이 화면이 알아서 다음으로 넘어가요"
        ]
      },
      "verify": [
        { "type": "check_command", "friendly": "가재코드 부품이 잘 도는지 확인하고 있어요", "command": "{{home}}/.bun/bin/gjc", "args": ["--smoke-test"] }
      ],
      "update": [
        { "type": "run_command", "friendly": "가재코드를 새 버전으로 바꾸고 있어요", "command": "{{home}}/.bun/bin/bun", "args": ["install", "-g", "gajae-code"] }
      ],
      "uninstall": [
        { "type": "run_command", "friendly": "가재코드를 깨끗하게 지우고 있어요", "command": "{{home}}/.bun/bin/bun", "args": ["remove", "-g", "gajae-code"] }
      ],
      "rollback": [
        { "type": "run_command", "friendly": "설치하다 만 흔적을 정리하고 있어요", "command": "{{home}}/.bun/bin/bun", "args": ["remove", "-g", "gajae-code"] }
      ]
    },
    "windows": {
      "prerequisites": ["bun"],
      "detect": [
        { "type": "check_command", "friendly": "가재코드가 이미 있는지 볼게요", "command": "cmd", "args": ["/C", "\"%USERPROFILE%\\.bun\\bin\\gjc\" --version"] }
      ],
      "install": [
        { "type": "run_command", "friendly": "가재코드를 설치하고 있어요", "command": "cmd", "args": ["/C", "\"%USERPROFILE%\\.bun\\bin\\bun.exe\" install -g gajae-code"] },
        { "type": "check_command", "friendly": "설치가 잘 됐는지 확인하고 있어요", "command": "cmd", "args": ["/C", "\"%USERPROFILE%\\.bun\\bin\\gjc\" --version"] }
      ],
      "auth": {
        "pattern": "browser_login",
        "steps": [
          { "type": "pty_session", "friendly": "Claude 계정을 연결하고 있어요", "command": "cmd", "args": ["/C", "\"%USERPROFILE%\\.bun\\bin\\gjc\" auth-broker login anthropic"] }
        ],
        "guide": [
          "잠시 뒤 인터넷 창이 자동으로 열려요",
          "쓰던 Claude 계정으로 로그인하고 허용을 눌러 주세요",
          "로그인이 끝나면 이 화면이 알아서 다음으로 넘어가요"
        ]
      },
      "verify": [
        { "type": "check_command", "friendly": "가재코드 부품이 잘 도는지 확인하고 있어요", "command": "cmd", "args": ["/C", "\"%USERPROFILE%\\.bun\\bin\\gjc\" --smoke-test"] }
      ],
      "update": [
        { "type": "run_command", "friendly": "가재코드를 새 버전으로 바꾸고 있어요", "command": "cmd", "args": ["/C", "\"%USERPROFILE%\\.bun\\bin\\bun.exe\" install -g gajae-code"] }
      ],
      "uninstall": [
        { "type": "run_command", "friendly": "가재코드를 깨끗하게 지우고 있어요", "command": "cmd", "args": ["/C", "\"%USERPROFILE%\\.bun\\bin\\bun.exe\" remove -g gajae-code"] }
      ],
      "rollback": [
        { "type": "run_command", "friendly": "설치하다 만 흔적을 정리하고 있어요", "command": "cmd", "args": ["/C", "\"%USERPROFILE%\\.bun\\bin\\bun.exe\" remove -g gajae-code"] }
      ]
    }
  }
}
```

- [ ] **Step 3: 통과 확인 + 커밋**

Run: `cargo test --manifest-path src-tauri/Cargo.toml` → PASS

```bash
git add src-tauri/recipes/gajaecode.json src-tauri/tests/real_recipes.rs
git commit -m "feat: 가재코드 실물 레시피 (Bun 의존, 브라우저 OAuth, 2026-07-05 라이브 검증)

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

### Task 10: OpenClaw 레시피

검증된 사실(2026-07-05, docs.openclaw.ai/install·/platforms/windows 원문 대조): 공식 설치 `curl -fsSL https://openclaw.ai/install.sh | bash`(mac) / `iwr -useb https://openclaw.ai/install.ps1 | iex`(windows 네이티브). 온보딩 생략 플래그 `--no-onboard`(mac) / `-NoOnboard`(windows) 실존 확인. Node.js 22.19+/24 권장. 인증·초기 설정은 대화형 `openclaw onboard`. 검증 `openclaw --version`, `openclaw doctor`. 업데이트 `openclaw update`, 제거 `openclaw uninstall --all --yes --non-interactive`. 최신 2026.6.11. MIT 무료. 참고: 코딩 전용이 아니라 범용 개인 비서에 가깝다(카드 설명에 반영).

**Files:**
- Create: `src-tauri/recipes/openclaw.json`
- Modify: `src-tauri/tests/real_recipes.rs`

- [ ] **Step 1: 실패하는 스펙 테스트 추가**

```rust
#[test]
fn openclaw_recipe_pulls_node_first() {
    let cat = catalog();
    let r = cat.get("openclaw").expect("openclaw 레시피 없음");
    assert_eq!(r.kind, ToolKind::Harness);
    let plan = build_plan(&cat, "openclaw", Platform::Mac, Flow::Install, &[]).unwrap();
    assert_eq!(plan.tool_order, vec!["nodejs-lts", "openclaw"]);
}
```

Run: FAIL 확인 후 진행.

- [ ] **Step 2: openclaw.json 작성**

```json
{
  "schemaVersion": 1,
  "id": "openclaw",
  "name": "OpenClaw",
  "kind": "harness",
  "easyDescription": "메신저로 심부름을 시키는 만능 AI 비서예요. 코딩도 해요",
  "pricing": { "label": "무료", "kind": "free" },
  "supportedModels": [
    { "modelLabel": "Claude, GPT, Gemini 외 40여 가지", "accountLabel": "쓰려는 모델의 계정 또는 API 키" }
  ],
  "recommended": false,
  "requires": [],
  "platforms": {
    "mac": {
      "prerequisites": ["nodejs-lts"],
      "detect": [
        { "type": "check_command", "friendly": "OpenClaw가 이미 있는지 볼게요", "command": "/bin/zsh", "args": ["-lc", "openclaw --version"] }
      ],
      "install": [
        { "type": "download_run", "friendly": "OpenClaw 공식 설치 프로그램을 실행하고 있어요", "url": "https://openclaw.ai/install.sh", "file_name": "openclaw-install.sh", "command": "/bin/bash", "args": ["{{file}}", "--no-onboard"] },
        { "type": "check_command", "friendly": "설치가 잘 됐는지 확인하고 있어요", "command": "/bin/zsh", "args": ["-lc", "openclaw --version"] }
      ],
      "auth": {
        "pattern": "interactive_terminal",
        "steps": [
          { "type": "pty_session", "friendly": "OpenClaw 첫 설정을 도와드리고 있어요", "command": "/bin/zsh", "args": ["-lc", "openclaw onboard"] }
        ],
        "guide": [
          "까만 창에서 질문이 나오면 Enter 키로 기본값을 고르면 돼요",
          "쓰고 싶은 AI 모델을 고르고, 안내에 따라 로그인하거나 열쇠 값을 붙여넣어 주세요",
          "설정이 끝나면 이 화면이 알아서 다음으로 넘어가요"
        ]
      },
      "verify": [
        { "type": "check_command", "friendly": "OpenClaw 상태를 점검하고 있어요", "command": "/bin/zsh", "args": ["-lc", "openclaw --version"] }
      ],
      "update": [
        { "type": "run_command", "friendly": "OpenClaw를 새 버전으로 바꾸고 있어요", "command": "/bin/zsh", "args": ["-lc", "openclaw update"] }
      ],
      "uninstall": [
        { "type": "run_command", "friendly": "OpenClaw를 깨끗하게 지우고 있어요", "command": "/bin/zsh", "args": ["-lc", "openclaw uninstall --all --yes --non-interactive"] }
      ],
      "rollback": [
        { "type": "run_command", "friendly": "설치하다 만 흔적을 정리하고 있어요", "command": "/bin/zsh", "args": ["-lc", "openclaw uninstall --all --yes --non-interactive || true"] }
      ]
    },
    "windows": {
      "prerequisites": ["nodejs-lts"],
      "detect": [
        { "type": "check_command", "friendly": "OpenClaw가 이미 있는지 볼게요", "command": "cmd", "args": ["/C", "openclaw --version"] }
      ],
      "install": [
        { "type": "download_run", "friendly": "OpenClaw 공식 설치 프로그램을 실행하고 있어요", "url": "https://openclaw.ai/install.ps1", "file_name": "openclaw-install.ps1", "command": "powershell", "args": ["-ExecutionPolicy", "Bypass", "-File", "{{file}}", "-NoOnboard"] },
        { "type": "check_command", "friendly": "설치가 잘 됐는지 확인하고 있어요", "command": "cmd", "args": ["/C", "openclaw --version"] }
      ],
      "auth": {
        "pattern": "interactive_terminal",
        "steps": [
          { "type": "pty_session", "friendly": "OpenClaw 첫 설정을 도와드리고 있어요", "command": "cmd", "args": ["/C", "openclaw onboard"] }
        ],
        "guide": [
          "까만 창에서 질문이 나오면 Enter 키로 기본값을 고르면 돼요",
          "쓰고 싶은 AI 모델을 고르고, 안내에 따라 로그인하거나 열쇠 값을 붙여넣어 주세요",
          "설정이 끝나면 이 화면이 알아서 다음으로 넘어가요"
        ]
      },
      "verify": [
        { "type": "check_command", "friendly": "OpenClaw 상태를 점검하고 있어요", "command": "cmd", "args": ["/C", "openclaw --version"] }
      ],
      "update": [
        { "type": "run_command", "friendly": "OpenClaw를 새 버전으로 바꾸고 있어요", "command": "cmd", "args": ["/C", "openclaw update"] }
      ],
      "uninstall": [
        { "type": "run_command", "friendly": "OpenClaw를 깨끗하게 지우고 있어요", "command": "cmd", "args": ["/C", "openclaw uninstall --all --yes --non-interactive"] }
      ],
      "rollback": [
        { "type": "run_command", "friendly": "설치하다 만 흔적을 정리하고 있어요", "command": "cmd", "args": ["/C", "openclaw uninstall --all --yes --non-interactive"] }
      ]
    }
  }
}
```

- [ ] **Step 3: 통과 확인 + 커밋**

Run: `cargo test --manifest-path src-tauri/Cargo.toml` → PASS

```bash
git add src-tauri/recipes/openclaw.json src-tauri/tests/real_recipes.rs
git commit -m "feat: OpenClaw 실물 레시피 (no-onboard 설치 + onboard 대화형 인증, 2026-07-05 라이브 검증)

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

### Task 11: Hermes 레시피

검증된 사실(2026-07-05, github.com/NousResearch/hermes-agent + install.sh/install.ps1 원본 소스 대조): Nous Research의 오픈소스 에이전트(MIT). 설치 스크립트가 Python 3.11, Node v22, git 등 준비물을 전부 자동 해결하므로 prerequisites 불필요. mac은 Apple Silicon만 공식 Tier 1(Intel 미지원, 카드 설명에 반영). windows 네이티브 Tier 1 (git 없으면 PortableGit 자동 설치). 인증 기본 `hermes setup --portal`(브라우저 OAuth, Nous Portal 무료 티어 있음). 검증 `hermes version`, `hermes doctor`. 업데이트 `hermes update`, 제거 `hermes uninstall`. 최신 v0.18.0.

**Files:**
- Create: `src-tauri/recipes/hermes.json`
- Modify: `src-tauri/tests/real_recipes.rs`

- [ ] **Step 1: 실패하는 스펙 테스트 추가**

```rust
#[test]
fn hermes_recipe_spec() {
    let cat = catalog();
    let r = cat.get("hermes").expect("hermes 레시피 없음");
    assert_eq!(r.kind, ToolKind::Harness);
    let plan = build_plan(&cat, "hermes", Platform::Mac, Flow::Install, &[]).unwrap();
    assert_eq!(plan.tool_order, vec!["hermes"]); // 준비물은 설치 스크립트가 자동 해결
    let mac = r.platforms.get(Platform::Mac).unwrap();
    assert_eq!(mac.auth.as_ref().unwrap().pattern, easy_harness_lib::recipe::schema::AuthPattern::BrowserLogin);
}
```

Run: FAIL 확인 후 진행.

- [ ] **Step 2: hermes.json 작성**

```json
{
  "schemaVersion": 1,
  "id": "hermes",
  "name": "Hermes",
  "kind": "harness",
  "easyDescription": "모델 300여 가지를 갈아끼며 쓰는 만능 AI 도우미예요. 애플 실리콘 맥 전용이에요",
  "pricing": { "label": "무료로 시작", "kind": "freemium" },
  "supportedModels": [
    { "modelLabel": "모델 300여 가지 (Claude, GPT, Gemini 포함)", "accountLabel": "Nous Portal 계정(무료 시작 가능)" }
  ],
  "recommended": false,
  "requires": [],
  "platforms": {
    "mac": {
      "prerequisites": [],
      "detect": [
        { "type": "check_command", "friendly": "Hermes가 이미 있는지 볼게요", "command": "/bin/zsh", "args": ["-lc", "hermes version"] }
      ],
      "install": [
        { "type": "download_run", "friendly": "Hermes 공식 설치 프로그램을 실행하고 있어요. 필요한 부품도 알아서 챙겨요", "url": "https://hermes-agent.nousresearch.com/install.sh", "file_name": "hermes-install.sh", "command": "/bin/bash", "args": ["{{file}}"] },
        { "type": "check_command", "friendly": "설치가 잘 됐는지 확인하고 있어요", "command": "/bin/zsh", "args": ["-lc", "hermes version"] }
      ],
      "auth": {
        "pattern": "browser_login",
        "steps": [
          { "type": "pty_session", "friendly": "Nous Portal 계정을 연결하고 있어요", "command": "/bin/zsh", "args": ["-lc", "hermes setup --portal"] }
        ],
        "guide": [
          "잠시 뒤 인터넷 창이 자동으로 열려요",
          "Nous Portal 계정으로 로그인해 주세요. 처음이면 무료로 가입할 수 있어요",
          "로그인이 끝나면 이 화면이 알아서 다음으로 넘어가요"
        ]
      },
      "verify": [
        { "type": "check_command", "friendly": "Hermes 상태를 점검하고 있어요", "command": "/bin/zsh", "args": ["-lc", "hermes doctor"] }
      ],
      "update": [
        { "type": "run_command", "friendly": "Hermes를 새 버전으로 바꾸고 있어요", "command": "/bin/zsh", "args": ["-lc", "hermes update --yes"] }
      ],
      "uninstall": [
        { "type": "run_command", "friendly": "Hermes를 깨끗하게 지우고 있어요", "command": "/bin/zsh", "args": ["-lc", "hermes uninstall --yes"] }
      ],
      "rollback": [
        { "type": "run_command", "friendly": "설치하다 만 흔적을 정리하고 있어요", "command": "/bin/zsh", "args": ["-lc", "rm -f ~/.local/bin/hermes"] }
      ]
    },
    "windows": {
      "prerequisites": [],
      "detect": [
        { "type": "check_command", "friendly": "Hermes가 이미 있는지 볼게요", "command": "cmd", "args": ["/C", "hermes version"] }
      ],
      "install": [
        { "type": "download_run", "friendly": "Hermes 공식 설치 프로그램을 실행하고 있어요. 필요한 부품도 알아서 챙겨요", "url": "https://hermes-agent.nousresearch.com/install.ps1", "file_name": "hermes-install.ps1", "command": "powershell", "args": ["-ExecutionPolicy", "Bypass", "-File", "{{file}}"] },
        { "type": "check_command", "friendly": "설치가 잘 됐는지 확인하고 있어요", "command": "cmd", "args": ["/C", "hermes version"] }
      ],
      "auth": {
        "pattern": "browser_login",
        "steps": [
          { "type": "pty_session", "friendly": "Nous Portal 계정을 연결하고 있어요", "command": "cmd", "args": ["/C", "hermes setup --portal"] }
        ],
        "guide": [
          "잠시 뒤 인터넷 창이 자동으로 열려요",
          "Nous Portal 계정으로 로그인해 주세요. 처음이면 무료로 가입할 수 있어요",
          "로그인이 끝나면 이 화면이 알아서 다음으로 넘어가요"
        ]
      },
      "verify": [
        { "type": "check_command", "friendly": "Hermes 상태를 점검하고 있어요", "command": "cmd", "args": ["/C", "hermes doctor"] }
      ],
      "update": [
        { "type": "run_command", "friendly": "Hermes를 새 버전으로 바꾸고 있어요", "command": "cmd", "args": ["/C", "hermes update --yes"] }
      ],
      "uninstall": [
        { "type": "run_command", "friendly": "Hermes를 깨끗하게 지우고 있어요", "command": "cmd", "args": ["/C", "hermes uninstall --yes"] }
      ],
      "rollback": [
        { "type": "run_command", "friendly": "설치하다 만 흔적을 정리하고 있어요", "command": "cmd", "args": ["/C", "hermes uninstall --yes"] }
      ]
    }
  }
}
```

주의: hermes uninstall의 `--yes`는 확인 프롬프트 생략 플래그로 라이브 확인됨(`--full`은 설정까지 삭제라 v1 기본에서 제외). 데스크톱 GUI 동시 설치 여부 등은 install.sh 기본값을 따른다.

- [ ] **Step 3: 통과 확인 + 커밋**

Run: `cargo test --manifest-path src-tauri/Cargo.toml` → PASS

```bash
git add src-tauri/recipes/hermes.json src-tauri/tests/real_recipes.rs
git commit -m "feat: Hermes 실물 레시피 (준비물 자동 해결 스크립트, Nous Portal OAuth, 2026-07-05 라이브 검증)

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

### Task 12: OpenCode 레시피 + 카탈로그 마감 검사

검증된 사실(2026-07-05, opencode.ai/docs 원문 대조 + GitHub releases): Anomaly(구 SST)의 오픈소스 멀티모델 에이전트(MIT). mac 공식 설치 `curl -fsSL https://opencode.ai/install | bash`. windows 네이티브 지원(공식 권장은 WSL이지만 필수 아님) - 비개발자 경로로는 npm(`npm install -g opencode-ai@latest`, Node 필요)을 쓴다. 인증은 TUI 안 `/connect`(프로바이더별 브라우저 OAuth 또는 키 붙여넣기, `~/.local/share/opencode/auth.json` 저장). 검증 `opencode --version`. 업데이트 `opencode upgrade`. 제거 `opencode uninstall` 실존. 최신 1.17.13.

**Files:**
- Create: `src-tauri/recipes/opencode.json`
- Modify: `src-tauri/tests/real_recipes.rs`

- [ ] **Step 1: 실패하는 스펙 테스트 추가 (개수 마감 포함)**

```rust
#[test]
fn opencode_recipe_spec_and_catalog_is_complete() {
    let cat = catalog();
    let r = cat.get("opencode").expect("opencode 레시피 없음");
    assert_eq!(r.kind, ToolKind::Harness);
    // windows만 npm 경로라 Node 준비물이 붙는다
    let win = build_plan(&cat, "opencode", Platform::Windows, Flow::Install, &[]).unwrap();
    assert_eq!(win.tool_order, vec!["nodejs-lts", "opencode"]);
    let mac = build_plan(&cat, "opencode", Platform::Mac, Flow::Install, &[]).unwrap();
    assert_eq!(mac.tool_order, vec!["opencode"]);
    // M3 카탈로그 마감: 하네스 6 + 준비물 2
    assert_eq!(cat.recipes.len(), 8);
    let harnesses = cat.recipes.iter().filter(|r| r.kind == ToolKind::Harness).count();
    assert_eq!(harnesses, 6);
}
```

Run: FAIL 확인 후 진행.

- [ ] **Step 2: opencode.json 작성**

```json
{
  "schemaVersion": 1,
  "id": "opencode",
  "name": "OpenCode",
  "kind": "harness",
  "easyDescription": "원하는 AI 모델을 골라 쓰는 오픈소스 코딩 도우미예요",
  "pricing": { "label": "무료로 시작", "kind": "freemium" },
  "supportedModels": [
    { "modelLabel": "Claude, GPT, Gemini 외 75개 제공사", "accountLabel": "제공사 계정 또는 무료 Zen 모델" }
  ],
  "recommended": false,
  "requires": [],
  "platforms": {
    "mac": {
      "prerequisites": [],
      "detect": [
        { "type": "check_command", "friendly": "OpenCode가 이미 있는지 볼게요", "command": "/bin/zsh", "args": ["-lc", "opencode --version"] }
      ],
      "install": [
        { "type": "download_run", "friendly": "OpenCode 공식 설치 프로그램을 실행하고 있어요", "url": "https://opencode.ai/install", "file_name": "opencode-install.sh", "command": "/bin/bash", "args": ["{{file}}"] },
        { "type": "check_command", "friendly": "설치가 잘 됐는지 확인하고 있어요", "command": "/bin/zsh", "args": ["-lc", "opencode --version"] }
      ],
      "auth": {
        "pattern": "interactive_terminal",
        "steps": [
          { "type": "pty_session", "friendly": "쓸 AI 모델 계정을 연결하고 있어요", "command": "/bin/zsh", "args": ["-lc", "opencode"] }
        ],
        "guide": [
          "까만 창이 뜨면 /connect 라고 입력하고 Enter 키를 눌러 주세요",
          "목록에서 쓰고 싶은 AI를 고르고, 안내에 따라 로그인하거나 열쇠 값을 붙여넣어 주세요",
          "연결이 끝나면 /exit 라고 입력해 마무리해 주세요"
        ]
      },
      "verify": [
        { "type": "check_command", "friendly": "OpenCode가 잘 응답하는지 확인하고 있어요", "command": "/bin/zsh", "args": ["-lc", "opencode --version"] }
      ],
      "update": [
        { "type": "run_command", "friendly": "OpenCode를 새 버전으로 바꾸고 있어요", "command": "/bin/zsh", "args": ["-lc", "opencode upgrade"] }
      ],
      "uninstall": [
        { "type": "run_command", "friendly": "OpenCode를 깨끗하게 지우고 있어요", "command": "/bin/zsh", "args": ["-lc", "opencode uninstall --force"] }
      ],
      "rollback": [
        { "type": "run_command", "friendly": "설치하다 만 흔적을 정리하고 있어요", "command": "/bin/zsh", "args": ["-lc", "rm -f ~/.local/bin/opencode"] }
      ]
    },
    "windows": {
      "prerequisites": ["nodejs-lts"],
      "detect": [
        { "type": "check_command", "friendly": "OpenCode가 이미 있는지 볼게요", "command": "cmd", "args": ["/C", "opencode --version"] }
      ],
      "install": [
        { "type": "run_command", "friendly": "OpenCode를 설치하고 있어요", "command": "cmd", "args": ["/C", "npm install -g opencode-ai@latest"] },
        { "type": "check_command", "friendly": "설치가 잘 됐는지 확인하고 있어요", "command": "cmd", "args": ["/C", "opencode --version"] }
      ],
      "auth": {
        "pattern": "interactive_terminal",
        "steps": [
          { "type": "pty_session", "friendly": "쓸 AI 모델 계정을 연결하고 있어요", "command": "cmd", "args": ["/C", "opencode"] }
        ],
        "guide": [
          "까만 창이 뜨면 /connect 라고 입력하고 Enter 키를 눌러 주세요",
          "목록에서 쓰고 싶은 AI를 고르고, 안내에 따라 로그인하거나 열쇠 값을 붙여넣어 주세요",
          "연결이 끝나면 /exit 라고 입력해 마무리해 주세요"
        ]
      },
      "verify": [
        { "type": "check_command", "friendly": "OpenCode가 잘 응답하는지 확인하고 있어요", "command": "cmd", "args": ["/C", "opencode --version"] }
      ],
      "update": [
        { "type": "run_command", "friendly": "OpenCode를 새 버전으로 바꾸고 있어요", "command": "cmd", "args": ["/C", "npm install -g opencode-ai@latest"] }
      ],
      "uninstall": [
        { "type": "run_command", "friendly": "OpenCode를 깨끗하게 지우고 있어요", "command": "cmd", "args": ["/C", "npm uninstall -g opencode-ai"] }
      ],
      "rollback": [
        { "type": "run_command", "friendly": "설치하다 만 흔적을 정리하고 있어요", "command": "cmd", "args": ["/C", "npm uninstall -g opencode-ai"] }
      ]
    }
  }
}
```

- [ ] **Step 3: 통과 확인**

Run: `cargo test --manifest-path src-tauri/Cargo.toml`
Expected: PASS (real_recipes 전체 + 드라이런 전수 6하네스 x 2 OS + 준비물 2 x 2 OS)

- [ ] **Step 4: 카탈로그 GUI 육안 확인**

Run: `bun run tauri dev`
확인: 카탈로그에 하네스 6종 카드가 뜨고, 각 카드에 모델 배지·가격 라벨·추천 배지(Claude Code)가 보이는지. 마법사는 아직 demo 모드(Task 16 전)라 클릭해도 안전.

- [ ] **Step 5: 커밋**

```bash
git add src-tauri/recipes/opencode.json src-tauri/tests/real_recipes.rs
git commit -m "feat: OpenCode 실물 레시피 + 카탈로그 8종 마감 검사 (2026-07-05 라이브 검증)

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```
### Task 13: 인증 정보 노출 + Wizard 비밀값 폼·인증 가이드

레시피의 `auth.pattern`과 `auth.guide`를 프론트로 노출하고, 마법사가 (1) auth 구간에서 안내 카드를 보여주고 (2) `waitingSecret` 상태에서 마스킹 입력 폼을 띄워 `provide_secret`으로 잇는다. 단독 Auth 화면은 마법사에 통합되므로 삭제한다.

**Files:**
- Modify: `src-tauri/src/runner/dry_run.rs` (DryRunReport에 auth 필드), `src/lib/types.ts`, `src/lib/ipc.ts`(변경 없음, 확인만), `src/screens/Wizard.tsx`, `src/App.tsx`
- Create: `src/components/SecretForm.tsx`, `src/components/AuthGuidePanel.tsx`
- Delete: `src/screens/Auth.tsx`
- Test: `src/components/__tests__/secretform.test.tsx`, `src-tauri/src/runner/dry_run.rs` tests

**Interfaces:**
- Consumes: `AuthSpec { pattern, steps, guide }`(schema.rs 기존), `provideSecret`(ipc.ts 기존), `RunState.waitingSecret`(기존)
- Produces:
  - `DryRunReport.auth: Option<DryRunAuth>` / TS `DryRunReport.auth: { pattern: "browser_login" | "api_key" | "interactive_terminal"; guide: string[] } | null`
  - `<SecretForm label={string} onSubmit={(value: string) => void} />`
  - `<AuthGuidePanel guide={string[]} />`

- [ ] **Step 1: 실패하는 Rust 테스트 작성**

`dry_run.rs` tests에 추가:

```rust
#[test]
fn report_carries_target_auth_pattern_and_guide() {
    let catalog = Catalog::load_dir(&Catalog::fixture_dir()).unwrap();
    let report = dry_run(&catalog, "mock-tool", Platform::Mac).unwrap();
    let auth = report.auth.expect("mock-tool mac에는 auth가 있음");
    assert_eq!(auth.pattern, "browser_login");
    assert_eq!(auth.guide.len(), 3);
}
```

- [ ] **Step 2: 실패 확인**

Run: `cargo test --manifest-path src-tauri/Cargo.toml report_carries_target_auth`
Expected: FAIL (컴파일 에러: `auth` 필드 없음)

- [ ] **Step 3: DryRunReport에 auth 추가**

`dry_run.rs`:

```rust
#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DryRunAuth {
    pub pattern: String,
    pub guide: Vec<String>,
}
```

`DryRunReport`에 `pub auth: Option<DryRunAuth>,` 추가. `dry_run()`에서 대상 레시피의 platform spec에서 채운다:

```rust
let auth = catalog
    .get(target_id)
    .and_then(|r| r.platforms.get(platform))
    .and_then(|spec| spec.auth.as_ref())
    .map(|a| DryRunAuth {
        pattern: match a.pattern {
            crate::recipe::schema::AuthPattern::BrowserLogin => "browser_login",
            crate::recipe::schema::AuthPattern::ApiKey => "api_key",
            crate::recipe::schema::AuthPattern::InteractiveTerminal => "interactive_terminal",
        }
        .to_string(),
        guide: a.guide.clone(),
    });
```

TS 미러 `src/lib/types.ts`:

```ts
export interface DryRunAuth {
  pattern: "browser_login" | "api_key" | "interactive_terminal";
  guide: string[];
}
export interface DryRunReport {
  targetId: string; platform: string; toolOrder: string[]; steps: DryRunStep[];
  auth: DryRunAuth | null;
}
```

기존 `src/screens/__tests__/wizard-lifecycle.test.tsx`의 `dryRun` 픽스처에 `auth: null` 필드를 추가한다 (타입 에러 방지).

Run: `cargo test --manifest-path src-tauri/Cargo.toml && bun run build`
Expected: PASS

- [ ] **Step 4: SecretForm 실패 테스트 작성**

Create `src/components/__tests__/secretform.test.tsx`:

```tsx
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { SecretForm } from "../SecretForm";

describe("SecretForm", () => {
  it("마스킹 입력을 받아 제출하고, 빈 값은 막는다", () => {
    const onSubmit = vi.fn();
    render(<SecretForm label="api_key" onSubmit={onSubmit} />);
    const input = screen.getByLabelText<HTMLInputElement>(/열쇠 값/);
    expect(input.type).toBe("password");
    fireEvent.click(screen.getByRole("button", { name: "등록하기" }));
    expect(onSubmit).not.toHaveBeenCalled();
    fireEvent.change(input, { target: { value: "sk-live-1" } });
    fireEvent.click(screen.getByRole("button", { name: "등록하기" }));
    expect(onSubmit).toHaveBeenCalledWith("sk-live-1");
  });
});
```

Run: `bun run test -- secretform` → Expected: FAIL (모듈 없음)

- [ ] **Step 5: SecretForm 구현**

Create `src/components/SecretForm.tsx`:

```tsx
import { useState } from "react";
import { PrimaryButton } from "./Buttons";

export function SecretForm({ label, onSubmit }: { label: string; onSubmit: (value: string) => void }) {
  const [value, setValue] = useState("");
  return (
    <form
      className="mx-auto mt-8 flex w-full max-w-md flex-col gap-3 text-left"
      onSubmit={(e) => {
        e.preventDefault();
        if (value.trim()) onSubmit(value.trim());
      }}
    >
      <label htmlFor="secret-input" className="font-bold">
        열쇠 값 붙여넣기
      </label>
      <input
        id="secret-input"
        type="password"
        autoComplete="off"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder="복사해 온 값을 여기에 붙여넣어 주세요"
        className="rounded-badge border border-line dark:border-line-dark bg-surface-card dark:bg-surface-card-dark px-4 py-3 font-mono"
      />
      <p className="text-caption text-txt-tertiary">
        이 값({label})은 도구에만 전달하고 이지 하네스는 저장하지 않아요.
      </p>
      <PrimaryButton type="submit">등록하기</PrimaryButton>
    </form>
  );
}
```

(`PrimaryButton`이 `type` prop을 안 받으면 `Buttons.tsx`에 `type?: "button" | "submit"` 전달을 추가한다.)

Run: `bun run test -- secretform` → Expected: PASS

- [ ] **Step 6: AuthGuidePanel 구현 (기존 Auth.tsx 카드 재사용)**

Create `src/components/AuthGuidePanel.tsx`:

```tsx
export function AuthGuidePanel({ guide }: { guide: string[] }) {
  if (guide.length === 0) return null;
  return (
    <div className="mt-8 grid w-full grid-cols-1 gap-4 md:grid-cols-3">
      {guide.map((text, i) => (
        <div
          key={text}
          className="rounded-card border border-line dark:border-line-dark bg-surface-card dark:bg-surface-card-dark p-6 text-left shadow-card"
        >
          <span className="flex h-8 w-8 items-center justify-center rounded-full bg-surface-gold-tint font-bold text-txt-gold">
            {i + 1}
          </span>
          <p className="mt-3 font-bold">{text}</p>
        </div>
      ))}
    </div>
  );
}
```

- [ ] **Step 7: Wizard 통합**

`src/screens/Wizard.tsx`:
- `getDryRun` 결과에서 `auth`를 상태로 보관: `const [auth, setAuth] = useState<DryRunAuth | null>(null);` → `setAuth(preview.auth);`
- 현재 섹션 추적: `runReducer`의 이벤트에서 `ev.section`을 `RunState`에 이미 반영하지 않으므로 `RunState`에 `section: string` 필드를 추가한다 (`initialRunState`는 `"detect"`, reducer의 base에 `section: ev.section`).
- 렌더 분기 (에러 아님, 진행 중):

```tsx
{state.waitingSecret ? (
  <>
    <h1 className="text-display font-extrabold">열쇠 하나만 등록하면 돼요</h1>
    <AuthGuidePanel guide={auth?.guide ?? []} />
    <SecretForm
      label={state.waitingSecret}
      onSubmit={(value) => runId && provideSecret(runId, state.waitingSecret as string, value)}
    />
  </>
) : (
  <>
    {/* 기존 진행바 블록 그대로 */}
    {state.section === "auth" && <AuthGuidePanel guide={auth?.guide ?? []} />}
  </>
)}
```

- `runId`를 상태로 보관: `const [runId, setRunId] = useState<string | null>(null);` (startFlow 결과 저장)
- `src/App.tsx`에서 `/auth/:toolId` 라우트와 `Auth` import 제거, `src/screens/Auth.tsx` 삭제.

- [ ] **Step 8: Wizard 라이프사이클 테스트 갱신**

`src/screens/__tests__/wizard-lifecycle.test.tsx`에 추가 (이 파일은 이미 `vi.mock("../../lib/ipc")` 모듈 mock을 쓴다. `fireEvent`, `screen`, `act` import 추가):

```tsx
it("waitingSecret에서 비밀값 폼을 띄우고 제출을 provideSecret으로 잇는다", async () => {
  let fireProgress: ((ev: ProgressEvent) => void) | undefined;
  vi.mocked(ipc.getDryRun).mockResolvedValue({
    ...dryRun,
    auth: { pattern: "api_key", guide: ["발급 페이지에서 열쇠를 복사하세요"] },
  });
  vi.mocked(ipc.startFlow).mockResolvedValue("run-1");
  vi.mocked(ipc.onProgress).mockImplementation(async (_runId, cb) => {
    fireProgress = cb;
    return vi.fn();
  });
  vi.mocked(ipc.onLog).mockResolvedValue(vi.fn());
  vi.mocked(ipc.provideSecret).mockResolvedValue(undefined);

  render(
    <MemoryRouter initialEntries={["/wizard/mock-tool"]}>
      <Routes>
        <Route path="/wizard/:toolId" element={<Wizard />} />
      </Routes>
    </MemoryRouter>,
  );
  await waitFor(() => expect(fireProgress).toBeDefined());
  act(() =>
    fireProgress!({
      runId: "run-1", recipeId: "mock-tool", recipeName: "모의 도구", section: "auth",
      stepIndex: 0, totalSteps: 2, friendly: "열쇠를 넣어 주세요",
      status: { kind: "waitingSecret", label: "api_key" },
    }),
  );
  const input = await screen.findByLabelText(/열쇠 값/);
  fireEvent.change(input, { target: { value: "sk-1" } });
  fireEvent.click(screen.getByRole("button", { name: "등록하기" }));
  expect(ipc.provideSecret).toHaveBeenCalledWith("run-1", "api_key", "sk-1");
});
```

(`ProgressEvent` 타입은 `../../lib/types`에서 import.)

Run: `bun run test`
Expected: PASS

- [ ] **Step 9: 커밋**

```bash
git add -A src src-tauri/src/runner/dry_run.rs
git commit -m "feat: 인증 실플로우 1차 (auth 패턴·가이드 노출, 비밀값 폼, 마법사 통합, Auth 화면 삭제)

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

### Task 14: PTY 백엔드 (portable-pty 0.9)

`pty_session` 스텝을 실동작시킨다. 대화형 인증(Claude Code `/login` 등)을 내장 터미널로 진행하기 위한 백엔드: PTY를 열어 명령을 실행하고, 출력을 `pty://data` 이벤트로 스트리밍하며, `pty_input` 커맨드로 입력을 받는다. 종료 코드 0이면 스텝 성공.

의존성 결정(2026-07-05 crates.io·GitHub 라이브 확인): tauri-plugin-pty 0.3.0은 정식 릴리스 태그가 없는 초기 단계 1인 프로젝트라 배제. wezterm이 프로덕션에서 쓰는 portable-pty 0.9.0을 직접 감싼다.

**Files:**
- Modify: `src-tauri/Cargo.toml`, `src-tauri/src/runner/mod.rs`, `src-tauri/src/runner/step_runner.rs`, `src-tauri/src/runner/events.rs`, `src-tauri/src/commands.rs`, `src-tauri/src/lib.rs`
- Create: `src-tauri/src/runner/pty.rs`

**Interfaces:**
- Consumes: `RunDeps`(Task 4에서 확장된 형태), `ProgressEmitter`(기존)
- Produces:
  - `trait PtyRunner { async fn run(&self, session_id: &str, command: &str, args: &[String]) -> std::io::Result<i32> }`
  - `PortablePtyRunner { app: AppHandle, inputs: PtyInputRegistry }` 실구현, `FakePtyRunner` 테스트용
  - `StepStatus::Terminal { session_id: String }` (serde tag kind="terminal", camelCase `sessionId`)
  - Tauri 커맨드 `pty_input(session_id: String, data: String)`
  - 이벤트 `pty://data` payload `{ sessionId: string, data: string }`
  - `PtyInputRegistry = Arc<Mutex<HashMap<String, Box<dyn Write + Send>>>>` (AppContext에 보관)

- [ ] **Step 1: Cargo.toml에 portable-pty 추가**

```toml
portable-pty = "0.9"
```

Run: `cargo check --manifest-path src-tauri/Cargo.toml` → OK

- [ ] **Step 2: 실패하는 step_runner 테스트 작성**

`step_runner.rs` tests에 추가:

```rust
#[tokio::test]
async fn pty_step_emits_terminal_status_and_succeeds_on_exit_zero() {
    use crate::recipe::plan::{InstallPlan, PlannedStep, Section};
    use crate::recipe::schema::Step;
    use crate::runner::pty::FakePtyRunner;
    let catalog = Catalog::load_dir(&Catalog::fixture_dir()).unwrap();
    let plan = InstallPlan {
        target_id: "mock-tool".into(),
        tool_order: vec!["mock-tool".into()],
        steps: vec![PlannedStep {
            recipe_id: "mock-tool".into(),
            recipe_name: "모의 도구".into(),
            section: Section::Auth,
            step: Step::PtySession {
                friendly: "로그인을 터미널에서 도와드릴게요".into(),
                command: "claude".into(),
                args: vec![],
            },
        }],
    };
    let process = FakeProcessRunner::new(vec![]);
    let emitter = CollectingEmitter::default();
    let opener = FakeUrlOpener::default();
    let downloader = crate::runner::download::FakeDownloader::default();
    let pty = FakePtyRunner::new(vec![Ok(0)]);
    let (_tx, mut rx) = tokio::sync::mpsc::channel(1);
    let deps = RunDeps {
        process: &process,
        emitter: &emitter,
        opener: &opener,
        downloader: &downloader,
        pty: &pty,
        vault: SecretVault::new(),
    };
    let report = run_plan(&plan, &catalog, Platform::Mac, "run-p", deps, &mut rx).await;
    assert!(report.success);
    let evs = emitter.events();
    assert!(evs.iter().any(|e| matches!(&e.status, StepStatus::Terminal { session_id } if session_id == "run-p-pty-0")));
    assert_eq!(pty.calls(), vec![("run-p-pty-0".to_string(), "claude".to_string())]);
}

#[tokio::test]
async fn pty_step_nonzero_exit_fails_run() {
    // 위와 동일 구성에서 FakePtyRunner::new(vec![Ok(1)])로 바꾸면
    // report.success == false, 마지막 이벤트 Done { success: false }
}
```

(두 번째 테스트도 완전한 코드로 작성한다. 구성이 동일하므로 헬퍼 fn `pty_plan()`으로 플랜 구성을 공유.)

- [ ] **Step 3: 실패 확인**

Run: `cargo test --manifest-path src-tauri/Cargo.toml pty_step`
Expected: FAIL (컴파일 에러: pty 모듈·필드 없음)

- [ ] **Step 4: PtyRunner trait + Fake 구현**

Create `src-tauri/src/runner/pty.rs`:

```rust
use std::collections::HashMap;
use std::io::Write;
use std::sync::{Arc, Mutex};

/// 세션별 PTY 입력 쓰기 핸들 (pty_input 커맨드가 사용)
pub type PtyInputRegistry = Arc<Mutex<HashMap<String, Box<dyn Write + Send>>>>;

pub trait PtyRunner: Send + Sync {
    /// PTY에서 command를 실행하고 종료 코드를 돌려준다.
    /// 실행 중 출력은 구현체가 이벤트로 스트리밍한다.
    fn run(
        &self,
        session_id: &str,
        command: &str,
        args: &[String],
    ) -> impl std::future::Future<Output = std::io::Result<i32>> + Send;
}

/// 테스트용: 종료 코드를 순서대로 돌려주고 호출을 기록한다.
#[doc(hidden)]
#[derive(Default)]
pub struct FakePtyRunner {
    responses: Mutex<Vec<std::io::Result<i32>>>,
    calls: Mutex<Vec<(String, String)>>,
}

impl FakePtyRunner {
    pub fn new(mut responses: Vec<std::io::Result<i32>>) -> Self {
        responses.reverse();
        FakePtyRunner {
            responses: Mutex::new(responses),
            calls: Mutex::new(Vec::new()),
        }
    }
    pub fn calls(&self) -> Vec<(String, String)> {
        self.calls.lock().unwrap().clone()
    }
}

impl PtyRunner for FakePtyRunner {
    async fn run(&self, session_id: &str, command: &str, _args: &[String]) -> std::io::Result<i32> {
        self.calls
            .lock()
            .unwrap()
            .push((session_id.to_string(), command.to_string()));
        self.responses.lock().unwrap().pop().unwrap_or(Ok(0))
    }
}
```

- [ ] **Step 5: StepStatus::Terminal 추가 + run_plan 분기**

`events.rs`의 `StepStatus`에 variant 추가:

```rust
Terminal { session_id: String },
```

(serde 컨테이너 속성이 `rename_all = "camelCase"`이므로 JSON은 `{"kind":"terminal","sessionId":"..."}`.)

`step_runner.rs`의 `run_plan` 루프에서 `execute_step` 호출 전에 PtySession 분기:

```rust
if let Step::PtySession { command, args, .. } = &planned.step {
    let session_id = format!("{run_id}-pty-{i}");
    deps.emitter.progress(&ev(StepStatus::Terminal {
        session_id: session_id.clone(),
    }));
    let command = deps.vault.substitute(command);
    let args: Vec<String> = args.iter().map(|a| deps.vault.substitute(a)).collect();
    match deps.pty.run(&session_id, &command, &args).await {
        Ok(0) => {
            deps.emitter.progress(&ev(StepStatus::Succeeded));
            continue;
        }
        Ok(code) => {
            deps.emitter.log(run_id, &format!("터미널 세션 종료 코드 {code}"));
            let failed = ev(StepStatus::Failed {
                message: "로그인이 끝까지 진행되지 않았어요. 다시 시도해 볼까요?".into(),
            });
            deps.emitter.progress(&failed);
            rollback(planned, catalog, platform, run_id, &deps).await;
            deps.emitter.progress(&done(false, "설치를 마치지 못했어요"));
            return RunReport { success: false, failed_step: Some(failed) };
        }
        Err(e) => {
            deps.emitter.log(run_id, &e.to_string());
            let failed = ev(StepStatus::Failed {
                message: "터미널을 열지 못했어요. 다시 시도해 볼까요?".into(),
            });
            deps.emitter.progress(&failed);
            rollback(planned, catalog, platform, run_id, &deps).await;
            deps.emitter.progress(&done(false, "설치를 마치지 못했어요"));
            return RunReport { success: false, failed_step: Some(failed) };
        }
    }
}
```

`RunDeps`에 `pub pty: &'a Y` (제네릭 `Y: PtyRunner`) 추가, 기존 테스트 전부 `FakePtyRunner::default()` 전달.

Run: `cargo test --manifest-path src-tauri/Cargo.toml pty_step` → PASS

- [ ] **Step 6: PortablePtyRunner 실구현**

`pty.rs`에 추가:

```rust
use portable_pty::{native_pty_system, CommandBuilder, PtySize};
use serde::Serialize;
use tauri::{AppHandle, Emitter};

#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
struct PtyDataPayload {
    session_id: String,
    data: String,
}

pub struct PortablePtyRunner {
    pub app: AppHandle,
    pub inputs: PtyInputRegistry,
}

impl PtyRunner for PortablePtyRunner {
    async fn run(&self, session_id: &str, command: &str, args: &[String]) -> std::io::Result<i32> {
        let pty_system = native_pty_system();
        let pair = pty_system
            .openpty(PtySize { rows: 30, cols: 100, pixel_width: 0, pixel_height: 0 })
            .map_err(std::io::Error::other)?;
        let mut cmd = CommandBuilder::new(command);
        cmd.args(args);
        let mut child = pair.slave.spawn_command(cmd).map_err(std::io::Error::other)?;
        drop(pair.slave);

        let writer = pair.master.take_writer().map_err(std::io::Error::other)?;
        self.inputs
            .lock()
            .unwrap()
            .insert(session_id.to_string(), writer);

        let mut reader = pair.master.try_clone_reader().map_err(std::io::Error::other)?;
        let app = self.app.clone();
        let sid = session_id.to_string();
        let read_task = tauri::async_runtime::spawn_blocking(move || {
            let mut buf = [0u8; 4096];
            loop {
                match std::io::Read::read(&mut reader, &mut buf) {
                    Ok(0) | Err(_) => break,
                    Ok(n) => {
                        let _ = app.emit(
                            "pty://data",
                            &PtyDataPayload {
                                session_id: sid.clone(),
                                data: String::from_utf8_lossy(&buf[..n]).into_owned(),
                            },
                        );
                    }
                }
            }
        });

        let status = tauri::async_runtime::spawn_blocking(move || child.wait())
            .await
            .map_err(std::io::Error::other)?
            .map_err(std::io::Error::other)?;
        let _ = read_task.await;
        self.inputs.lock().unwrap().remove(session_id);
        // master는 여기서 drop되며 reader도 EOF로 끝난다
        Ok(status.exit_code() as i32)
    }
}
```

- [ ] **Step 7: pty_input 커맨드 + AppContext 배선**

`commands.rs`:
- `AppContext`에 `pub pty_inputs: crate::runner::pty::PtyInputRegistry` 필드 추가 (lib.rs setup에서 `Arc::new(Mutex::new(HashMap::new()))`).
- `start_flow`의 실모드 분기에서 `let pty = PortablePtyRunner { app: app.clone(), inputs: ctx_inputs.clone() };` (spawn 전에 `let ctx_inputs = ctx.pty_inputs.clone();`) 하고 `RunDeps`에 전달.
- 신규 커맨드:

```rust
#[tauri::command]
pub fn pty_input(session_id: String, data: String, ctx: State<'_, AppContext>) -> Result<(), String> {
    let mut inputs = ctx.pty_inputs.lock().unwrap();
    let writer = inputs
        .get_mut(&session_id)
        .ok_or_else(|| "터미널 세션을 찾지 못했어요".to_string())?;
    writer
        .write_all(data.as_bytes())
        .and_then(|_| writer.flush())
        .map_err(|e| e.to_string())
}
```

`lib.rs` invoke_handler에 `commands::pty_input` 등록.

- [ ] **Step 8: 전체 통과 확인**

Run: `cargo test --manifest-path src-tauri/Cargo.toml && cargo clippy --manifest-path src-tauri/Cargo.toml --all-targets -- -D warnings`
Expected: PASS. (PortablePtyRunner 자체는 유닛 테스트 대상이 아니다. 실제 셸 스폰 통합 검증은 Task 20의 스모크에서 수행.)

- [ ] **Step 9: 커밋**

```bash
git add src-tauri
git commit -m "feat: pty_session 실행기 (portable-pty 0.9, pty://data 스트림, pty_input 커맨드)

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

### Task 15: 내장 터미널 프론트 (@xterm/xterm 6.0)

`terminal` 상태를 받으면 마법사 안에 내장 터미널을 띄우고, 옆에 레시피의 한국어 인증 가이드를 병행 표시한다 (스펙 6절 대화형 터미널형).

**Files:**
- Modify: `package.json`(xterm 추가), `src/lib/types.ts`, `src/lib/ipc.ts`, `src/lib/runReducer.ts`, `src/screens/Wizard.tsx`
- Create: `src/components/TerminalPanel.tsx`
- Test: `src/lib/__tests__/runReducer.test.ts`, `src/components/__tests__/terminalpanel.test.tsx`

**Interfaces:**
- Consumes: `pty://data` 이벤트, `pty_input` 커맨드 (Task 14), `AuthGuidePanel` (Task 13)
- Produces:
  - TS `StepStatus`에 `{ kind: "terminal"; sessionId: string }` 추가
  - `RunState.terminalSession: string | null`
  - `ipc.ts`: `ptyInput(sessionId, data)`, `onPtyData(sessionId, cb)`
  - `<TerminalPanel sessionId={string} />`

- [ ] **Step 1: 설치**

```bash
bun add @xterm/xterm@6.0.0
```

- [ ] **Step 2: 실패하는 reducer 테스트 작성**

`runReducer.test.ts`에 추가:

```ts
it("terminal 상태가 세션 id를 노출하고 다음 running에서 닫힌다", () => {
  let s = runReducer(initialRunState("mock-tool"), ev({ status: { kind: "terminal", sessionId: "r-pty-0" } }));
  expect(s.terminalSession).toBe("r-pty-0");
  s = runReducer(s, ev({ status: { kind: "running" } }));
  expect(s.terminalSession).toBeNull();
});
```

Run: `bun run test -- runReducer` → FAIL (타입·필드 없음)

- [ ] **Step 3: 타입·IPC·reducer 구현**

`types.ts`의 `StepStatus` union에 `| { kind: "terminal"; sessionId: string }` 추가.

`ipc.ts`에 추가:

```ts
export const ptyInput = (sessionId: string, data: string) =>
  invoke<void>("pty_input", { sessionId, data });

export function onPtyData(sessionId: string, cb: (data: string) => void): Promise<UnlistenFn> {
  return listen<{ sessionId: string; data: string }>("pty://data", (e) => {
    if (e.payload.sessionId === sessionId) cb(e.payload.data);
  });
}
```

`runReducer.ts`: `RunState`에 `terminalSession: string | null` 추가(initial은 null), switch에 추가:

```ts
case "terminal":
  return { ...base, terminalSession: ev.status.sessionId };
case "running":
  return { ...base, waitingSecret: null, terminalSession: null };
```

Run: `bun run test -- runReducer` → PASS

- [ ] **Step 4: TerminalPanel 구현 (테스트 먼저)**

Create `src/components/__tests__/terminalpanel.test.tsx` (xterm은 jsdom에서 실렌더가 안 되므로 모듈 모킹, IPC는 기존 wizard 테스트처럼 `vi.mock` 모듈 mock):

```tsx
import { render } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

const write = vi.fn();
const onData = vi.fn(() => ({ dispose: vi.fn() }));
const open = vi.fn();
const disposeTerm = vi.fn();
vi.mock("@xterm/xterm", () => ({
  Terminal: vi.fn(() => ({ open, write, onData, dispose: disposeTerm })),
}));
vi.mock("@xterm/xterm/css/xterm.css", () => ({}));
vi.mock("../../lib/ipc");

import * as ipc from "../../lib/ipc";
import { TerminalPanel } from "../TerminalPanel";

describe("TerminalPanel", () => {
  afterEach(() => vi.clearAllMocks());

  it("pty 데이터를 터미널에 쓰고 언마운트 시 구독과 터미널을 정리한다", async () => {
    let fire: ((data: string) => void) | undefined;
    const unlisten = vi.fn();
    vi.mocked(ipc.onPtyData).mockImplementation(async (_sessionId, cb) => {
      fire = cb;
      return unlisten;
    });

    const { unmount } = render(<TerminalPanel sessionId="r-pty-0" />);
    await vi.waitFor(() =>
      expect(ipc.onPtyData).toHaveBeenCalledWith("r-pty-0", expect.any(Function)),
    );
    fire?.("hello");
    expect(write).toHaveBeenCalledWith("hello");

    unmount();
    expect(unlisten).toHaveBeenCalled();
    expect(disposeTerm).toHaveBeenCalled();
  });
});
```

Create `src/components/TerminalPanel.tsx`:

```tsx
import { useEffect, useRef } from "react";
import { Terminal } from "@xterm/xterm";
import "@xterm/xterm/css/xterm.css";
import { onPtyData, ptyInput } from "../lib/ipc";

export function TerminalPanel({ sessionId }: { sessionId: string }) {
  const hostRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!hostRef.current) return;
    const term = new Terminal({ cols: 100, rows: 30, convertEol: true, fontFamily: "JetBrains Mono Variable, monospace" });
    term.open(hostRef.current);
    const sub = term.onData((data) => { void ptyInput(sessionId, data); });
    let unlisten: (() => void) | undefined;
    void onPtyData(sessionId, (data) => term.write(data)).then((un) => { unlisten = un; });
    return () => {
      sub.dispose();
      unlisten?.();
      term.dispose();
    };
  }, [sessionId]);

  return (
    <div className="mt-8 overflow-hidden rounded-card border border-line dark:border-line-dark bg-[#111111] p-3 text-left" ref={hostRef} />
  );
}
```

Run: `bun run test -- terminalpanel` → PASS

- [ ] **Step 5: Wizard 통합**

`Wizard.tsx` 진행 분기에 터미널 상태 추가 (Task 13의 waitingSecret 분기와 병렬):

```tsx
{state.terminalSession ? (
  <>
    <h1 className="text-display font-extrabold">아래 까만 창에서 로그인을 도와드릴게요</h1>
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-[2fr_1fr]">
      <TerminalPanel sessionId={state.terminalSession} />
      <AuthGuidePanel guide={auth?.guide ?? []} />
    </div>
  </>
) : state.waitingSecret ? (
  /* Task 13 분기 그대로 */
) : (
  /* 진행바 분기 그대로 */
)}
```

Run: `bun run test && bun run build` → PASS

- [ ] **Step 6: 커밋**

```bash
git add -A src package.json bun.lock
git commit -m "feat: 내장 터미널 (xterm 6, pty 스트림 배선, 인증 가이드 병행 표시)

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

### Task 16: 마법사·대시보드 실모드 전환 (demo:false)

M2의 데모 고정(`startFlow(..., true)`)을 실모드로 전환한다. StrictMode(dev)의 이펙트 이중 실행이 실설치를 두 번 시작하지 않도록 시작 가드를 넣는다.

**Files:**
- Modify: `src/screens/Wizard.tsx`, `src/screens/Dashboard.tsx`
- Test: `src/screens/__tests__/wizard-lifecycle.test.tsx`

**Interfaces:**
- Consumes: `startFlow`(기존), Task 13의 runId 상태
- Produces: 실모드 마법사. `startFlow` 데모 파라미터는 유지(개발·테스트용).

- [ ] **Step 1: 실패하는 테스트 작성**

`wizard-lifecycle.test.tsx`에 추가 (기존 `vi.mock("../../lib/ipc")` 그대로 사용):

```tsx
it("실모드로 한 번만 시작한다 (StrictMode 이중 마운트 가드)", async () => {
  vi.mocked(ipc.getDryRun).mockResolvedValue(dryRun);
  vi.mocked(ipc.startFlow).mockResolvedValue("run-1");
  vi.mocked(ipc.onProgress).mockResolvedValue(vi.fn());
  vi.mocked(ipc.onLog).mockResolvedValue(vi.fn());

  render(
    <StrictMode>
      <MemoryRouter initialEntries={["/wizard/mock-tool"]}>
        <Routes>
          <Route path="/wizard/:toolId" element={<Wizard />} />
        </Routes>
      </MemoryRouter>
    </StrictMode>,
  );
  await waitFor(() => expect(ipc.startFlow).toHaveBeenCalled());
  expect(vi.mocked(ipc.startFlow)).toHaveBeenCalledTimes(1);
  expect(vi.mocked(ipc.startFlow)).toHaveBeenCalledWith("mock-tool", "install", false);
});
```

Run: `bun run test -- wizard-lifecycle` → FAIL (현재는 demo가 true이고, StrictMode에서 2회 호출)

- [ ] **Step 2: 시작 가드 + 실모드 구현**

`Wizard.tsx`: 이펙트 안의 시작 로직을 ref 가드로 감싼다. StrictMode 재실행은 같은 컴포넌트 인스턴스에서 이펙트만 다시 도는 것이므로 ref가 유지된다. 재시도(attempt)와 도구 변경은 키가 달라져 새로 시작한다.

```tsx
const startRef = useRef<{ key: string; promise: Promise<{ runId: string; auth: DryRunAuth | null; toolName: string }> } | null>(null);

useEffect(() => {
  let cancelled = false;
  let unProgress: (() => void) | undefined;
  let unLog: (() => void) | undefined;

  setState(initialRunState(toolId));
  const key = `${toolId}:${attempt}`;
  if (!startRef.current || startRef.current.key !== key) {
    startRef.current = {
      key,
      promise: (async () => {
        const preview = await getDryRun(toolId);
        const target = preview.steps.find((s) => s.recipeId === toolId);
        const runId = await startFlow(toolId, "install", false);
        return { runId, auth: preview.auth, toolName: target?.recipeName ?? toolId };
      })(),
    };
  }
  (async () => {
    try {
      const { runId, auth, toolName } = await startRef.current!.promise;
      if (cancelled) return;
      setToolName(toolName);
      setAuth(auth);
      setRunId(runId);
      const p = await onProgress(runId, (ev) => setState((s) => runReducer(s, ev)));
      if (cancelled) { p(); return; }
      unProgress = p;
      const l = await onLog(runId, (line) => setState((s) => appendLog(s, line)));
      if (cancelled) { l(); return; }
      unLog = l;
    } catch {
      if (!cancelled) {
        setState((s) => ({ ...s, error: { message: "시작하지 못했어요. 다시 시도해 볼까요?", friendly: "준비 단계" } }));
      }
    }
  })();

  return () => {
    cancelled = true;
    unProgress?.();
    unLog?.();
  };
}, [toolId, attempt]);
```

`Dashboard.tsx`: `startFlow(id, "uninstall", true)` → `startFlow(id, "uninstall", false)`. 그리고 `setTimeout(reload, 500)`을 `onProgress` done 이벤트 대기로 교체:

```tsx
const uninstall = async (id: string) => {
  if (!window.confirm(`${nameOf(id)}을(를) 지울까요? 설정과 기록도 함께 정리돼요.`)) return;
  const runId = await startFlow(id, "uninstall", false);
  const un = await onProgress(runId, (ev) => {
    if (ev.status.kind === "done") {
      un();
      reload();
    }
  });
};
```

- [ ] **Step 3: 통과 확인**

Run: `bun run test` → PASS

- [ ] **Step 4: 커밋**

```bash
git add src/screens/Wizard.tsx src/screens/Dashboard.tsx src/screens/__tests__/wizard-lifecycle.test.tsx
git commit -m "feat: 마법사·대시보드 실모드 전환 (StrictMode 이중 시작 가드, M2 이월)

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

### Task 17: 진단 zip 내보내기

스펙 7절: 실패 문의용 진단 파일. 환경 진단·설치 상태·최근 실행 로그(마스킹 완료본)를 zip으로 묶어 다운로드 폴더에 저장하고 Finder/탐색기에서 보여준다. (zip 크레이트 8.6.0, 2026-04-25 발행, crates.io 2026-07-05 확인)

**Files:**
- Modify: `src-tauri/Cargo.toml`, `src-tauri/src/commands.rs`, `src-tauri/src/lib.rs`, `src/screens/Settings.tsx`, `src/lib/ipc.ts`
- Create: `src-tauri/src/runner/diagnostics.rs`
- Test: diagnostics.rs 유닛 테스트, `src/screens/__tests__/settings.test.tsx`

**Interfaces:**
- Consumes: `probe_env`, `StateStore::load`, `AppContext`(run 로그 기록 추가)
- Produces:
  - `AppContext.run_logs: Mutex<HashMap<String, Vec<String>>>` (TauriEmitter.log가 기록, 런당 2000줄 제한)
  - `diagnostics::build_zip(dest: &Path, env_json: &str, state_json: &str, logs: &[(String, Vec<String>)]) -> Result<(), EngineError>`
  - Tauri 커맨드 `export_diagnostics() -> Result<String, String>` (저장된 zip 경로 반환)
  - `ipc.ts`: `exportDiagnostics(): Promise<string>`

- [ ] **Step 1: Cargo.toml에 zip 추가**

```toml
zip = { version = "8", default-features = false, features = ["deflate"] }
```

- [ ] **Step 2: 실패하는 zip 빌더 테스트 작성**

Create `src-tauri/src/runner/diagnostics.rs` (테스트 먼저):

```rust
use std::io::Write;
use std::path::Path;

use crate::error::EngineError;

pub fn build_zip(
    dest: &Path,
    env_json: &str,
    state_json: &str,
    logs: &[(String, Vec<String>)],
) -> Result<(), EngineError> {
    todo!()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn zip_contains_env_state_and_logs() {
        let dir = tempfile::tempdir().unwrap();
        let dest = dir.path().join("diag.zip");
        build_zip(
            &dest,
            r#"{"os":"mac"}"#,
            r#"{"installations":[]}"#,
            &[("run-1".into(), vec!["첫 줄".into(), "둘째 줄".into()])],
        )
        .unwrap();
        let file = std::fs::File::open(&dest).unwrap();
        let mut zip = zip::ZipArchive::new(file).unwrap();
        let names: Vec<String> = (0..zip.len())
            .map(|i| zip.by_index(i).unwrap().name().to_string())
            .collect();
        assert!(names.contains(&"env.json".to_string()));
        assert!(names.contains(&"installed.json".to_string()));
        assert!(names.contains(&"logs/run-1.log".to_string()));
        let mut body = String::new();
        std::io::Read::read_to_string(&mut zip.by_name("logs/run-1.log").unwrap(), &mut body).unwrap();
        assert!(body.contains("둘째 줄"));
    }
}
```

Run: `cargo test --manifest-path src-tauri/Cargo.toml zip_contains` → FAIL (todo! 패닉)

- [ ] **Step 3: build_zip 구현**

```rust
pub fn build_zip(
    dest: &Path,
    env_json: &str,
    state_json: &str,
    logs: &[(String, Vec<String>)],
) -> Result<(), EngineError> {
    let file = std::fs::File::create(dest)?;
    let mut zip = zip::ZipWriter::new(file);
    let opts: zip::write::SimpleFileOptions = Default::default();
    zip.start_file("env.json", opts).map_err(std::io::Error::other)?;
    zip.write_all(env_json.as_bytes())?;
    zip.start_file("installed.json", opts).map_err(std::io::Error::other)?;
    zip.write_all(state_json.as_bytes())?;
    for (run_id, lines) in logs {
        zip.start_file(format!("logs/{run_id}.log"), opts).map_err(std::io::Error::other)?;
        zip.write_all(lines.join("\n").as_bytes())?;
    }
    zip.finish().map_err(std::io::Error::other)?;
    Ok(())
}
```

`runner/mod.rs`에 `pub mod diagnostics;` 추가.

Run: `cargo test --manifest-path src-tauri/Cargo.toml zip_contains` → PASS

- [ ] **Step 4: 로그 기록 + 커맨드 배선**

`commands.rs`:
- `AppContext`에 `pub run_logs: Mutex<HashMap<String, Vec<String>>>` 추가 (lib.rs setup에서 빈 맵).
- `TauriEmitter`에 앱 상태로 기록 추가:

```rust
fn log(&self, run_id: &str, line: &str) {
    if let Some(ctx) = self.app.try_state::<AppContext>() {
        let mut logs = ctx.run_logs.lock().unwrap();
        let entry = logs.entry(run_id.to_string()).or_default();
        entry.push(line.to_string());
        let len = entry.len();
        if len > 2000 {
            entry.drain(0..len - 2000);
        }
    }
    // 기존 emit 유지
}
```

- 신규 커맨드:

```rust
#[tauri::command]
pub async fn export_diagnostics(app: AppHandle, ctx: State<'_, AppContext>) -> Result<String, String> {
    let env = probe_env(&TokioProcessRunner).await;
    let env_json = serde_json::to_string_pretty(&env).map_err(|e| e.to_string())?;
    let state_json =
        serde_json::to_string_pretty(&ctx.store.load()).map_err(|e| e.to_string())?;
    let logs: Vec<(String, Vec<String>)> = ctx
        .run_logs
        .lock()
        .unwrap()
        .iter()
        .map(|(k, v)| (k.clone(), v.clone()))
        .collect();
    let dir = app
        .path()
        .download_dir()
        .map_err(|e| e.to_string())?;
    let dest = dir.join(format!("easy-harness-diagnostics-{}.zip", crate::state::now_unix()));
    crate::runner::diagnostics::build_zip(&dest, &env_json, &state_json, &logs)
        .map_err(|e| e.to_string())?;
    let _ = app.opener().reveal_item_in_dir(&dest);
    Ok(dest.to_string_lossy().into_owned())
}
```

`lib.rs` invoke_handler에 등록. `ipc.ts`에 `export const exportDiagnostics = () => invoke<string>("export_diagnostics");` 추가.

- [ ] **Step 5: Settings 버튼 (테스트 먼저)**

Create `src/screens/__tests__/settings.test.tsx`:

```tsx
import { render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { mockIPC, clearMocks } from "@tauri-apps/api/mocks";
import { Settings } from "../Settings";

describe("설정 화면", () => {
  afterEach(() => clearMocks());

  it("진단 파일을 저장하고 결과 안내를 보여준다", async () => {
    mockIPC((cmd) => {
      if (cmd === "export_diagnostics") return "/Users/me/Downloads/easy-harness-diagnostics-1.zip";
    });
    render(<Settings />);
    screen.getByRole("button", { name: "진단 파일 저장하기" }).click();
    expect(await screen.findByText(/다운로드 폴더에 저장했어요/)).toBeInTheDocument();
  });
});
```

`src/screens/Settings.tsx` 구현:

```tsx
import { useState } from "react";
import { PrimaryButton } from "../components/Buttons";
import { exportDiagnostics } from "../lib/ipc";

export function Settings() {
  const [saved, setSaved] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);
  return (
    <div>
      <h1 className="text-title font-extrabold">설정</h1>
      <section className="mt-6 max-w-xl rounded-card border border-line dark:border-line-dark bg-surface-card dark:bg-surface-card-dark p-6 shadow-card">
        <h2 className="font-bold">문제가 생겼나요?</h2>
        <p className="mt-1 text-caption text-txt-tertiary">
          무슨 일이 있었는지 담은 진단 파일을 만들어 드려요. 문의할 때 첨부하면 빨라요. 비밀값은 자동으로 가려져요.
        </p>
        <PrimaryButton
          className="mt-4"
          onClick={() => {
            setFailed(false);
            exportDiagnostics().then(setSaved).catch(() => setFailed(true));
          }}
        >
          진단 파일 저장하기
        </PrimaryButton>
        {saved && <p className="mt-3 font-bold text-status-success">다운로드 폴더에 저장했어요</p>}
        {failed && <p className="mt-3 font-bold text-status-error">저장이 안 됐어요. 다시 한 번 눌러 주세요.</p>}
      </section>
    </div>
  );
}
```

Run: `bun run test -- settings` → PASS

- [ ] **Step 6: 전체 확인 + 커밋**

Run: `cargo test --manifest-path src-tauri/Cargo.toml && bun run test`

```bash
git add -A src src-tauri
git commit -m "feat: 진단 zip 내보내기 (환경·상태·마스킹 로그, 다운로드 폴더 저장)

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

### Task 18: 레시피 번들 서명 검증 (ed25519) + 서명 도구

원격 레시피 위·변조 차단. 번들(JSON)과 분리 서명(base64)을 ed25519로 검증한다. (ed25519-dalek 2.2.0 stable 고정, 2026-07-05 확인: 3.0은 아직 rc.1이라 채택하지 않음. 검증은 반드시 `verify_strict` 사용: 약한 공개키·malleable 서명 거부.)

**Files:**
- Modify: `src-tauri/Cargo.toml`, `src-tauri/src/recipe/mod.rs`
- Create: `src-tauri/src/recipe/signing.rs`, `src-tauri/src/bin/sign_recipes.rs`

**Interfaces:**
- Consumes: 없음 (독립 모듈)
- Produces:
  - `signing::verify_bundle(bundle: &[u8], sig_b64: &str, pubkey_b64: &str) -> Result<(), EngineError>`
  - `signing::RECIPE_PUBKEY_B64: &str` (배포 공개키 상수)
  - `cargo run --manifest-path src-tauri/Cargo.toml --bin sign_recipes -- keygen|sign <파일>` 개발 도구
  - `EngineError::SignatureInvalid` variant

- [ ] **Step 1: Cargo.toml에 의존성 추가**

```toml
ed25519-dalek = "2.2"
base64 = "0.22"
```

(base64 0.22는 이미 널리 쓰이는 stable 라인. `cargo add base64`가 다른 최신 버전을 제안하면 그것을 따른다.)

- [ ] **Step 2: 실패하는 검증 테스트 작성**

Create `src-tauri/src/recipe/signing.rs`:

```rust
use base64::Engine as _;
use ed25519_dalek::{Signature, VerifyingKey};

use crate::error::EngineError;

/// 레시피 배포 공개키 (base64, 32바이트).
/// Step 4에서 sign_recipes keygen으로 실키를 만들어 이 값을 교체한다.
/// (그 전까지는 유효하지 않은 값이라 원격 캐시 검증이 항상 실패 = 안전한 기본값)
pub const RECIPE_PUBKEY_B64: &str = "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=";

pub fn verify_bundle(bundle: &[u8], sig_b64: &str, pubkey_b64: &str) -> Result<(), EngineError> {
    let invalid = |m: &str| EngineError::SignatureInvalid(m.to_string());
    let pk_bytes = base64::engine::general_purpose::STANDARD
        .decode(pubkey_b64)
        .map_err(|_| invalid("공개키 형식"))?;
    let pk_bytes: [u8; 32] = pk_bytes.try_into().map_err(|_| invalid("공개키 길이"))?;
    let key = VerifyingKey::from_bytes(&pk_bytes).map_err(|_| invalid("공개키"))?;
    let sig_bytes = base64::engine::general_purpose::STANDARD
        .decode(sig_b64.trim())
        .map_err(|_| invalid("서명 형식"))?;
    let sig_bytes: [u8; 64] = sig_bytes.try_into().map_err(|_| invalid("서명 길이"))?;
    let sig = Signature::from_bytes(&sig_bytes);
    key.verify_strict(bundle, &sig).map_err(|_| invalid("서명 불일치"))
}

#[cfg(test)]
mod tests {
    use super::*;
    use base64::Engine as _;
    use ed25519_dalek::{Signer, SigningKey};

    fn test_key() -> SigningKey {
        SigningKey::from_bytes(&[7u8; 32]) // 테스트 전용 고정 키
    }

    #[test]
    fn valid_signature_passes_and_tampered_fails() {
        let key = test_key();
        let pubkey_b64 =
            base64::engine::general_purpose::STANDARD.encode(key.verifying_key().to_bytes());
        let bundle = br#"{"version":1,"recipes":[]}"#;
        let sig_b64 =
            base64::engine::general_purpose::STANDARD.encode(key.sign(bundle).to_bytes());
        assert!(verify_bundle(bundle, &sig_b64, &pubkey_b64).is_ok());
        let tampered = br#"{"version":2,"recipes":[]}"#;
        assert!(verify_bundle(tampered, &sig_b64, &pubkey_b64).is_err());
        assert!(verify_bundle(bundle, &sig_b64, "invalid!!").is_err());
    }
}
```

`recipe/mod.rs`에 `pub mod signing;` 추가. `error.rs`에 variant 추가:

```rust
#[error("레시피 서명이 올바르지 않아요: {0}")]
SignatureInvalid(String),
```

Run: `cargo test --manifest-path src-tauri/Cargo.toml signing` → PASS (구현이 곧바로 맞으면 통과. 실패하면 고친다)

- [ ] **Step 3: 서명 도구 작성**

Create `src-tauri/src/bin/sign_recipes.rs`:

```rust
//! 레시피 번들 서명 도구 (개발자 전용, 앱에 포함되지 않음)
//! keygen: 새 키쌍 생성 (개인키는 절대 커밋 금지)
//! sign <bundle.json> <secret.key>: 분리 서명 파일(bundle.json.sig) 생성
use base64::Engine as _;
use ed25519_dalek::{Signer, SigningKey};

fn main() {
    let args: Vec<String> = std::env::args().collect();
    match args.get(1).map(String::as_str) {
        Some("keygen") => {
            let mut seed = [0u8; 32];
            std::fs::File::open("/dev/urandom")
                .and_then(|mut f| std::io::Read::read_exact(&mut f, &mut seed))
                .expect("난수 소스를 열 수 없어요 (이 도구는 맥/리눅스 전용)");
            let key = SigningKey::from_bytes(&seed);
            let b64 = base64::engine::general_purpose::STANDARD;
            std::fs::write("recipe-signing-secret.key", b64.encode(key.to_bytes())).unwrap();
            println!("공개키(base64): {}", b64.encode(key.verifying_key().to_bytes()));
            println!("개인키는 recipe-signing-secret.key에 저장됨. 커밋 금지, 안전한 곳에 보관!");
        }
        Some("sign") => {
            let bundle_path = args.get(2).expect("사용법: sign <bundle.json> <secret.key>");
            let key_path = args.get(3).expect("사용법: sign <bundle.json> <secret.key>");
            let b64 = base64::engine::general_purpose::STANDARD;
            let seed: [u8; 32] = b64
                .decode(std::fs::read_to_string(key_path).unwrap().trim())
                .unwrap()
                .try_into()
                .unwrap();
            let key = SigningKey::from_bytes(&seed);
            let bundle = std::fs::read(bundle_path).unwrap();
            let sig = b64.encode(key.sign(&bundle).to_bytes());
            std::fs::write(format!("{bundle_path}.sig"), &sig).unwrap();
            println!("서명 저장: {bundle_path}.sig");
        }
        _ => eprintln!("사용법: sign_recipes keygen | sign <bundle.json> <secret.key>"),
    }
}
```

`.gitignore`에 `recipe-signing-secret.key` 추가.

- [ ] **Step 4: 실키 생성·공개키 상수 교체**

```bash
cd src-tauri && cargo run --bin sign_recipes -- keygen
```

출력된 공개키(base64)로 `signing.rs`의 `RECIPE_PUBKEY_B64` 값을 교체한다. 개인키 파일은 형에게 전달할 안전 보관 대상으로 남기고 커밋하지 않는다 (작업 종료 보고에 명시).

- [ ] **Step 5: 전체 확인 + 커밋**

Run: `cargo test --manifest-path src-tauri/Cargo.toml && cargo clippy --manifest-path src-tauri/Cargo.toml --all-targets -- -D warnings`

```bash
git add src-tauri .gitignore
git commit -m "feat: 레시피 번들 ed25519 서명 검증 (verify_strict) + 서명 도구

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

### Task 19: 레시피 원격 갱신 (fetch·캐시·폴백)

앱 시작 시 GitHub 레시피 저장소에서 서명된 번들을 받아 검증 후 캐시하고, 다음 로딩부터 캐시본(버전이 더 높을 때)을 쓴다. 네트워크 실패·검증 실패 시 조용히 번들 리소스로 폴백한다.

주의: GitHub 리모트·레시피 저장소는 아직 없다 (HANDOFF 참조). URL 상수는 확정 경로로 박아 두고, 저장소가 생기기 전까지는 fetch가 404로 실패해 폴백만 탄다 (안전).

**Files:**
- Modify: `src-tauri/src/recipe/loader.rs`, `src-tauri/src/lib.rs`, `src/screens/Catalog.tsx`
- Create: `src-tauri/src/recipe/remote.rs`

**Interfaces:**
- Consumes: `signing::verify_bundle`(Task 18), `Recipe::parse`(기존), reqwest(Task 4)
- Produces:
  - 번들 파일 포맷: `{ "bundleVersion": u64, "recipes": [Recipe...] }` + 분리 서명 `.sig`
  - `Catalog::from_bundle(text: &str) -> Result<(u64, Catalog), EngineError>`
  - `remote::refresh(url_base: &str, cache_dir: &Path) -> Result<bool, EngineError>` (새 번들 저장 여부)
  - `remote::load_cached(cache_dir: &Path, min_version: u64) -> Option<Catalog>`
  - 이벤트 `catalog://updated` (갱신 성공 시 프론트에 알림, Catalog가 다시 로드)

- [ ] **Step 1: 실패하는 from_bundle 테스트 작성**

`loader.rs` tests에 추가:

```rust
#[test]
fn parses_bundle_with_version() {
    let mock = std::fs::read_to_string(Catalog::fixture_dir().join("mock-tool.json")).unwrap();
    let bundle = format!(r#"{{"bundleVersion": 7, "recipes": [{mock}]}}"#);
    let (version, catalog) = Catalog::from_bundle(&bundle).unwrap();
    assert_eq!(version, 7);
    assert!(catalog.get("mock-tool").is_some());
}
```

- [ ] **Step 2: from_bundle 구현**

`loader.rs`:

```rust
#[derive(serde::Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
struct BundleFile {
    bundle_version: u64,
    recipes: Vec<serde_json::Value>,
}

impl Catalog {
    pub fn from_bundle(text: &str) -> Result<(u64, Catalog), EngineError> {
        let bundle: BundleFile =
            serde_json::from_str(text).map_err(|e| EngineError::RecipeParse {
                file: "recipes-bundle.json".into(),
                message: e.to_string(),
            })?;
        let mut recipes = Vec::new();
        let mut seen = std::collections::HashSet::new();
        for value in bundle.recipes {
            let recipe = Recipe::parse(&value.to_string())?;
            if !seen.insert(recipe.id.clone()) {
                return Err(EngineError::RecipeParse {
                    file: "recipes-bundle.json".into(),
                    message: format!("id가 겹쳐요: {}", recipe.id),
                });
            }
            recipes.push(recipe);
        }
        Ok((bundle.bundle_version, Catalog { recipes }))
    }
}
```

Run: `cargo test --manifest-path src-tauri/Cargo.toml parses_bundle` → PASS

- [ ] **Step 3: remote 모듈 (테스트 먼저)**

Create `src-tauri/src/recipe/remote.rs`. 캐시 로딩과 검증 로직은 파일시스템만으로 테스트하고, fetch는 얇게 남긴다:

```rust
use std::path::Path;

use crate::error::EngineError;
use crate::recipe::loader::Catalog;
use crate::recipe::signing::{verify_bundle, RECIPE_PUBKEY_B64};

pub const REMOTE_BASE: &str =
    "https://raw.githubusercontent.com/needslab-ai/easy-harness-recipes/main";

/// 캐시된 원격 번들을 검증해 로딩. 서명·파싱 실패 또는 버전이 낮으면 None.
pub fn load_cached(cache_dir: &Path, min_version: u64) -> Option<Catalog> {
    let bundle = std::fs::read(cache_dir.join("recipes-bundle.json")).ok()?;
    let sig = std::fs::read_to_string(cache_dir.join("recipes-bundle.json.sig")).ok()?;
    verify_bundle(&bundle, &sig, RECIPE_PUBKEY_B64).ok()?;
    let (version, catalog) = Catalog::from_bundle(&String::from_utf8(bundle).ok()?).ok()?;
    (version >= min_version).then_some(catalog)
}

/// 원격에서 번들·서명을 받아 검증 후 캐시에 저장. 새로 저장했으면 true.
pub async fn refresh(url_base: &str, cache_dir: &Path) -> Result<bool, EngineError> {
    let get = |path: String| async move {
        let resp = reqwest::get(&path)
            .await
            .map_err(|e| std::io::Error::other(e.to_string()))?;
        if !resp.status().is_success() {
            return Err(std::io::Error::other(format!("HTTP {}", resp.status())));
        }
        resp.bytes()
            .await
            .map_err(|e| std::io::Error::other(e.to_string()))
    };
    let bundle = get(format!("{url_base}/recipes-bundle.json")).await?;
    let sig = String::from_utf8_lossy(&get(format!("{url_base}/recipes-bundle.json.sig")).await?).into_owned();
    verify_bundle(&bundle, &sig, RECIPE_PUBKEY_B64)?;
    Catalog::from_bundle(&String::from_utf8_lossy(&bundle))?; // 파싱 가능해야 캐시
    std::fs::create_dir_all(cache_dir)?;
    std::fs::write(cache_dir.join("recipes-bundle.json"), &bundle)?;
    std::fs::write(cache_dir.join("recipes-bundle.json.sig"), sig)?;
    Ok(true)
}

#[cfg(test)]
mod tests {
    use super::*;
    use base64::Engine as _;
    use ed25519_dalek::{Signer, SigningKey};

    // load_cached는 실키가 아닌 테스트 키로 검증할 수 있도록 내부 함수를 분리해 테스트한다:
    // verify_bundle 호출부를 pubkey 파라미터로 받는 load_cached_with_key(cache_dir, min_version, pubkey)로
    // 구현하고, load_cached는 RECIPE_PUBKEY_B64를 넘기는 한 줄 래퍼로 둔다.
    #[test]
    fn cached_bundle_roundtrip_with_signature() {
        let key = SigningKey::from_bytes(&[9u8; 32]);
        let b64 = base64::engine::general_purpose::STANDARD;
        let pubkey = b64.encode(key.verifying_key().to_bytes());
        let mock = std::fs::read_to_string(Catalog::fixture_dir().join("mock-tool.json")).unwrap();
        let bundle = format!(r#"{{"bundleVersion": 2, "recipes": [{mock}]}}"#);
        let sig = b64.encode(key.sign(bundle.as_bytes()).to_bytes());
        let dir = tempfile::tempdir().unwrap();
        std::fs::write(dir.path().join("recipes-bundle.json"), &bundle).unwrap();
        std::fs::write(dir.path().join("recipes-bundle.json.sig"), &sig).unwrap();
        assert!(load_cached_with_key(dir.path(), 1, &pubkey).is_some());
        assert!(load_cached_with_key(dir.path(), 3, &pubkey).is_none()); // 버전 낮음
        std::fs::write(dir.path().join("recipes-bundle.json"), bundle.replace('2', "9")).unwrap();
        assert!(load_cached_with_key(dir.path(), 1, &pubkey).is_none()); // 서명 불일치
    }
}
```

(테스트 주석대로 `load_cached_with_key`로 구현을 분리한다. 완성 코드는 위 시그니처를 그대로 따른다.)

`recipe/mod.rs`에 `pub mod remote;` 추가.

Run: `cargo test --manifest-path src-tauri/Cargo.toml remote` → PASS

- [ ] **Step 4: lib.rs 시작 배선**

setup에서:

```rust
const BUNDLED_MIN_VERSION: u64 = 1; // 번들 리소스보다 낮은 원격 캐시는 무시

let cache_dir = data_dir.join("recipes-cache");
let catalog = crate::recipe::remote::load_cached(&cache_dir, BUNDLED_MIN_VERSION)
    .unwrap_or_else(|| Catalog::load_dir(&bundled).expect("번들 레시피 로딩 실패"));
```

그리고 manage 후 백그라운드 갱신:

```rust
let handle = app.handle().clone();
tauri::async_runtime::spawn(async move {
    if crate::recipe::remote::refresh(crate::recipe::remote::REMOTE_BASE, &cache_dir)
        .await
        .unwrap_or(false)
    {
        let _ = handle.emit("catalog://updated", &());
    }
});
```

주의: 갱신 성공분은 다음 실행부터 반영이 기본이고, `catalog://updated`를 받은 Catalog 화면은 목록 다시 로드만 한다 (AppContext의 catalog 교체는 실행 중 플랜과 얽히므로 하지 않는다. 재시작 반영이면 충분).

`Catalog.tsx`에 이벤트 구독 추가:

```tsx
useEffect(() => {
  let un: (() => void) | undefined;
  void listen("catalog://updated", load).then((u) => { un = u; });
  return () => un?.();
}, [load]);
```

(`import { listen } from "@tauri-apps/api/event";`)

- [ ] **Step 5: 전체 확인 + 커밋**

Run: `cargo test --manifest-path src-tauri/Cargo.toml && bun run test && bun run tauri dev` 부팅 스모크 (원격 404 폴백이 조용한지 로그 확인)

```bash
git add -A src src-tauri
git commit -m "feat: 레시피 원격 갱신 (서명 번들 fetch·캐시·폴백, catalog://updated)

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

### Task 20: 전체 검증 + HANDOFF 갱신

- [ ] **Step 1: 전체 게이트 실행**

```bash
cargo test --manifest-path src-tauri/Cargo.toml
cargo clippy --manifest-path src-tauri/Cargo.toml --all-targets -- -D warnings
cargo fmt --manifest-path src-tauri/Cargo.toml --check
bun run test
bun run build
```

Expected: 전부 GREEN.

- [ ] **Step 2: GUI 스모크 (수동 확인 항목)**

`bun run tauri dev`로 부팅 후:
1. 환영 화면 진단 → 카탈로그에 하네스 6종 카드(모델 배지·가격 표시) 확인
2. 카탈로그에서 임의 도구의 드라이런 미리보기(마법사 진입 직후 스텝 목록) 확인
3. Settings에서 진단 파일 저장 → 다운로드 폴더에 zip 생성 확인
4. 실설치는 형 확인 후 진행: nodejs-lts가 없는 상태라면 claude-code 설치가 Node 설치부터 이어지는지 관찰

주의: 실설치 스모크는 실제로 시스템을 바꾼다. 자동으로 돌리지 말고 사용자(형)에게 실행 여부를 확인받는다.

- [ ] **Step 3: HANDOFF.md 갱신 + 마무리 커밋**

HANDOFF.md를 M3 완료 상태로 덮어쓴다: 완료 요약, M4(플러그인 5종 레시피) 준비물, 남은 결정(레시피 저장소 생성, 서명 개인키 보관, GitHub 리모트).

```bash
git add HANDOFF.md
git commit -m "chore: HANDOFF 갱신 (마일스톤 3 완료)

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```
