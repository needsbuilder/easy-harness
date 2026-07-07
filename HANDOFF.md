# HANDOFF — 이지 하네스

## 현재 상태 (2026-07-07) — M6 증분 1 구현 완료, 커밋 대기
브랜치 `feat/m6-shipped-bugs`에 "배포된 앱 버그 정리" 6종 구현·검증 완료. **아직 커밋 안 함**(사용자 지시 대기).

- 계획: ~/.claude/plans/sequential-mixing-hammock.md · 레저: .superpowers/sdd/progress.md "M6 증분 1"
- 게이트 5종 GREEN: 프론트 `bun run test`(77) + `bun run build`, `cargo fmt --check`·`clippy --all-features -D warnings`·`test --all-features`(96). tauri dev 부팅 스모크 clean(패닉 없음)
- 적대적 코드리뷰로 Wizard 구독 누수(startFlow 실패 경로) HIGH 1건 발견·수정 완료
- 사용자 선택: "배포 앱 버그 먼저" + "맥만 있음" → 윈도우 실행검증·코드서명은 다음 트랙으로 분리

## 이번에 고친 것 (6종)
1+2. 자동 업데이트 앱 시작 시 전역 확인(App 루트 AppUpdateProvider, 배너는 AppShell) + 진행률 불확정(percent null) 처리. Provider 부재 시 idle 폴백
3. **N1 "지우는 중" 영구멈춤 근본수정**: ipc.ts subscribeRun(listen-before-invoke+버퍼링). Dashboard(안전타이머), Wizard(refs로 StrictMode 안전). 백엔드·IPC 계약 불변
4. Catalog/Plugins 리스너 누수 → useTauriEvent 훅
5. reqwest 타임아웃(remote.rs·download.rs)
6. PTY UTF-8 청크경계 모지케(pty.rs Utf8Reassembler)

신규 파일: src/lib/useTauriEvent.ts · src/lib/appUpdateContext.tsx · src/components/UpdateBanner.tsx · 테스트 5개(useTauriEvent·ipc·appUpdateContext·updateBanner·dashboard-uninstall)

## 다음 스텝 (사용자 결정 대기)
- 커밋/PR 여부: main 직접 금지, 브랜치 `feat/m6-shipped-bugs`에서 작업 중. 커밋 메시지·PR 생성은 지시 시
- (선택) 항목6 PTY UTF-8은 원래 명시 범위 밖이나 맥 한글 인증 화면에 영향 있어 포함함 — 빼길 원하면 되돌릴 수 있음

## M6 잔여 백로그 (다음 증분들)
- ★ 윈도우 트랙(윈도우 PC 확보 후): 레시피 실행검증(lazycodex omo 경로·im-not-ai/k-skill/korean-law) · lazycodex 윈도우 경로버그(%USERPROFILE% 미변환) · codex/hermes/openclaw/opencode 윈도우 verify 보강 · 윈도우 코드서명(인증서 구매)
- 하드닝: scan_secrets 심링크순환/압축 미검사 · release.yml permissions 과대(contents:write→read)
- 기존: verify 패턴 CLI 출력 포맷 의존 · windows findstr 오탐 가능성 · --config 키 미저장 근본해결(state 스키마 필요)

## 인프라 (재사용 정보, M5)
- 레포 3종(needslab-ai): easy-harness(private 소스) · easy-harness-releases(public 배포) · easy-harness-recipes(public 번들)
- GitHub 시크릿 9종 등록. Apple: Team ID RB6FTGW2DK, Issuer ba4190ef-..., API Key QWSDYSB37M
- 로컬 키: ~/.tauri/easy-harness-updater.key(+.password) · ~/.tauri/AuthKey_QWSDYSB37M.p8
- 릴리스 절차·함정은 CLAUDE.md "릴리스 절차 (M5)" 섹션 참조
- ⚠️ 사용자 후속(권장): updater 개인키·Apple .p8을 Dashlane 보안메모에 백업 · Dashlane apple.com 비번 갱신
