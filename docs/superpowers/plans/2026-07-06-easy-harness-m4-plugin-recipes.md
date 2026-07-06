# 이지 하네스 M4: 플러그인 5종 레시피 구현 계획

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 오픈소스·플러그인 5종(lazycodex, insane-search, k-skill, korean-law-mcp, im-not-ai) 레시피와 requires 의존성 UX(사전 안내·체인 인증 카드), api_key 패턴 마감, 맥 전용 배지, stderr 힌트, 삭제 가드, 제작자 표기를 구현한다.

**Architecture:** 엔진의 통합 설치 런(build_plan의 DFS 의존성 해석)은 그대로 두고, dry_run 리포트를 "체인 내 도구별 인증 목록"으로 확장해 프론트가 사전 안내와 도구별 인증 카드를 그린다. 레시피 5종은 `src-tauri/recipes/*.json` 데이터 추가이며 엔진 코드 변경이 없다.

**Tech Stack:** Rust(Tauri 2, serde, tokio) + React 19 + TypeScript + vitest + cargo test.

**스펙:** `docs/superpowers/specs/2026-07-06-easy-harness-m4-plugin-recipes-design.md` (실측 결과 반영판)

## Global Constraints

- **카피 규칙 (기계 검사됨):** 레시피의 name·easyDescription·friendly·auth.guide에 빈 문자열, em dash(—), 이모지 금지. `dry_run.rs`의 `assert_catalog_dry_runs_cleanly`가 전수 검사한다. UI 신규 문구·에러 힌트도 같은 규칙을 수동 준수. 문구는 비개발자 눈높이(전문용어 즉시 풀기).
- **레시피 JSON:** 최상위·구조체 필드는 camelCase, `deny_unknown_fields`라 필드 오타는 파싱 에러(단 Step variant 안 필드 오타는 조용히 무시됨 — 드라이런 테스트로 잡는다). `schemaVersion: 1` 고정.
- **셸 컨벤션:** mac 스텝은 `"command": "/bin/zsh", "args": ["-lc", "<한 줄 명령>"]` (로그인 셸이라야 `~/.local/bin`·`/usr/local/bin`이 PATH에 있음). windows는 `"command": "cmd", "args": ["/C", "<명령>"]`.
- **플레이스홀더:** `{{home}}`(홈 디렉터리), `{{secret:LABEL}}`(SecretVault 치환), `{{file}}`(download_run 결과)만 존재.
- **게이트 명령 (src-tauri에서):** `cargo test` · `cargo clippy --all-targets -- -D warnings` · `cargo fmt --check`, (레포 루트에서) `bun run test` · `bun run build`.
- **커밋:** 태스크마다 커밋. 메시지 끝에 트레일러 2줄:
  `Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>` / `Claude-Session: https://claude.ai/code/session_01B5458sx7nGidQX23HCJDz2`
- **구현 중 웹 재검증 금지:** 아래 "실측 확정 사실"이 2026-07-06 기준 검증본이다. 어긋나는 실동작을 발견하면 멈추고 보고한다(임의 변경 금지).

## 실측 확정 사실 (2026-07-06, 사용자 맥 / Claude Code 2.1.201 — 전 태스크 공통 근거)

1. **Claude Code 플러그인 비대화형 CLI 공식 존재:** `claude plugin marketplace add <HTTPS .git URL>` → `claude plugin install <플러그인>@<마켓플레이스>`. 성공 exit 0, 실패 exit 1(에러 메시지 포함), 중복 marketplace add는 exit 0 멱등. 제거는 `claude plugin uninstall <이름>` (비대화형 exit 0), 갱신은 `claude plugin update <이름>`. 확인은 `claude plugin list --json`(id·version·scope·enabled 배열).
2. **URL은 반드시 HTTPS `.git` 전체 URL:** owner/repo 축약형은 사용자 환경에 따라 SSH clone을 타서(실측) SSH 키 없는 초보 맥에서 실패할 수 있다. HTTPS URL 형식은 exit 0 실측.
3. **userConfig 주입:** `claude plugin install <id> --config key=value` 공식 옵션. korean-law는 manifest에 `"LAW_OC": "${user_config.api_key}"` + `userConfig.api_key(sensitive)` — 즉 `--config api_key=<OC키>`로 끝.
4. **마켓플레이스·플러그인 실물 id:** insane-search = `insane-search@gptaku-plugins` (마켓 `https://github.com/fivetaku/gptaku_plugins.git`) · korean-law = `korean-law@korean-law-marketplace` (마켓 `https://github.com/chrisryugj/korean-law-mcp.git`) · im-not-ai = `humanize-korean@im-not-ai` (마켓 `https://github.com/epoko77-ai/im-not-ai.git`).
5. **k-skill은 마켓플레이스 경로가 깨져 있음**(marketplace.json 없음, add 실측 exit 1). 실제 경로는 Vercel Labs skills CLI: `npx --yes skills add NomaDamas/k-skill --all -g -y -a claude-code` → `~/.claude/skills/<스킬이름>/`에 복사(102종). 제거는 `npx --yes skills remove <이름들...> -g -y` — 비대화형 exit 0, 없는 이름은 "No matching skills found"로 무해.
6. **lazycodex:** `npx --yes lazycodex-ai@latest install --no-tui`가 공식 무인 설치(도구 자체 doctor 출력의 remediation 문구). doctor는 진단 FAIL이 있어도 exit 0이라 게이트로 못 쓴다. 설치 산출물은 `~/.local/bin/omo`(+ omo-* 헬퍼 스크립트들, 실물 확인) — detect는 path_check, verify는 `omo --version`.
7. **`claude plugin marketplace add`는 시스템 git으로 clone한다** — git(맥 개발자 도구) 없는 초보 맥 대비 stderr 힌트 필요(Task 3).
8. 이 5종은 전부 제3자 오픈소스: Sisyphus Labs(code-yeongyu) · fivetaku · NomaDamas · chrisryugj · epoko77-ai.

## 파일 구조 (전체 조감)

```
src-tauri/src/recipe/schema.rs      # Task 1: SourceInfo + ToolKind::as_str
src-tauri/src/commands.rs           # Task 1,2: CatalogEntry(source·platforms·available), Task 4: get_dry_run installed
src-tauri/src/runner/error_hints.rs # Task 3: 신규
src-tauri/src/runner/mod.rs         # Task 3: execute_step 힌트 배선
src-tauri/src/runner/dry_run.rs     # Task 4: DryRunTool·tools·installed
src-tauri/recipes/{lazycodex,insane-search,korean-law-mcp,im-not-ai,k-skill}.json  # Task 10~14: 신규
src-tauri/tests/real_recipes.rs     # Task 10~14: 플러그인 스펙 테스트 + 카탈로그 13종 마감
src/lib/types.ts                    # Task 1,2,4
src/lib/runReducer.ts               # Task 5: currentRecipeId
src/components/ToolCard.tsx         # Task 1,2,8: source·비활성·resolveName
src/components/WizardStepper.tsx    # Task 5: helperNames
src/components/SecretForm.tsx       # Task 7: submitting
src/screens/Wizard.tsx              # Task 4,5,6: tools·프리플라이트·체인 인증 카드
src/screens/Success.tsx             # Task 6: 함께 설치한 도구 표시
src/screens/Plugins.tsx             # Task 8: 실구현
src/screens/Dashboard.tsx           # Task 9: 삭제 가드
```

---

### Task 1: 레시피 스키마 `source` 필드 + 카드 제작자 표기

**Files:**
- Modify: `src-tauri/src/recipe/schema.rs`
- Modify: `src-tauri/src/commands.rs` (CatalogEntry)
- Modify: `src/lib/types.ts`, `src/components/ToolCard.tsx`
- Test: schema.rs 내장 tests, `src/components/__tests__/toolcard.test.tsx`

**Interfaces:**
- Produces (Rust): `pub struct SourceInfo { pub label: String, pub url: Option<String> }`, `Recipe.source: Option<SourceInfo>`, `CatalogEntry.source: Option<SourceInfo>`, `impl ToolKind { pub fn as_str(&self) -> &'static str }`
- Produces (TS): `interface SourceInfo { label: string; url?: string | null }`, `CatalogEntry.source?: SourceInfo | null`
- 이후 태스크 의존: Task 4가 `ToolKind::as_str` 사용, Task 10~14 레시피가 `source` 필드 사용.

- [ ] **Step 1: 실패 테스트 작성** — `src-tauri/src/recipe/schema.rs`의 tests 모듈에 추가:

```rust
    #[test]
    fn parses_optional_source_and_defaults_to_none() {
        let with = VALID.replacen(
            "\"id\"",
            "\"source\": { \"label\": \"만든 곳: 모의연구소\", \"url\": \"https://example.com\" }, \"id\"",
            1,
        );
        let r = Recipe::parse(&with).unwrap();
        let s = r.source.expect("source 파싱돼야 함");
        assert_eq!(s.label, "만든 곳: 모의연구소");
        assert_eq!(s.url.as_deref(), Some("https://example.com"));
        // 없으면 None (기존 레시피 8종 하위 호환)
        assert!(Recipe::parse(VALID).unwrap().source.is_none());
    }

    #[test]
    fn tool_kind_as_str_matches_wire_format() {
        assert_eq!(ToolKind::Harness.as_str(), "harness");
        assert_eq!(ToolKind::Plugin.as_str(), "plugin");
        assert_eq!(ToolKind::Prerequisite.as_str(), "prerequisite");
    }
```

- [ ] **Step 2: 실패 확인** — Run: `cargo test -p easy-harness parses_optional_source tool_kind_as_str` (src-tauri에서). Expected: 컴파일 에러(`source` 필드 없음, `as_str` 없음).

- [ ] **Step 3: 구현** — schema.rs의 `Recipe`에 필드 추가(`requires` 아래):

```rust
    #[serde(default)]
    pub source: Option<SourceInfo>,
```

`Pricing` 정의 위에 구조체 추가:

```rust
#[derive(Debug, Clone, PartialEq, Deserialize, Serialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct SourceInfo {
    /// 카드에 그대로 보여줄 제작자 표기 (예: "만든 곳: NomaDamas")
    pub label: String,
    #[serde(default)]
    pub url: Option<String>,
}
```

`ToolKind`에 impl 추가:

```rust
impl ToolKind {
    pub fn as_str(&self) -> &'static str {
        match self {
            ToolKind::Harness => "harness",
            ToolKind::Plugin => "plugin",
            ToolKind::Prerequisite => "prerequisite",
        }
    }
}
```

`commands.rs`: `CatalogEntry`에 `pub source: Option<crate::recipe::schema::SourceInfo>,` 추가하고 `to_catalog_entries`의 매핑에 `source: r.source.clone(),` 추가. 기존 kind 매핑 `match r.kind {...}.to_string()`을 `r.kind.as_str().to_string()`으로 교체.

- [ ] **Step 4: 통과 확인** — Run: `cargo test -p easy-harness` Expected: 전체 PASS (기존 56+7 포함).

- [ ] **Step 5: 프론트 실패 테스트** — `src/components/__tests__/toolcard.test.tsx`에 추가 (기존 테스트의 entry 팩토리를 재사용하되 형태는 파일 내 기존 코드를 따른다):

```tsx
it("source가 있으면 제작자 표기를 보여준다", () => {
  render(<ToolCard entry={{ ...base, source: { label: "만든 곳: NomaDamas" } }} onSelect={() => {}} />);
  expect(screen.getByText("만든 곳: NomaDamas")).toBeInTheDocument();
});
```

