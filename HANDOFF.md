# HANDOFF — 이지 하네스

## 현재 작업
- **M4(플러그인 5종 레시피) 구현 완료·main 머지** (2026-07-06, 71d7ca8). 태스크 15개 SDD(구현자+리뷰어 사이클, 뮤테이션 검증) 전부 통과, 최종 전체 브랜치 리뷰(opus) MERGE OK
- 게이트: cargo 76(63+13) · vitest 50 · clippy 0 · fmt 클린 · build OK
- GUI 육안 확인 완료(cua-driver, 실설치 없이): 플러그인 화면 5종 카드(제작자·"Claude Code에 설치돼요") · LazyCodex 프리플라이트("먼저 챙길 게 있어요", 스텝퍼 "Codex·Node.js 설치") · 조사 처리 정상. 시작 버튼은 안 눌러 실설치 없음
- 카탈로그 13종 확정: 하네스 6 + 플러그인 5(lazycodex·insane-search·korean-law-mcp·im-not-ai·k-skill) + 준비물 2

## 다음 스텝 (형 확인 필요)
1. **실설치 스모크 2종** — 형 확인 후 진행:
   - lazycodex: Codex 로그인 필요(브라우저) + 체인 설치 검증. 부수 효과: 형 맥의 기존 lazycodex 4.13.0 잔재가 4.15+로 복구됨
   - korean-law-mcp: 법제처 OC 키 필요(open.law.go.kr 무료 발급, 이메일) — api_key 패턴 첫 실검증
2. 스모크 통과 후 M5(서명·배포 파이프라인 + 자동 업데이트) 착수
3. GitHub 리모트 미등록 (CI 실행하려면 필요) · 레시피 원격 저장소 생성은 M5

## M4에서 확정된 것 (상세는 스펙·계획 문서)
- 스펙: docs/superpowers/specs/2026-07-06-easy-harness-m4-plugin-recipes-design.md (실측 반영판) · 계획: docs/superpowers/plans/2026-07-06-easy-harness-m4-plugin-recipes.md
- Claude Code 플러그인 설치 = 공식 비대화형 CLI (`claude plugin marketplace add <HTTPS .git URL>` → `claude plugin install`). 키 주입 = `--config api_key={{secret:law_oc}}`. verify = `claude plugin list --json` 내용 확인(종료 코드 불신)
- k-skill은 마켓플레이스 깨져서 Vercel Labs skills CLI 사용(전체 102종, 사용자 확정). 제거는 이름 명시 목록(레시피 내 스냅샷) — 업스트림 추가분은 원격 갱신으로 동기화
- 신규 UI: 프리플라이트(선행 하네스 안내) · 도구별 인증 카드 전환 · 맥 전용 배지(insane-search가 윈도우 첫 사례) · SecretForm 제출 피드백 · stderr 패턴 힌트 5종 · 대시보드 삭제 가드 · source 표기

## 잔여 백로그 (M4 미포함·최종 리뷰 triage 전부 백로그 승인)
- ★ M6 검증 대상: lazycodex windows(omo 경로·설치 동작) · im-not-ai/k-skill/korean-law windows 섹션 전체
- ★ verify가 인증을 실검증 못 함(가재코드) · bun detect 버전 미검사 · browser_login 터미널 숨김 재설계 · Success 카피 불일치(가재코드)
- 기존: PTY UTF-8 버퍼링 · Catalog listen 가드 · run_logs 정리 · reqwest 타임아웃 · Dashboard done 이벤트 유실(N1)
- 사소: Success가 준비물 이름 노출 · error_hints 401 오탐 여지 · useCatalog 훅 추출 · 재제출 차단 회귀 테스트
- dev 환경 참고: **tauri dev는 target/debug/recipes에 삭제된 레시피 잔재를 남긴다** (이번에 mock 3종 발견·수동 삭제). 릴리스 빌드는 무관. 레시피 파일 삭제 시 target/debug/recipes도 정리할 것

## 핵심 결정/주의
- 인증 패턴 4종 실사용 현황: browser_login(codex·hermes) · interactive_terminal(claude-code·openclaw·opencode) · automatic(가재코드) · **api_key(korean-law-mcp, M4 신규)**
- requires(도구 단위) vs prerequisites(플랫폼 준비물) — 해석 시 병합, 설치는 단일 런. 프리플라이트는 미설치 선행 "하네스"만 언급
- 백엔드가 '같은 라벨 시크릿 재요청' 방식으로 바뀌면 Wizard secretSubmitting 해제 effect 재검토
- 서명 개인키 백업: Dashlane 보안 메모(복원 시 개행 제거 44자)
- SDD 레저: .superpowers/sdd/progress.md (M2·M3는 progress-m2m3-archive.md)
