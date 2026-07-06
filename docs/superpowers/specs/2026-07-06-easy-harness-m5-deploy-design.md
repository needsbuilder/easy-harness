# 이지 하네스 M5 — 서명·배포 파이프라인 + 자동 업데이트 설계

- 날짜: 2026-07-06
- 상태: 사용자 설계 승인 완료 (섹션별 승인), 스펙 리뷰 대기
- 상위 스펙: docs/superpowers/specs/2026-07-05-easy-harness-design.md §11 (배포·서명·업데이트)
- 이전 마일스톤: docs/superpowers/specs/2026-07-06-easy-harness-m4-plugin-recipes-design.md

## 1. 개요와 목표

M5는 이지 하네스를 "형 맥에서만 도는 개발 빌드"에서 "일반 사용자가 내려받아 설치하고, 이후 자동으로 갱신되는 배포 제품"으로 만든다. 범위는 ① GitHub 저장소 3종 구성 ② 릴리스 파이프라인(빌드+맥 서명·공증+시크릿 스캔+릴리스) ③ 앱 자동 업데이트(tauri-plugin-updater) ④ 대시보드 실버전 표시 ⑤ 레시피 verify 인증 실검증 강화.

## 2. 확정 결정 사항 (2026-07-06 사용자 확정)

1. **코드 비공개 + 공개 릴리스 레포**: 소스는 private, 배포 산출물만 별도 public 레포. (public→private 전환은 업데이트 주소가 깨져 불가역이므로 private 시작이 안전한 방향)
2. **Apple**: 사용자가 이미 보유한 유료 Apple Developer 계정 사용. 가입 절차 생략, Developer ID Application 인증서 발급부터. 계정 유형(Individual/Organization)·Team ID는 구현 시 확인. Individual이면 설치 화면에 개인 실명 표시됨을 인지하고 진행.
3. **윈도우 코드 서명 보류**: M5는 서명 없는 NSIS 빌드 + CI에 조건부 서명 자리만 마련. 인증서 구매는 윈도우 배포 실시작(M6 이후) 때 재검토. 근거: Azure Artifact Signing 한국 가입 불가, EV도 SmartScreen 즉시 신뢰 폐지(2024-03), 윈도우 레시피 검증 자체가 M6.
4. **파이프라인 A안**: 공식 tauri-apps/tauri-action@v1로 빌드→서명→공증→latest.json→릴리스를 일괄 처리. 수동 조립(B)·로컬 빌드(C)는 기각.
5. **시크릿 스캔**: 릴리스 산출물 검사로 확정(기존 2026-07-06 결정 재확인). 걸리면 릴리스 실패. 커밋 단계 훅은 하지 않음.
6. **배포 게이트**: 파이프라인은 draft 릴리스까지만. 사용자가 GitHub에서 발행(Publish)해야 실배포. GitHub `releases/latest` 별칭이 draft·prerelease를 건너뛰므로 발행 버튼이 배포 스위치가 된다.

## 3. 리서치 근거 요약 (2026-07-06 웹 검증, sonnet 에이전트 4종)

