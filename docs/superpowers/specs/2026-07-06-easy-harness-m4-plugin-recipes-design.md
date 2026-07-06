# 이지 하네스 M4 — 오픈소스·플러그인 5종 레시피 설계

- 작성일: 2026-07-06
- 상태: 사용자 승인 완료 (브레인스토밍 설계 승인, 문서 리뷰 단계)
- 상위 문서: [2026-07-05 이지 하네스 설계](2026-07-05-easy-harness-design.md) 12절 마일스톤 4
- 선행 마일스톤: M3 완료 (하네스 6종 + 준비물 2종 레시피, 실설치 GUI 스모크 통과)

## 1. 개요와 목표

M4는 v1 라인업의 나머지 절반인 **오픈소스·플러그인 5종**(lazycodex, insane-search, k-skill, korean-law-mcp, im-not-ai)의 레시피를 작성하고, 이들이 처음 실사용하는 **requires 의존성 흐름**(선행 하네스 자동 설치)과 **api_key 인증 패턴**을 제품 수준으로 마감한다.

엔진 쪽 requires 인프라(스키마 `kind:"plugin"`·`requires`, 설치 순서 DFS 해석·순환 감지, 카탈로그 missing_requires 배지)는 M2~M3에서 구현·테스트 완료 상태다. 다만 전부 mock 픽스처로만 검증됐고 실물 레시피는 0개다. M4의 무게중심은 엔진 신규 개발이 아니라 **레시피 데이터 5종 + 이를 사용자에게 제대로 보여주는 UI 마감**이다.

## 2. 확정 결정 사항 (2026-07-06 사용자 확정)

| 항목 | 결정 |
|---|---|
| 선행 하네스 설치 UX | **마법사 시작 전 안내 스텝** 추가 후 단일 런으로 진행 (접근법 A). 조용한 자동 설치·왕복 2회 유도안은 기각 |
| 설치 구조 | 엔진의 기존 통합 설치 런 유지. 도구별 연쇄 런(접근법 B)은 기각 — 프론트 오케스트레이션 신규 개발 부담 대비 이득 부족 |
| 멀티하네스 도구(k-skill, im-not-ai) | **v1은 requires를 Claude Code로 고정.** anyOf 스키마 확장·설치 하네스 자동 감지는 v2 백로그 |
| 윈도우 격차 | **네이티브 설치 근거가 있는 4종만 windows 섹션 작성**, insane-search는 생략하고 카탈로그에 "맥 전용" 표시. WSL2 안내는 범위 제외. 윈도우 실검증은 M6 VM 스모크, 어긋나면 레시피 원격 갱신으로 수정 |
| 추가 범위 | 이월 백로그 중 3건 포함: **stderr 패턴 에러 안내, 대시보드 삭제 가드, 제작자 출처 표기**. api_key 마감(백로그 5번)은 korean-law-mcp가 강제하므로 코어 취급 |

## 3. 레시피 5종 상세

아래 사실관계는 2026-07-06 웹 라이브 조사 결과다(멀티에이전트, 출처는 각 항목). 5종 모두 제3자 오픈소스이며 자사(needslab) 프로젝트가 아니다 — 카드에 제작자 출처를 표기한다(5절 `source` 필드).

### 3.1 lazycodex — Codex 강화 배포판