- [ ] **Step 6: 실패 확인** — Run: `bun run test` Expected: FAIL (types에 source 없음 → tsc/렌더 미표시).

- [ ] **Step 7: 구현** — `src/lib/types.ts`에 `export interface SourceInfo { label: string; url?: string | null }` 추가, `CatalogEntry`에 `source?: SourceInfo | null;` 추가. `ToolCard.tsx`의 "설치됨 · v..." 문단 위에 추가:

```tsx
      {entry.source && (
        <p className="mt-3 text-caption text-txt-tertiary">{entry.source.label}</p>
      )}
```

- [ ] **Step 8: 통과 확인** — Run: `bun run test` Expected: PASS (34+1).

- [ ] **Step 9: 커밋** — `git add -A && git commit -m "feat: 레시피 source 필드와 카드 제작자 표기"` (+트레일러)

---

### Task 2: 플랫폼 가용성 (윈도우에서 맥 전용 도구 비활성)

**Files:**
- Modify: `src-tauri/src/commands.rs`
- Modify: `src/lib/types.ts`, `src/components/ToolCard.tsx`
- Test: commands.rs 내장, `src/components/__tests__/toolcard.test.tsx`

**Interfaces:**
- Consumes: `Platform::current() -> Option<Platform>`, `Platforms::get`
- Produces (Rust): `to_catalog_entries(catalog, state, platform: Option<Platform>)` (시그니처 변경!), `CatalogEntry.platforms: Vec<String>`, `CatalogEntry.available: bool`
- Produces (TS): `CatalogEntry.platforms: Platform[]`, `CatalogEntry.available: boolean`. ToolCard는 `available === false`면 클릭 불가.

- [ ] **Step 1: 실패 테스트** — commands.rs tests에 추가:

```rust
    #[test]
    fn entries_expose_platform_availability() {
        let mut catalog = Catalog::load_dir(&Catalog::fixture_dir()).unwrap();
        // mock-tool을 맥 전용으로 조작
        catalog
            .recipes
            .iter_mut()
            .find(|r| r.id == "mock-tool")
            .unwrap()
            .platforms
            .windows = None;
        let state = AppState { installations: vec![] };
        let on_win = to_catalog_entries(&catalog, &state, Some(crate::recipe::schema::Platform::Windows));
        let tool = on_win.iter().find(|e| e.id == "mock-tool").unwrap();
        assert_eq!(tool.platforms, vec!["mac"]);
        assert!(!tool.available);
        let on_mac = to_catalog_entries(&catalog, &state, Some(crate::recipe::schema::Platform::Mac));
        assert!(on_mac.iter().find(|e| e.id == "mock-tool").unwrap().available);
        // OS 판별 불가(None)면 전부 비가용
        let unknown = to_catalog_entries(&catalog, &state, None);
        assert!(unknown.iter().all(|e| !e.available));
    }
```

- [ ] **Step 2: 실패 확인** — Run: `cargo test -p easy-harness entries_expose_platform` Expected: 컴파일 에러(인자 2개 함수에 3개 전달).

- [ ] **Step 3: 구현** — `to_catalog_entries` 시그니처를 `pub fn to_catalog_entries(catalog: &Catalog, state: &AppState, platform: Option<Platform>) -> Vec<CatalogEntry>`로 변경. CatalogEntry에 두 필드 추가:

```rust
    pub platforms: Vec<String>,
    pub available: bool,
```

매핑에 추가:

```rust
                platforms: {
                    let mut v = Vec::new();
                    if r.platforms.mac.is_some() { v.push("mac".to_string()); }
                    if r.platforms.windows.is_some() { v.push("windows".to_string()); }
                    v
                },
                available: platform.is_some_and(|p| r.platforms.get(p).is_some()),
```

`list_catalog` 호출부: `to_catalog_entries(&ctx.catalog, &ctx.store.load(), Platform::current())`. 기존 테스트 `catalog_entries_carry_install_state_and_missing_requires`의 호출에 `Some(Platform::Mac)` 추가 (schema::Platform use 필요).

- [ ] **Step 4: 통과 확인** — Run: `cargo test -p easy-harness` Expected: 전체 PASS.

- [ ] **Step 5: 프론트 실패 테스트** — toolcard.test.tsx:

```tsx
it("available=false면 클릭이 막히고 맥 전용 안내가 보인다", () => {
  const onSelect = vi.fn();
  render(<ToolCard entry={{ ...base, available: false, platforms: ["mac"] }} onSelect={onSelect} />);
  expect(screen.getByText("지금은 맥에서만 설치돼요")).toBeInTheDocument();
  fireEvent.click(screen.getByRole("button"));
  expect(onSelect).not.toHaveBeenCalled();
});
```

기존 테스트들의 base entry에 `platforms: ["mac", "windows"], available: true`를 추가해 타입을 맞춘다.

- [ ] **Step 6: 실패 확인** — Run: `bun run test` Expected: FAIL.

- [ ] **Step 7: 구현** — types.ts `CatalogEntry`에 `platforms: Platform[]; available: boolean;` 추가. ToolCard.tsx:

```tsx
export function ToolCard({ entry, onSelect, resolveName }: {
  entry: CatalogEntry;
  onSelect: (id: string) => void;
  resolveName?: (id: string) => string;
}) {
  const unavailable = !entry.available;
  return (
    <button
      type="button"
      onClick={() => { if (!unavailable) onSelect(entry.id); }}
      aria-disabled={unavailable}
      className={`relative rounded-card ... p-5 text-left transition-shadow${unavailable ? " opacity-60 cursor-not-allowed" : ""}`}
    >
```

(className의 `...`는 기존 클래스 그대로 유지.) 배지 영역 마지막에:

```tsx
        {unavailable && (
          <Badge variant="warning">
            {entry.platforms.length === 1 && entry.platforms[0] === "mac"
              ? "지금은 맥에서만 설치돼요"
              : "이 컴퓨터에서는 아직 설치할 수 없어요"}
          </Badge>
        )}
```

`resolveName` prop은 이 태스크에서 선언만 하고(기본 미사용) Task 8에서 배선한다. 기존 missingRequires 배지를 `{(resolveName?.(id) ?? id)} 필요`로 바꾼다:

```tsx
        {entry.missingRequires.map((id) => (
          <Badge key={id} variant="warning">{(resolveName?.(id) ?? id)} 필요</Badge>
        ))}
```

- [ ] **Step 8: 통과 확인** — Run: `bun run test` Expected: PASS.
- [ ] **Step 9: 커밋** — `git add -A && git commit -m "feat: 카탈로그 플랫폼 가용성과 맥 전용 카드 비활성"` (+트레일러)

---

### Task 3: stderr 패턴 에러 힌트 (`error_hints` 모듈)

**Files:**
- Create: `src-tauri/src/runner/error_hints.rs`
- Modify: `src-tauri/src/runner/mod.rs`
- Test: error_hints.rs 내장 + mod.rs tests 1건 추가

**Interfaces:**
- Produces: `pub fn hint_for(log: &str) -> Option<String>` — 실패 로그에서 흔한 원인 감지 시 쉬운 말 안내. `execute_step`의 모든 Failure message가 `hint_for(...).unwrap_or_else(|| <기존 기본 문구>)`를 탄다.

- [ ] **Step 1: 실패 테스트** — 새 파일 `src-tauri/src/runner/error_hints.rs`를 테스트부터:

```rust
//! 실패 로그(stderr·stdout·exit)에서 흔한 원인을 찾아 쉬운 말 안내를 만든다.
//! 스펙 6절 ⑤: 공통 패턴 테이블만 (레시피별 선언 확장은 안 한다).

pub fn hint_for(log: &str) -> Option<String> {
    todo!()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn network_permission_missing_devtools_and_key_hints() {
        assert!(hint_for("curl: Could not resolve host claude.ai").unwrap().contains("인터넷"));
        assert!(hint_for("EACCES: permission denied").unwrap().contains("권한"));
        assert!(hint_for("zsh: command not found: npx").unwrap().contains("프로그램"));
        assert!(hint_for("xcrun: error: invalid active developer path").unwrap().contains("개발자 도구"));
        assert!(hint_for("Error: invalid API key provided").unwrap().contains("인증키"));
        assert!(hint_for("전혀 모르는 이상한 출력").is_none());
    }

    #[test]
    fn hints_obey_copy_rules() {
        for sample in [
            "Could not resolve host", "permission denied", "command not found",
            "xcrun: error", "invalid api key",
        ] {
            let h = hint_for(sample).unwrap();
            assert!(!h.contains('—'), "em dash 금지: {h}");
            assert!(!h.trim().is_empty());
        }
    }
}
```

`runner/mod.rs` 상단에 `pub mod error_hints;` 추가.

- [ ] **Step 2: 실패 확인** — Run: `cargo test -p easy-harness error_hints` Expected: FAIL (todo! panic).

- [ ] **Step 3: 구현** — `hint_for` 본문:

```rust
pub fn hint_for(log: &str) -> Option<String> {
    let lower = log.to_lowercase();
    // 첫 매칭 승. 네트워크가 가장 흔하니 맨 앞.
    const RULES: &[(&[&str], &str)] = &[
        (
            &["could not resolve host", "getaddrinfo", "enotfound", "etimedout",
              "connection refused", "network is unreachable", "econnreset", "timed out"],
            "인터넷 연결이 불안정한 것 같아요. 와이파이를 확인한 뒤 다시 시도해 주세요.",
        ),
        (
            &["xcrun: error", "invalid active developer path", "developer tools were not found"],
            "맥 개발자 도구가 필요해요. 화면에 설치 창이 뜨면 설치를 눌러 주세요. 끝나면 여기서 다시 시도하면 돼요.",
        ),
        (
            &["permission denied", "eacces", "eperm", "operation not permitted", "access is denied"],
            "컴퓨터가 권한 문제로 막았어요. 앱을 껐다 켠 뒤 다시 시도해 주세요.",
        ),
        (
            &["command not found", "not recognized as an internal", "enoent",
              "no such file or directory"],
            "필요한 프로그램을 아직 찾지 못했어요. 다시 시도하면 준비물부터 챙겨서 진행해요.",
        ),
        (
            &["invalid api key", "invalid_api_key", "unauthorized", "\"401\"", " 401 ",
              "authentication failed", "인증키"],
            "등록한 열쇠(인증키)가 맞지 않는 것 같아요. 발급 페이지에서 값을 다시 복사해 붙여넣어 주세요.",
        ),
    ];
    for (needles, hint) in RULES {
        if needles.iter().any(|n| lower.contains(n)) {
            return Some((*hint).to_string());
        }
    }
    None
}
```

- [ ] **Step 4: 통과 확인** — Run: `cargo test -p easy-harness error_hints` Expected: PASS.

- [ ] **Step 5: 배선 실패 테스트** — runner/mod.rs tests에 추가:

```rust
    #[tokio::test]
    async fn failure_message_uses_stderr_hint_when_matched() {
        let runner = FakeProcessRunner::new(vec![fail("EACCES: permission denied")]);
        let vault = SecretVault::new();
        let opener = FakeUrlOpener::default();
        let downloader = download::FakeDownloader::default();
        let step = Step::RunCommand {
            friendly: "설치 중".into(),
            command: "tool".into(),
            args: vec![],
        };
        let StepOutcome::Failure { message, .. } =
            execute_step(&step, &runner, &vault, &opener, &downloader).await
        else {
            panic!("Failure여야 함");
        };
        assert!(message.contains("권한"), "힌트가 반영돼야 함: {message}");
    }
```