- **tauri-plugin-updater 2.10.1** (crates.io/npm, 2026-04-04) · Tauri 2.x가 현행 안정 버전(3.0은 기획 단계). 서명 검증은 끌 수 없는 필수 기능. — https://v2.tauri.app/plugin/updater/
- **tauri-action v1.0.0** (2026-06-29): Tauri 2 stable 전용, `uploadUpdaterJson`으로 latest.json 자동 생성, `owner`/`repo` 입력으로 다른 레포에 릴리스 가능. ⚠️ v1부터 latest.json이 브라우저 다운로드 URL 대신 GitHub API URL을 씀 → 구현 시 비인증 다운로드·rate limit 실검증 필요(§14). — https://github.com/tauri-apps/tauri-action/releases
- **맥 서명·공증**: Developer ID Application 인증서(.p12) + notarytool. CI 환경변수: `APPLE_CERTIFICATE`, `APPLE_CERTIFICATE_PASSWORD`, `KEYCHAIN_PASSWORD` + 공증은 App Store Connect API 키(`APPLE_API_ISSUER`/`APPLE_API_KEY`/`APPLE_API_KEY_PATH`) 방식 채택. — https://v2.tauri.app/distribute/sign/macos/
- **윈도우 서명 시장**: Azure Trusted Signing은 "Artifact Signing"으로 개명(2026-01 GA), 미국·캐나다·EU·영국 한정이라 한국 불가. 대안 SSL.com IV($129/년+eSigner $180/년), Certum(€139~209), 한국전자인증 OV(34만원/년, USB 토큰이라 CI 부적합). 2026-03-01부터 인증서 최대 유효기간 460일. EV의 SmartScreen 즉시 신뢰는 2024-03 폐지. — https://learn.microsoft.com/en-us/azure/artifact-signing/faq
- **GitHub Actions 비용**: private 레포 맥 러너는 무료 분수에서 약 10배 차감(macOS 표준 $0.062/분). Free 플랜 무료 2,000분/월 → 맥 실질 약 200분/월. public 레포는 무료 무제한. — https://docs.github.com/en/billing/reference/actions-runner-pricing
- **private 릴리스 자산은 비인증 다운로드 불가** → 별도 public releases 레포 패턴이 표준 해법. — https://github.com/orgs/tauri-apps/discussions/7553

## 4. 저장소·키 구성

| 레포 (needslab-ai 조직) | 공개 | 역할 |
|---|---|---|
| `easy-harness` | private | 소스 + ci.yml(테스트) + release.yml(릴리스 파이프라인) |
| `easy-harness-releases` | public | 배포 전용. 릴리스 자산(.dmg, setup.exe, .app.tar.gz, latest.json)만. README에 다운로드 안내 |
| `easy-harness-recipes` | public | 서명된 레시피 번들. `recipe/remote.rs`의 REMOTE_BASE가 이미 이 주소 참조. 현재 번들(recipes-bundle.json + .sig) 게시 |

GitHub 시크릿 (easy-harness 레포):

| 시크릿 | 용도 |
|---|---|
| `APPLE_CERTIFICATE` / `APPLE_CERTIFICATE_PASSWORD` | Developer ID Application .p12 (base64) / 내보내기 암호 |
| `KEYCHAIN_PASSWORD` | CI 임시 키체인 암호 (임의 값) |
| `APPLE_API_ISSUER` / `APPLE_API_KEY` / `APPLE_API_KEY_PATH` | 공증용 App Store Connect API 키 (.p8) |
| `TAURI_SIGNING_PRIVATE_KEY` / `..._PASSWORD` | 업데이트 서명 개인키 (`tauri signer generate`로 신규 생성) |
| `RELEASES_PAT` | easy-harness-releases에 릴리스 쓰기 권한 있는 fine-grained PAT (기본 GITHUB_TOKEN은 타 레포 불가) |
| (예약) `WINDOWS_SIGN_*` | 윈도우 서명 도입 시. M5는 미등록 |

키 3종 구분: ① Apple 인증서(맥 Gatekeeper 신뢰) ② Tauri 업데이트 키(업데이트 파일 위·변조 방지, 앱에 공개키 내장) ③ 레시피 서명키(기존, ed25519). 개인키 원본은 전부 Dashlane 보안 메모 백업(레시피 키와 동일 규칙).

## 5. 릴리스 파이프라인 (release.yml)

- 트리거: `v*` 태그 push. 첫 스텝에서 태그 버전과 `src-tauri/tauri.conf.json`의 `version` 일치 검사, 다르면 즉시 실패 (버전의 단일 진실 원천 = tauri.conf.json).
- 매트릭스: `macos-latest --target aarch64-apple-darwin` / `macos-latest --target x86_64-apple-darwin` / `windows-latest`.
- 각 러너: tauri-apps/tauri-action@v1 → 빌드 → (맥) 서명+공증 → 업데이터 아티팩트(.app.tar.gz+.sig, .exe .sig) 생성(`createUpdaterArtifacts: true`).
- **시크릿 스캔 스텝(§9)이 업로드 전에 산출물 검사, 검출 시 잡 실패.**
- 릴리스 대상: `owner: needslab-ai, repo: easy-harness-releases`, `RELEASES_PAT` 사용, `releaseDraft: true`, `uploadUpdaterJson` 활성. latest.json은 tauri-action이 자동 생성.
- 윈도우 서명: `WINDOWS_SIGN_*` 시크릿이 존재할 때만 실행되는 조건부 스텝(내용은 도입 시 작성). M5에서는 항상 건너뜀.
- 기존 ci.yml: `concurrency`(진행 중 중복 실행 취소) 추가로 맥 러너 분 절약. 트리거는 현행 유지.