- 정체: OpenAI Codex CLI 전용 에이전트 배포판(엔진 oh-my-openagent). 제작 Sisyphus Labs (code-yeongyu). 출처: github.com/code-yeongyu/lazycodex, lazycodex.ai/docs, npm lazycodex-ai (2026-07-06 확인, 당시 4.15.1)
- `requires: ["codex"]` — **requires 실사용 1호.** mac·windows 모두 `prerequisites: ["nodejs-lts"]` (npx 실행에 Node 필요)
- 설치: `npx lazycodex-ai install --no-tui` (무인 모드). `--codex-autonomous` 플래그는 계획 단계 실측에서 효과 확인 후 채택 여부 결정 (Codex 동작 방식을 바꾸는 옵션일 수 있어 기본 미포함)
- 인증: 없음 — Codex의 기존 로그인에 얹혀간다. auth 섹션 생략
- verify·update·uninstall: `npx lazycodex-ai doctor` / 재설치 / `npx lazycodex-ai uninstall` (doctor 종료 코드는 계획 단계 실측)
- 윈도우: 작성. 공식 문서가 네이티브 절차(Git Bash 기반, Node 자동 프로비저닝)를 제공하나 권장 환경 표는 WSL2를 권해 문서 내 모순 존재 — 네이티브 절차 기준으로 작성하고 M6 스모크에서 검증
- 주의: 버전 갱신이 매우 빠름(수일 단위). 레시피에 버전 고정 금지, doctor로 상태 확인

### 3.2 insane-search — Claude Code 웹읽기 플러그인

- 정체: 웹 fetch가 막힐 때 단계적 우회로 공개 페이지를 읽는 Claude Code 전용 플러그인. 제작 fivetaku. 출처: github.com/fivetaku/insane-search, fivetaku/gptaku_plugins (2026-07-06 확인, 0.9.1)
- `requires: ["claude-code"]`
- 설치: `claude plugin marketplace add fivetaku/gptaku_plugins` → `claude plugin install insane-search@gptaku-plugins` (4절 공통 규칙)
- 인증: 없음 (API 키·프록시 불필요가 공식 셀링포인트)
- 윈도우: **섹션 생략** — 공식 README가 WSL2 필수 명시(네이티브 미지원). 카탈로그에서 "맥 전용" 처리(6절 ③)
- 주의: 첫 실행 시 파이썬 패키지 자동 설치 — verify가 설치 등록 확인까지만 책임진다는 한계를 계획 단계에 명시

### 3.3 k-skill — 한국 특화 스킬 모음

- 정체: SRT 예매·부동산·법령·쇼핑 등 한국 특화 Agent Skills 모음(2026-07-06 실측 102종). 제작 NomaDamas. 출처: github.com/NomaDamas/k-skill (2026-07-06 확인)
- `requires: ["claude-code"]` — 실제로는 Codex·OpenCode·OpenClaw도 지원하지만 v1은 Claude Code 고정(2절)
- 설치 (2026-07-06 실측으로 변경): README의 마켓플레이스 경로는 현재 깨져 있음(저장소에 `.claude-plugin/marketplace.json` 없음, `claude plugin marketplace add` 실측 exit 1). 실제 동작 경로는 Vercel Labs skills CLI — `npx --yes skills add NomaDamas/k-skill --all -g -y -a claude-code` (실측: `~/.claude/skills/<이름>/`에 복사, exit 0). mac·windows `prerequisites: ["nodejs-lts"]`
- 설치 범위 (사용자 확정 2026-07-06): **전체 102종 설치.** 제거는 `npx --yes skills remove <이름들> -g -y`에 레시피 작성 시점의 전체 이름 목록을 명시(실측: 비대화형 exit 0, 없는 이름은 무해하게 건너뜀). 업스트림에 스킬이 추가되면 레시피 원격 갱신으로 목록 동기화
- 인증: 없음 — 대부분 기능은 운영자 호스팅 프록시로 동작. SRT 로그인·특허 키 등 일부 BYOK 기능은 사용 시점에 도구가 직접 안내(우리 레시피 범위 밖). 카드 설명에 이 사실을 쉬운 말로 한 줄 반영
- 윈도우: 작성 (Node/프록시 기반이라 네이티브 동작 가능성 높음, 일부 맥 전용 기능은 카드 설명에서 언급하지 않음). M6 검증
- 주의: 예매·결제류 스킬은 민감 — 카드 설명은 검색·조회 위주로 소개

### 3.4 korean-law-mcp — 법제처 법령 MCP 서버

