# 이지 하네스 브랜드·UI 디자인 (마일스톤 1) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 이지 하네스의 브랜드(로고·앱 아이콘)와 UI 디자인 시스템·핵심 화면 6종 목업을 힉스필드 MCP + Claude Design으로 제작해, 마일스톤 2(앱 구현)가 바로 쓸 수 있는 산출물로 확정한다.

**Architecture:** 힉스필드(mcp__claude_ai__*)로 (A) 마스코트 / (B) 미니멀 두 방향의 브랜드 시안을 생성 → 사용자가 비교 선택 → 선택 방향으로 디자인 토큰·컴포넌트 규칙 확정 → Claude Design(mcp__claude-design__*)으로 화면 6종 목업 제작. 각 단계 산출물은 `design/` 아래에 파일로 저장하고 git으로 추적한다.

**Tech Stack:** 힉스필드 MCP (이미지 생성·업스케일·배경제거), Claude Design MCP (화면 목업), Artifact (시안 비교 보드), git

## Global Constraints

- 기존 EasyClaw의 코드·UI·로고·마스코트를 일절 참고하지 않는다. 특히 "주황색 집게(크랩) 캐릭터" 콘셉트와 주황 단독 메인 컬러는 모든 생성 프롬프트에서 명시적으로 배제한다.
- 주 사용자층은 **비개발자 일반인**. 모든 시안 평가 1순위 기준은 "비개발자에게 매력적인가".
- UI 언어는 한국어. 목업 문구는 전문용어 금지 ("개발 지식 0인 사람이 처음 읽어도 이해되는가"로 검수).
- 브랜드는 (A) 새 마스코트 캐릭터 / (B) 미니멀·모던 **두 방향을 각각 생성한 뒤 사용자가 비교 선택**한다. 어느 한쪽을 건너뛰지 않는다.
- 설치·첫 실행 성공 화면은 "캡처해서 SNS에 공유하고 싶은 비주얼"로 특별 설계한다.
- 최종 산출물: ① 앱 아이콘 마스터 1024×1024 투명배경 PNG ② 로고(가로형·심볼) ③ 디자인 토큰(`design/tokens.json`) ④ 화면 6종 목업 (환영·카탈로그·마법사·인증·확인·대시보드). 아이콘의 .icns/.ico 변환은 마일스톤 2에서 `tauri icon`으로 수행하므로 여기선 마스터 PNG까지만.
- 제품명 표기: 한글 "이지 하네스", 영문 "Easy Harness".
- 사용자 승인 게이트(STOP)가 있는 태스크는 승인 없이 다음 태스크로 넘어가지 않는다.
- 힉스필드 모델 선택은 하드코딩하지 않고 실행 시점에 `models_explore(action:'recommend')`로 추천받아 쓴다 (모델 라인업이 자주 바뀌므로).

---

### Task 1: 디자인 브리프 작성

**Files:**
- Create: `design/brief.md`

**Interfaces:**
- Produces: 이후 모든 생성 프롬프트·평가의 단일 기준 문서. Task 2·3의 프롬프트는 이 브리프의 "배제 목록"과 "평가 기준"을 그대로 인용한다.

- [ ] **Step 1: 브리프 파일 작성**

`design/brief.md`에 아래 내용을 그대로 작성 (스펙 1·10절 요약):

```markdown
# 이지 하네스 디자인 브리프

## 제품
- 이지 하네스 (Easy Harness): 비개발자가 클릭 몇 번으로 AI 코딩 도구를
  설치→로그인→첫 실행→관리까지 끝내는 맥/윈도우 데스크톱 앱.
- 핵심 감정: "나도 할 수 있네?" — 쉬움, 안심, 성취감.

## 타깃
- 비개발자 일반인. 터미널·개발 지식 0 전제.
- SNS(스레드) 입소문이 성장 채널 → 스크린샷이 예뻐야 한다.

## 두 방향
- A. 새 마스코트 캐릭터: 친근함으로 공략. 설치 진행을 캐릭터가 안내.
- B. 미니멀·모던: Raycast·Arc 감성. "장난감 아닌 제대로 된 도구" 신뢰감.

## 배제 목록 (모든 프롬프트에 negative로 포함)
- 크랩/집게/게 모양 캐릭터 전부 (기존 EasyClaw 마스코트)
- 주황색 단독 메인 컬러
- 보석·금목걸이 등 블링블링 콘셉트
- 터미널/해커 감성 (초록 글자 검은 배경)

## 평가 기준 (순서대로)
1. 비개발자에게 매력적인가 (귀엽거나/세련되거나 — 갖고 싶은가)
2. 앱 아이콘으로 축소해도 식별되는가 (16px에서도)
3. 한국어 UI와 어울리는가
4. 확장성 (11종 도구 카드·배지 시스템과 어울리는가)
```

