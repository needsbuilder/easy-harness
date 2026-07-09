# HANDOFF — 이지 하네스

## 현재 작업 (2026-07-09) — 랜딩페이지 리디자인 + 약관 + 리모션 데모영상
사용자 요청으로 랜딩페이지를 "세련되게" 리디자인 중. **클로드 디자인(claude.ai/design)에 시안**으로 만들고 → 확정 후 실제 `web/` React 코드로 이식 예정. **배포는 리모션 영상까지 다 만든 뒤 한 번에**(사용자 결정, 며칠 뒤. 서두르지 않음).

### 클로드 디자인 프로젝트 (시안)
- project_id `236d59c1-aaf3-4c8e-a0f9-e389c9d13cff` · url https://claude.ai/design/p/236d59c1-aaf3-4c8e-a0f9-e389c9d13cff
- 파일: `landing.dc.html`(랜딩) · `terms.dc.html`(이용약관) · `privacy.dc.html`(개인정보처리방침) · support.js
- 실물 이미지는 배포된 랜딩 `easyharness.vercel.app`(안정적 공개 별칭)에서 참조 — mascot.png, icons/*.png, demo.mp4. (base64 인라인은 LLM이 대용량 재현 불가라 URL 참조로 우회)

### 랜딩 시안 확정 사항 (사용자 피드백 반영 완료)
- 히어로: 좌우 비대칭(좌 헤드라인+다운로드, 우 오공이 광배+근두운링+float). "AI 코딩 도구" 골드 밑줄. 다운로드 버튼 윈도우(골드)·맥(테두리) + 공식 아이콘.
- 데모 섹션: **임시로 앱 카탈로그 CSS 목업** (리모션 영상 완성되면 교체 예정)
- 스텝: 카드 3개(01/02/03). **카드 사이 궤적선은 사용자가 "이상하다"고 해서 제거함**
- 도구: 실물 로고 카드 그리드 + 플러그인 골드 칩
- **색: 골드 단색 톤으로 통일. 청록(mint) UI는 사용자가 "짜친다"고 해서 전부 제거**(라벨·궤적·노드·칩점·glow). 마스코트 구름의 민트만 남김(이미지라). → 재도입 금지
- 상단 GitHub는 릴리스가 아니라 **레포 링크**(스타 유도). "다른 버전 보기" 제거.
- 규칙: em dash·이모지 금지, Pretendard, word-break:keep-all(한글 어절 줄바꿈)

### 푸터 사업자정보 (사업자등록증 기준 실값 반영 완료)
상호 니즈랩(NeedsLab) · 대표 권용범 · 사업자등록번호 825-16-02771 · 주소 경기도 광명시 소하로 190, B동 12층 1217호 · 문의 hello@needslab.ai. (통신판매업신고번호 없음 — 무료앱)

### 약관 2종 (초안 — 배포 전 처리 필요)
- terms/privacy 초안 작성됨. 이지 하네스 특성 반영(무료앱, 제3자 도구 설치 도우미, 면책 / 앱은 회사서버 미수집·로컬저장).
- **배포 전**: ① 시행일 `2026년 00월 00일` 실제 배포일로 채우기 ② 노란 "초안" 안내박스 제거 ③ 가능하면 법률 검토

### 리모션 데모영상 (진행 중)
- `remotion-demo/` 폴더 = Remotion 4.0.486 blank 프로젝트(bun install 완료). 이미지는 `remotion-demo/public/`(web/public에서 복사).
- 구성 24초(720f/30fps) 4씬: `src/scenes/` Intro(오공이 등장+타이틀)·PickTool(카탈로그 카드 클릭)·Installing(오공이 날며 설치 진행바)·Done(준비 완료). 골드톤, Composition.tsx에서 Sequence로 조립(살짝 오버랩=크로스페이드). id=`EasyHarnessDemo`.
- 렌더: `npx remotion render EasyHarnessDemo out/demo.mp4` → 결과 확인·조정 중. 폰트는 index.css에 Pretendard CDN @import(안 되면 시스템 한글 폴백).
- 완성되면: easyharness 배포에 새 영상 넣고 랜딩 데모 섹션을 video로 교체.

### 남은 순서
③ 리모션 렌더 확인·조정(현재) → ④ 시안을 실제 `web/` React 컴포넌트로 이식(약관 `/terms`·`/privacy` 라우트 + 푸터 사업자정보 포함) → `vercel deploy --prod --cwd web`로 배포. (랜딩 배포는 git 연동 아님)

---

## 백로그 (별개, 보류 중)
- **앱 v0.1.3 릴리스 보류**("다 정리하고 한 번에" 방침. 배포된 앱은 v0.1.2). 절차·함정은 CLAUDE.md "릴리스 절차 (M5)".
- **M6 윈도우 트랙 완료**: PR #2·#3·#4 main 머지(실측 CI·lazycodex omo.cmd 절대경로·verify 보강·서명 스캐폴드·카탈로그 카드 리디자인). 잔여(선택): codex·claude-code `.local\bin` PATH 윈도우 실기 확인.
- **카탈로그 "실제 설치 감지" 보류**(2026-07-08 Agent Teams 검토 후): 삭제 안전장치(Dashboard.tsx 경고가 catalog.installed 의존) 훼손·이름충돌 오탐(hermes)·타임아웃 전무가 리스크. 재착수 시 "스캔 버튼식+하드 타임아웃(fail-open)+installed.json 불변+stdout 검증".

## 인프라 (재사용)
- 레포 3종(needslab-ai): easy-harness(private 소스) · easy-harness-releases(public 배포) · easy-harness-recipes(public 번들)
- 랜딩 배포: `vercel deploy --prod --cwd web` (프로젝트명 easyharness, 공개 별칭 easyharness.vercel.app)
- Apple: Team RB6FTGW2DK, 로컬 키 ~/.tauri/. GitHub 시크릿 9종 등록.