- 정체: 법제처 오픈 API 42종을 묶은 MCP 서버(환각 방지 인용 검증 포함). 제작 chrisryugj(류주임). 출처: github.com/chrisryugj/korean-law-mcp, npm korean-law-mcp (2026-07-06 확인, 4.6.4)
- `requires: ["claude-code"]`
- **api_key 인증 패턴 실사용 1호.** 법제처 OC 키 필수(무료, open.law.go.kr에서 이메일 등록 발급)
  - auth 구성: `open_url`(발급 페이지) → `input_secret`(OC 키) → 키를 도구 설정에 기록하는 스텝. **앱은 키를 보관하지 않는다** — 화면·로그·진단 파일 노출 금지(상위 스펙 6절 원칙)
- 설치 경로 (2026-07-06 실측으로 확정): 마켓플레이스 경로 채택, npm 폴백 폐기. 키 주입은 공식 비대화형 옵션 실측 확인 — `claude plugin install korean-law@korean-law-marketplace --config api_key=<OC키>` (플러그인 manifest가 `LAW_OC: ${user_config.api_key}`로 MCP 서버에 전달, 실물 설치본에서 확인)
- 윈도우: 작성 — 네이티브 지원 명시 확인됨(Node 18+만 필요)
- 주의: 원격 호스팅 엔드포인트(제3자 프록시) 경로는 채택하지 않는다 — 법령 조회가 외부 프록시를 경유하는 구조는 배제하고 로컬 실행 경로만 사용

### 3.5 im-not-ai — 한글 AI 티 제거 스킬

- 정체: AI가 쓴 한글 텍스트를 사람 글처럼 윤문하는 스킬(설치명 humanize-korean). 제작 epoko77-ai. 출처: github.com/epoko77-ai/im-not-ai (2026-07-06 확인, MIT)
- `requires: ["claude-code"]` — Codex·Gemini도 지원하지만 v1은 Claude Code 고정
- 설치: `claude plugin marketplace add epoko77-ai/im-not-ai` → `claude plugin install humanize-korean@im-not-ai` (clone+install.sh 경로는 채택 안 함 — 마켓플레이스 경로가 공식 권장이고 윈도우 호환도 유리)
- 인증: 없음 — Claude Code의 기존 인증을 그대로 사용
- 윈도우: 작성 (마켓플레이스 경로는 심링크 스크립트를 우회하므로 네이티브 가능성 높음). M6 검증

## 4. 공통 규칙 — Claude Code 플러그인 설치·검증

- **설치는 공식 비대화형 CLI 사용**: `claude plugin marketplace add <repo>` → `claude plugin install <name>@<marketplace>`. 슬래시 명령(`/plugin ...`)의 우회가 아니라 공식 문서가 "스크립팅·자동화 전용"으로 명시한 정식 경로다. 출처: code.claude.com/docs plugins-reference·plugin-marketplaces (2026-07-06 확인)
- **종료 코드를 신뢰하지 않는다**: `claude plugin` 계열의 종료 코드 의미가 공식 문서에 없음. verify는 다음 중 계획 단계 실측으로 확정 — ① `claude plugin list --json` 실행 후 내용 확인, ② `claude plugin details <name>@<marketplace>`의 성공/실패 동작, ③ `~/.claude/plugins/` 하위 경로 `path_check`(스텝 타입 첫 실사용 후보)
- 마켓플레이스 중복 추가(`marketplace add` 재실행) 시 동작도 실측 — 재설치·업데이트 흐름이 이 명령을 다시 타기 때문
- uninstall: `claude plugin uninstall <name> -y` + marketplace 항목 정리 여부 실측
- 카피: 신규 레시피 전부 기존 dry_run 전수 카피 검사(빈 문자열·em dash·이모지 금지)를 통과해야 하며, 문구는 비개발자 기준(전문용어 즉시 풀어쓰기)

## 5. 레시피 스키마 변경 (레시피 JSON 스키마 기준 유일한 변경 — 6절의 DryRunReport·CatalogEntry 확장은 앱 내부 IPC 타입이라 별개)

