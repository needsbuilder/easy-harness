# M6 윈도우 트랙 — 설계(Spec)

작성: 2026-07-08 · 브랜치: `feat/m6-windows-track`

## 배경·문제

이지 하네스의 실물 검증은 지금까지 전부 맥에서만 이뤄졌다. 윈도우 레시피 커맨드·경로는 mac 기준 추정치로 작성돼 "실측 불가" 딱지가 붙은 채 M4~M5 내내 미뤄졌다(`docs/superpowers/plans/2026-07-06-easy-harness-m4-plugin-recipes.md:1200,1616`, `.../m5-deploy-design.md:16,26`). 그 결과 실제 결함이 남아 있다.

1. **lazycodex 윈도우 설치 파손**: windows verify가 mac 경로(`{{home}}/.local/bin/omo`, 확장자 없음)를 그대로 써서 `path_check`가 항상 실패로 오판 → `step_runner.rs:176-194`가 자동 rollback(`npx lazycodex-ai uninstall`)을 돌려 방금 성공한 설치를 지운다.
2. **하네스 4종 verify 부실**: codex·hermes·openclaw·opencode의 mac verify에는 "로그인 살아있는지" 확인하는 2번째 스텝(커밋 `638c2ce`/`8f4e9f4`)이 있는데 windows엔 없다.
3. **윈도우 코드서명 미설정**: 배포된 앱은 전부 무서명(`release.yml`에 자리 주석만). SmartScreen 경고.

핵심 제약: 개발 환경이 맥뿐이라 문서마다 "윈도우 PC 필요"로 미뤄왔다.

## 결정

### D1. 실측은 GitHub Actions 윈도우 러너로 (로컬 윈도우 불요)
무료 `windows-latest` 러너에서 레시피의 windows 설치 커맨드를 실제로 돌려 진짜 산출물 경로·파일명을 발견한다. "실측 불가"를 실측으로 바꾸는 언락. 조사용이므로 `workflow_dispatch`(수동), soft-fail 리포트. 상시 게이트 승격 경로는 워크플로우 주석에 남긴다.
- 커맨드 소스: 레시피 JSON을 PowerShell `ConvertFrom-Json`으로 직접 읽어 실행(하드코딩 아님) → 레시피 드리프트 없음.
- auth(브라우저 로그인) 섹션은 헤드리스라 스킵. 그래서 **로그인이 필요한 verify(인증 문자열)는 CI로 검증 불가** → 그 문자열은 mac 실측값을 재사용한다. CI로 검증되는 것은 설치 성공·바이너리 경로·셸 배관(파이프/종료코드)까지.
- 한계: PowerShell 미니엔진은 앱 러너(Rust `Command`)와 인자 인용이 미세하게 다를 수 있다(근사 검증). 100% 동일 실행이 필요하면 후속으로 `--features dev-tools`의 헤드리스 `run_recipe --no-auth` bin(엔진이 이미 DI라 소규모) — 지금은 과잉이라 백로그.

### D2. verify 보강은 powershell Select-String으로 통일
mac의 `grep -q`/`grep -Eq`를 windows로 옮길 때, findstr에 공백+따옴표(`/C:"Logged in"`)를 Rust `Command`→cmd로 넘기면 따옴표 이스케이프가 깨질 위험이 크다. 그래서 4종 전부 `powershell -Command "if (-not (... | Select-String ... -Quiet)) { exit 1 }"`로 통일한다.
- 패턴을 단일따옴표로 감싸 args에 큰따옴표가 하나도 없게 만들어 Rust→powershell 경로에서 안전.
- openclaw의 `"missingProvidersInUse": []`는 큰따옴표를 정규식 와일드카드(`missingProvidersInUse.:.\[\]`)로 우회.
- **exit 가드 필수**: `Select-String -Quiet`는 미매치 시에도 프로세스 종료코드를 0으로 두므로, 게이트로 쓰려면 `if (-not (...)) { exit 1 }`가 반드시 있어야 한다(없으면 게이트 무력화). 테스트 `windows_verify_gates_have_exit_guard`가 회귀를 잡는다.
- 이는 M4 설계가 명시한 "findstr 깨지면 powershell로 통일" 폴백 경로.

### D3. lazycodex는 실측 전 안전한 interim + 안전장치
- windows detect/verify를 확장자 없는 `path_check` → `check_command` `cmd /C "omo --version"`으로. 셸 PATHEXT가 확장자(.exe/.cmd)를 해결 → 확장자 미지 문제 회피. 경로 하드코딩 안 하므로 실측 전 병합 가능.
- **안전장치**: PATH 미반영 시 false-negative 가능성이 남으므로, windows `rollback`을 빈 배열로(비파괴). verify가 오판해도 방금 설치한 걸 지우지 않는다. mac은 정상 작동 중이라 무변경.
- 실측 후: 실제 절대경로가 확정되면 `path_check`(PATH 비의존, 가장 견고)로 업그레이드하고 destructive rollback 복원 여부 재검토.

### D4. 코드서명은 스캐폴드만(인증서 없이), 회귀 0 최우선
- 커밋된 `tauri.conf.json`엔 서명 필드를 **넣지 않는다** → 시크릿 없으면 오늘과 바이트 동일한 무서명 빌드(회귀 구조적 0).
- `release.yml`: 시크릿을 **job-level env**로 승격(step-level env는 자기 `if:`에서 안 보이는 함정)하고, `if: runner.os == 'Windows' && env.WINDOWS_SIGN_COMMAND != ''`일 때만 `jq`로 `bundle.windows.signCommand`를 러너 작업본에 주입. tauri-action은 `tauri build`만 호출하므로 서명은 config로 제어된다(context7 tauri v2 문서 확인, 2026-07-08).
- `scan_secrets`(release.yml)는 번들 산출물만 스캔하고 패턴(`sk-ant-`/`AKIA`/`ghp_`/PEM 등)이 signCommand와 겹치지 않아 오탐 없음.
- 인증서 조달(벤더 결정·구매)은 이번 범위 밖(사용자 결정). "값만 꽂으면 되는" 체크리스트는 계획 문서에.

## 비목표
- 실제 인증서 구매·실서명 · 브라우저 auth 자동검증 · 엔진 레벨 "verify 실패는 rollback 안 함" 정책 변경(제품 semantics 변경이라 별도 스펙) · insane-search 윈도우 지원(의도적 맥 전용).

## 완료 기준
1. CI 5종(mac+win cargo fmt/clippy/test, front test+build) GREEN.
2. release.yml이 시크릿 없는 상태에서 무서명 빌드를 기존과 동일하게 생성(회귀 0).
3. windows-smoke가 수동 실행되어 lazycodex 등 실제 산출물 경로 리포트를 낸다.
4. 실측값으로 lazycodex(및 필요 시 k-skill/im-not-ai) windows 경로가 확정된다.
