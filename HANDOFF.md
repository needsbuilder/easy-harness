# HANDOFF — 이지 하네스

## 현재 작업 (2026-07-08) — 소개 랜딩 사이트 + Remotion 시연영상, 배포됨 / 미세조정 대기
브랜치 `feat/landing-site`(main 미병합). **라이브: https://easyharness.needslab.ai** (Vercel needslab 팀 프로젝트 `easyharness`, CLI 직접 배포. 커스텀 도메인 SSL 정상. needslab.ai 네임서버가 vercel-dns라 자동).
- 구성: `web/`(Vite+React+Tailwind4 랜딩) · `video/`(Remotion). 스펙/계획: docs/superpowers/specs·plans/2026-07-08-easy-harness-landing*.md
- 사이트: 히어로(오공이+헤드라인+다운로드 버튼) · 시연영상 · 3단계 · 되는 도구들(공식 아이콘) · 푸터. 반응형·다크. 다운로드 버튼은 GitHub API로 최신 릴리스(v0.1.2) 자산 동적 링크(web/src/lib/releases.ts·useLatestRelease.ts, 테스트 9)
- 영상: `video/` Remotion, 실제 앱 목업(design/mockups) + 애니메이션, 22초 무음+자막, `web/public/demo.mp4`(4.3MB). Pretendard 임베드로 한글 렌더. 렌더: `cd video && bunx remotion render src/index.ts Demo out/demo.mp4 --codec h264`
- 공식 아이콘: `web/public/icons/*.png` — 각 도구 공식 사이트 apple-touch-icon(claude.ai·chatgpt.com(google favicon)·openclaw.ai·nousresearch.com·opencode.ai). gajaecode는 공식 로고 못 찾아 초록 G 타일 생성(임시)
- 재배포: `vercel deploy --prod --cwd web --yes` (git 연동 아님)
- ⏳ 사용자 확인 대기: ① 히어로 상단 워드마크가 마스코트+텍스트라 큰 오공이와 겹쳐 "오공이 2번" — 텍스트만으로 바꿀지 ② 아이콘 그리드 정렬. playwriter 확장 불안정으로 스크린샷 못 뜸 → 사용자 눈 확인 필요. 미병합/미세조정 후 병합 예정

## M6 증분 1 완료 (2026-07-08) — 배포 앱 버그 6종 정리, main 머지
PR #1 squash 머지(main `f1ced91`). CI 3잡(front·rust macos·rust windows) 전판 GREEN. 브랜치 정리 완료. 다음은 M6 잔여 백로그.

- 계획: ~/.claude/plans/sequential-mixing-hammock.md · 레저: .superpowers/sdd/progress.md "M6 증분 1"
- 사용자 선택: "배포 앱 버그 먼저" + "맥만 있음" → 윈도우 실행검증·코드서명은 다음 트랙

## 이번에 고친 것 (6종, 전부 프론트/러너 내부 · IPC 계약 불변)
1+2. 자동 업데이트 앱 시작 시 전역 확인(App 루트 AppUpdateProvider, 배너는 AppShell) + 진행률 불확정(percent null). Provider 부재 시 idle 폴백
3. N1 "지우는 중" 영구멈춤 근본수정: ipc.ts subscribeRun(listen-before-invoke+버퍼링). Dashboard(안전타이머)·Wizard(refs로 StrictMode·조기언마운트 안전)
4. Catalog/Plugins 리스너 누수 → useTauriEvent 훅
5. reqwest 타임아웃(remote.rs·download.rs)
6. PTY UTF-8 청크경계 모지케(pty.rs Utf8Reassembler)
- 적대적 코드리뷰로 Wizard 구독 누수(startFlow 실패 경로) HIGH 1건 잡아 수정. 신규 파일: useTauriEvent.ts·appUpdateContext.tsx·UpdateBanner.tsx + 테스트 5개

## M6 잔여 백로그 (다음 증분 후보)
- ★ 윈도우 트랙(윈도우 PC 확보 후): 레시피 실행검증(lazycodex omo 경로·im-not-ai/k-skill/korean-law) · lazycodex 윈도우 경로버그(%USERPROFILE% 미변환, verify/detect가 유닉스 경로 그대로) · codex/hermes/openclaw/opencode 윈도우 verify 보강 · 윈도우 코드서명(release.yml에 WINDOWS_SIGN_* 자리 있음, 인증서 미구매)
- 하드닝: scan_secrets 심링크순환/압축 미검사 · release.yml permissions 과대(contents:write→read)
- 기존: verify 패턴 CLI 출력 포맷 의존 · windows findstr 오탐 가능성 · --config 키 미저장 근본해결(state 스키마 필요)

## 인프라 (재사용 정보, M5)
- 레포 3종(needslab-ai): easy-harness(private 소스) · easy-harness-releases(public 배포) · easy-harness-recipes(public 번들)
- GitHub 시크릿 9종 등록. Apple: Team ID RB6FTGW2DK, Issuer ba4190ef-..., API Key QWSDYSB37M
- 로컬 키: ~/.tauri/easy-harness-updater.key(+.password) · ~/.tauri/AuthKey_QWSDYSB37M.p8
- 릴리스 절차·함정은 CLAUDE.md "릴리스 절차 (M5)" 섹션 참조
- ⚠️ 사용자 후속(권장): updater 개인키·Apple .p8을 Dashlane 보안메모에 백업 · Dashlane apple.com 비번 갱신
