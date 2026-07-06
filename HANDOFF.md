# HANDOFF — 이지 하네스

## 현재 작업
- **M4(플러그인 5종 레시피) 설계 스펙 작성·커밋 완료** (2026-07-06, ae1f1b1). 사용자 승인 완료, **스펙 문서 리뷰 게이트 대기 중** → 승인되면 writing-plans로 구현 계획 작성
- 스펙: docs/superpowers/specs/2026-07-06-easy-harness-m4-plugin-recipes-design.md
- 브레인스토밍 확정 결정: 선행 하네스는 마법사 시작 전 안내 스텝 + 단일 런(접근법 A) · 멀티하네스 도구(k-skill, im-not-ai)는 v1 Claude Code 고정 · 윈도우는 근거 있는 4종만 작성, insane-search는 맥 전용 배지 · 추가 범위 3건 포함(stderr 패턴 에러 안내, 대시보드 삭제 가드, 제작자 source 표기)

## 다음 스텝
1. 형이 스펙 문서 리뷰 → 승인 시 writing-plans 스킬로 M4 구현 계획 작성 (계획 단계 라이브 실측 목록은 스펙 9절: claude plugin CLI 실측, korean-law-mcp 키 주입, lazycodex 무인 설치 등)
2. GitHub 리모트 미등록 (CI 실행하려면 필요) · 레시피 원격 저장소 생성은 M5

## M4 조사 핵심 (2026-07-06 라이브 확인 — 상세·출처는 스펙 3절)
- 5종 전부 제3자 오픈소스: lazycodex(Sisyphus Labs, Codex 전용, npx lazycodex-ai) · insane-search(fivetaku, Claude Code 전용, 윈도우 WSL2 필수) · k-skill(NomaDamas, 멀티하네스) · korean-law-mcp(chrisryugj, 법제처 OC 키 필수 = api_key 실사용 1호) · im-not-ai(epoko77-ai, 설치명 humanize-korean)
- Claude Code 플러그인 비대화형 CLI 공식 존재: `claude plugin marketplace add` → `claude plugin install` (code.claude.com 문서 확인). 단 종료 코드 의미 미문서화 → verify는 `claude plugin list --json` 등 내용 확인으로
- 엔진 requires 인프라는 M2~M3에 이미 완비(스키마·DFS 순서·배지) — 실물 레시피만 0개. Plugins.tsx는 스텁이라 M4에서 실구현

## 잔여 백로그 (M4 미포함, 별도 트랙)
- ★ verify가 인증을 실검증 못 함(가재코드) · ★ bun detect 버전 미검사 · ★ browser_login 터미널 숨김 재설계 · ★ Success 카피 불일치(가재코드)
- 기존: PTY reader UTF-8 버퍼링+워치독 · Catalog listen 가드 · run_logs 정리 · reqwest 타임아웃+부분파일 정리 · Dashboard done 이벤트 유실(N1)
- (api_key provideSecret 피드백+SecretForm 초기화와 stderr 패턴 매칭은 M4 범위로 승격됨)

## 핵심 결정/주의
- 인증 패턴 4종: browser_login · api_key · interactive_terminal · automatic(터미널 미표시). 가재코드는 automatic. M4 플러그인 4종은 auth 섹션 자체 생략(인증 불필요), korean-law-mcp만 api_key
- requires(도구 단위, 플러그인→하네스) vs prerequisites(플랫폼별 준비물) 구분 — 스펙 5절에 명문화
- Windows 실검증은 M6 VM 스모크. 어긋나면 레시피 원격 갱신으로 수정
- 서명 개인키 백업 완료(Dashlane 보안 메모, 복원 시 개행 제거 44자)
- SDD 실행 기록: .superpowers/sdd/progress.md (gitignored) · M3 계획: docs/superpowers/plans/2026-07-05-easy-harness-m3-real-recipes.md
