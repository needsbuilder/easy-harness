# HANDOFF — 이지 하네스

## 현재 작업 (2026-07-10) — 랜딩페이지 리디자인 배포
랜딩페이지를 "세련되게" 리디자인 + 리모션 데모영상 + 약관 2종 추가해서 실제 `web/` React 코드로 이식 완료. 브랜치 `feat/landing-download-os-split`에 커밋됨. **push + `vercel --prod` 배포 진행 중/완료.**

### 이번에 한 것 (전부 web/ + remotion-demo/)
- **랜딩 리디자인**: Nav(GitHub 레포 버튼) · Hero(좌우 비대칭, 오공이 광배·float) · DemoVideo(리모션 영상) · Steps(01/02/03, 선 없음) · Tools(실물 로고 그리드+플러그인 칩) · CtaSection · Footer(사업자정보+약관링크). **골드 단색 톤 통일(청록 UI 전부 제거 — 사용자 "짜친다". 재도입 금지)**. em dash·이모지 금지, Pretendard, break-keep.
- **리모션 데모영상**: `remotion-demo/`(Remotion 4.0.486). 24초 4씬(Intro·PickTool·Installing·Done). 골드톤. 오공이가 **설치창 앞을**(zIndex:5) 기울여 대각선으로 날아감. 렌더→`web/public/demo.mp4`+`demo-poster.png`. 재렌더: `cd remotion-demo && npx remotion render EasyHarnessDemo out/demo.mp4` 후 web/public에 복사.
- **약관 2종**: `/terms`·`/privacy` 라우트(react-router-dom 7) + `vercel.json` SPA rewrite. **korean-law MCP 검토 반영**: 이용약관 면책조항에 고의·중과실 배제 단서(약관규제법 §7①), 개인정보처리방침에 파기·안전성·쿠키·구제방법 4항목 추가(개보법 §30). 시행일 2026-07-10.
- **푸터 사업자정보**(실값, `web/src/lib/links.ts`): 니즈랩(NeedsLab)·권용범·825-16-02771·경기 광명시 소하로 190 B동 12층 1217호·hello@needslab.ai.

### 배포
- 랜딩 배포는 git 연동 아님 → **`vercel deploy --prod --cwd web`** (프로젝트 easyharness, 공개 별칭 easyharness.vercel.app). 미리보기는 `vercel deploy --cwd web`(단 프리뷰 URL은 Vercel 로그인벽 있어 curl 불가).
- 배포 후 확인: 랜딩 영상 자동재생 + `/terms`·`/privacy` 직접접속 200 + 모바일 가로스크롤 없음.

### 남은 것 / 주의
- 약관은 "명백한 리스크"만 보완한 초안 — 유료화·규모 확대 시 변호사 정식 검토 권고(사용자 인지함).
- 이 리디자인 브랜치는 아직 main 미머지 — 배포는 브랜치에서 직접 vercel로 나감. main 반영은 PR로 별도 정리 필요할 수 있음.

---

## 백로그 (별개, 보류 중)
- **앱 v0.1.3 릴리스 보류**("다 정리하고 한 번에". 배포된 앱은 v0.1.2). 절차·함정은 CLAUDE.md "릴리스 절차 (M5)".
- **M6 윈도우 트랙 완료**: PR #2·#3·#4 머지. 잔여(선택): codex·claude-code `.local\bin` PATH 윈도우 실기 확인.
- **카탈로그 "실제 설치 감지" 보류**(2026-07-08 Agent Teams 검토): 삭제 안전장치(Dashboard.tsx 경고가 catalog.installed 의존) 훼손·이름충돌 오탐(hermes)·타임아웃 전무 리스크. 재착수 시 "스캔 버튼식+하드 타임아웃(fail-open)+installed.json 불변+stdout 검증".

## 인프라 (재사용)
- 레포 3종(needslab-ai): easy-harness(private 소스) · easy-harness-releases(public 배포) · easy-harness-recipes(public 번들)
- Apple: Team RB6FTGW2DK, 로컬 키 ~/.tauri/. GitHub 시크릿 9종 등록.
