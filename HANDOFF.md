# HANDOFF — 이지 하네스

## 현재 작업
- **마일스톤 3 구현 계획 작성 완료** (2026-07-05): `docs/superpowers/plans/2026-07-05-easy-harness-m3-real-recipes.md` (20개 태스크)
- 하네스 6종 설치·인증·모델 정보는 멀티에이전트 워크플로우(리서치 6 + 교차 검증 6 + 크레이트 1 + Node LTS 1)로 **2026-07-05 라이브 검증 완료, 전 항목 confidence high**. 결과는 계획서에 박제됨 (구현 중 재검증 불필요)
- 계획 자기 리뷰 통과: 플레이스홀더 0, 레시피 JSON 8종 기계 검증 OK

## 다음 스텝
1. **M3 계획 실행** — 실행 방식 사용자 선택 대기: 서브에이전트 주도(권장) vs 인라인(executing-plans)
2. 실행 완료 후: 서명 개인키(`recipe-signing-secret.key`) 형에게 안전 보관 전달, 레시피 원격 저장소(`needslab-ai/easy-harness-recipes`) 생성은 M5
3. GitHub 리모트 여전히 미등록 (CI 실행하려면 필요)

## 핵심 결정/주의 (M3 계획, 라이브 검증 근거)
- 공용 준비물 = **Node.js LTS v24.18.0 + Bun** 2종 (git 제외: 어느 하네스도 필수 아님. GajaeCode가 Bun >= 1.3.14 요구가 핵심 발견)
- 6종 모두 공식 설치 스크립트/Bun 설치가 기본, 인증은 전부 대화형 터미널 또는 브라우저 OAuth. api_key 패턴(SecretForm)은 엔진·UI만 완비, 실사용은 M4 플러그인부터
- 크레이트 확정: reqwest 0.13(rustls 기본) · **portable-pty 0.9 채택**(tauri-plugin-pty 0.3.0은 초기 단계라 배제) · ed25519-dalek 2.2 stable(`verify_strict` 필수, 3.0은 아직 rc) · zip 8 · @xterm/xterm 6.0.0
- 엔진 추가 결정: `{{home}}` 치환, **윈도우 PATH 신선화**(레지스트리 재읽기, 설치 직후 명령 탐색), mac 스텝은 `/bin/zsh -lc` 래핑
- Auth.tsx 단독 화면은 삭제하고 마법사에 통합. Windows 경로 실검증은 M6 VM 스모크(어긋나면 레시피 원격 갱신으로 수정)
- stderr 패턴 매칭 맞춤 에러 안내는 M3 범위 밖 (M4+ 백로그)
- 브랜드 규칙 유지: 골드 주 색, 카피 em dash·이모지 금지 (계획 Task 5가 기계 검사를 name·설명·가이드까지 확장)
- 이벤트 채널: 기존 "install://progress"·"install://log" + 신규 "pty://data"·"catalog://updated". TS 미러는 src/lib/types.ts 단일 소스