- `source` 선택 필드 신설: `{ "label": "만든 곳: NomaDamas", "url": "https://github.com/NomaDamas/k-skill" }` (url 선택). 카탈로그 카드에 작게 표시. schemaVersion은 1 유지(선택 필드 추가는 하위 호환)
- requires vs prerequisites 구분 기준을 이 문서로 명문화: **requires = 다른 레시피(도구 단위, 플랫폼 무관, 주로 플러그인→하네스)** / **prerequisites = 플랫폼별 공용 준비물(bun, nodejs-lts 등)**. 해석 단계에서는 병합되어 하나의 설치 순서가 된다(기존 동작 유지)

## 6. 앱 변경

### ① 마법사: 선행 설치 안내 스텝 + 체인 인증 안내
- DryRunReport의 auth를 "대상 레시피 1개"에서 **체인 내 레시피별 {인증 패턴, 안내 문구, 표시 이름} 목록**으로 확장. 프론트 타입·기존 테스트의 기계적 갱신 포함
- 마법사 시작 화면: 설치 순서에 미설치 선행 **하네스**가 포함되면 안내 카드를 먼저 보여준다 — 예: "이 도구를 쓰려면 Codex가 먼저 필요해요. ① Codex 설치하고 로그인 ② lazycodex 설치 순서로 진행할게요" + 시작 버튼 1개. 준비물(prerequisite kind)은 이름을 나열하지 않고 "준비물 포함"으로만 언급(비개발자 혼란 방지). 선행 하네스가 없으면 이 카드 없이 기존 흐름 그대로
- 진행 중: 인증 단계의 안내 카드(AuthGuidePanel)를 **지금 인증 중인 레시피의 것**으로 전환 — 체인 인증 시 안내 카드가 비는 기존 갭 해소. WizardStepper의 "준비물 설치" 고정 라벨도 실제 도구 이름 표시로 개선
- 성공 화면: 체인 설치면 "Codex와 lazycodex를 설치했어요"처럼 설치된 도구를 모두 표시

### ② Plugins.tsx 실구현
- 현재 "다음 업데이트에서 열려요" 스텁 제거. Catalog와 동일한 ToolCard 그리드 재사용, `kind === 'plugin'` 필터, catalog 갱신 리스너 재사용
- 카드에 대상 하네스 표시("Claude Code에 설치돼요") + 기존 missing_requires 배지 유지. 클릭 시 마법사로 이동(선행 설치는 ①이 담당)

### ③ 맥 전용 배지
- CatalogEntry에 지원 플랫폼 목록 추가(백엔드 계산). 현재 OS의 platforms 섹션이 없는 도구는 카드 비활성 + "지금은 맥에서만 설치돼요" 라벨 (윈도우의 insane-search가 첫 사례)

### ④ api_key 실사용 마감 (이월 백로그 5번)
- SecretForm 제출 후 "확인하는 중" 피드백 → 성공 시 다음 단계 자동 진행, 실패 시 폼 초기화 + 쉬운 말 안내 + 재입력 유도
- 키 마스킹·비보관 원칙 유지(화면·로그·진단 zip 노출 금지)

### ⑤ stderr 패턴 에러 안내 (이월 백로그, 상위 스펙 7절)
- Rust 공통 패턴 테이블: 네트워크 단절·권한 부족·PATH 미반영 + 신규 "API 키 무효/형식 오류" 패턴. 실패 시 매칭되면 맞춤 쉬운 말 안내, 미매칭이면 기존 일반 안내. 레시피 스키마로의 패턴 선언 확장은 하지 않는다(공통 테이블만)

### ⑥ 대시보드 삭제 가드
- 하네스 삭제 시 설치 목록에서 그 하네스를 requires로 참조하는 플러그인이 있으면 경고 다이얼로그: "lazycodex가 Codex를 사용하고 있어요. 삭제하면 lazycodex가 멈출 수 있어요" + 계속/취소. 차단이 아니라 경고형

