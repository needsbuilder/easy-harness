# HANDOFF — 이지 하네스

## 현재 작업 — 실설치 스모크 2종 완료·통과, v? fix 머지 (2026-07-06)
- **lazycodex 스모크 통과**: 프리플라이트 → Codex 설치(브라우저 로그인) → Node.js → LazyCodex → "준비 완료!" 관통. 실설치 확인 omo 4.15.1·codex 0.142.4·node v24.16.0. 기존 omo 4.13.0 잔재가 최신으로 복구됨
- **korean-law-mcp 스모크 통과 (api_key 패턴 첫 실검증)**: 플러그인 카드 → 프리플라이트 → Claude Code(기설치 재확인) → SecretForm(OC 입력) → `claude plugin install --config api_key=<OC>` → "준비 완료!" 관통. user-scope 4.4.3 새로 설치, installed.json 기록, 헤드리스 claude로 민법 검색 실동작 확인. 대시보드에 7종 정상 표시(v? fix 적용돼 "2026년 7월 6일에 설치했어요")
- **v? 정직화 fix main 머지** (200f707): 대시보드 v? → 설치날짜, 가짜 "최신 상태예요" 배지·"매일 새 버전 확인" 카피 제거, ToolCard "설치됨 · v?" → "설치됨". vitest 53·cargo 76·clippy 0·fmt·build 전부 통과, sonnet 리뷰 MERGE OK
- 앱은 아직 떠 있음(pid 살아있음, `bun run tauri dev` 백그라운드 셸은 stopped 표시지만 프로세스 생존). M5 착수 전 정리 가능

## 스모크에서 나온 발견 2건 (버그 아님, 백로그·memory 기록)
1. **법제처 OC 미검증**: lawSearch API가 OC를 실제 검증 안 함 — 가짜·빈 OC도 200 정상. korean-law search는 키 없이도 동작 → SecretForm 강제가 최소 검색엔 불필요한 마찰일 수 있음(본문 조회 등은 미확인). memory `korean-law-oc-not-validated`에 상세
2. **--config 키 미저장**: `claude plugin install --config api_key=<값>`이 넣은 값이 .claude.json·settings.json·credentials.json 어디에도 영구 저장 안 됨(install 전후 백업 diff로 확정). korean-law는 OC 무관이라 이번엔 무영향이나, OC 진짜 요구하는 다른 api_key 플러그인엔 "설치는 되는데 키 비어 실패" 잠재 결함. 기존 백로그 "verify가 인증 실검증 못 함"과 직결 → M5 verify 설계 시 고려

## 다음 스텝 — M5 착수 준비 완료
1. **M5 = 서명·배포 파이프라인 + 자동 업데이트**(tauri-plugin-updater). 스모크 2종 다 통과했으니 착수 가능
2. M5에서 함께: verify 인증 실검증 설계(발견 2) · 대시보드 실버전 파싱(v? fix는 임시 정직화, 실기록은 M5) · 자동 업데이트 UI 되살리기(Dashboard.tsx appUpdateReady=false 자리) · **배포 산출물 시크릿 스캔**(사용자 결정 2026-07-06: 릴리스 빌드 후 앱 번들에 알려진 시크릿 패턴/키 문자열 없는지 자동 검사→있으면 빌드 실패. 소스는 이미 플레이스홀더라 안전하나 배포본 안전망으로. 커밋 단계 훅은 선택 안 함)
3. GitHub 리모트 미등록 (CI·레시피 원격 저장소는 M5)
4. dev 정리: **tauri dev는 target/debug/recipes에 삭제된 레시피 잔재를 남긴다**. 릴리스 빌드는 무관

## M4에서 확정된 것 (상세는 스펙·계획 문서)
- 스펙: docs/superpowers/specs/2026-07-06-easy-harness-m4-plugin-recipes-design.md · 계획: docs/superpowers/plans/2026-07-06-easy-harness-m4-plugin-recipes.md
- Claude Code 플러그인 설치 = 공식 비대화형 CLI (`claude plugin marketplace add <HTTPS .git URL>` → `claude plugin install`). 키 주입 = `--config api_key={{secret:law_oc}}`. verify = `claude plugin list --json` 내용 확인(종료 코드 불신)
- k-skill은 마켓플레이스 깨져서 Vercel Labs skills CLI 사용(전체 102종). 제거는 이름 명시 목록(레시피 내 스냅샷)
- 신규 UI: 프리플라이트 · 도구별 인증 카드 · 맥 전용 배지 · SecretForm 제출 피드백 · stderr 힌트 5종 · 대시보드 삭제 가드 · source 표기

## 잔여 백로그
- ★ M6 검증 대상: lazycodex windows(omo 경로) · im-not-ai/k-skill/korean-law windows 섹션 전체
- ★ verify 인증 실검증 못 함(발견 2와 병합) · bun detect 버전 미검사 · browser_login 터미널 숨김 재설계 · Success 카피 불일치
- 기존: PTY UTF-8 버퍼링 · Catalog listen 가드 · run_logs 정리(현재 로그 파일 안 남김) · reqwest 타임아웃 · Dashboard done 이벤트 유실(N1)
- 사소: Success가 준비물 이름 노출 · error_hints 401 오탐 여지 · useCatalog 훅 추출 · 재제출 차단 회귀 테스트

## 핵심 결정/주의
- 인증 패턴 4종 실사용: browser_login(codex·hermes) · interactive_terminal(claude-code·openclaw·opencode) · automatic(가재코드) · **api_key(korean-law-mcp)** — 4종 다 실설치 스모크로 관통 확인됨
- requires(도구) vs prerequisites(플랫폼 준비물) — 해석 시 병합, 설치는 단일 런. 프리플라이트는 미설치 선행 하네스만 언급
- 서명 개인키 백업: Dashlane 보안 메모(복원 시 개행 제거 44자)
- SDD 레저: .superpowers/sdd/progress.md (M2·M3는 progress-m2m3-archive.md)