- [ ] **Step 2: 커밋**

```bash
git add design/brief.md
git commit -m "design: 디자인 브리프 작성 (두 방향·배제 목록·평가 기준)"
```

---

### Task 2: 힉스필드 준비 확인 + 모델 추천 받기

**Files:**
- Create: `design/generation-log.md` (생성 이력 기록 시작)

**Interfaces:**
- Produces: 사용할 이미지 생성 모델명(문자열), 잔여 크레딧 확인 결과. Task 3·4가 이 모델명을 사용한다.

- [ ] **Step 1: 힉스필드 MCP 도구 로드**

ToolSearch로 필요한 도구 스키마 로드:
`select:mcp__claude_ai__balance,mcp__claude_ai__models_explore,mcp__claude_ai__generate_image,mcp__claude_ai__job_status,mcp__claude_ai__upscale_image,mcp__claude_ai__remove_background,mcp__claude_ai__show_generations`

- [ ] **Step 2: 크레딧 잔액 확인**

`mcp__claude_ai__balance` 호출. 잔액이 로고 시안 8장 + 정제 작업을 못 돌릴 수준이면 STOP하고 사용자에게 충전 여부 확인.

- [ ] **Step 3: 모델 추천 받기**

`mcp__claude_ai__models_explore(action:'recommend')`에 목표 전달: "브랜드 로고/앱 아이콘/마스코트 캐릭터 시안 생성, 텍스트 없는 심볼 위주, 투명배경 가능하면 우대". 추천 모델명을 `design/generation-log.md`에 기록.

- [ ] **Step 4: 커밋**

```bash
git add design/generation-log.md
git commit -m "design: 힉스필드 준비 확인·모델 선정 기록"
```

---

### Task 3: A방향 — 마스코트 캐릭터 시안 4종 생성

**Files:**
- Create: `design/candidates/mascot/mascot-01.png` ~ `mascot-04.png`
- Modify: `design/generation-log.md` (프롬프트·모델·생성ID 기록)

**Interfaces:**
- Consumes: Task 2의 추천 모델명
- Produces: 마스코트 후보 PNG 4장 (Task 5 비교 보드의 입력)

- [ ] **Step 1: 콘셉트 4종을 각각 생성**

`mcp__claude_ai__generate_image`로 아래 4개 프롬프트를 각각 실행 (Task 2의 추천 모델 사용). 공통 negative: "no crab, no claw, no lobster, no orange-only color scheme, no gold chains or jewelry, no hacker/terminal aesthetic, no text".

콘셉트 1 — 커넥터 버디 (설치=연결 메타포):
```
A cute mascot character for a Korean consumer desktop app that installs AI tools
with one click. Concept: a friendly rounded power-plug / connector creature,
soft 3D render, big expressive eyes, welcoming smile, holding a glowing
connection spark. Fresh mint-and-indigo palette, soft studio lighting, clean
white background, app-mascot quality like Duolingo or Toss characters.
```

콘셉트 2 — 도우미 로봇:
```
A cute small helper robot mascot, soft rounded body like a marshmallow,
one hand giving a thumbs-up, subtle checkmark motif on its chest, soft 3D
render, pastel blue-violet palette, warm friendly expression, clean white
background, consumer-app mascot quality.
```

콘셉트 3 — 마법사 견습생 (마법사 UI 메타포):
```
A cute tiny wizard-apprentice creature mascot casting an easy one-click spell,
sparkle trail forming a checkmark, soft 3D render, rounded shapes, friendly
big eyes, teal and lavender palette, clean white background, playful but
trustworthy, consumer-app mascot quality.
```

콘셉트 4 — 자유 탐색 (모델 창의성 위임):
```
Design an original, never-seen-before cute mascot for "Easy Harness", a
Korean app that makes installing AI coding tools effortless for complete
beginners. The mascot should embody "easy, safe, delightful". Soft 3D,
rounded, instantly lovable, works as a tiny app icon. Fresh non-orange
palette, clean white background.
```

- [ ] **Step 2: 생성 결과 다운로드·저장**

각 생성 job 완료를 `job_status`로 확인 후 결과 이미지를 `design/candidates/mascot/mascot-01.png`~`04.png`로 저장 (URL 반환 시 `curl -L -o`로 다운로드). 프롬프트 전문·모델·생성 ID를 `design/generation-log.md`에 기록.

- [ ] **Step 3: 결과 검수**