## 6. 자동 업데이트 (앱)

- 의존성: `tauri-plugin-updater`(2.10.x) + `tauri-plugin-process`(재시작용). capabilities에 `updater:default`, `process:default` 추가. lib.rs에 데스크톱 전용으로 플러그인 등록.
- tauri.conf.json: `bundle.createUpdaterArtifacts: true`, `plugins.updater.pubkey`(신규 생성 공개키 내용), `plugins.updater.endpoints: ["https://github.com/needslab-ai/easy-harness-releases/releases/latest/download/latest.json"]`, `plugins.updater.windows.installMode: "passive"`.
- 확인 시점: 앱 시작 시 1회 백그라운드 `check()`. 실패(오프라인 포함)는 조용히 무시하고 UI에 아무것도 띄우지 않는다.
- UI 흐름 (Dashboard.tsx의 기존 배너 자리 사용):
  1. 업데이트 있음 → 금색 배너 "이지 하네스 새 버전이 나왔어요. 1분이면 끝나요." + [지금 업데이트]
  2. 클릭 → `downloadAndInstall(진행 콜백)` → 버튼이 진행률로 전환: "받는 중이에요 42%"
  3. 완료 → `relaunch()`로 자동 재시작 (윈도우는 인스톨러가 앱을 강제 종료하는 플랫폼 동작 있음, 카피에서 "앱이 잠시 꺼졌다 켜져요"로 예고)
  4. 실패 → 배너 카피 교체: "업데이트를 받지 못했어요. 다음에 다시 시도할게요." 앱은 그대로 사용 가능.
- 안전성: 업데이트 파일은 내장 공개키로 서명 검증을 통과해야만 설치됨(플러그인 필수 동작, 비활성화 불가).
- 신규 카피는 design/design-system.md 카피 규칙(쉬운 한국어, em dash 금지, humanize 검수)을 따른다.

## 7. 대시보드 실버전 표시

- `state.rs`의 `Installation.version`(현재 항상 None)을 채운다: 설치·업데이트 플로우 성공 직후 probe(기존 버전 스캔 모듈)를 해당 도구에 대해 1회 실행해 버전 문자열 저장.
- 표시 규칙(v? 정직화 원칙 유지): 버전 있으면 "설치됨 · v4.15.1 · 2026년 7월 6일에 설치했어요", 버전을 못 읽는 도구는 현행(날짜만). 거짓 버전 표시 금지.
- IPC 영향: `Installation` 구조는 그대로(version 필드 기존재), 백엔드 채움 로직 + Dashboard/ToolCard 표시 분기만. types.ts는 이미 미러 존재.

## 8. verify 인증 실검증 강화

- 현황: 13개 레시피 중 claude-code만 인증을 실검증(`claude -p '안녕...'`). 나머지는 check_command(존재 확인)뿐이라 브라우저 로그인·API 키 실패를 놓친다(실설치 스모크 발견 2 연계).
- 메커니즘: **스키마 변경 없음.** 기존 run_command 스텝으로 각 도구의 인증 상태 확인 명령을 verify 섹션에 추가 (claude-code가 검증한 패턴 재사용).
- 범위: 구현 계획 단계에서 도구별 확인 명령 존재 여부를 라이브 조사(codex·hermes·openclaw·opencode·korean-law-mcp 등 인증 있는 도구 우선). **확인 명령이 실존하는 도구만 강화, 없으면 현행 유지(거짓 검증 금지).** 종료 코드를 못 믿는 도구는 korean-law 방식대로 출력 내용 검사.
- 레시피 수정 시 tests/real_recipes.rs 스펙 테스트 갱신 필수(레시피 오타 안전망).
- 효과: 백로그 "--config 키 미저장"류 결함이 최소한 verify 단계에서 탐지됨(근본 해결은 범위 밖 §13).

