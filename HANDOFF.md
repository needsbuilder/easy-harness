# HANDOFF — 이지 하네스

## 현재 작업
- **마일스톤 2 (앱 뼈대 + 레시피 엔진 + 스텝 러너 + 드라이런) 완료, main에 머지됨** (2026-07-05, 머지 커밋 029ebf8)
- 태스크 16개 전부 구현·리뷰 통과. 최종 전체 리뷰(opus) 판정: Ready to merge = Yes (Critical 0)
- 테스트: cargo 37 + vitest 19 전부 GREEN, clippy/fmt 클린. `tauri dev` 부팅 스모크 통과. **GUI 육안 데모 확인 완료 (사용자, 2026-07-05 "다 잘되네")**

## 다음 스텝
1. **마일스톤 3 계획 작성** (writing-plans): 하네스 6종 실물 레시피 (설치→인증→verify). **각 도구 설치법·지원 모델·인증 방식 라이브 검증 필수** (스펙 9절)
2. M3에 포함할 이월 작업: download_run 실행기(reqwest 버전 라이브 확인) · pty_session 배선(tauri-plugin-pty 0.3.0 재확인) · 레시피 원격 갱신+ed25519 서명(2.2.0 stable, 3.0-rc 재확인) · Auth 화면 실플로우 배선 · 마법사 demo:false 전환 · phaseOf 역행 보정 · SecretVault 긴 값 우선 정렬 · Welcome/Catalog IPC 에러 상태 · 진단 zip
3. GitHub 리모트 미등록 상태 — 리모트 만들어야 CI(GitHub Actions)와 푸시 가능

## 핵심 결정/주의
- 엔진 결정: 플랜 auth는 설치되는 모든 도구에 포함 / Done 이벤트 step_index==total / 드라이런 게이트는 레시피가 선언한 플랫폼만 검증 (단일 플랫폼 레시피 안전)
- M2 특성(결함 아님): 마법사·대시보드가 demo:true 고정이라 설치 상태 영속화 분기를 UI에서 안 탄다 — 엔진은 Rust 테스트로 검증됨, 실노출은 M3
- 이벤트 채널: "install://progress"(ProgressEvent, status tag="kind") · "install://log". TS 미러는 src/lib/types.ts 단일 소스
- 브랜드 규칙 유지: 골드 주 색, UI 카피 em dash·이모지 금지 (드라이런 테스트가 기계 검사)
- SDD 실행 기록: .superpowers/sdd/progress.md (gitignored) · 계획: docs/superpowers/plans/2026-07-05-easy-harness-m2-skeleton-engine.md
