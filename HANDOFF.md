# HANDOFF — 이지 하네스

## 현재 상태 (2026-07-08) — M6 윈도우 트랙 진행 중 (브랜치 feat/m6-windows-track)
직전 완료분(랜딩+영상+공식아이콘)은 main에 있고 라이브(https://easyharness.needslab.ai). v0.1.3 앱 릴리스는 "다 정리하고 한 번에" 방침으로 **여전히 보류**(배포된 앱은 v0.1.2). 지금은 M6 윈도우 트랙 작업 중.

스펙/계획: `docs/superpowers/specs|plans/2026-07-08-easy-harness-m6-windows-track*.md`. 레저: `.superpowers/sdd/progress.md` 하단.

### 이번 세션 완료 (브랜치 feat/m6-windows-track, 로컬 게이트 GREEN — 커밋/PR 예정)
- **T1 실측 CI 인프라**: `.github/workflows/windows-smoke.yml`(workflow_dispatch·windows-latest) + `.github/scripts/windows-probe.ps1`(레시피 JSON 직접 읽어 windows detect/install/verify 실행, auth 스킵, 실제 산출물 경로 스캔 → STEP_SUMMARY+아티팩트)
- **T2 lazycodex 경로버그**: windows detect/verify를 확장자 없는 path_check → `cmd /C "omo --version"`. windows rollback을 `[]`(비파괴)로 — verify 오판이 방금 설치한 걸 지우던 버그 차단
- **T3 하네스 4종 verify 보강**: codex·hermes·openclaw·opencode windows verify에 "로그인 살아있는지" 2번째 스텝을 **powershell Select-String + `exit 1` 가드**로 추가(findstr 공백+따옴표 이스케이프 위험 회피). 테스트 확장(auth_verify win 순회 + windows_verify_gates_have_exit_guard 신설)
- **T4 코드서명 스캐폴드**: release.yml에 조건부 서명 주입 스텝(시크릿 `WINDOWS_SIGN_COMMAND` 있을 때만 jq로 signCommand 주입). tauri.conf 무변경 → **회귀 0**
- 검증: cargo test --all-features(lib 75+통합 16+scan_secrets 6) · fmt · clippy · front test+build 전부 통과. JSON/YAML 유효성 확인

## 다음 스텝
- **커밋 + PR**(easy-harness private 소스, main 대상). 그 후:
- **T5(형이 GitHub에서 수행)**: Actions → "Windows Smoke (실측)" → Run workflow(브랜치 feat/m6-windows-track). 맥에선 못 돌리니 형이 버튼 눌러야 첫 실측 데이터가 나옴. 리포트에서 실제 `omo` 경로·파일명, 하네스 설치 경로, verify 셸 배관 종료코드 판독
- **T6(실측 후)**: lazycodex를 실측 절대경로 path_check로 업그레이드, k-skill/im-not-ai 경로·매칭 교정, verify 커맨드가 실측에서 깨졌으면 조정. real_recipes.rs 동기화
- **T7**: CI GREEN 후 머지. 레시피 변경 전달 = 원격 번들(`scripts/build_recipes_bundle.sh` → easy-harness-recipes)로 v0.1.2 사용자에 선반영 가능하나, 방침상 기본은 v0.1.3 일괄

## 주의/결정
- 인증(로그인) 필요한 verify는 헤드리스 CI가 검증 못함 → 인증 문자열은 mac 실측값 재사용. CI는 설치 경로·셸 배관까지만
- 미니엔진(pwsh)은 앱 러너(Rust Command)와 인자 인용이 근사 — 100% 동일 실행 필요 시 후속으로 헤드리스 dev-tools bin(백로그)
- **코드서명 인증서 조달은 범위 밖**(사용자 결정 대기). 스캐폴드만 깔림. "값만 꽂으면 되는" 체크리스트는 계획 문서 하단
- pwsh는 맥에 없어 probe 스크립트 런타임 검증은 windows-smoke 실행 때 처음 이뤄짐

## 인프라 (재사용)
- 레포 3종(needslab-ai): easy-harness(private 소스) · easy-harness-releases(public 배포) · easy-harness-recipes(public 번들)
- 릴리스 절차·함정은 CLAUDE.md "릴리스 절차 (M5)". GitHub 시크릿 9종 등록. Apple: Team RB6FTGW2DK, 로컬 키 ~/.tauri/
- 랜딩 배포는 git 연동 아님 — 사이트 수정 시 `vercel deploy --prod --cwd web`