4장을 Read 도구로 눈으로 확인. 배제 목록 위반(집게·주황 단독·블링)이 있으면 해당 콘셉트만 프롬프트의 negative를 강화해 1회 재생성.

- [ ] **Step 4: 커밋**

```bash
git add design/candidates/mascot/ design/generation-log.md
git commit -m "design: A방향 마스코트 시안 4종 생성"
```

---

### Task 4: B방향 — 미니멀·모던 로고 시안 4종 생성

**Files:**
- Create: `design/candidates/minimal/minimal-01.png` ~ `minimal-04.png`
- Modify: `design/generation-log.md`

**Interfaces:**
- Consumes: Task 2의 추천 모델명
- Produces: 미니멀 로고 후보 PNG 4장 (Task 5 비교 보드의 입력)

- [ ] **Step 1: 콘셉트 4종을 각각 생성**

공통 negative는 Task 3과 동일 + "no mascot, no character, no cute animal".

콘셉트 1 — 육각 포트/소켓 심볼:
```
Minimal modern app icon for "Easy Harness", a desktop app that installs AI
tools in one click. A clean hexagonal port/socket symbol with a glowing plug
entering it, subtle depth, smooth indigo-to-teal gradient on a dark squircle,
Raycast/Arc/Linear aesthetic, crisp vector-like edges, no text.
```

콘셉트 2 — EH 모노그램:
```
Minimal geometric monogram combining the letters E and H into one continuous
elegant shape, modern sans-serif construction, smooth violet-to-cyan gradient,
placed on a soft dark squircle app icon, premium consumer-tool aesthetic like
Raycast or Arc browser, no other text.
```

콘셉트 3 — 원클릭 스위치:
```
Minimal app icon: a single beautiful toggle switch flipped to ON with a soft
glow ring, symbolizing "AI tools made instantly usable", smooth gradient
mint-to-blue, floating on a dark squircle, subtle glassmorphism, Raycast-like
premium aesthetic, no text.
```

콘셉트 4 — 자유 탐색:
```
Design an original minimal, premium app icon for "Easy Harness", a Korean
consumer app that makes installing AI coding tools effortless. Convey "easy,
instant, trustworthy". Modern gradient, dark squircle, Raycast/Arc-tier
polish, memorable at 16 pixels, no text.
```

- [ ] **Step 2: 다운로드·저장** — Task 3 Step 2와 동일 절차로 `design/candidates/minimal/minimal-01.png`~`04.png` 저장, 로그 기록.

- [ ] **Step 3: 결과 검수** — Task 3 Step 3과 동일 (배제 목록 + "16px 식별성" 체크).

- [ ] **Step 4: 커밋**

```bash
git add design/candidates/minimal/ design/generation-log.md
git commit -m "design: B방향 미니멀 로고 시안 4종 생성"
```

---

### Task 5: 시안 비교 보드 제시 + 사용자 방향 선택 (STOP 게이트)

**Files:**
- Create: `design/comparison-board.html` (Artifact 소스)
- Create: `design/DECISION.md` (선택 결과 기록)

**Interfaces:**
- Consumes: Task 3·4의 후보 PNG 8장
- Produces: 확정 방향(`mascot` 또는 `minimal`)과 확정 후보 파일명 — Task 6부터 전부 이 결정을 따른다.

- [ ] **Step 1: artifact-design 스킬 로드**

Artifact 작성 전 `artifact-design` 스킬을 Skill 도구로 로드 (전역 지침).

- [ ] **Step 2: 비교 보드 Artifact 제작**

`design/comparison-board.html`에 8장을 A/B 두 섹션으로 배치한 갤러리 작성. 이미지는 **data URI로 임베드** (CSP가 외부 URL 차단). 각 카드에 콘셉트 이름·한 줄 설명 표기. 라이트/다크 테마 모두 대응. Artifact 도구로 게시해 사용자가 브라우저에서 크게 볼 수 있게 한다.

- [ ] **Step 3: 사용자 선택 받기 (STOP)**

AskUserQuestion으로 ① 방향(A 마스코트 / B 미니멀 / 특정 후보 조합) ② 마음에 든 후보 번호 ③ 수정 요청사항을 받는다. **응답 전 다음 태스크 진행 금지.** 재생성 요청 시 해당 방향 태스크(3 또는 4)로 돌아가 반영 후 보드 갱신.

- [ ] **Step 4: 결정 기록·커밋**

선택 방향·후보·사용자 코멘트를 `design/DECISION.md`에 기록.

```bash
git add design/comparison-board.html design/DECISION.md
git commit -m "design: 브랜드 방향 확정 (사용자 선택 기록)"
```

---

### Task 6: 확정 시안 정제 — 로고·앱 아이콘 마스터 제작

