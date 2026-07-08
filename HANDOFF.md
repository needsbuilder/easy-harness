# HANDOFF — 이지 하네스

## 현재 상태 (2026-07-08) — 랜딩 사이트 + 시연영상 + 공식 아이콘 완료, 릴리스 보류
전부 main에 커밋·푸시됨(최신 `dd9832d`), CI 전판 GREEN. **라이브: https://easyharness.needslab.ai** (Vercel needslab 팀 프로젝트 `easyharness`, CLI 직접 배포).
⏳ **다음: v0.1.3 릴리스는 사용자 요청으로 보류** — "다 정리하고 한 번에" 내기로 함. 아직 배포된 앱은 v0.1.2(아이콘 변경 미포함).

### 완료된 것
- **소개 랜딩 사이트**(`web/`, Vite+React+Tailwind4): 히어로·시연영상·3단계·되는도구들·푸터. 반응형·다크. 다운로드 버튼은 GitHub API로 최신 릴리스(v0.1.2) 자산 동적 링크(web/src/lib/releases.ts·useLatestRelease.ts, 테스트 9). 배포는 `vercel deploy --prod --cwd web --yes`
- **Remotion 시연영상**(`video/`): 실제 앱 목업(design/mockups)+애니메이션, 22초 무음+자막, `web/public/demo.mp4`(4.4MB). Pretendard 임베드. 렌더: `cd video && bunx remotion render src/index.ts Demo out/demo.mp4 --codec h264`
- **도구 공식 아이콘**(앱+랜딩+영상 3곳 일치):
  - 하네스 6종 공식 앱아이콘(apple-touch-icon류): claude-code(claude.ai 코랄 별표)·codex(LobeHub 파란꽃+터미널, ★GPT꽃 아님)·gajaecode(Yeachan-Heo 레포 가재)·openclaw(openclaw.ai 랍스터)·hermes(nousresearch.com apple-touch-icon 앞모습 흑백 헤어밴드+N)·opencode(opencode.ai 블록). 파일: `web/public/icons/*.png` + `src/assets/tool-icons/*.png`(둘 다 동일 6개)
  - 오픈소스 플러그인 5종(insane-search·lazycodex·korean-law-mcp·k-skill·im-not-ai)은 **고유 로고 없어 전부 첫 글자 타일**(사용자 지시)
  - 앱: `src/lib/toolIcons.ts`(Vite glob id→아이콘) + `src/components/ToolCard.tsx`(아이콘 있으면 img, 없으면 첫글자). 테스트 src/lib/__tests__/toolIcons.test.ts
  - 영상 카탈로그: 목업(02-catalog.png)에 6개 공식 아이콘 합성해 재렌더
- **루트 vitest 스코프 수정**: `vitest.config.ts`에 `include:["src/**"]` — web/·video/ 테스트가 루트 CI에 안 딸려오게

### 아이콘 교훈(재작업 방지)
- 공식 아이콘 = 각 사이트 **apple-touch-icon**(앱 아이콘)이지 favicon/워드마크 아님. favicon 쓰면 반려됨
- Codex는 고유 로고 없음 → LobeHub Codex 아이콘(파란꽃+터미널). OpenAI 꽃은 "GPT 아이콘"이라 반려됨
- Hermes 앞모습 흑백은 hermes-agent(48px)가 아니라 **nousresearch.com/apple-touch-icon.png(180px)**가 고해상도 원본
- 스펙/계획: docs/superpowers/specs·plans/2026-07-08-easy-harness-landing*.md

## 다음 스텝
- **v0.1.3 릴리스**(보류 해제 시): tauri.conf.json version→0.1.3, main 커밋, `git tag v0.1.3 && push` → 파이프라인 draft → 발행. 이때 앱 ToolCard 공식 아이콘이 사용자에게 나감. (릴리스 절차·함정은 CLAUDE.md "릴리스 절차 (M5)")
- 랜딩 도메인/배포는 git 연동 아님 — 사이트 수정 시 `vercel deploy --prod --cwd web`
- (선택) M6 잔여 백로그: 윈도우 트랙(레시피 실행검증·lazycodex 경로버그·verify 보강·코드서명) · 하드닝(scan_secrets·release.yml permissions)

## 인프라 (재사용)
- 레포 3종(needslab-ai): easy-harness(private 소스) · easy-harness-releases(public 배포) · easy-harness-recipes(public 번들)
- Vercel: needslab 팀 프로젝트 `easyharness`, needslab.ai 네임서버가 vercel-dns라 서브도메인 자동. `.vercel`·`.env.local`은 web/.gitignore
- GitHub 시크릿 9종 등록. Apple: Team ID RB6FTGW2DK, Issuer ba4190ef-..., API Key QWSDYSB37M · 로컬 키 ~/.tauri/
- ⚠️ 사용자 후속(권장): updater 개인키·Apple .p8 Dashlane 백업 · Dashlane apple.com 비번 갱신