## 7. 에러 처리

- 기존 단계별 재시도·롤백 체계 재사용. 플러그인 레시피도 rollback 섹션 작성(마켓플레이스 제거 등)
- `claude plugin` 종료 코드 불신 문제는 verify 단계가 최종 방어선 (4절)
- api_key 실패(키 오타·만료)는 ⑤의 패턴 매칭 + ④의 재입력 흐름으로 사용자 자력 복구 가능하게

## 8. 테스트 전략

- real_recipes.rs: 레시피 수 assert 8 → 13 갱신, 플러그인 5종 스펙 테스트(kind·requires 대상·인증 패턴·플랫폼 유무·source 표기), plan 체인 테스트 보강(플러그인→하네스→준비물 3단 순서, 선행 하네스 기설치 시 스킵)
- vitest: Plugins 화면 렌더·필터, 사전 안내 스텝 표시 조건, 레시피별 인증 카드 전환, 맥 전용 카드 상태, SecretForm 실패 재입력, 삭제 가드 다이얼로그
- 전체 게이트(M3 동일): cargo 전체 + clippy 0 + fmt + vitest + build, dry_run 전수 카피 검사 자동 적용
- 마감 스모크: 실설치 GUI 스모크 대표 2종 — lazycodex(체인+선행 안내 검증), korean-law-mcp(api_key 검증). 실설치는 사용자 확인 후 진행. 윈도우는 M6 VM 스모크로 이월

## 9. 계획 단계 라이브 검증 목록 — 실측 완료 (2026-07-06, 사용자 맥 / Claude Code 2.1.201)

1. ✔ `claude plugin` CLI: 성공 exit 0, 실패(없는 플러그인·마켓) exit 1, 중복 marketplace add는 exit 0 멱등("already on disk"), uninstall 비대화형 exit 0, `list --json`은 id·version·scope·enabled·installPath 배열. 단 종료 코드 의미는 여전히 미문서화라 verify는 `list --json` 내용 확인 병행. owner/repo 축약형은 사용자 git 설정에 따라 SSH clone을 탈 수 있어(실측) 레시피는 명시적 HTTPS `.git` URL 사용(HTTPS 형식 exit 0 실측). marketplace add는 시스템 git으로 clone — git 없는 맥 대비 stderr 힌트에 개발자 도구 패턴 포함
2. ✔ korean-law-mcp 키 주입: `claude plugin install --config api_key=<키>` 공식 옵션 확인(3.4절). npm 폴백 폐기
3. ✔ lazycodex: doctor는 진단에 FAIL이 있어도 exit 0(실측) — detect/verify 게이트로 사용 불가. 설치 산출물 `~/.local/bin/omo`(+omo-* 헬퍼, 실물 확인)를 path_check/`omo --version`으로 확인. 권장 설치 명령 `npx --yes lazycodex-ai@latest install --no-tui`(doctor 출력의 공식 remediation). `--codex-autonomous`는 Codex 동작을 바꾸는 옵션일 수 있어 채택 안 함
4. ✔ k-skill: 마켓플레이스 경로 깨짐 → skills CLI로 변경(3.3절). skills CLI 실측: add/remove 비대화형 exit 0, `-a claude-code` 에이전트 지정 유효, 없는 이름 remove 무해
5. auth 섹션 없는 plugin 레시피의 마법사 화면 흐름(인증 단계 스킵)은 구현 태스크의 vitest·수동 스모크에서 확인

## 10. 범위 제외 (백로그 유지)

- 멀티하네스 requires(anyOf)·설치 하네스 자동 감지 — v2
- WSL2 설치 안내 — v2
- 이월 백로그 중 미포함: verify의 인증 실검증(가재코드), bun detect 버전 검사, browser_login 터미널 숨김 재설계, Success 카피 불일치(가재코드), PTY UTF-8 버퍼링, Catalog listen 가드, run_logs 정리, reqwest 타임아웃, Dashboard done 이벤트 유실 — 별도 트랙