- [ ] **Step 6: 실패 확인** — Run: `cargo test -p easy-harness failure_message_uses_stderr_hint` Expected: FAIL (기본 문구 그대로).

- [ ] **Step 7: 배선** — `execute_step`에서 exit != 0 및 spawn 에러의 Failure 구성 3곳(Run/CheckCommand, DownloadRun의 명령 실패, 각 `Err(e)` 암)을 다음 패턴으로 교체:

```rust
                Ok(out) => {
                    let raw = format!("exit={}\n{}{}", out.exit_code, out.stdout, out.stderr);
                    StepOutcome::Failure {
                        message: error_hints::hint_for(&raw).unwrap_or_else(|| {
                            "이 단계가 잘 끝나지 않았어요. 다시 시도해 볼까요?".into()
                        }),
                        log: vault.mask(&raw),
                    }
                }
                Err(e) => StepOutcome::Failure {
                    message: error_hints::hint_for(&e.to_string()).unwrap_or_else(|| {
                        "명령을 시작하지 못했어요. 다시 시도해 볼까요?".into()
                    }),
                    log: vault.mask(&e.to_string()),
                },
```

(DownloadRun 쪽 기본 문구는 기존 문자열 유지: "설치 프로그램이 잘 끝나지 않았어요..." / "설치 프로그램을 시작하지 못했어요...". 다운로드 자체 실패 문구 "내려받는 중에 인터넷이..."는 이미 친절하므로 그대로 둔다.) 파일 상단에 `use secrets::SecretVault;` 옆에 별도 use는 불필요 — `error_hints::hint_for` 경로 호출.

- [ ] **Step 8: 통과 확인** — Run: `cargo test -p easy-harness` Expected: 전체 PASS (기존 "이 단계가 잘..." 문구를 단언하던 테스트가 있으면 이번 힌트 케이스와 충돌하지 않는지 확인 — 기존 테스트는 stderr "boom"이라 힌트 미매칭, 기본 문구 유지됨).
- [ ] **Step 9: 커밋** — `git commit -am "feat: 실패 로그 패턴 기반 쉬운 말 에러 힌트"` (+트레일러)

---

### Task 4: dry_run 체인 확장 (`tools` 목록 + installed 반영)

**Files:**
- Modify: `src-tauri/src/runner/dry_run.rs`, `src-tauri/src/commands.rs`
- Modify: `src/lib/types.ts`, `src/screens/Wizard.tsx` (컴파일 유지 최소 수정)
- Test: dry_run.rs 내장, `src/screens/__tests__/wizard-lifecycle.test.tsx` 목 데이터 갱신

**Interfaces:**
- Consumes: `build_plan(catalog, target, platform, Flow::Install, installed)`, `ToolKind::as_str()` (Task 1)
- Produces (Rust): `dry_run(catalog, target_id, platform, installed: &[String])` (시그니처 변경!), `DryRunTool { id, name, kind, auth: Option<DryRunAuth> }`, `DryRunReport { target_id, platform, tool_order, tools: Vec<DryRunTool>, steps }` — **기존 `auth` 필드 제거.**
- Produces (TS): `DryRunTool`, `DryRunReport.tools: DryRunTool[]` (auth 필드 제거). 프론트는 `report.tools.find(t => t.id === X)?.auth`로 도구별 인증을 찾는다.

- [ ] **Step 1: 실패 테스트** — dry_run.rs tests를 다음으로 교체·추가:

```rust
    #[test]
    fn report_carries_per_tool_auth_in_chain() {
        let catalog = Catalog::load_dir(&Catalog::fixture_dir()).unwrap();
        let report = dry_run(&catalog, "mock-plugin", Platform::Mac, &[]).unwrap();
        assert_eq!(report.tool_order, vec!["mock-prereq", "mock-tool", "mock-plugin"]);
        let ids: Vec<&str> = report.tools.iter().map(|t| t.id.as_str()).collect();
        assert_eq!(ids, vec!["mock-prereq", "mock-tool", "mock-plugin"]);
        let kinds: Vec<&str> = report.tools.iter().map(|t| t.kind.as_str()).collect();
        assert_eq!(kinds, vec!["prerequisite", "harness", "plugin"]);
        // 체인 중간(mock-tool)의 인증이 실려 온다
        let tool = report.tools.iter().find(|t| t.id == "mock-tool").unwrap();
        let auth = tool.auth.as_ref().expect("mock-tool 인증 있어야 함");
        assert_eq!(auth.pattern, "browser_login");
        assert_eq!(auth.guide.len(), 3);
        // 플러그인 자신은 auth 없음
        assert!(report.tools.iter().find(|t| t.id == "mock-plugin").unwrap().auth.is_none());
    }

    #[test]
    fn installed_dependencies_are_excluded_from_report() {
        let catalog = Catalog::load_dir(&Catalog::fixture_dir()).unwrap();
        let installed = vec!["mock-tool".to_string(), "mock-prereq".to_string()];
        let report = dry_run(&catalog, "mock-plugin", Platform::Mac, &installed).unwrap();
        assert_eq!(report.tool_order, vec!["mock-plugin"]);
        assert_eq!(report.tools.len(), 1);
    }
```

기존 `report_carries_target_auth_pattern_and_guide`는 삭제하고, `report_lists_steps_in_dependency_order`·`all_bundled_recipes_dry_run_on_declared_platforms`·`fixture_recipes_dry_run_cleanly_with_copy_checks`와 `assert_catalog_dry_runs_cleanly` 안의 `dry_run(...)` 호출은 `, &[]` 인자를 추가한다.

- [ ] **Step 2: 실패 확인** — Run: `cargo test -p easy-harness dry_run` Expected: 컴파일 에러.

- [ ] **Step 3: 구현** — dry_run.rs:

```rust
#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DryRunTool {
    pub id: String,
    pub name: String,
    pub kind: String,
    pub auth: Option<DryRunAuth>,
}
```

`DryRunReport`의 `pub auth: Option<DryRunAuth>`를 `pub tools: Vec<DryRunTool>`로 교체. 패턴 문자열 변환을 헬퍼로:

```rust
fn auth_of(catalog: &Catalog, id: &str, platform: Platform) -> Option<DryRunAuth> {
    catalog
        .get(id)
        .and_then(|r| r.platforms.get(platform))
        .and_then(|spec| spec.auth.as_ref())
        .map(|a| DryRunAuth {
            pattern: match a.pattern {
                crate::recipe::schema::AuthPattern::BrowserLogin => "browser_login",
                crate::recipe::schema::AuthPattern::ApiKey => "api_key",
                crate::recipe::schema::AuthPattern::InteractiveTerminal => "interactive_terminal",
                crate::recipe::schema::AuthPattern::Automatic => "automatic",
            }
            .to_string(),
            guide: a.guide.clone(),
        })
}

pub fn dry_run(
    catalog: &Catalog,
    target_id: &str,
    platform: Platform,
    installed: &[String],
) -> Result<DryRunReport, EngineError> {
    let plan = build_plan(catalog, target_id, platform, Flow::Install, installed)?;
    let tools = plan
        .tool_order
        .iter()
        .map(|id| {
            let r = catalog.get(id).expect("plan에 있으면 카탈로그에 있음");
            DryRunTool {
                id: r.id.clone(),
                name: r.name.clone(),
                kind: r.kind.as_str().to_string(),
                auth: auth_of(catalog, id, platform),
            }
        })
        .collect();
    Ok(DryRunReport {
        target_id: plan.target_id.clone(),
        platform: platform.as_str().to_string(),
        tool_order: plan.tool_order.clone(),
        tools,
        steps: /* 기존 매핑 그대로 */,
    })
}
```

commands.rs `get_dry_run`:

```rust
#[tauri::command]
pub fn get_dry_run(tool_id: String, ctx: State<'_, AppContext>) -> Result<DryRunReport, String> {
    let platform = current_platform()?;
    let installed: Vec<String> = ctx
        .store
        .load()
        .installations
        .iter()
        .map(|i| i.recipe_id.clone())
        .collect();
    dry_run(&ctx.catalog, &tool_id, platform, &installed).map_err(err_str)
}
```

- [ ] **Step 4: 통과 확인** — Run: `cargo test -p easy-harness` Expected: 전체 PASS.

- [ ] **Step 5: 프론트 타입·최소 배선** — types.ts:

```ts
export interface DryRunTool {
  id: string; name: string; kind: ToolKind; auth: DryRunAuth | null;
}
export interface DryRunReport {
  targetId: string; platform: string; toolOrder: string[];
  tools: DryRunTool[]; steps: DryRunStep[];
}
```

Wizard.tsx 최소 수정(전면 개편은 Task 6): `preview.auth` → `preview.tools.find((t) => t.id === toolId)?.auth ?? null`. wizard-lifecycle.test.tsx의 getDryRun 목이 돌려주는 리포트에 `tools: [{ id: toolId, name: ..., kind: "harness", auth: <기존 auth 값> }]`를 넣고 `auth` 키는 제거.

- [ ] **Step 6: 통과 확인** — Run: `bun run test && bun run build` Expected: PASS.
- [ ] **Step 7: 커밋** — `git commit -am "feat: 드라이런 리포트를 체인 도구별 인증 목록으로 확장"` (+트레일러)

---

### Task 5: 진행 중 도구 추적 + 인증 카드 전환 + 스텝퍼 이름

**Files:**
- Modify: `src/lib/runReducer.ts`, `src/screens/Wizard.tsx`, `src/components/WizardStepper.tsx`
- Test: `src/lib/__tests__/runReducer.test.ts`, `src/components/__tests__/wizard-parts.test.tsx`

**Interfaces:**
- Produces: `RunState.currentRecipeId: string` (진행 이벤트의 recipeId 추적), `WizardStepper` prop `helperNames?: string[]` (2단계 라벨을 실제 도구 이름으로).
- Task 6이 이 상태를 그대로 사용.

- [ ] **Step 1: 실패 테스트** — runReducer.test.ts에 추가:

```ts
it("진행 이벤트의 recipeId를 currentRecipeId로 추적한다", () => {
  let s = initialRunState("mock-plugin");
  expect(s.currentRecipeId).toBe("mock-plugin");
  s = runReducer(s, { ...ev, recipeId: "mock-tool", status: { kind: "running" } });
  expect(s.currentRecipeId).toBe("mock-tool");
  s = runReducer(s, { ...ev, recipeId: "mock-plugin", status: { kind: "running" } });
  expect(s.currentRecipeId).toBe("mock-plugin");
});
```

(`ev`는 파일 내 기존 진행 이벤트 팩토리를 따른다.) wizard-parts.test.tsx에 추가:

```tsx
it("helperNames가 있으면 2단계 라벨에 도구 이름이 나온다", () => {
  render(<WizardStepper current={2} toolName="lazycodex" helperNames={["Codex", "Node.js"]} />);
  expect(screen.getByText("Codex·Node.js 설치")).toBeInTheDocument();
});
```

- [ ] **Step 2: 실패 확인** — Run: `bun run test` Expected: FAIL.

- [ ] **Step 3: 구현** — runReducer.ts: `RunState`에 `currentRecipeId: string;` 추가, `initialRunState`에서 `currentRecipeId: targetId`, `runReducer`의 base에 `currentRecipeId: ev.recipeId || state.currentRecipeId,` 추가 (done 이벤트도 recipeId가 target이라 안전). WizardStepper.tsx:

