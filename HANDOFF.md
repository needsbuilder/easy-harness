# HANDOFF — 이지 하네스

## 현재 작업
- **Task 4 완료** (2026-07-05): 픽스처 레시피 3종 + 카탈로그 로더
  - mock-prereq/tool/plugin 픽스처 JSON, Catalog::load_dir() 구현
  - 3/3 테스트 통과, 회귀 없음, clippy 깨끗함
  - 커밋 7061865: `feat: 픽스처 레시피 3종 + 카탈로그 로더`
- **다음 행동: Task 5 (플랜 빌더) 시작** (의존도 그래프 구성, Catalog::get() 활용)

## 다음 스텝
1. 마일스톤 2 실행: feature/m2-skeleton-engine 브랜치, Task 1부터 순서대로
2. 완료 후 마일스톤 3 계획 (하네스 6종 실물 레시피 — 설치법·모델 목록 반드시 라이브 검증)

## 핵심 결정/주의
- M2 확정 스택: Tauri 2.11.x · React 19.2.7 · react-router 7.18.1(HashRouter, v8은 3주차라 보류) · Tailwind 4.3.2(@theme CSS-first) · Vitest 4 + mockIPC · 명령 실행 tokio::process 직접
- M2 범위 제외(계획에 명시): download_run 실행기·pty_session 실배선·레시피 원격 갱신+ed25519 서명·진단 zip → 마일스톤 3, 자동 업데이트 → 마일스톤 5
- 마법사는 M2에서 드라이런 데모 모드(demo: true) 고정, CI가 번들 레시피 전수 × 2 OS 드라이런 검증
- 브랜드 규칙 유지: 골드 주 색, UI 카피 em dash·이모지 금지 (드라이런 테스트가 em dash를 기계 검사)
- 스펙: docs/superpowers/specs/2026-07-05-easy-harness-design.md · 디자인 자산: design/README.md
