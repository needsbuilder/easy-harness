# HANDOFF — 이지 하네스

## M5 완료 (2026-07-07) — 서명·배포 파이프라인 + 자동 업데이트
M5 전체 완료. v0.1.0·v0.1.1 실배포 성공, 완료 기준 4/4 실증. 다음은 M6.

- 스펙: docs/superpowers/specs/2026-07-06-easy-harness-m5-deploy-design.md · 계획: docs/superpowers/plans/2026-07-06-easy-harness-m5-deploy.md · 레저: .superpowers/sdd/progress.md (13태스크 커밋·리뷰 판정 전체)
- main에 전부 머지됨(feat/m5-deploy → e18d4cb 이후 hotfix들 main 직접). CI 3잡(맥·윈도우·프론트) 전판 GREEN
- **실배포 완료**: needslab-ai/easy-harness-releases에 v0.1.0·v0.1.1 발행. 서명·공증된 dmg, 자동 업데이트 관통

## 완료 기준 실증 (4/4)
1. .dmg 설치 → spctl "accepted, Notarized Developer ID" + stapler worked (경고 없이 실행)
2. 자동 업데이트 → /Applications 앱이 0.1.0→0.1.1 원클릭 갱신, 업데이트본도 공증 유효
3. 시크릿 스캔 → canary 주입 번들 exit 1 / 클린 exit 0
4. 게이트 5종(cargo fmt/clippy/test --all-features, bun test/build) + CI 전판 GREEN

## 인프라 (재사용 정보)
- 레포 3종(needslab-ai): easy-harness(private 소스) · easy-harness-releases(public 배포) · easy-harness-recipes(public 번들)
- GitHub 시크릿 9종 전부 등록. Apple: Team ID RB6FTGW2DK(Individual), Issuer ba4190ef-..., API Key QWSDYSB37M(제품 개발 역할)
- 로컬 키: ~/.tauri/easy-harness-updater.key(+.password) · ~/.tauri/AuthKey_QWSDYSB37M.p8 · ~/.tauri/dev-id-p12.password
- 릴리스 절차·함정은 CLAUDE.md "릴리스 절차 (M5)" 섹션 참조

## ⚠️ 사용자 후속 조치 (권장)
- **Dashlane 백업**: updater 개인키(~/.tauri/easy-harness-updater.key + 비번), Apple .p8(QWSDYSB37M), Issuer/Key ID를 보안 메모에 추가. 지금은 로컬 파일에만 있음
- **Dashlane apple.com 갱신**: 저장된 비번 2개(ybgwon96/gyb0719) 모두 로그인 거부됨 → 실제 값으로 갱신

## M6 백로그 (다음 마일스톤)
- ★ 윈도우 레시피 전체 검증(lazycodex omo 경로·im-not-ai/k-skill/korean-law windows 섹션) · 윈도우 코드 서명(release.yml에 WINDOWS_SIGN_* 조건부 자리 있음, 인증서 미구매)
- **자동 업데이트가 대시보드 방문 시에만 check()** — 앱 시작 시 전역 체크로 개선 여지(현재 useAppUpdate가 Dashboard.tsx에서만 마운트)
- verify 패턴 CLI 출력 포맷 의존(선례와 동일) · windows findstr 버전 오탐 가능성
- 기존: PTY UTF-8 버퍼링 · Catalog listen 가드 · reqwest 타임아웃 · Dashboard done 이벤트 유실(N1) · --config 키 미저장 근본 해결
- M5 리뷰 Minor(레저 기록): scan_secrets 심링크 순환/압축 산출물 미검사 · release.yml permissions 과대(contents:write→read) · appUpdate contentLength 0 엣지 테스트