**Files:**
- Create: `design/final/app-icon-1024.png` (1024×1024, 투명배경)
- Create: `design/final/logo-symbol.png`, `design/final/logo-horizontal.png`
- Modify: `design/generation-log.md`

**Interfaces:**
- Consumes: Task 5의 확정 후보 PNG
- Produces: 마일스톤 2가 `tauri icon`에 넣을 마스터 아이콘 + 화면 목업에 쓸 로고. 파일명은 위 3개를 정확히 사용한다.

- [ ] **Step 1: 확정 후보 정제 생성**

확정 후보를 입력 이미지로 `generate_image`(이미지 편집 모드)·`upscale_image`를 사용해: ① 앱 아이콘용 정방형 구도 정리 ② 2K 업스케일. 마스코트 방향이면 아이콘용 단순화 버전(머리/심볼만)도 함께 생성.

- [ ] **Step 2: 배경 제거**

`remove_background`로 투명배경 처리 → 1024×1024로 리사이즈해 `design/final/app-icon-1024.png` 저장:

```bash
sips -z 1024 1024 <입력>.png --out design/final/app-icon-1024.png
```

- [ ] **Step 3: 로고 2종 저장**

심볼 단독(`logo-symbol.png`)과, 심볼+제품명 가로 조합의 기준 이미지(`logo-horizontal.png`) 저장. (한글 워드마크 타이포는 목업 단계에서 웹폰트로 조판하므로 여기선 심볼 품질에 집중.)

- [ ] **Step 4: 검수 — 16px 식별성 테스트**

```bash
sips -z 16 16 design/final/app-icon-1024.png --out /tmp/icon-16.png
```
16px 축소본을 Read로 확인해 식별 가능한지 검수. 뭉개지면 Step 1로 돌아가 단순화 버전 재생성 (최대 2회).

- [ ] **Step 5: 사용자 확인 (STOP)**

최종 아이콘·로고를 SendUserFile(render)로 보여주고 승인받는다.

- [ ] **Step 6: 커밋**

```bash
git add design/final/ design/generation-log.md
git commit -m "design: 앱 아이콘 마스터(1024px)·로고 확정"
```

---

### Task 7: 디자인 토큰·시스템 정의

**Files:**
- Create: `design/tokens.json`
- Create: `design/design-system.md`

**Interfaces:**
- Consumes: Task 5 확정 방향, Task 6 최종 시안의 실제 색상
- Produces: `design/tokens.json` — 마일스톤 2에서 Tailwind 설정으로 그대로 변환되는 단일 소스. 키 구조는 아래 스키마를 정확히 따른다.

- [ ] **Step 1: 확정 시안에서 색 추출**

Task 6 최종 PNG에서 주조색·보조색을 추출해 팔레트 초안 구성 (Read로 이미지 확인 후 대표색 결정).

- [ ] **Step 2: tokens.json 작성**

아래 스키마로 작성 (값은 확정 시안 기준으로 채움 — 아래는 구조 예시이며 색상 hex는 Step 1 결과로 대체):

```json
{
  "color": {
    "brand": { "primary": "#5B5FEF", "secondary": "#2DD4BF", "accent": "#F4C95D" },
    "surface": { "bg": "#FFFFFF", "card": "#F7F8FA", "bgDark": "#111318", "cardDark": "#1B1E27" },
    "text": { "primary": "#191B22", "secondary": "#5A6072", "onBrand": "#FFFFFF" },
    "status": { "success": "#22C55E", "warning": "#F59E0B", "error": "#EF4444", "info": "#3B82F6" }
  },
  "font": {
    "family": { "base": "Pretendard Variable", "mono": "JetBrains Mono" },
    "size": { "display": "28px", "title": "20px", "body": "15px", "caption": "13px" }
  },
  "radius": { "card": "16px", "button": "12px", "badge": "999px" },
  "spacing": { "unit": "4px", "cardGap": "16px", "screenPadding": "24px" }
}
```

한국어 본문 폰트는 Pretendard(오픈소스, SIL OFL — 실행 시점에 배포처·라이선스 라이브 확인)로 한다.

- [ ] **Step 3: design-system.md 작성**

컴포넌트 규칙 문서화: 도구 카드(아이콘·이름·한줄설명·모델 배지·요금 배지·설치 상태), 진행 스텝퍼("2/4단계" 표기), 버튼 위계(주/보조/위험), 에러 패널(쉬운말 요약+해결 제안+재시도), 성공 화면(공유하고 싶은 비주얼 — 큰 일러스트+축하 문구+캡처 프레임) 각각의 구성과 토큰 매핑.

