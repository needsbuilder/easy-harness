# HANDOFF — 이지 하네스

## 현재 작업
- **마일스톤 3 Task 7 완료** (2026-07-05, feature/m3-real-recipes 브랜치, 커밋 dd80495): Claude Code 레시피 JSON + 스펙 테스트 구현. TDD 순서 준수(테스트 추가 → 실패 확인 → JSON 작성 → 통과 → 커밋). 네이티브 설치 스크립트(install.sh/install.ps1), 터미널 로그인, 3단계 auth.guide, Mac/Windows 지원. cargo test 모두 GREEN (44개 library + 2개 real_recipes). 상세는 `.superpowers/sdd/task-7-report.md`.

## 다음 스텝
1. **M3 Task 8부터 계속** (계획서 `docs/superpowers/plans/2026-07-05-easy-harness-m3-real-recipes.md`, 진행 장부 `.superpowers/sdd/progress.md`) — 남은 순서: Task 8 Codex, 9 GajaeCode, 10 OpenClaw, 11 Hermes, 12 OpenCode, 13~16 인증 UI·PTY·실모드, 17~19 진단 zip·서명·원격 갱신, 20 최종 검증. (Task 1~7 완료: nodejs-lts·bun·claude-code 레시피 포함)
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
