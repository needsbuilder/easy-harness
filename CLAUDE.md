# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## 프로젝트 개요

이지 하네스(Easy Harness): AI 입문 비개발자가 클릭 몇 번으로 AI 코딩 도구(Claude Code 등)를 설치·인증·확인·관리하는 맥/윈도우 데스크톱 앱. Tauri 2 (Rust) + React 19 + TypeScript + Vite + Tailwind CSS 4. 패키지 매니저는 bun.

주 사용자가 터미널 경험이 전혀 없는 일반인이라는 전제가 모든 문구·화면·에러 메시지의 기준이다. UI 카피와 레시피의 `friendly` 문구는 전부 쉬운 한국어("~하고 있어요" 톤)로 쓰고, 한국어 카피에 em dash(—)를 쓰지 않는다. 코드 주석도 한국어가 관례다.

## 자주 쓰는 명령

```bash
bun install                  # 의존성 설치
bun run tauri dev            # 앱 실행 (개발 모드)
bun run test                 # 프론트 테스트 전체 (vitest run)
bun run test src/lib/__tests__/josa.test.ts   # 프론트 단일 테스트 파일
bun run build                # tsc + vite build (CI가 검사)

cd src-tauri
cargo test                   # Rust 테스트 전체 (레시피 드라이런 전수 검증 포함)
cargo test --test real_recipes        # 실물 레시피 스펙 테스트만
cargo test <이름>            # 이름 매칭 단일 테스트
cargo fmt --check            # CI가 검사
cargo clippy -- -D warnings  # CI가 검사 (경고 = 실패)
```

- CI(`.github/workflows/ci.yml`): Rust는 macOS·Windows 매트릭스에서 fmt/clippy/test, 프론트는 test + build. 머지 전 로컬에서 이 다섯 개를 다 돌려보는 게 안전하다.
- 레시피 번들 서명 도구(개발자 전용, 앱 미포함): `cargo run --bin sign_recipes -- keygen|sign <bundle.json> <secret.key>`. 개인키는 절대 커밋 금지.
- `bun run dev`(vite 단독)는 Tauri IPC가 없어 화면 껍데기만 뜬다. 실동작 확인은 `bun run tauri dev`.
- tauri dev는 `src-tauri/target/debug/recipes`에 삭제된 레시피 잔재를 남길 수 있다(릴리스 빌드는 무관).

## 아키텍처

### 핵심 개념: 레시피 (선언적 JSON)

도구 하나 = `src-tauri/recipes/*.json` 하나. 새 도구 추가는 레시피 파일 추가 + `src-tauri/tests/real_recipes.rs`에 자기 검증 테스트 추가로 끝나는 구조다.

- 스키마: `src-tauri/src/recipe/schema.rs` (`schemaVersion: 1`, camelCase, `deny_unknown_fields`)
- `kind`: `harness`(AI 코딩 도구) / `plugin`(하네스에 붙는 확장) / `prerequisite`(Node.js·bun 같은 준비물)
- 플랫폼별(mac/windows) 섹션: `detect / install / auth / verify / update / uninstall / rollback`, 각 섹션은 Step 배열
- Step 7종: `check_command` `run_command` `download_run` `open_url` `input_secret` `pty_session` `path_check`. 치환자: `{{home}}`, `{{file}}`(download_run), `{{secret:<label>}}`(시크릿 주입)
- 인증 패턴 4종: `browser_login`(브라우저 로그인) / `api_key`(SecretForm 입력) / `interactive_terminal`(앱 내 xterm PTY) / `automatic`(사용자 입력 없음, UI 안 띄움)
- `requires`(다른 도구 의존) vs `prerequisites`(플랫폼 준비물): plan 단계에서 병합되어 단일 런으로 설치된다
- 주의: Step은 내부 태그드 enum이라 variant 안의 오타 필드는 serde가 조용히 무시한다. 레시피 필드 오타는 `real_recipes.rs` 드라이런 테스트가 잡는 안전망이므로, 레시피를 추가·수정하면 반드시 거기에 스펙 테스트를 넣거나 갱신한다.

### Rust 백엔드 (`src-tauri/src/`)

- `lib.rs`: 앱 엔트리. 카탈로그 로딩(원격 캐시 → 번들 폴백) + Tauri 커맨드 등록
- `recipe/`: `loader.rs`(카탈로그) · `plan.rs`(`build_plan`이 requires+prerequisites를 풀어 `tool_order` 산출) · `remote.rs`(원격 레시피 번들 갱신) · `signing.rs`(ed25519 검증)
- `runner/`: 스텝 실행 엔진. `step_runner.rs`가 플로우를 돌리며 이벤트 방출, `pty.rs`(portable-pty), `secrets.rs`(SecretVault), `dry_run.rs`, `error_hints.rs`(stderr 패턴 → 한국어 힌트), `diagnostics.rs`
- `commands.rs`: Tauri 커맨드(IPC) 정의. `start_flow`의 `demo: true`는 실제 실행 없이 진행 이벤트만 시뮬레이션
- `probe.rs`: 환경 점검(설치된 도구·버전 스캔) · `state.rs`: 설치 기록(`installed.json`, app data dir)

원격 레시피: `recipe/remote.rs`의 `REMOTE_BASE`(GitHub raw)에서 서명된 번들을 백그라운드로 받아 캐시하고, 서명 검증 실패·버전 다운그레이드는 거부한다. 갱신 성공 시 `catalog://updated` 이벤트만 쏘고 다음 실행부터 반영.

### 프론트 (`src/`)와 IPC 계약

- `src/lib/ipc.ts` = `commands.rs`의 프론트 미러, `src/lib/types.ts` = Rust 구조체의 camelCase 미러. **백엔드 커맨드·이벤트·구조체를 바꾸면 이 두 파일(그리고 `lib.rs`의 핸들러 등록)을 같이 맞춰야 한다.**
- 이벤트 채널: `install://progress`(ProgressEvent) · `install://log` · `pty://data` · `catalog://updated`
- 화면 흐름(HashRouter, `App.tsx`): Welcome → Catalog → `/wizard/:toolId` → Success. AppShell 하위에 Catalog·Plugins·Dashboard(`/tools`)·Settings
- `src/lib/runReducer.ts`: Wizard가 ProgressEvent 스트림을 4단계(phase: 준비물→설치→인증·확인) 상태로 접는 리듀서. 설치 진행 UI 로직의 중심
- `src/lib/josa.ts`: 한국어 조사(을/를, 이/가) 자동 선택 유틸. 카피에 도구 이름을 끼울 때 사용
- 테스트는 각 디렉터리의 `__tests__/`에 vitest + testing-library(jsdom)

## 문서·프로세스

- 스펙: `docs/superpowers/specs/` · 구현 계획: `docs/superpowers/plans/` (마일스톤 단위, SDD 방식)
- SDD 진행 레저: `.superpowers/sdd/progress.md`
- `HANDOFF.md`(레포 루트): 현재 작업 상태·다음 스텝. 세션 시작 시 자동 로드되므로 의미 있는 작업 단위마다 최신으로 덮어쓴다
- 디자인 자산: `design/` (`tokens.json` 색·폰트 토큰, `design-system.md` 컴포넌트·카피 규칙). UI 카피를 새로 쓰면 design-system.md의 카피 규칙(em dash 금지, humanize 검수)을 따른다