- [ ] **Step 4: 커밋**

```bash
git add design/tokens.json design/design-system.md
git commit -m "design: 디자인 토큰·컴포넌트 시스템 정의"
```

---

### Task 8: 화면 6종 목업 제작 (Claude Design)

**Files:**
- Create: Claude Design 프로젝트 (원격) + `design/mockups/01-welcome.png` ~ `06-dashboard.png` (렌더 캡처)

**Interfaces:**
- Consumes: `design/tokens.json`, `design/final/logo-symbol.png`, design-system.md의 컴포넌트 규칙
- Produces: 화면 6종 목업 PNG — 마일스톤 2 UI 구현의 시각 기준. 파일명 규칙: `01-welcome`, `02-catalog`, `03-wizard`, `04-auth`, `05-success`, `06-dashboard`.

- [ ] **Step 1: Claude Design 도구 로드·프로젝트 생성**

ToolSearch로 `select:mcp__claude-design__get_claude_design_prompt,mcp__claude-design__create_project,mcp__claude-design__write_files,mcp__claude-design__render_preview,mcp__claude-design__list_design_systems` 로드 → `get_claude_design_prompt`로 최신 작성 가이드 확인 → "Easy Harness" 프로젝트 생성.

- [ ] **Step 2: 화면 6종 제작**

tokens.json 값을 그대로 사용해 6화면 작성. 화면별 필수 요소:
1. `01-welcome` — 로고 + "3분이면 준비 끝" 카피 + 환경 진단 결과 카드("준비 OK" / "준비물 2개 필요해요")
2. `02-catalog` — 11종 도구 카드 그리드. 카드: 아이콘·이름·한줄설명·**지원 AI 모델 배지·필요 계정 배지**·무료/요금제·설치됨 체크·입문자 추천 배지. lazycodex 카드에 "Codex 필요" 표시.
3. `03-wizard` — "지금 Node.js를 설치하고 있어요 (2/4단계)" 스텝퍼 + 진행바 + "자세한 로그 보기" 토글
4. `04-auth` — 브라우저 로그인형 안내 화면 (단계 그림 + "로그인 시작" 버튼)
5. `05-success` — **공유하고 싶은 성공 화면** (Global Constraints 참조): 큰 축하 비주얼 + "Claude Code 준비 완료!" + 은은한 브랜드 프레임
6. `06-dashboard` — 설치 목록·버전·업데이트 있음 표시·업데이트/삭제 버튼

모든 문구는 한국어, 전문용어 금지 기준으로 작성.

- [ ] **Step 3: 렌더·검수**

`render_preview`로 각 화면 렌더 → PNG를 `design/mockups/`에 저장 → 브리프 평가 기준 4개로 자체 검수 (특히 "전문용어 0" 문구 검수).

- [ ] **Step 4: 사용자 리뷰 (STOP)**

6장을 비교 보드 Artifact에 추가(또는 SendUserFile render)해 보여주고 화면별 피드백 수렴 → 반영 → 재렌더. 승인까지 반복.

- [ ] **Step 5: 커밋**

```bash
git add design/mockups/
git commit -m "design: 화면 6종 목업 확정"
```

---

### Task 9: 산출물 정리·핸드오프

**Files:**
- Create: `design/README.md` (산출물 인덱스)
- Modify: `HANDOFF.md`

**Interfaces:**
- Consumes: Task 6~8의 전체 산출물
- Produces: 마일스톤 2 계획(별도 plan)이 참조할 산출물 인덱스

- [ ] **Step 1: 산출물 인덱스 작성**

`design/README.md`에 파일 목록·용도·마일스톤 2에서의 사용법(`tauri icon design/final/app-icon-1024.png`, tokens.json → Tailwind 변환) 기록.

- [ ] **Step 2: HANDOFF.md 갱신**

현재 상태를 "마일스톤 1 완료, 다음: 마일스톤 2(앱 뼈대+레시피 엔진) 계획 작성"으로 갱신.

- [ ] **Step 3: 커밋**

```bash
git add design/README.md HANDOFF.md
git commit -m "design: 마일스톤 1 산출물 정리·핸드오프"
```

---

## 후속 계획 (이 plan 범위 밖)

- 마일스톤 2: Tauri 2 앱 뼈대 + 레시피 엔진·스텝 러너·드라이런 (디자인 확정 후 별도 plan — TDD 본격 적용 구간)
- 마일스톤 3~4: 하네스 6종 / 오픈소스·플러그인 5종 레시피 (지원 모델·설치법 라이브 검증 포함)
- 마일스톤 5: 서명·배포 파이프라인 / 마일스톤 6: VM 스모크 테스트·출시
