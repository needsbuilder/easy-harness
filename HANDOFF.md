# HANDOFF — 이지 하네스

## 현재 작업
- **마일스톤 3 구현 완료, 머지 대기** (2026-07-05, 브랜치 feature/m3-real-recipes, 27+커밋)
- 태스크 20개 전부 구현·태스크별 리뷰 통과 (픽스 6건 반영). 최종 전체 리뷰(opus) 판정: **Ready to merge = Yes** (Critical 0, 코드 Important 0)
- 게이트: cargo 53+7 · vitest 30 · clippy/fmt 클린 · build OK. 부팅 스모크 3회 통과 (레시피 8종 로딩, 원격 404 폴백 정상)
- 산출: 하네스 6종 + 준비물 2종 실물 레시피, download_run(reqwest 0.13), PTY(portable-pty 0.9 + xterm 6), 인증 UI(가이드·비밀값 폼), 실모드 전환, 진단 zip, ed25519 서명 검증(verify_strict) + 원격 갱신(다운그레이드 방지)

## 다음 스텝
1. **사용자 결정: 머지 방식** (finishing-a-development-branch) + 실설치 GUI 스모크는 실제 시스템을 바꾸므로 사용자 판단하에 실행
2. **운영 액션 (릴리스 전 필수)**: 서명 개인키 `src-tauri/recipe-signing-secret.key`(비커밋, 로컬 단일본)를 안전한 곳에 백업. 분실 시 원격 레시피 갱신 기능 영구 불능
3. M4(플러그인 5종 레시피) 이월 백로그: api_key 실사용 시 provideSecret 피드백+SecretForm 초기화 · PTY reader UTF-8 버퍼링+워치독 · Catalog listen 가드 · run_logs 정리 · reqwest 타임아웃+부분파일 정리 · stderr 패턴 매칭 에러 안내 · Dashboard done 이벤트 유실 시 "지우는 중" 고정(N1)
4. GitHub 리모트 미등록 (CI 실행하려면 필요) · 레시피 원격 저장소(needslab-ai/easy-harness-recipes) 생성은 M5

## 핵심 결정/주의
- 공용 준비물 = Node.js LTS v24.18.0 + Bun (git 제외). GajaeCode는 Bun >= 1.3.14 요구
- 인증: 6종 모두 대화형 터미널/브라우저 OAuth. api_key 패턴은 엔진·UI 완비, 실사용 M4부터
- 엔진: {{home}} 치환 · 윈도우 PATH 신선화(레지스트리 재읽기, CI 윈도우 매트릭스가 실검증) · mac 스텝 /bin/zsh -lc 래핑 · 원격 캐시는 로딩마다 재검증 + 버전 단조성
- 정정 반영: reqwest feature는 rustls(0.13에서 개명) · tauri resources는 디렉터리 패턴 · Cargo default-run=easy-harness (sign_recipes bin 모호성)
- Windows 실검증은 M6 VM 스모크. 어긋나면 레시피 원격 갱신으로 수정 (앱 릴리스 불필요)
- SDD 실행 기록: .superpowers/sdd/progress.md (gitignored) · 계획: docs/superpowers/plans/2026-07-05-easy-harness-m3-real-recipes.md
