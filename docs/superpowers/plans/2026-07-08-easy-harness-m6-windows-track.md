# M6 윈도우 트랙 — 구현 계획(Plan)

스펙: `docs/superpowers/specs/2026-07-08-easy-harness-m6-windows-track-design.md` · 브랜치: `feat/m6-windows-track`

## 전역 제약
- 러너 엔진(Rust)은 무변경 — 전부 레시피 JSON·CI·문서 레이어 작업.
- 레시피를 추가·수정하면 `src-tauri/tests/real_recipes.rs`에 스펙 테스트를 넣거나 갱신(레시피 오타 안전망).
- 한국어 카피: friendly는 "~하고 있어요/볼게요" 톤, em dash·이모지 금지(`dry_run.rs`의 `assert_copy_ok`가 검사).
- 회귀 0: 시크릿 없는 릴리스 파이프라인이 100% 그대로 동작해야 한다.
- 로컬 게이트: `cd src-tauri && cargo test --all-features && cargo fmt --check && cargo clippy -- -D warnings` + 루트 `bun run test && bun run build`.

## Task

### T1 — 윈도우 실측 CI 인프라 (windows 데이터 불요)  ✅
- `.github/workflows/windows-smoke.yml` (workflow_dispatch, windows-latest, setup-node, probe 실행, `if: always()` 아티팩트 업로드, continue-on-error)
- `.github/scripts/windows-probe.ps1` (레시피 JSON 직접 읽어 windows detect/install/verify 실행, auth 스킵, `{{home}}`/`{{file}}` 재현, 스텝별 종료코드+산출물 경로 스캔, GITHUB_STEP_SUMMARY+아티팩트 이중 출력)

### T2 — lazycodex 경로버그 + 안전장치  ✅
- `src-tauri/recipes/lazycodex.json`: windows detect/verify를 `path_check {{home}}/.local/bin/omo` → `check_command cmd /C "omo --version"`. windows rollback을 빈 배열(비파괴).
- 테스트: `lazycodex_recipe_pulls_codex_and_node_first`에 windows detect/verify가 `omo --version`이고 rollback이 비파괴("uninstall" 미포함)인지 단언 추가.

### T3 — 하네스 4종 windows verify 보강  ✅
- codex·hermes·openclaw·opencode의 windows verify에 mac과 등가인 2번째 스텝을 `powershell Select-String + exit 가드`로 추가.
- 테스트: `auth_verify_steps_check_real_login`을 Mac·Windows 둘 다 순회하도록 확장(니들은 양 플랫폼 args에 공통으로 등장하는 인증 표식). 신규 `windows_verify_gates_have_exit_guard`(Select-String 게이트에 `exit 1` 가드 강제).

### T4 — 코드서명 스캐폴드 (인증서 없이)  ✅
- `.github/workflows/release.yml`: build job에 `env.WINDOWS_SIGN_COMMAND` 승격 + 조건부 서명 주입 스텝(`jq`로 `bundle.windows.signCommand` 주입, 시크릿 없으면 스킵).
- `tauri.conf.json`은 무변경(회귀 0).

### T5 — 실측 실행·판독 (형 수행)  ⏳
- PR의 브랜치에서 Actions → "Windows Smoke (실측)" → Run workflow. 리포트에서 실제 `omo` 경로·파일명, 하네스 설치 경로, verify 셸 배관 종료코드 판독.

### T6 — 실측값으로 경로 확정 (T5 이후)  ⏳
- lazycodex windows detect/verify를 실측 절대경로 `path_check`로 업그레이드(가능하면), destructive rollback 복원 여부 재검토.
- k-skill(`{{home}}/.claude/skills/k-skill-setup`)·im-not-ai(`findstr` 매칭) 경로/매칭이 어긋나면 교정.
- verify 보강 커맨드의 셸 배관이 실측에서 깨졌으면 조정. real_recipes.rs 스펙 테스트 동기화.

### T7 — 게이트 GREEN·머지  ⏳
- CI 5종 GREEN 확인 후 main 머지. 레시피 변경 전달(원격 번들 vs v0.1.3 일괄)은 배포 방침 따라.

## 인증서 확보 시 "값만 꽂으면 되는" 체크리스트
- [ ] 서명 벤더 확정: CI 무인 서명 가능한 것 우선. 한국 가입 가능·클라우드 서명(예: SSL.com eSigner, Certum, relic+클라우드 HSM). Azure Trusted Signing(구 Artifact Signing)은 한국 가입 불가. EV는 SmartScreen 즉시신뢰가 2024-03 폐지돼 OV 대비 이점 없음(가격·최신성은 조달 시점에 웹으로 재확인).
- [ ] `gh secret set WINDOWS_SIGN_COMMAND --repo needslab-ai/easy-harness`(예: `signtool sign /fd sha256 /tr <timestampUrl> /td sha256 %1`, 또는 벤더 CLI. `%1`이 서명할 파일 경로로 치환됨).
- [ ] 서명 도구가 읽을 크리덴셜을 release.yml 주입 스텝 `env:`에 추가(예: eSigner라면 `ESIGNER_USERNAME`/`ESIGNER_PASSWORD`/`ESIGNER_TOTP_SECRET`).
- [ ] timestampUrl이 필요한 벤더면 jq 주입에 함께(타임스탬프 없으면 인증서 만료 후 서명 무효).
- [ ] 첫 서명 릴리스에서 setup.exe/msi가 `signtool verify /pa` 통과 + SmartScreen 거동 확인. scan_secrets가 서명 산출물에 오탐 없는지 1회 확인.