```tsx
export function WizardStepper({ current, toolName, helperNames = [] }: {
  current: 1 | 2 | 3 | 4; toolName: string; helperNames?: string[];
}) {
  const helperLabel = helperNames.length > 0 ? `${helperNames.join("·")} 설치` : "준비물 설치";
  const labels = ["컴퓨터 점검", helperLabel, `${toolName} 설치`, "마무리"];
```

Wizard.tsx: `<WizardStepper current={state.phase} toolName={toolName} helperNames={helperNames} />` — helperNames는 preview에서 `tools.filter((t) => t.id !== toolId).map((t) => t.name)` (Task 6에서 preview 상태로 정리되며, 이 태스크에서는 기존 구조 안에서 tools를 상태로 보관해 전달). 인증 카드도 이 태스크에서 도구별로 전환: `auth` 상태를 `tools` 상태로 바꾸고 `const currentAuth = tools.find((t) => t.id === state.currentRecipeId)?.auth ?? null;`를 기존 `auth` 사용처 3곳(terminal 옆 패널, waitingSecret 위 패널, section==="auth" 패널)에 사용.

- [ ] **Step 4: 통과 확인** — Run: `bun run test` Expected: PASS.
- [ ] **Step 5: 커밋** — `git commit -am "feat: 진행 중 도구별 인증 카드 전환과 스텝퍼 이름 표시"` (+트레일러)

---

### Task 6: 마법사 사전 안내 스텝 + 성공 화면 체인 표시

**Files:**
- Modify: `src/screens/Wizard.tsx` (전면 정리), `src/screens/Success.tsx`
- Test: `src/screens/__tests__/wizard-lifecycle.test.tsx`, `src/screens/__tests__/success.test.tsx`

**Interfaces:**
- Consumes: `DryRunReport.tools` (Task 4), `RunState.currentRecipeId` (Task 5)
- Produces: 프리플라이트 화면(미설치 선행 하네스가 체인에 있을 때만), Success로 넘기는 location state `{ name: string, helpers: string[] }`.

- [ ] **Step 1: 실패 테스트** — wizard-lifecycle.test.tsx에 추가 (파일의 기존 목 패턴 준수):

```tsx
it("선행 하네스가 체인에 있으면 안내부터 보여주고, 시작을 눌러야 설치가 시작된다", async () => {
  mockGetDryRun.mockResolvedValue({
    targetId: "lazycodex", platform: "mac",
    toolOrder: ["codex", "nodejs-lts", "lazycodex"],
    tools: [
      { id: "codex", name: "Codex", kind: "harness", auth: { pattern: "browser_login", guide: ["a", "b", "c"] } },
      { id: "nodejs-lts", name: "Node.js", kind: "prerequisite", auth: null },
      { id: "lazycodex", name: "lazycodex", kind: "plugin", auth: null },
    ],
    steps: [{ recipeId: "lazycodex", recipeName: "lazycodex", section: "install", stepType: "run_command", friendly: "설치" }],
  });
  renderWizard("lazycodex");
  expect(await screen.findByText(/먼저 챙길 게 있어요/)).toBeInTheDocument();
  expect(screen.getByText(/Codex 설치하고 로그인하기/)).toBeInTheDocument();
  expect(mockStartFlow).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole("button", { name: /좋아요, 시작할게요/ }));
  await waitFor(() => expect(mockStartFlow).toHaveBeenCalledWith("lazycodex", "install", false));
});

it("선행 하네스가 없으면 안내 없이 바로 시작한다", async () => {
  mockGetDryRun.mockResolvedValue({
    targetId: "claude-code", platform: "mac", toolOrder: ["claude-code"],
    tools: [{ id: "claude-code", name: "Claude Code", kind: "harness", auth: null }],
    steps: [],
  });
  renderWizard("claude-code");
  await waitFor(() => expect(mockStartFlow).toHaveBeenCalled());
  expect(screen.queryByText(/먼저 챙길 게 있어요/)).not.toBeInTheDocument();
});
```

success.test.tsx에 추가:

```tsx
it("함께 설치한 도구가 있으면 같이 보여준다", () => {
  renderWithState("/success/lazycodex", { name: "lazycodex", helpers: ["Codex", "Node.js"] });
  expect(screen.getByText(/Codex·Node.js도 함께 준비했어요/)).toBeInTheDocument();
});
```

- [ ] **Step 2: 실패 확인** — Run: `bun run test` Expected: FAIL.

- [ ] **Step 3: 구현 (Wizard.tsx 전체를 아래로 정리)** — 핵심 변경: dryRun과 startFlow 분리, `confirmed` 게이트, helpers·currentAuth 계산.

```tsx
import { useEffect, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router";
import { AuthGuidePanel } from "../components/AuthGuidePanel";
import { PrimaryButton } from "../components/Buttons";
import { LogPanel } from "../components/LogPanel";
import { ErrorPanel } from "../components/ErrorPanel";
import { MascotBubble } from "../components/MascotBubble";
import { SecretForm } from "../components/SecretForm";
import { TerminalPanel } from "../components/TerminalPanel";
import { WizardStepper } from "../components/WizardStepper";
import { getDryRun, onLog, onProgress, provideSecret, startFlow } from "../lib/ipc";
import { appendLog, initialRunState, runReducer, type RunState } from "../lib/runReducer";
import type { DryRunReport } from "../lib/types";

export function Wizard() {
  const { toolId = "" } = useParams();
  const navigate = useNavigate();
  const [state, setState] = useState<RunState>(() => initialRunState(toolId));
  const [preview, setPreview] = useState<DryRunReport | null>(null);
  const [confirmed, setConfirmed] = useState(false);
  const [showLog, setShowLog] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const [runId, setRunId] = useState<string | null>(null);
  const [secretSubmitting, setSecretSubmitting] = useState(false);

  const tools = preview?.tools ?? [];
  const target = tools.find((t) => t.id === toolId);
  const toolName = target?.name ?? toolId;
  const helpers = tools.filter((t) => t.id !== toolId);
  const pendingHarnesses = helpers.filter((t) => t.kind === "harness");
  const needsPreflight = pendingHarnesses.length > 0;
  const currentAuth = tools.find((t) => t.id === state.currentRecipeId)?.auth ?? null;
  const helperNames = helpers.map((t) => t.name);

  // 1) 미리보기: 도구·재시도 단위로 새로 읽는다 (읽기 전용이라 중복 호출 무해)
  useEffect(() => {
    let cancelled = false;
    setState(initialRunState(toolId));
    setPreview(null);
    setConfirmed(false);
    setSecretSubmitting(false);
    getDryRun(toolId)
      .then((p) => { if (!cancelled) setPreview(p); })
      .catch(() => {
        if (!cancelled) setState((s) => ({ ...s, error: { message: "시작하지 못했어요. 다시 시도해 볼까요?", friendly: "준비 단계" } }));
      });
    return () => { cancelled = true; };
  }, [toolId, attempt]);

  // 2) 시작: 미리보기가 준비되고, 선행 안내가 없거나 사용자가 눌렀을 때 1회만.
  //    StrictMode 이중 마운트에서도 같은 key면 시작 promise를 재사용한다.
  const shouldStart = preview !== null && (!needsPreflight || confirmed);
  const startRef = useRef<{ key: string; promise: Promise<string> } | null>(null);
  useEffect(() => {
    if (!shouldStart) return;
    let cancelled = false;
    let unProgress: (() => void) | undefined;
    let unLog: (() => void) | undefined;
    const key = `${toolId}:${attempt}`;
    if (!startRef.current || startRef.current.key !== key) {
      startRef.current = { key, promise: startFlow(toolId, "install", false) };
    }
    (async () => {
      try {
        const newRunId = await startRef.current!.promise;
        if (cancelled) return;
        setRunId(newRunId);
        const p = await onProgress(newRunId, (ev) => setState((s) => runReducer(s, ev)));
        if (cancelled) { p(); return; }
        unProgress = p;
        const l = await onLog(newRunId, (line) => setState((s) => appendLog(s, line)));
        if (cancelled) { l(); return; }
        unLog = l;
      } catch {
        if (!cancelled) {
          setState((s) => ({ ...s, error: { message: "시작하지 못했어요. 다시 시도해 볼까요?", friendly: "준비 단계" } }));
        }
      }
    })();
    return () => { cancelled = true; unProgress?.(); unLog?.(); };
  }, [shouldStart, toolId, attempt]);

  // 비밀값 등록 후 다음 이벤트가 오면 제출 상태 해제
  useEffect(() => {
    if (!state.waitingSecret) setSecretSubmitting(false);
  }, [state.waitingSecret]);

  useEffect(() => {
    if (state.done && state.success) {
      navigate(`/success/${toolId}`, { state: { name: toolName, helpers: helperNames } });
    }
  }, [state.done, state.success, navigate, toolId, toolName, helperNames]);

  const preflight = preview !== null && needsPreflight && !confirmed && !state.error;

  return (
    <div className="flex min-h-screen flex-col items-center bg-surface-bg dark:bg-surface-bg-dark px-8 py-12">
      <WizardStepper current={state.phase} toolName={toolName} helperNames={helperNames} />
      <div className={`mt-12 w-full ${state.terminalSession ? "max-w-5xl" : "max-w-2xl"} text-center`}>
        {state.error ? (
          <ErrorPanel
            message={state.error.message}
            friendly={state.error.friendly}
            onRetry={() => setAttempt((n) => n + 1)}
            onCopyLog={() => navigator.clipboard.writeText(state.logs.join("\n"))}
          />
        ) : preflight ? (
          <>
            <h1 className="text-display font-extrabold">먼저 챙길 게 있어요</h1>
            <p className="mt-4 text-txt-secondary dark:text-txt-secondary-dark">
              {toolName}는 {pendingHarnesses.map((t) => t.name).join("·")} 위에서 도는 도구예요.
              아래 순서대로 한 번에 진행할게요.
            </p>
            <ol className="mx-auto mt-6 flex w-fit flex-col gap-2 text-left font-bold">
              {pendingHarnesses.map((t, i) => (
                <li key={t.id}>{i + 1}. {t.name} 설치하고 로그인하기</li>
              ))}
              <li>{pendingHarnesses.length + 1}. {toolName} 설치하기</li>
            </ol>
            {helpers.some((t) => t.kind === "prerequisite") && (
              <p className="mt-3 text-caption text-txt-tertiary">필요한 준비물도 함께 챙겨요.</p>
            )}
            <PrimaryButton className="mt-8" onClick={() => setConfirmed(true)}>
              좋아요, 시작할게요
            </PrimaryButton>
          </>
        ) : state.terminalSession ? (
          <>
            <h1 className="text-display font-extrabold">아래 까만 창에서 로그인을 도와드릴게요</h1>
            <div className="grid grid-cols-1 gap-4 lg:grid-cols-[2fr_1fr]">
              <TerminalPanel sessionId={state.terminalSession} />
              <AuthGuidePanel guide={currentAuth?.guide ?? []} stacked />
            </div>
          </>
        ) : state.waitingSecret ? (
          <>
            <h1 className="text-display font-extrabold">열쇠 하나만 등록하면 돼요</h1>
            <AuthGuidePanel guide={currentAuth?.guide ?? []} />
            <SecretForm
              label={state.waitingSecret}
              submitting={secretSubmitting}
              onSubmit={(value) => {
                if (!runId) return;
                provideSecret(runId, state.waitingSecret as string, value);
                setSecretSubmitting(true);
              }}
            />
          </>
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
            {state.section === "auth" && <AuthGuidePanel guide={currentAuth?.guide ?? []} />}
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

(주의: SecretForm의 `submitting` prop은 Task 7에서 추가된다 — Task 6과 7을 같은 세션에서 이어 하거나, Task 6 시점에는 prop 전달 줄을 빼고 Task 7에서 넣어도 된다. 순서대로 하면 Task 7이 곧바로 해결한다. Task 6 단독 통과를 위해 이 시점엔 `submitting`·`setSecretSubmitting(true)` 줄을 생략하고 Task 7에서 추가하라.)

Success.tsx: location state 타입과 표시 추가:

```tsx
  const { state } = useLocation() as { state?: { name?: string; helpers?: string[] } };
  const toolName = state?.name ?? toolId;
  const helpers = state?.helpers ?? [];
