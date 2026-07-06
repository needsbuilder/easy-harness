# HANDOFF — 이지 하네스

## 현재 작업 — M5 구현 진행 중 (subagent-driven, 2026-07-07 새벽)
- 스펙: docs/superpowers/specs/2026-07-06-easy-harness-m5-deploy-design.md · 계획: docs/superpowers/plans/2026-07-06-easy-harness-m5-deploy.md (13태스크)
- 브랜치: feat/m5-deploy · 레저: .superpowers/sdd/progress.md (태스크별 커밋·리뷰 판정 기록)
- **완료(리뷰 승인까지)**: T1 인프라(needslab-ai 조직+레포 3종+push) · T2 레시피 번들 채널(v1 게시·앱 수신 실검증) · T4 scan_secrets(fail-closed) · T5 updater 백엔드(pubkey 검증) · T6 업데이트 훅+배너 · T7 실버전 채움({{home}} 치환·배너 오탐 픽스) · T8 버전·날짜 병기 · T9 verify 인증 실검증 4종(hermes=nous 소스 확정, opencode 패턴 조임)
- **진행 중**: T10 release.yml 리뷰 대기 · T3 시크릿 9종 중 6종 등록 완료
- **사용자 대기**: App Store Connect 로그인 → APPLE_API_ISSUER/KEY/KEY_P8 3종 등록 (Dashlane apple.com 항목 2개 모두 비번 거부됨 — 실제 값으로 갱신 권장). 이게 없으면 T12(첫 릴리스, 공증)만 막힘

## 다음 스텝
1. T10 리뷰 → T11 게이트 5종+최종 브랜치 리뷰+main 머지
2. T12 v0.1.0 태그 릴리스 스모크 (완료 기준 1·3: dmg spctl, 시크릿 스캔 주입 실증) — **Apple API 키 3종 필수**
3. T13 v0.1.1 자동 업데이트 스모크 (완료 기준 2) + CLAUDE.md 릴리스 절차 + 마감

## 핵심 결정/주의 (이번 세션 실측)
- 서명 identity: "Developer ID Application: YONG BEOM GWON (RB6FTGW2DK)" (기존 보유, Individual)
- 업데이트 서명키: ~/.tauri/easy-harness-updater.key(+.password) — GitHub 시크릿 등록 완료, **Dashlane 백업은 사용자 확장으로 추가 필요**
- tauri-action v1의 latest.json은 GitHub API 자산 URL 사용 → T13에서 다운로드 실동작 확인, 실패 시 계획 Task 13 Step 4 폴백
- 로컬 dmg 번들링은 GUI 세션 제약으로 실패(.app.tar.gz는 정상) — CI 러너에서 재확인
- 레시피 번들 게시 절차: scripts/build_recipes_bundle.sh <버전> <개인키> (개인키는 Dashlane 보안 메모 44자)

## 잔여 백로그 (M5 리뷰에서 나온 Minor는 레저에, 기존 백로그는 이전 HANDOFF 참조)
- ★ M6: 윈도우 레시피 전체 검증 · 윈도우 코드 서명 · windows findstr 버전 오탐 확인