## 9. 시크릿 스캔 (scan_secrets)

- `src-tauri/src/bin/scan_secrets.rs` (개발·CI 전용 cargo bin, 앱 번들 미포함. sign_recipes와 동일 위상).
- 입력: 산출물 경로들(맥 .app 내용물/.dmg 추출물, 윈도우 setup.exe, 업데이터 tar.gz). 바이너리·리소스를 순회하며 패턴 검사.
- 패턴(초기 세트): Tauri/rsign 개인키 마커("untrusted comment: rsign encrypted secret key"), 레시피 ed25519 개인키, `-----BEGIN ... PRIVATE KEY-----`, App Store Connect .p8 마커, `sk-ant-`·`AKIA` 류 API 키, GitHub PAT(`github_pat_`, `ghp_`). 공개키(RECIPE_PUBKEY_B64, updater pubkey)는 정상 포함이므로 허용 목록으로 오탐 방지.
- 검출 시 exit 1 + 어떤 파일 어느 패턴인지 리포트 → release.yml에서 업로드 전 실행되어 릴리스 실패.
- 단위 테스트로 패턴 검출·허용 목록을 검증(맥·윈도우 러너 공통 동작).

## 10. 에러 처리

- 업데이터: "조용한 실패" 원칙(확인 실패 무음, 다운로드 실패는 배너 안내 후 정상 사용). 서명 불일치 파일은 플러그인이 설치 자체를 거부.
- 파이프라인: 태그·버전 불일치 즉시 실패 / 공증 실패 시 잡 실패(원인은 notarytool 로그) / 시크릿 스캔 검출 시 실패. 모두 draft 이전 단계라 사용자 영향 없음.
- 시크릿 스캔 오탐: 허용 목록으로 관리, 오탐으로 릴리스가 막히면 패턴을 좁히되 검사 자체는 끄지 않는다.

## 11. 테스트 전략

- vitest: 업데이트 배너 상태 전환(없음→있음→받는 중→실패→재시도 가능), Dashboard/ToolCard 버전 표시 분기. 플러그인 JS API는 목으로.
- cargo: scan_secrets 패턴·허용 목록 단위 테스트, probe 버전 채움·installed.json 저장 로직, real_recipes verify 스펙 갱신.
- 실검증(스모크): §12 완료 기준 1~3. 업데이트 관통은 실릴리스 2개(v0.1.0→v0.1.1)로 확인.

## 12. 완료 기준

1. 사용자 맥에서 배포용 .dmg를 내려받아 더블클릭 설치 → 보안 경고 없이 실행 (서명+공증 유효).
2. 구버전 설치 상태에서 새 버전 발행 → 대시보드 배너 → 클릭 1회로 업데이트 완료·재시작 (실릴리스 2개로 검증).
3. 시크릿 스캔이 가짜 키를 심은 빌드를 실제로 실패시킴(의도적 1회 주입 테스트).
4. 기존 게이트 전부 GREEN: cargo test · clippy -D warnings · fmt · vitest · bun run build.

## 13. 범위 제외 (백로그 유지)

- 윈도우 인증서 구매·실서명 (조건부 자리만) · 윈도우 레시피 실검증(M6)
- 다운로드 랜딩 페이지(웹) · 법인 전환·Organization 계정 전환
- `--config` 키 미저장의 근본 해결(§8은 탐지까지만) · PTY UTF-8 버퍼링 등 기존 백로그

## 14. 구현·계획 단계 라이브 확인 목록

1. 사용자 Apple 계정 유형·Team ID, App Store Connect API 키 발급 권한
2. needslab-ai GitHub 조직 존재 여부(없으면 생성), gh CLI 인증 계정·요금제(무료 분수 한도)
3. tauri-action v1 latest.json의 GitHub API URL이 public 레포에서 비인증 다운로드 되는지 + rate limit(60회/시/IP)가 업데이트 확인에 실질 문제인지 → 문제면 latest.json URL 재작성 스텝 추가
4. 도구별 인증 상태 확인 명령 실존 여부(§8)
5. tauri dev가 남기는 target/debug/recipes 잔재가 릴리스 번들 리소스에 섞이지 않는지(릴리스 빌드 경로 확인)