```

부제 문단 아래에:

```tsx
      {helpers.length > 0 && (
        <p className="mt-1 text-caption text-txt-tertiary">{helpers.join("·")}도 함께 준비했어요.</p>
      )}
```

- [ ] **Step 4: 통과 확인** — Run: `bun run test` Expected: PASS (기존 wizard-lifecycle 테스트 포함 — 기존 테스트의 목 리포트에 tools가 들어갔는지 확인).
- [ ] **Step 5: 커밋** — `git commit -am "feat: 선행 하네스 사전 안내 스텝과 성공 화면 체인 표시"` (+트레일러)

---

### Task 7: SecretForm 제출 피드백 (api_key 마감)

**Files:**
- Modify: `src/components/SecretForm.tsx`, `src/screens/Wizard.tsx` (Task 6 주석 참고)
- Test: `src/components/__tests__/secretform.test.tsx`

**Interfaces:**
- Produces: `SecretForm` prop `submitting?: boolean` — true면 버튼 비활성 + "확인하는 중" 라벨. 제출 시 입력값은 비워진다.

- [ ] **Step 1: 실패 테스트** — secretform.test.tsx:

```tsx
it("제출하면 입력이 비워지고, submitting이면 버튼이 잠긴다", () => {
  const onSubmit = vi.fn();
  const { rerender } = render(<SecretForm label="api_key" onSubmit={onSubmit} />);
  const input = screen.getByLabelText("열쇠 값 붙여넣기") as HTMLInputElement;
  fireEvent.change(input, { target: { value: "oc-123" } });
  fireEvent.submit(input.closest("form")!);
  expect(onSubmit).toHaveBeenCalledWith("oc-123");
  expect(input.value).toBe("");
  rerender(<SecretForm label="api_key" onSubmit={onSubmit} submitting />);
  expect(screen.getByRole("button", { name: "확인하는 중" })).toBeDisabled();
});
```

- [ ] **Step 2: 실패 확인** — Run: `bun run test` Expected: FAIL.

- [ ] **Step 3: 구현** — SecretForm.tsx:

```tsx
export function SecretForm({ label, onSubmit, submitting = false }: {
  label: string; onSubmit: (value: string) => void; submitting?: boolean;
}) {
  const [value, setValue] = useState("");
  return (
    <form
      className="mx-auto mt-8 flex w-full max-w-md flex-col gap-3 text-left"
      onSubmit={(e) => {
        e.preventDefault();
        const v = value.trim();
        if (v && !submitting) {
          onSubmit(v);
          setValue(""); // 실패로 되돌아와도 빈 폼에서 다시 시작 (이월 백로그 5번)
        }
      }}
    >
```

버튼: `<PrimaryButton type="submit" disabled={submitting}>{submitting ? "확인하는 중" : "등록하기"}</PrimaryButton>`. (PrimaryButton이 disabled prop을 그대로 button에 넘기는지 `src/components/Buttons.tsx` 확인 — 없으면 `disabled` 전달 지원을 추가한다.) Wizard.tsx에 Task 6 주석의 `submitting` 전달·`setSecretSubmitting(true)` 줄을 넣는다.

- [ ] **Step 4: 통과 확인** — Run: `bun run test` Expected: PASS.
- [ ] **Step 5: 커밋** — `git commit -am "feat: 비밀값 제출 피드백과 폼 초기화"` (+트레일러)

---

### Task 8: Plugins 화면 실구현

**Files:**
- Modify: `src/screens/Plugins.tsx`
- Test: Create `src/screens/__tests__/plugins.test.tsx`

**Interfaces:**
- Consumes: `listCatalog()`, `ToolCard`(entry·onSelect·resolveName), `catalog://updated` 이벤트 (Catalog.tsx 패턴 복제)
- Produces: `/plugins` 화면 — kind==="plugin" 카드 그리드, 카드에 "OOO에 설치돼요" 캡션.

- [ ] **Step 1: 실패 테스트** — plugins.test.tsx (catalog.test.tsx의 목 패턴을 따라 `listCatalog`·`listen` 목):

```tsx
const entries = [
  harness({ id: "claude-code", name: "Claude Code", installed: false }),
  plugin({ id: "im-not-ai", name: "I'm Not AI", requires: ["claude-code"], missingRequires: ["claude-code"] }),
  plugin({ id: "korean-law-mcp", name: "한국 법령 검색", requires: ["claude-code"], missingRequires: [] }),
];
it("플러그인 카드만 그리고, 대상 하네스 이름을 보여준다", async () => {
  render(<Plugins />, { wrapper: MemoryRouterWrapper });
  expect(await screen.findByText("I'm Not AI")).toBeInTheDocument();
  expect(screen.queryByText("Claude Code")).not.toBeInTheDocument(); // 하네스 카드는 없음
  expect(screen.getAllByText("Claude Code에 설치돼요").length).toBe(2);
  expect(screen.getByText("Claude Code 필요")).toBeInTheDocument(); // id가 아니라 이름
});
```

(`harness`/`plugin` 팩토리는 CatalogEntry 필수 필드 전부 — platforms/available/source 포함 — 채우는 로컬 헬퍼로 작성.)

- [ ] **Step 2: 실패 확인** — Run: `bun run test` Expected: FAIL (스텁 화면).

- [ ] **Step 3: 구현** — Plugins.tsx를 Catalog.tsx와 같은 구조로:

```tsx
import { listen } from "@tauri-apps/api/event";
import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router";
import { ToolCard } from "../components/ToolCard";
import { listCatalog } from "../lib/ipc";
import type { CatalogEntry } from "../lib/types";

export function Plugins() {
  const [entries, setEntries] = useState<CatalogEntry[]>([]);
  const [failed, setFailed] = useState(false);
  const navigate = useNavigate();

  const load = useCallback(() => {
    setFailed(false);
    listCatalog().then(setEntries).catch(() => setFailed(true));
  }, []);
  useEffect(load, [load]);
  useEffect(() => {
    let un: (() => void) | undefined;
    void listen("catalog://updated", load).then((u) => { un = u; });
    return () => un?.();
  }, [load]);

  const plugins = entries.filter((e) => e.kind === "plugin");
  const nameOf = useCallback(
    (id: string) => entries.find((c) => c.id === id)?.name ?? id,
    [entries],
  );

  return (
    <div>
      <h1 className="text-title font-extrabold">플러그인 · 오픈소스</h1>
      <p className="mt-1 text-txt-secondary dark:text-txt-secondary-dark">
        쓰던 AI 도구를 더 똑똑하게 만들어 주는 부품이에요. 필요한 것까지 알아서 챙겨 드려요.
      </p>
      {failed ? (
        <div className="mt-6 flex flex-col items-start gap-3">
          <p className="font-bold">목록을 가져오지 못했어요</p>
          <button type="button" className="rounded-badge border border-line dark:border-line-dark px-4 py-2 font-bold hover:bg-surface-card-hover dark:hover:bg-surface-card-hover-dark" onClick={load}>
            다시 불러오기
          </button>
        </div>
      ) : (
        <div className="mt-6 grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          {plugins.map((e) => (
            <ToolCard key={e.id} entry={e} resolveName={nameOf} onSelect={(id) => navigate(`/wizard/${id}`)} />
          ))}
        </div>
      )}
    </div>
  );
}
```

ToolCard.tsx에 대상 하네스 캡션 추가 (배지 div 아래):

```tsx
      {entry.kind === "plugin" && entry.requires.length > 0 && (
        <p className="mt-2 text-caption text-txt-tertiary">
          {entry.requires.map((id) => resolveName?.(id) ?? id).join("·")}에 설치돼요
        </p>
      )}
```

- [ ] **Step 4: 통과 확인** — Run: `bun run test` Expected: PASS.
- [ ] **Step 5: 커밋** — `git commit -am "feat: 플러그인 화면 실구현"` (+트레일러)

---

### Task 9: 대시보드 삭제 가드

**Files:**
- Modify: `src/screens/Dashboard.tsx`
- Test: `src/screens/__tests__/dashboard.test.tsx`

**Interfaces:**
- Consumes: `CatalogEntry.requires`, `CatalogEntry.installed`
- Produces: 하네스 삭제 시 그 위에 얹힌 설치된 플러그인이 있으면 경고 문구가 든 confirm.

- [ ] **Step 1: 실패 테스트** — dashboard.test.tsx (기존 목 패턴):

```tsx
it("플러그인이 얹혀 있는 하네스를 지울 때 경고를 함께 보여준다", async () => {
  mockGetAppState.mockResolvedValue({ installations: [inst("codex"), inst("lazycodex")] });
  mockListCatalog.mockResolvedValue([
    harness({ id: "codex", name: "Codex", installed: true }),
    plugin({ id: "lazycodex", name: "lazycodex", requires: ["codex"], installed: true }),
  ]);
  const confirmSpy = vi.spyOn(window, "confirm").mockReturnValue(false);
  render(<Dashboard />, { wrapper: MemoryRouterWrapper });
  fireEvent.click((await screen.findAllByText("삭제"))[0]); // Codex 행
  expect(confirmSpy.mock.calls[0][0]).toContain("lazycodex도 함께 멈출 수 있어요");
});
```

- [ ] **Step 2: 실패 확인** — Run: `bun run test` Expected: FAIL.

- [ ] **Step 3: 구현** — Dashboard.tsx `uninstall` 함수의 confirm 부분 교체:

```tsx
  const uninstall = async (id: string) => {
    if (removing.has(id)) return;
    const dependents = catalog
      .filter((c) => c.installed && c.requires.includes(id))
      .map((c) => c.name);
    const warning = dependents.length > 0
      ? `이 도구를 지우면 위에 얹혀 있는 ${dependents.join("·")}도 함께 멈출 수 있어요. `
      : "";
    if (!window.confirm(`${warning}${nameOf(id)}을(를) 지울까요? 설정과 기록도 함께 정리돼요.`)) return;
```

- [ ] **Step 4: 통과 확인** — Run: `bun run test` Expected: PASS.
- [ ] **Step 5: 커밋** — `git commit -am "feat: 의존 플러그인 있는 도구 삭제 경고"` (+트레일러)

---

## 레시피 태스크 공통 규칙 (Task 10~14)

- 파일 위치: `src-tauri/recipes/<id>.json`. 로더가 디렉터리를 그대로 읽으므로 파일 추가만으로 카탈로그에 실린다 (서명은 원격 번들 전용이라 무관).
- 카피는 dry_run 전수 검사를 자동 통과해야 한다 (em dash·이모지·빈 문자열 금지).
- 스펙 테스트는 `src-tauri/tests/real_recipes.rs`에 태스크마다 추가. 테스트 먼저(레시피 파일 없어 FAIL 확인) → JSON 작성 → PASS.
- `supportedModels`는 플러그인 5종 전부 `[]`(모델은 하네스 쪽 속성). `recommended`는 전부 false.
- detect는 정보성(성공/실패 모두 install로 진행)이므로 설치 명령은 재실행해도 안전한 것만 쓴다 (marketplace add 멱등·plugin install 재설치·skills add 덮어쓰기 모두 안전).

---

### Task 10: lazycodex 레시피 (requires 실사용 1호)

**Files:**
- Create: `src-tauri/recipes/lazycodex.json`
- Test: `src-tauri/tests/real_recipes.rs`

**Interfaces:**
- Consumes: 기존 레시피 id `codex`, `nodejs-lts`. schema `source` 필드(Task 1).
- Produces: 카탈로그 id `lazycodex`. 이후 Task 14의 개수 검사에 포함.

- [ ] **Step 1: 실패 테스트** — real_recipes.rs에 추가:

```rust
#[test]
fn lazycodex_recipe_pulls_codex_and_node_first() {
    let cat = catalog();
    let r = cat.get("lazycodex").expect("lazycodex 레시피 없음");
    assert_eq!(r.kind, ToolKind::Plugin);
    assert_eq!(r.requires, vec!["codex"]);
    assert!(r.source.as_ref().unwrap().label.contains("Sisyphus"));
    let plan = build_plan(&cat, "lazycodex", Platform::Mac, Flow::Install, &[]).unwrap();
    assert_eq!(plan.tool_order, vec!["codex", "nodejs-lts", "lazycodex"]);
    // Codex가 이미 있으면 준비물과 자신만
    let plan2 = build_plan(&cat, "lazycodex", Platform::Mac, Flow::Install, &["codex".into()]).unwrap();
    assert_eq!(plan2.tool_order, vec!["nodejs-lts", "lazycodex"]);
    for p in [Platform::Mac, Platform::Windows] {
        let spec = r.platforms.get(p).unwrap();
        assert!(spec.auth.is_none(), "{p:?}: 자체 인증 없음 (Codex 인증에 얹혀감)");
        assert!(!spec.verify.is_empty());
        assert!(!spec.uninstall.is_empty());
        let joined = format!("{:?}", spec.install);
        assert!(joined.contains("--no-tui"), "{p:?}: 무인 설치 플래그 필요");
        assert!(!joined.contains("--codex-autonomous"), "{p:?}: 채택 안 한 플래그");
    }
}
```

- [ ] **Step 2: 실패 확인** — Run: `cargo test -p easy-harness --test real_recipes lazycodex` Expected: FAIL ("lazycodex 레시피 없음").

- [ ] **Step 3: 레시피 작성** — `src-tauri/recipes/lazycodex.json`:

```json
{
  "schemaVersion": 1,
  "id": "lazycodex",
  "name": "LazyCodex",
  "kind": "plugin",
  "easyDescription": "Codex에 계획 세우기, 자기 검증, 기억력을 더해 주는 강화 키트예요",
  "pricing": { "label": "무료", "kind": "free" },
  "recommended": false,
  "requires": ["codex"],
  "source": { "label": "만든 곳: Sisyphus Labs", "url": "https://github.com/code-yeongyu/lazycodex" },
  "platforms": {
    "mac": {
      "prerequisites": ["nodejs-lts"],
      "detect": [
        { "type": "path_check", "friendly": "LazyCodex가 이미 붙어 있는지 볼게요", "path": "{{home}}/.local/bin/omo" }
      ],
      "install": [
        { "type": "run_command", "friendly": "LazyCodex를 Codex에 붙이고 있어요", "command": "/bin/zsh", "args": ["-lc", "npx --yes lazycodex-ai@latest install --no-tui"] }
      ],
      "verify": [
        { "type": "check_command", "friendly": "잘 붙었는지 확인하고 있어요", "command": "/bin/zsh", "args": ["-lc", "{{home}}/.local/bin/omo --version"] }
      ],
      "update": [
        { "type": "run_command", "friendly": "LazyCodex를 새 버전으로 바꾸고 있어요", "command": "/bin/zsh", "args": ["-lc", "npx --yes lazycodex-ai@latest install --no-tui"] }
      ],
      "uninstall": [
        { "type": "run_command", "friendly": "LazyCodex를 깨끗하게 지우고 있어요", "command": "/bin/zsh", "args": ["-lc", "npx --yes lazycodex-ai uninstall"] }
      ],
      "rollback": [
        { "type": "run_command", "friendly": "설치하다 만 흔적을 정리하고 있어요", "command": "/bin/zsh", "args": ["-lc", "npx --yes lazycodex-ai uninstall"] }
      ]
    },
    "windows": {
      "prerequisites": ["nodejs-lts"],
      "detect": [
        { "type": "path_check", "friendly": "LazyCodex가 이미 붙어 있는지 볼게요", "path": "{{home}}/.local/bin/omo" }
      ],
      "install": [
        { "type": "run_command", "friendly": "LazyCodex를 Codex에 붙이고 있어요", "command": "cmd", "args": ["/C", "npx --yes lazycodex-ai@latest install --no-tui"] }
      ],
      "verify": [
        { "type": "check_command", "friendly": "잘 붙었는지 확인하고 있어요", "command": "cmd", "args": ["/C", "npx --yes lazycodex-ai doctor"] }
      ],
      "update": [
        { "type": "run_command", "friendly": "LazyCodex를 새 버전으로 바꾸고 있어요", "command": "cmd", "args": ["/C", "npx --yes lazycodex-ai@latest install --no-tui"] }
      ],
      "uninstall": [
        { "type": "run_command", "friendly": "LazyCodex를 깨끗하게 지우고 있어요", "command": "cmd", "args": ["/C", "npx --yes lazycodex-ai uninstall"] }
      ],
      "rollback": [
        { "type": "run_command", "friendly": "설치하다 만 흔적을 정리하고 있어요", "command": "cmd", "args": ["/C", "npx --yes lazycodex-ai uninstall"] }
      ]
    }
  }
}
```

(윈도우 detect의 `{{home}}/.local/bin/omo` 경로와 verify의 doctor 사용은 실측 불가 항목 — M6 VM 스모크에서 검증하고 어긋나면 원격 갱신. doctor는 exit 0 고정이라 verify 게이트로는 약하지만 윈도우에서 `omo` 경로가 불확실해 실행 성공 여부만 본다. 맥은 실물 근거 있는 `omo --version` 사용.)

- [ ] **Step 4: 통과 확인** — Run: `cargo test -p easy-harness --test real_recipes` Expected: PASS (단 `opencode_recipe_spec_and_catalog_is_complete`의 `len() == 8`이 9가 되어 FAIL — 이 단언을 Task 14 전까지 임시로 깨두면 안 되므로, **이 태스크에서 그 단언 2줄을 삭제**하고 Task 14의 신규 완결성 테스트가 최종 개수를 책임진다는 주석을 남긴다):

```rust
    // 카탈로그 개수·구성 마감 검사는 M4 완결성 테스트(catalog_is_complete_after_m4)가 담당
```

- [ ] **Step 5: 커밋** — `git add -A && git commit -m "feat: LazyCodex 레시피 (requires 실사용 1호)"` (+트레일러)

---

### Task 11: insane-search 레시피 (맥 전용 1호)

**Files:**
- Create: `src-tauri/recipes/insane-search.json`
- Test: `src-tauri/tests/real_recipes.rs`

**Interfaces:**
- Consumes: 레시피 id `claude-code`
- Produces: 카탈로그 id `insane-search` (windows 섹션 없음 → Task 2의 available=false 경로 실물 1호)

- [ ] **Step 1: 실패 테스트**:

```rust
#[test]
fn insane_search_recipe_is_mac_only_claude_plugin() {
    let cat = catalog();
    let r = cat.get("insane-search").expect("insane-search 레시피 없음");
    assert_eq!(r.kind, ToolKind::Plugin);
    assert_eq!(r.requires, vec!["claude-code"]);
    assert!(r.platforms.windows.is_none(), "윈도우는 WSL2 필수라 v1 미지원");
    let plan = build_plan(&cat, "insane-search", Platform::Mac, Flow::Install, &[]).unwrap();
    assert_eq!(plan.tool_order, vec!["claude-code", "insane-search"]);
    let mac = r.platforms.get(Platform::Mac).unwrap();
    assert!(mac.auth.is_none());
    let install = format!("{:?}", mac.install);
    assert!(install.contains("https://github.com/fivetaku/gptaku_plugins.git"), "HTTPS URL 고정");
    assert!(install.contains("insane-search@gptaku-plugins"));
}
```

- [ ] **Step 2: 실패 확인** — Run: `cargo test -p easy-harness --test real_recipes insane_search` Expected: FAIL.

- [ ] **Step 3: 레시피 작성** — `src-tauri/recipes/insane-search.json`:

```json
{
  "schemaVersion": 1,
  "id": "insane-search",
  "name": "인세인서치",
  "kind": "plugin",
  "easyDescription": "웹페이지가 안 열릴 때 다른 길을 찾아 끝까지 읽어다 주는 검색 보조예요",
  "pricing": { "label": "무료", "kind": "free" },
  "recommended": false,
  "requires": ["claude-code"],
  "source": { "label": "만든 곳: fivetaku", "url": "https://github.com/fivetaku/insane-search" },
  "platforms": {
    "mac": {
      "prerequisites": [],
      "detect": [
        { "type": "check_command", "friendly": "이미 설치돼 있는지 볼게요", "command": "/bin/zsh", "args": ["-lc", "claude plugin list --json | grep -q 'insane-search@gptaku-plugins'"] }
      ],
      "install": [
        { "type": "run_command", "friendly": "플러그인 가게를 등록하고 있어요", "command": "/bin/zsh", "args": ["-lc", "claude plugin marketplace add https://github.com/fivetaku/gptaku_plugins.git"] },
        { "type": "run_command", "friendly": "인세인서치를 Claude Code에 설치하고 있어요", "command": "/bin/zsh", "args": ["-lc", "claude plugin install insane-search@gptaku-plugins"] }
      ],
      "verify": [
        { "type": "check_command", "friendly": "설치 목록에 잘 올라갔는지 확인하고 있어요", "command": "/bin/zsh", "args": ["-lc", "claude plugin list --json | grep -q 'insane-search@gptaku-plugins'"] }
      ],
      "update": [
        { "type": "run_command", "friendly": "인세인서치를 새 버전으로 바꾸고 있어요", "command": "/bin/zsh", "args": ["-lc", "claude plugin update insane-search"] }
      ],
      "uninstall": [
        { "type": "run_command", "friendly": "인세인서치를 깨끗하게 지우고 있어요", "command": "/bin/zsh", "args": ["-lc", "claude plugin uninstall insane-search"] }
      ],
      "rollback": [
        { "type": "run_command", "friendly": "설치하다 만 흔적을 정리하고 있어요", "command": "/bin/zsh", "args": ["-lc", "claude plugin uninstall insane-search || true"] }
      ]
    }
  }
}
```

- [ ] **Step 4: 통과 확인** — Run: `cargo test -p easy-harness --test real_recipes` Expected: PASS.
- [ ] **Step 5: 커밋** — `git add -A && git commit -m "feat: 인세인서치 레시피 (맥 전용 1호)"` (+트레일러)

---

### Task 12: korean-law-mcp 레시피 (api_key 실사용 1호)

**Files:**
- Create: `src-tauri/recipes/korean-law-mcp.json`
- Test: `src-tauri/tests/real_recipes.rs`

**Interfaces:**
- Consumes: 레시피 id `claude-code`, `{{secret:law_oc}}` 치환(SecretVault), `input_secret`/`open_url` 스텝
- Produces: 카탈로그 id `korean-law-mcp`. api_key 패턴의 첫 실물 — SecretForm 경로(Task 7)가 이 레시피로 처음 실동작한다.

- [ ] **Step 1: 실패 테스트**:

```rust
#[test]
fn korean_law_recipe_uses_api_key_pattern() {
    let cat = catalog();
    let r = cat.get("korean-law-mcp").expect("korean-law-mcp 레시피 없음");
    assert_eq!(r.kind, ToolKind::Plugin);
    assert_eq!(r.requires, vec!["claude-code"]);
    for p in [Platform::Mac, Platform::Windows] {
        let spec = r.platforms.get(p).unwrap();
        let auth = spec.auth.as_ref().expect("api_key 인증 필요");
        assert_eq!(auth.pattern, AuthPattern::ApiKey, "{p:?}");
        assert_eq!(auth.guide.len(), 3, "{p:?}");
        let steps = format!("{:?}", auth.steps);
        assert!(steps.contains("open.law.go.kr"), "{p:?}: 발급 페이지 열기");
        assert!(steps.contains("InputSecret"), "{p:?}");
        assert!(steps.contains("law_oc"), "{p:?}: 시크릿 라벨");
        assert!(steps.contains("--config api_key={{secret:law_oc}}"), "{p:?}: 키 주입");
        assert!(!steps.contains("PtySession"), "{p:?}: 터미널 금지");
    }
}
```

- [ ] **Step 2: 실패 확인** — Run: `cargo test -p easy-harness --test real_recipes korean_law` Expected: FAIL.

- [ ] **Step 3: 레시피 작성** — `src-tauri/recipes/korean-law-mcp.json` (윈도우는 grep 대신 findstr, 셸만 다르고 구조 동일):

```json
{
  "schemaVersion": 1,
  "id": "korean-law-mcp",
  "name": "한국 법령 검색",
  "kind": "plugin",
  "easyDescription": "법제처 공식 자료로 법령과 판례를 정확하게 찾아 주는 법률 도우미예요",
  "pricing": { "label": "무료 (인증키 필요)", "kind": "free" },
  "recommended": false,
  "requires": ["claude-code"],
  "source": { "label": "만든 곳: chrisryugj", "url": "https://github.com/chrisryugj/korean-law-mcp" },
  "platforms": {
    "mac": {
      "prerequisites": [],
      "detect": [
        { "type": "check_command", "friendly": "이미 설치돼 있는지 볼게요", "command": "/bin/zsh", "args": ["-lc", "claude plugin list --json | grep -q 'korean-law@korean-law-marketplace'"] }
      ],
      "install": [
        { "type": "run_command", "friendly": "플러그인 가게를 등록하고 있어요", "command": "/bin/zsh", "args": ["-lc", "claude plugin marketplace add https://github.com/chrisryugj/korean-law-mcp.git"] }
      ],
      "auth": {
        "pattern": "api_key",
        "steps": [
          { "type": "open_url", "friendly": "법제처 인증키 발급 페이지를 열어 드릴게요", "url": "https://open.law.go.kr/LSO/openApi/guideList.do" },
          { "type": "input_secret", "friendly": "발급받은 인증키를 넣어 주세요", "label": "law_oc" },
          { "type": "run_command", "friendly": "인증키와 함께 법령 검색기를 연결하고 있어요", "command": "/bin/zsh", "args": ["-lc", "claude plugin install korean-law@korean-law-marketplace --config api_key={{secret:law_oc}}"] }
        ],
        "guide": [
          "버튼을 누르면 법제처 발급 페이지가 열려요. 이메일만 있으면 무료로 바로 받아요",
          "발급받은 인증키(짧은 영문 아이디 모양)를 복사해서 아래 칸에 붙여넣어 주세요",
          "등록이 끝나면 Claude Code 안에서 법령 검색을 바로 쓸 수 있어요"
        ]
      },
      "verify": [
        { "type": "check_command", "friendly": "설치 목록에 잘 올라갔는지 확인하고 있어요", "command": "/bin/zsh", "args": ["-lc", "claude plugin list --json | grep -q 'korean-law@korean-law-marketplace'"] }
      ],
      "update": [
        { "type": "run_command", "friendly": "법령 검색기를 새 버전으로 바꾸고 있어요", "command": "/bin/zsh", "args": ["-lc", "claude plugin update korean-law"] }
      ],
      "uninstall": [
        { "type": "run_command", "friendly": "법령 검색기를 깨끗하게 지우고 있어요", "command": "/bin/zsh", "args": ["-lc", "claude plugin uninstall korean-law"] }
      ],
      "rollback": [
        { "type": "run_command", "friendly": "설치하다 만 흔적을 정리하고 있어요", "command": "/bin/zsh", "args": ["-lc", "claude plugin uninstall korean-law || true"] }
      ]
    },
    "windows": {
      "prerequisites": [],
      "detect": [
        { "type": "check_command", "friendly": "이미 설치돼 있는지 볼게요", "command": "cmd", "args": ["/C", "claude plugin list --json | findstr korean-law@korean-law-marketplace"] }
      ],
      "install": [
        { "type": "run_command", "friendly": "플러그인 가게를 등록하고 있어요", "command": "cmd", "args": ["/C", "claude plugin marketplace add https://github.com/chrisryugj/korean-law-mcp.git"] }
      ],
      "auth": {
        "pattern": "api_key",
        "steps": [
          { "type": "open_url", "friendly": "법제처 인증키 발급 페이지를 열어 드릴게요", "url": "https://open.law.go.kr/LSO/openApi/guideList.do" },
          { "type": "input_secret", "friendly": "발급받은 인증키를 넣어 주세요", "label": "law_oc" },
          { "type": "run_command", "friendly": "인증키와 함께 법령 검색기를 연결하고 있어요", "command": "cmd", "args": ["/C", "claude plugin install korean-law@korean-law-marketplace --config api_key={{secret:law_oc}}"] }
        ],
        "guide": [
          "버튼을 누르면 법제처 발급 페이지가 열려요. 이메일만 있으면 무료로 바로 받아요",
          "발급받은 인증키(짧은 영문 아이디 모양)를 복사해서 아래 칸에 붙여넣어 주세요",
          "등록이 끝나면 Claude Code 안에서 법령 검색을 바로 쓸 수 있어요"
        ]
      },
      "verify": [
        { "type": "check_command", "friendly": "설치 목록에 잘 올라갔는지 확인하고 있어요", "command": "cmd", "args": ["/C", "claude plugin list --json | findstr korean-law@korean-law-marketplace"] }
      ],
      "update": [
        { "type": "run_command", "friendly": "법령 검색기를 새 버전으로 바꾸고 있어요", "command": "cmd", "args": ["/C", "claude plugin update korean-law"] }
      ],
      "uninstall": [
        { "type": "run_command", "friendly": "법령 검색기를 깨끗하게 지우고 있어요", "command": "cmd", "args": ["/C", "claude plugin uninstall korean-law"] }
      ],
      "rollback": [
        { "type": "run_command", "friendly": "설치하다 만 흔적을 정리하고 있어요", "command": "cmd", "args": ["/C", "claude plugin uninstall korean-law"] }
      ]
    }
  }
}
```

- [ ] **Step 4: 통과 확인** — Run: `cargo test -p easy-harness --test real_recipes` Expected: PASS.
- [ ] **Step 5: 커밋** — `git add -A && git commit -m "feat: 한국 법령 검색 레시피 (api_key 실사용 1호)"` (+트레일러)

---

### Task 13: im-not-ai 레시피

**Files:**
- Create: `src-tauri/recipes/im-not-ai.json`
- Test: `src-tauri/tests/real_recipes.rs`

**Interfaces:**
- Consumes: 레시피 id `claude-code`
- Produces: 카탈로그 id `im-not-ai` (설치 실체는 `humanize-korean@im-not-ai`)

- [ ] **Step 1: 실패 테스트**:

```rust
#[test]
fn im_not_ai_recipe_installs_humanize_korean_plugin() {
    let cat = catalog();
    let r = cat.get("im-not-ai").expect("im-not-ai 레시피 없음");
    assert_eq!(r.kind, ToolKind::Plugin);
    assert_eq!(r.requires, vec!["claude-code"]);
    for p in [Platform::Mac, Platform::Windows] {
        let spec = r.platforms.get(p).unwrap();
        assert!(spec.auth.is_none(), "{p:?}");
        let install = format!("{:?}", spec.install);
        assert!(install.contains("https://github.com/epoko77-ai/im-not-ai.git"), "{p:?}");
        assert!(install.contains("humanize-korean@im-not-ai"), "{p:?}: 설치 실체 이름");
    }
}
```

- [ ] **Step 2: 실패 확인** — Run: `cargo test -p easy-harness --test real_recipes im_not_ai` Expected: FAIL.

- [ ] **Step 3: 레시피 작성** — `src-tauri/recipes/im-not-ai.json`. 구조는 Task 12와 동일 골격(auth 없음)이며 값만 다르다. mac 섹션 전문:

```json
{
  "schemaVersion": 1,
  "id": "im-not-ai",
  "name": "임낫에이아이",
  "kind": "plugin",
  "easyDescription": "AI가 쓴 한글 특유의 티를 지워서 사람이 쓴 글처럼 다듬어 줘요",
  "pricing": { "label": "무료", "kind": "free" },
  "recommended": false,
  "requires": ["claude-code"],
  "source": { "label": "만든 곳: epoko77-ai", "url": "https://github.com/epoko77-ai/im-not-ai" },
  "platforms": {
    "mac": {
      "prerequisites": [],
      "detect": [
        { "type": "check_command", "friendly": "이미 설치돼 있는지 볼게요", "command": "/bin/zsh", "args": ["-lc", "claude plugin list --json | grep -q 'humanize-korean@im-not-ai'"] }
      ],
      "install": [
        { "type": "run_command", "friendly": "플러그인 가게를 등록하고 있어요", "command": "/bin/zsh", "args": ["-lc", "claude plugin marketplace add https://github.com/epoko77-ai/im-not-ai.git"] },
        { "type": "run_command", "friendly": "임낫에이아이를 Claude Code에 설치하고 있어요", "command": "/bin/zsh", "args": ["-lc", "claude plugin install humanize-korean@im-not-ai"] }
      ],
      "verify": [
        { "type": "check_command", "friendly": "설치 목록에 잘 올라갔는지 확인하고 있어요", "command": "/bin/zsh", "args": ["-lc", "claude plugin list --json | grep -q 'humanize-korean@im-not-ai'"] }
      ],
      "update": [
        { "type": "run_command", "friendly": "임낫에이아이를 새 버전으로 바꾸고 있어요", "command": "/bin/zsh", "args": ["-lc", "claude plugin update humanize-korean"] }
      ],
      "uninstall": [
        { "type": "run_command", "friendly": "임낫에이아이를 깨끗하게 지우고 있어요", "command": "/bin/zsh", "args": ["-lc", "claude plugin uninstall humanize-korean"] }
      ],
      "rollback": [
        { "type": "run_command", "friendly": "설치하다 만 흔적을 정리하고 있어요", "command": "/bin/zsh", "args": ["-lc", "claude plugin uninstall humanize-korean || true"] }
      ]
    },
    "windows": { "...": "mac과 동일 구조를 cmd /C·findstr로 변환 (Task 12 windows 섹션과 같은 규칙: grep -q → findstr, /bin/zsh -lc → cmd /C, || true 제거)" }
  }
}
```

(windows 섹션은 위 주석 규칙대로 실제 JSON으로 풀어 쓴다 — `"..."` 같은 자리표시자를 남기면 파싱 에러로 즉시 잡힌다.)

- [ ] **Step 4: 통과 확인** — Run: `cargo test -p easy-harness --test real_recipes` Expected: PASS.
- [ ] **Step 5: 커밋** — `git add -A && git commit -m "feat: 임낫에이아이 레시피"` (+트레일러)

---

### Task 14: k-skill 레시피 + M4 카탈로그 완결성 검사

**Files:**
- Create: `src-tauri/recipes/k-skill.json`
- Test: `src-tauri/tests/real_recipes.rs`

**Interfaces:**
- Consumes: 레시피 id `claude-code`, `nodejs-lts`
- Produces: 카탈로그 id `k-skill` + 최종 완결성 테스트 `catalog_is_complete_after_m4` (13종 = 하네스 6 + 플러그인 5 + 준비물 2)

- [ ] **Step 1: 실패 테스트**:

```rust
#[test]
fn k_skill_recipe_uses_skills_cli_with_full_set() {
    let cat = catalog();
    let r = cat.get("k-skill").expect("k-skill 레시피 없음");
    assert_eq!(r.kind, ToolKind::Plugin);
    assert_eq!(r.requires, vec!["claude-code"]);
    let plan = build_plan(&cat, "k-skill", Platform::Mac, Flow::Install, &[]).unwrap();
    assert_eq!(plan.tool_order, vec!["claude-code", "nodejs-lts", "k-skill"]);
    for p in [Platform::Mac, Platform::Windows] {
        let spec = r.platforms.get(p).unwrap();
        assert!(spec.auth.is_none(), "{p:?}");
        let install = format!("{:?}", spec.install);
        assert!(install.contains("skills add NomaDamas/k-skill --all -g -y -a claude-code"), "{p:?}");
        let un = format!("{:?}", spec.uninstall);
        assert!(un.contains("skills remove"), "{p:?}");
        assert!(un.contains("lotto-results"), "{p:?}: 이름 명시 제거 목록");
        assert!(un.contains("-g -y"), "{p:?}");
    }
}

#[test]
fn catalog_is_complete_after_m4() {
    let cat = catalog();
    assert_eq!(cat.recipes.len(), 13, "하네스 6 + 플러그인 5 + 준비물 2");
    let count = |k: ToolKind| cat.recipes.iter().filter(|r| r.kind == k).count();
    assert_eq!(count(ToolKind::Harness), 6);
    assert_eq!(count(ToolKind::Plugin), 5);
    assert_eq!(count(ToolKind::Prerequisite), 2);
    // 플러그인 5종 공통 계약: requires 비어 있지 않고, 제3자 오픈소스라 source 표기 필수
    for r in cat.recipes.iter().filter(|r| r.kind == ToolKind::Plugin) {
        assert!(!r.requires.is_empty(), "{}: 플러그인은 대상 하네스 필요", r.id);
        assert!(r.source.is_some(), "{}: 제작자 표기 필요", r.id);
    }
}
```

- [ ] **Step 2: 실패 확인** — Run: `cargo test -p easy-harness --test real_recipes k_skill catalog_is_complete` Expected: FAIL.

- [ ] **Step 3: 레시피 작성** — `src-tauri/recipes/k-skill.json`. uninstall/rollback의 제거 명령은 아래 102개 이름 전체를 한 줄에 나열한다 (2026-07-06 `--list` 실측 스냅샷 — 업스트림 추가분은 레시피 원격 갱신으로 동기화):

```
biz-health-check bunjang-search catchtable-sniper cheap-gas-nearby corporate-registration-consulting coupang-product-search court-auction-notice-search daangn-cars-search daangn-jobs-search daangn-realty-search daangn-used-goods-search daishin-report-search daiso-product-search danawa-price-search delivery-tracking donation-place-search emergency-room-beds express-bus-booking fine-dust-location flight-ticket-search foresttrip-vacancy fsc-corporate-info g2b-order-plan-search g2b-sanctioned-supplier gangnamunni-clinic-search geeknews-search gongsijiga-search han-river-water-level hipass-receipt hola-poke-yeoksam household-waste-info hwp intercity-bus-booking iros-registry-automation job-posting-match jobkorea-talent-search joseon-sillok-search k-dart k-schoollunch-menu k-skill-cleaner k-skill-setup kakao-bar-nearby kakao-map kakaotalk-mac kbl-results kbo-results kleague-results korea-weather korean-character-count korean-cinema-search korean-humanizer korean-jangbu-for korean-law-search korean-marathon-schedule korean-middle-korean korean-patent-search korean-privacy-terms korean-scholarship-search korean-slang-writing korean-spell-check korean-stock-search korean-transit-route kosis-stats kstartup-search ktx-booking lck-analytics lh-notice-search library-book-search local-election-candidate-search localdata-business-status lotto-results lovebug-report market-kurly-search mfds-drug-safety mfds-food-safety myrealtrip-search naming-house national-pension-workplace naver-blog-research naver-news-search naver-shopping-search nts-business-registration nts-tax-delinquency ohou-today-deal olive-young-search parking-lot-search public-restroom-nearby real-estate-search rhwp-advanced rhwp-edit saju-fortune saramin-talent-search seoul-bike seoul-density seoul-subway-arrival sh-notice-search srt-booking subway-lost-property ticket-availability toss-securities used-car-price-search zipcode-search
```

JSON (mac; windows는 같은 명령을 `cmd /C`로):

```json
{
  "schemaVersion": 1,
  "id": "k-skill",
  "name": "K-스킬",
  "kind": "plugin",
  "easyDescription": "로또, 날씨, 법령, 부동산 같은 한국 생활 정보 백여 가지를 AI 도구에 더해 줘요",
  "pricing": { "label": "무료", "kind": "free" },
  "recommended": false,
  "requires": ["claude-code"],
  "source": { "label": "만든 곳: NomaDamas", "url": "https://github.com/NomaDamas/k-skill" },
  "platforms": {
    "mac": {
      "prerequisites": ["nodejs-lts"],
      "detect": [
        { "type": "path_check", "friendly": "이미 설치돼 있는지 볼게요", "path": "{{home}}/.claude/skills/k-skill-setup" }
      ],
      "install": [
        { "type": "run_command", "friendly": "한국 생활 스킬 모음을 설치하고 있어요", "command": "/bin/zsh", "args": ["-lc", "npx --yes skills add NomaDamas/k-skill --all -g -y -a claude-code"] }
      ],
      "verify": [
        { "type": "path_check", "friendly": "스킬이 제자리에 들어갔는지 확인하고 있어요", "path": "{{home}}/.claude/skills/k-skill-setup" }
      ],
      "update": [
        { "type": "run_command", "friendly": "스킬 모음을 새 버전으로 바꾸고 있어요", "command": "/bin/zsh", "args": ["-lc", "npx --yes skills add NomaDamas/k-skill --all -g -y -a claude-code"] }
      ],
      "uninstall": [
        { "type": "run_command", "friendly": "스킬 모음을 깨끗하게 지우고 있어요", "command": "/bin/zsh", "args": ["-lc", "npx --yes skills remove <위 102개 이름 나열> -g -y"] }
      ],
      "rollback": [
        { "type": "run_command", "friendly": "설치하다 만 흔적을 정리하고 있어요", "command": "/bin/zsh", "args": ["-lc", "npx --yes skills remove <위 102개 이름 나열> -g -y"] }
      ]
    },
    "windows": { "구조 동일": "cmd /C, path_check는 {{home}}/.claude/skills/k-skill-setup 그대로 (Rust Path가 슬래시 처리)" }
  }
}
```

(`<위 102개 이름 나열>` 자리에는 위 이름 블록을 공백으로 이어 그대로 넣는다 — 자리표시자를 남기면 스펙 테스트 `lotto-results` 단언이 잡는다. windows 섹션도 실제 JSON으로 풀어 쓴다.)

- [ ] **Step 4: 통과 확인** — Run: `cargo test -p easy-harness --test real_recipes` Expected: 전체 PASS (dry_run 카피 전수 검사 포함 — `cargo test -p easy-harness all_bundled_recipes` 재확인).
- [ ] **Step 5: 커밋** — `git add -A && git commit -m "feat: K-스킬 레시피 (전체 102종) + M4 카탈로그 완결성 검사"` (+트레일러)

---

### Task 15: 전체 게이트 + 문서 마감

**Files:**
- Modify: `HANDOFF.md`

- [ ] **Step 1: Rust 게이트** — Run (src-tauri에서): `cargo test && cargo clippy --all-targets -- -D warnings && cargo fmt --check` Expected: 전부 통과·경고 0. 실패하면 고치고 재실행.
- [ ] **Step 2: 프론트 게이트** — Run (레포 루트): `bun run test && bun run build` Expected: vitest 전체 PASS(기존 34 + 신규), tsc·vite 빌드 성공.
- [ ] **Step 3: 수동 GUI 확인 (실설치 없이)** — `bun run tauri dev`로 앱을 띄워 확인: ① 플러그인 화면에 5종 카드+제작자 표기+"Claude Code에 설치돼요" ② lazycodex 카드 클릭 시(하네스 미설치 상태 store 기준) "먼저 챙길 게 있어요" 안내 표시, **시작 버튼은 누르지 않는다**(실설치 방지) ③ 대시보드 삭제 경고 문구. 이상 발견 시 수정 후 해당 태스크 테스트 보강.
- [ ] **Step 4: HANDOFF 갱신·커밋** — 현재 작업(M4 구현 완료, 게이트 수치), 다음 스텝(실설치 스모크: lazycodex 체인 + korean-law-mcp api_key — 사용자 확인 후 진행, 이후 M5), 주의(k-skill 102종 목록은 원격 갱신으로 동기화, lazycodex·im-not-ai 윈도우 섹션은 M6 검증 대상)를 덮어쓰기로 기록. `git add -A && git commit -m "chore: HANDOFF 갱신 (M4 구현 완료)"` (+트레일러)
- [ ] **Step 5: 사용자 보고** — 실설치 스모크 2종(lazycodex: 형 맥의 기존 4.13.0 잔재를 4.15+로 복구하는 효과도 있음 / korean-law-mcp: 법제처 키 필요 — 형이 발급)을 형 확인 후 진행하겠다고 보고하고 대기.

---

## 계획 셀프 리뷰 결과 (작성 시 반영 완료)

- 스펙 커버리지: 스펙 3절(레시피 5종)=Task 10~14, 5절(source·구분 명문화)=Task 1, 6절 ①=Task 4·5·6 ②=Task 8 ③=Task 2 ④=Task 7 ⑤=Task 3 ⑥=Task 9, 8절(테스트)=각 태스크+Task 15, 실설치 스모크=Task 15 Step 5(사용자 게이트).
- 타입 일관성: `DryRunTool`(Rust/TS 동형), `RunState.currentRecipeId`, `helperNames`, `SecretForm.submitting`, `CatalogEntry.{source,platforms,available}` — 정의 태스크와 사용 태스크 명칭 일치 확인.
- 알려진 한계(의도된 결정): lazycodex 윈도우 detect/verify와 im-not-ai·k-skill 윈도우 섹션은 실측 불가 → M6 VM 스모크에서 검증, 어긋나면 레시피 원격 갱신. korean-law verify는 설치 등록 확인까지만(키 유효성은 첫 사용 시 판명 — stderr 힌트가 재입력 유도).
