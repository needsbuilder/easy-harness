# HANDOFF — 이지 하네스

## 현재 상태 (2026-07-08) — M6 윈도우 트랙 핵심 완료 (PR #2·#3 main 머지), v0.1.3 릴리스 보류
PR #2(T1~T4: 실측 CI·lazycodex·verify 보강·서명 스캐폴드) + PR #3(lazycodex omo.cmd 실측 확정) 둘 다 main 머지 완료(최신 `f80276b`). windows-smoke 실측(run 28930310158)으로 실물 검증. v0.1.3 앱 릴리스는 "다 정리하고 한 번에" 방침으로 **여전히 보류**(배포된 앱은 v0.1.2).

스펙/계획: `docs/superpowers/specs|plans/2026-07-08-easy-harness-m6-windows-track*.md`. 레저: `.superpowers/sdd/progress.md` 하단.

### 이번 세션 완료 (브랜치 feat/m6-windows-track, 로컬 게이트 GREEN — 커밋/PR 예정)
- **T1 실측 CI 인프라**: `.github/workflows/windows-smoke.yml`(workflow_dispatch·windows-latest) + `.github/scripts/windows-probe.ps1`(레시피 JSON 직접 읽어 windows detect/install/verify 실행, auth 스킵, 실제 산출물 경로 스캔 → STEP_SUMMARY+아티팩트)
- **T2 lazycodex 경로버그**: windows detect/verify를 확장자 없는 path_check → `cmd /C "omo --version"`. windows rollback을 `[]`(비파괴)로 — verify 오판이 방금 설치한 걸 지우던 버그 차단
- **T3 하네스 4종 verify 보강**: codex·hermes·openclaw·opencode windows verify에 "로그인 살아있는지" 2번째 스텝을 **powershell Select-String + `exit 1` 가드**로 추가(findstr 공백+따옴표 이스케이프 위험 회피). 테스트 확장(auth_verify win 순회 + windows_verify_gates_have_exit_guard 신설)
- **T4 코드서명 스캐폴드**: release.yml에 조건부 서명 주입 스텝(시크릿 `WINDOWS_SIGN_COMMAND` 있을 때만 jq로 signCommand 주입). tauri.conf 무변경 → **회귀 0**
- 검증: cargo test --all-features(lib 75+통합 16+scan_secrets 6) · fmt · clippy · front test+build 전부 통과. JSON/YAML 유효성 확인

## 실측 결과 (windows-smoke run 28930310158, 2026-07-08)
- **lazycodex 확정**: omo가 `%USERPROFILE%\.local\bin\omo.cmd`로 설치되고 `.local\bin`은 PATH 미등록 → 임시안 `omo --version`도 실패. detect/verify를 절대경로 `path_check {{home}}/.local/bin/omo.cmd`로 확정(브랜치 fix/lazycodex-omo-cmd-path, 로컬 테스트 GREEN)
- **verify 보강 검증**: openclaw/opencode 완전 통과(npm 전역 `C:\npm\prefix`가 PATH). codex/hermes/claude-code는 `.local\bin`이 CI 세션 PATH 미반영이라 probe에선 미해결이나 powershell은 구문에러 없이 exit 1(커맨드 구조 정상)
- **잔여 확인 필요(별도)**: claude-code·codex의 `.local\bin`이 레지스트리 PATH에 등록되는지 + 앱 process.rs PATH 새로고침이 실행 시 잡는지 — probe로는 확정 불가(앱 실기 확인 필요). 이 트랙 이전부터 있던 PATH 의존
- 리포트 원본: 이 세션 scratchpad `probe/*.md`(9종). 재현: gh로 windows-smoke.yml dispatch

## 다음 스텝 (M6 윈도우 트랙 핵심 완료 — 아래는 잔여/선택)
- (선택) 위 "잔여 확인 필요"의 `.local\bin` PATH를 윈도우 실기(tauri dev)에서 확인 — 필요 시 harness(codex·claude-code) detect/verify도 lazycodex처럼 절대경로화
- 레시피 변경 전달 = 원격 번들(`scripts/build_recipes_bundle.sh` → easy-harness-recipes)로 v0.1.2 사용자에 선반영 가능하나, 방침상 기본은 v0.1.3 일괄
- v0.1.3 릴리스(보류 해제 시): tauri.conf.json version→0.1.3 → 태그 push → draft → 발행(절차·함정은 CLAUDE.md "릴리스 절차 (M5)"). 이때 공식 아이콘 + 윈도우 트랙 개선이 사용자에게 나감

## 주의/결정
- 인증(로그인) 필요한 verify는 헤드리스 CI가 검증 못함 → 인증 문자열은 mac 실측값 재사용. CI는 설치 경로·셸 배관까지만
- 미니엔진(pwsh)은 앱 러너(Rust Command)와 인자 인용이 근사 — 100% 동일 실행 필요 시 후속으로 헤드리스 dev-tools bin(백로그)
- **코드서명 인증서 조달은 범위 밖**(사용자 결정 대기). 스캐폴드만 깔림. "값만 꽂으면 되는" 체크리스트는 계획 문서 하단
- pwsh는 맥에 없어 probe 스크립트 런타임 검증은 windows-smoke 실행 때 처음 이뤄짐

## 인프라 (재사용)
- 레포 3종(needslab-ai): easy-harness(private 소스) · easy-harness-releases(public 배포) · easy-harness-recipes(public 번들)
- 릴리스 절차·함정은 CLAUDE.md "릴리스 절차 (M5)". GitHub 시크릿 9종 등록. Apple: Team RB6FTGW2DK, 로컬 키 ~/.tauri/
- 랜딩 배포는 git 연동 아님 — 사이트 수정 시 `vercel deploy --prod --cwd web`
