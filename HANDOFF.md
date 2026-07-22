# HANDOFF — 이지 하네스

## 완료 (2026-07-22) — Apache-2.0 오픈소스 공개 ✅

**https://github.com/needsbuilder/easy-harness 가 public 이다.** push + `gh repo edit --visibility public` 완료, 익명 접근·라이선스 인식(Apache-2.0)·README 이미지 렌더링까지 검증함. 토픽 12종·홈페이지(easyharness.needslab.ai)·설명 설정 완료.

### 공개 직후 추가 완료 (커밋 c8f6d3c·968a9e7)
- **이슈 템플릿 2종**(`.github/ISSUE_TEMPLATE/`): `new-tool.yml`(도구 정보·설치 명령·로그인 방식을 구조화해 받아 되묻는 왕복 제거) · `bug.yml`(비개발자용 문구). `config.yml`은 보안 신고를 Security Advisory로 유도.
- **PR 템플릿**: 확인한 OS·테스트 추가 여부·5개 검사 체크박스.
- **랜딩 스타 유도**: `GITHUB_REPO`를 릴리스 레포 → **소스 레포**로 교체(스타는 소스에 쌓여야 함). Nav에 스타 개수, `OpenSource.tsx` 섹션 신규(별 주기 + 내 도구 추가하기). `useGithubStars`는 **0개면 숨긴다**(별 0은 사회적 증거 부재를 광고하는 역효과). API 미인증 60회/시간 제한에 걸려도 버튼은 그대로 보이게 실패를 삼킨다.
- 검증: 실브라우저로 데스크톱·모바일 렌더링, 가로스크롤 없음, 콘솔 에러 없음 확인.

### 소셜 프리뷰 완료
`web/public/og.png`를 레포 Settings에 업로드함. **gh CLI에는 이 API가 없어서** playwriter로 사용자 크롬에 붙어 `#repo-image-file-input`에 `setInputFiles`로 넣었다. 검증은 레포 HTML의 `og:image`가 `repository-images.githubusercontent.com/...`인지로 한다(기본값이면 `opengraph.githubassets.com`).
- 함정: 업로드 성공해도 "Upload an image to customize..." 안내 문구는 그대로 남는다. 콘솔의 503 로그도 무관한 리소스 것이라 실패로 오판하기 쉽다. **판정은 반드시 og:image로.**

### 이슈 템플릿 실측 결과
- YAML 폼은 **GraphQL `issueTemplates`에 안 잡힌다**(빈 배열). 마크다운 템플릿만 반환하므로 API로는 검증 불가 → 로그인 상태의 브라우저로 `issues/new/choose`를 봐야 한다.
- **`mailto:` contact_link는 GitHub이 렌더링하지 않는다**(실측). 메일 안내는 SECURITY.md에만 둔다.
- 보안 신고 항목은 GitHub이 "Report a security vulnerability"를 자동 제공하므로 config.yml에 또 적으면 중복이다 → 제거함.

### 아직 남은 것
- Code of Conduct 없음(CONTRIBUTING 말미 "서로에 대한 예의"로 대신 중, GitHub은 인식 못 함) · Discussions 비활성(관리 부담)

### 결정 (2026-07-22)
- **직접 수익화 안 함**. 무료·오픈소스로 인지도를 쌓아 **책·강의·해커톤**으로 수익화하는 방향(사용자 판단). 유료 기능 계획 없음 → 라이선스 분리 구조 불필요.
- **라이선스 Apache-2.0**. MIT 대신 고른 이유는 상표 조항(6조)으로 "이지 하네스" 이름 무단 재배포를 막을 근거가 생기기 때문.
- **소유는 니즈랩, 얼굴은 권용범**. NOTICE=저작권 니즈랩, README "만든 사람"=개인 서사(책·강의는 법인이 아니라 사람이 팖).
- **커밋 이메일은 `ybgwon96@gmail.com` 유지**(전역 설정 그대로). hello@needslab.ai로 바꿨다가 사용자가 되돌림. 레포 로컬 git 설정 없음.
- **히스토리 재작성 안 함**: 태그 v0.1.0~v0.1.2가 있어 SHA가 바뀌면 릴리스↔소스 대응이 깨진다. 과거 커밋 168개의 개인 지메일 노출은 감수.
- **HANDOFF·docs·CLAUDE.md 공개 그대로 둠**(사용자 결정). 홍보용 `스레드용_*.png`는 gitignore.

### 공개 전 안전 점검 완료
히스토리 4만 줄 diff 전수 스캔 → API 키·개인키·.env 커밋 이력 **없음**. 걸린 건 전부 `scan_secrets.rs`의 가짜 테스트 값. Apple Team ID·시크릿 "이름"은 노출되나 값은 아니며 서명된 앱에 이미 들어있어 비밀 아님.

### 만든 문서 (커밋 `8a7b51f`)
`LICENSE`(apache.org 원문) · `NOTICE`(상표 조항) · `README.md`(전면 개편) · `CONTRIBUTING.md` · `SECURITY.md` · package.json·Cargo.toml `license` 필드.

- **CONTRIBUTING이 핵심**: 도구 제작자가 직접 레시피를 PR하게 만드는 게 "사용자 노동 없는 성장 엔진". "JSON 한 개면 되고 Rust·React 몰라도 된다"를 앞세우고, Step 7종·치환자·인증 4패턴·문구 규칙·`real_recipes.rs` 테스트 작성법까지 적음.
- **레시피 PR = 보안 리뷰**로 취급한다고 명시(사용자 PC에서 실제 명령 실행). 서명은 관리자만 하므로 머지≠배포.

### 개인 계정으로 이전 (2026-07-22, 공개 1시간 뒤)
`needslab-ai/easy-harness` → **`needsbuilder/easy-harness`**. 사용자 판단: 목표가 개인 인지도(책·강의)인데 조직 소유면 URL·프로필 노출이 안 잡힌다.
- **조직 레포여도 잔디는 이미 심기고 있었다**(개인 기여 175회 집계 확인). 차이는 ① URL에 계정명 ② 프로필 Repositories 탭 ③ 스타 받은 레포의 주인 ④ 검색 노출.
- 이전 비용 0이었던 이유: 스타 0·다운로드 0·홍보 전이었고, **GitHub이 시크릿 9종을 그대로 이전**하며(공식 문서 확인) 옛 URL도 자동 리다이렉트한다.
- **주의: `needslab-ai`에 다시 `easy-harness` 이름으로 레포를 만들면 리다이렉트가 영구 삭제된다.** 만들지 말 것.
- 저작권은 그대로 니즈랩(NOTICE·LICENSE가 정한다. 레포 위치와 무관).
- `-releases`·`-recipes`는 아직 조직 소유 → 아래 "레포 통합"에서 함께 정리.

### 레포 통합 (다음 작업, v0.1.3과 묶기)
**레포를 3개로 나눈 유일한 이유는 "소스가 private"이었다**(M5 설계 문서 확인). 오늘 public이 됐으니 명분이 사라졌다. 지금 다운로드 실적이 0회라(v0.1.2 dmg·exe 모두 0) 주소를 바꿔도 끊길 사용자가 없다. **사용자가 생기면 못 옮긴다** — 업데이트 주소가 배포된 앱 안에 박히기 때문.
1. 레시피 번들을 소스 레포로 옮기고 `recipe/remote.rs`의 `REMOTE_BASE` 수정
2. `release.yml`이 소스 레포에 릴리스하도록 변경 → **`RELEASES_PAT` 시크릿 불필요해짐**
3. `tauri.conf.json` updater endpoints, `web/src/lib/releases.ts` 주소 변경
4. 옛 레포 2개는 **삭제 말고 아카이브**

### 공개 후 남은 것
- **Apple Developer가 Individual(개인) 명의** → 서명이 `YONG BEOM GWON`으로 나감. 지금 문제는 없으나 법인·팀 계정 전환 시 재서명 필요(사용자 인지함).
- 인지도→수익 전환 장치 3종이 아직 **없음**(사용자에게 지적한 상태): ① 설치 성공 화면에서 다음 단계로 보내는 통로 ② 이메일 명단(개인정보처리방침에 수집 항목 추가 필요) ③ 제품에 드러난 개인 브랜드.

---

## 완료 (2026-07-22) — 랜딩 정식 주소 확정
`easyharness.needslab.ai`를 정식(canonical) 주소로 확정하고 배포·검증까지 끝. 커밋 `2a8ff9f`.

- **easyharness.com은 구매 불가**: 2018년 등록(호주), 만료 2026-08-14, 빈 페이지 상태. 8년째 미사용이라 **9월 말~10월에 드롭 여부 재확인 가치 있음**. 대안 미등록: easy-harness.com(~$20/년)·easyharness.co·.io·.kr.
- **vercel.json**: `.vercel.app` → needslab.ai 308 영구 이동. **루트(`/`)는 `:path*`가 빈 경로를 안 잡아 규칙을 따로 둬야 한다**(첫 배포에서 홈만 리다이렉트 누락돼 재배포함). `type: "host"`는 openapi.vercel.sh/vercel.json 스키마로 검증한 정식 문법.
- **og.png가 아예 없어서 카톡·슬랙 공유 썸네일이 안 뜨고 있었다**. SPA rewrite 탓에 없는 파일도 200(text/html)으로 나와 그동안 안 드러남. demo-poster.png를 1200x630으로 크롭해 생성. 같은 이유로 robots.txt·sitemap.xml도 없었음 → 추가.
- 검증: `.vercel.app`의 `/`·`/terms`·`/privacy`·`/og.png` 전부 308 → 정식 주소 200. og.png가 `image/png`로 정상 서빙.
- 배포는 여전히 git 연동 아님 → **`vercel deploy --prod --cwd web`**.

---

## 백로그 (별개, 보류 중)
- **앱 v0.1.3 릴리스 보류**("다 정리하고 한 번에". 배포된 앱은 v0.1.2). 절차·함정은 CLAUDE.md "릴리스 절차 (M5)". 오픈소스 공개와 함께 정리하기로 한 건이므로 공개 직후 재검토.
- **M6 윈도우 트랙 완료**: PR #2·#3·#4 머지. 잔여(선택): codex·claude-code `.local\bin` PATH 윈도우 실기 확인.
- **카탈로그 "실제 설치 감지" 보류**(2026-07-08 Agent Teams 검토): 삭제 안전장치(Dashboard.tsx 경고가 catalog.installed 의존) 훼손·이름충돌 오탐(hermes)·타임아웃 전무 리스크. 재착수 시 "스캔 버튼식+하드 타임아웃(fail-open)+installed.json 불변+stdout 검증".
- 약관은 "명백한 리스크"만 보완한 초안. 유료화·규모 확대 시 변호사 정식 검토 권고(사용자 인지함).

## 인프라 (재사용)
- 레포 3종: **`needsbuilder/easy-harness`**(소스, public, Apache-2.0) · `needslab-ai/easy-harness-releases`(public 배포) · `needslab-ai/easy-harness-recipes`(public 번들). 뒤 둘은 통합 예정.
- GitHub 개인 계정 `needsbuilder`(Yongbeom Gwon), 조직 `needslab-ai`. 커밋 이메일은 전역 지메일.
- Apple: Team RB6FTGW2DK(Individual), 로컬 키 ~/.tauri/. GitHub 시크릿 9종 등록.
- 랜딩: Vercel 프로젝트 `needslab/easyharness`, 정식 주소 easyharness.needslab.ai, DNS는 Vercel(ns1/ns2.vercel-dns.com).
