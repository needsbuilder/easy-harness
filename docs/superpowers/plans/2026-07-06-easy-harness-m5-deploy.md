# 이지 하네스 M5 — 서명·배포 파이프라인 + 자동 업데이트 구현 계획

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 이지 하네스를 서명·공증된 .dmg로 배포하고, GitHub Releases 기반 자동 업데이트·대시보드 실버전·verify 인증 실검증·산출물 시크릿 스캔까지 완성한다.

**Architecture:** 코드는 private `needslab-ai/easy-harness`, 배포 산출물은 public `easy-harness-releases`(tauri-action@v1이 draft 릴리스+latest.json 생성, 사용자 발행이 배포 스위치), 레시피 번들은 public `easy-harness-recipes`. 앱은 tauri-plugin-updater로 시작 시 1회 조용히 확인하고 대시보드 배너에서 원클릭 업데이트한다.

**Tech Stack:** Tauri 2 (Rust) · tauri-plugin-updater 2.10.x · tauri-plugin-process 2 · tauri-apps/tauri-action@v1 · GitHub Actions (macos/windows 러너) · React 19 + vitest · bun

**스펙:** docs/superpowers/specs/2026-07-06-easy-harness-m5-deploy-design.md

## Global Constraints

- 패키지 매니저 bun. 게이트 5종: `cargo fmt --check` · `cargo clippy -- -D warnings` · `cargo test` · `bun run test` · `bun run build` (전부 src-tauri 또는 루트에서)
- UI·레시피 friendly 카피: 쉬운 한국어 "~하고 있어요" 톤, **em dash(—) 금지**, design/design-system.md 카피 규칙 준수
- 레시피 JSON은 `deny_unknown_fields`지만 Step variant 내부 오타는 serde가 조용히 무시 → **레시피 수정 시 tests/real_recipes.rs 스펙 테스트 갱신 필수**
- 조직·레포: `needslab-ai` / `easy-harness`(private) · `easy-harness-releases`(public) · `easy-harness-recipes`(public). REMOTE_BASE(recipe/remote.rs)가 easy-harness-recipes를 이미 참조
- Apple 서명 identity(실측): `Developer ID Application: YONG BEOM GWON (RB6FTGW2DK)` — 키체인에 기존재, 신규 발급 불필요
- 개인키·PAT·인증서는 절대 커밋 금지. GitHub 시크릿 + Dashlane 보안 메모 백업
- 작업 브랜치: `feat/m5-deploy` (main에서 분기). Task 1~3은 레포 밖 인프라 작업 포함
- 커밋 메시지는 한국어, 프리픽스 feat:/fix:/chore:/docs: (기존 컨벤션)

## 계획 단계 실측 결과 (2026-07-06, 이 맥에서 확인 완료)

1. **Developer ID Application 인증서 기존재** (`security find-identity -v -p codesigning`): Team ID `RB6FTGW2DK`, Individual 계정. → 인증서 .p12 내보내기만 필요
2. **gh CLI**: `needsbuilder` 계정 활성(repo·workflow 스코프). `needslab-ai` 조직은 404 → 웹에서 생성 필요(조직 생성은 API 미지원)
3. **인증 실검증 명령 실측**: `codex login status` → "Logged in using ChatGPT" ✓ / `opencode auth list` → 자격증명 나열(exit 0) ✓ / `openclaw models status --json` → `"missingProvidersInUse": []`로 판정 가능 ✓ / hermes는 `hermes auth status <provider>` 실존하나 Nous Portal 로그인과의 provider id 매핑 미확인 → Task 9에서 후보 조사 후 안 되면 현행 유지
4. **tauri-action v1의 latest.json은 GitHub API 자산 URL** (`api.github.com/repos/.../releases/assets/<id>`, src/upload-version-json.ts L97에서 확인). public 레포는 비인증 다운로드가 되지만 업데이터 실동작은 Task 13 스모크로 확정, 실패 시 같은 태스크의 폴백 스크립트 적용
5. **번들 형식**: `{"bundleVersion": <u64>, "recipes": [<레시피 JSON>...]}` (loader.rs `from_bundle`)
6. **스펙 §5 미세 조정**: tauri-action은 빌드와 draft 업로드가 한 액션이라 시크릿 스캔을 "업로드 전"이 아닌 **"draft 업로드 후·발행 전"**에 실행한다. 발행 게이트(사용자 클릭) 앞이므로 안전성 동일. 스캔 실패 시 잡이 실패하고 draft는 발행 금지·삭제 안내

---

### Task 1: GitHub 조직·레포 3종 생성 + 코드 push

**Files:**
- Modify: `.superpowers/sdd/progress.md` (M5 레저로 초기화)

**Interfaces:**
- Produces: 리모트 `origin` = `https://github.com/needslab-ai/easy-harness.git`, 빈 public 레포 2개(easy-harness-releases, easy-harness-recipes). 이후 모든 태스크가 이 리모트를 전제

- [ ] **Step 1: needslab-ai 조직 생성 (사용자 개입)**

조직 생성은 GitHub API로 불가(웹 전용). 사용자에게 안내하거나 브라우저 스킬로 보조:
https://github.com/account/organizations/new?plan=free 에서 조직 이름 `needslab-ai`, 무료 플랜, 소속 계정 `needsbuilder`.
확인: `gh api /orgs/needslab-ai --jq .login` → `needslab-ai`

- [ ] **Step 2: 레포 3개 생성**

```bash
gh repo create needslab-ai/easy-harness --private --description "이지 하네스: 클릭 몇 번으로 AI 코딩 도구 설치"
gh repo create needslab-ai/easy-harness-releases --public --description "이지 하네스 공식 배포 파일"
gh repo create needslab-ai/easy-harness-recipes --public --description "이지 하네스 레시피 번들 (서명 검증됨)"
```
Expected: 각각 "Created repository". 실패 시(권한) `gh auth refresh -h github.com -s repo` 후 재시도.

- [ ] **Step 3: 코드 push + 레저 초기화**

```bash
cd /Users/ai-code-lab/projects/easy-harness
git remote add origin https://github.com/needslab-ai/easy-harness.git
git push -u origin main
```
`.superpowers/sdd/progress.md`를 M5 헤더로 초기화(M4 내용은 이미 아카이브 관례 유지: progress-m4-archive.md로 이동):
```markdown
# M5 서명·배포 파이프라인 + 자동 업데이트 — SDD 진행 레저
- 계획: docs/superpowers/plans/2026-07-06-easy-harness-m5-deploy.md
- 브랜치: feat/m5-deploy
```

- [ ] **Step 4: 확인 + 커밋**

```bash
git ls-remote origin main | head -1   # 커밋 해시 나오면 성공
git checkout -b feat/m5-deploy
git add .superpowers/sdd/ && git commit -m "chore: M5 SDD 레저 초기화 (M4 아카이브)"
```

---

### Task 2: 레시피 번들 빌드 스크립트 + easy-harness-recipes 게시

**Files:**
- Create: `scripts/build_recipes_bundle.sh`
- Test: `src-tauri/tests/real_recipes.rs` (번들 조립 라운드트립 테스트 추가)

**Interfaces:**
- Consumes: 기존 `sign_recipes` bin(`cargo run --bin sign_recipes -- sign <bundle.json> <secret.key>`), `Catalog::from_bundle(&str) -> Result<(u64, Catalog)>`
- Produces: `src-tauri/recipes-bundle.json`(+`.sig`) 생성 절차, 원격 레시피 채널 가동

- [ ] **Step 1: 실패하는 테스트 작성** — tests/real_recipes.rs에 추가:

```rust
#[test]
fn bundle_built_from_recipes_dir_parses() {
    // scripts/build_recipes_bundle.sh와 같은 조립 방식이 유효함을 보증
    let dir = easy_harness_lib::recipe::loader::Catalog::bundled_dir();
    let mut recipes: Vec<serde_json::Value> = Vec::new();
    let mut names: Vec<_> = std::fs::read_dir(&dir)
        .unwrap()
        .map(|e| e.unwrap().path())
        .filter(|p| p.extension().is_some_and(|e| e == "json"))
        .collect();
    names.sort();
    for p in names {
        recipes.push(serde_json::from_str(&std::fs::read_to_string(p).unwrap()).unwrap());
    }
    let bundle = serde_json::json!({ "bundleVersion": 1, "recipes": recipes }).to_string();
    let (v, cat) = Catalog::from_bundle(&bundle).expect("조립한 번들이 파싱돼야 함");
    assert_eq!(v, 1);
    assert!(cat.get("claude-code").is_some());
}
```
(serde_json이 dev-dependencies에 없으면 이미 dependencies에 있으므로 그대로 사용 가능)

- [ ] **Step 2: 실행해 통과 확인** (조립 로직은 기존 코드라 이 테스트는 바로 GREEN이어야 정상. RED면 번들 필드명이 다른 것이므로 loader.rs의 BundleFile 정의를 먼저 확인)

```bash
cd src-tauri && cargo test bundle_built_from_recipes_dir_parses
```
Expected: PASS

- [ ] **Step 3: 스크립트 작성** — `scripts/build_recipes_bundle.sh`:

```bash
#!/usr/bin/env bash
set -euo pipefail
# 사용법: scripts/build_recipes_bundle.sh <bundleVersion> <개인키 경로>
# 개인키는 Dashlane 보안 메모에서 복원(개행 제거 44자). 절대 커밋 금지.
[ $# -eq 2 ] || { echo "사용법: $0 <bundleVersion> <개인키 경로>" >&2; exit 1; }
cd "$(dirname "$0")/../src-tauri"
jq -n --argjson v "$1" '{bundleVersion: $v, recipes: [inputs]}' recipes/*.json > recipes-bundle.json
cargo run --bin sign_recipes -- sign recipes-bundle.json "$2"
echo "생성 완료: src-tauri/recipes-bundle.json(.sig)"
echo "게시: easy-harness-recipes 레포 루트에 두 파일을 커밋·푸시하세요"
```
`chmod +x scripts/build_recipes_bundle.sh`. `.gitignore`에 `src-tauri/recipes-bundle.json*` 추가(생성물 커밋 방지).

- [ ] **Step 4: 번들 생성·게시** (개인키는 Dashlane에서 복원, 임시 파일은 스크래치 디렉터리에 두고 사용 후 삭제)

```bash
scripts/build_recipes_bundle.sh 1 <복원한 개인키 경로>
git clone https://github.com/needslab-ai/easy-harness-recipes.git /tmp/ehr
cp src-tauri/recipes-bundle.json src-tauri/recipes-bundle.json.sig /tmp/ehr/
cd /tmp/ehr && git add -A && git commit -m "chore: 레시피 번들 v1 게시" && git push
```

- [ ] **Step 5: 원격 수신 실검증** — 앱을 한 번 띄워 캐시 생성 확인:

```bash
cd /Users/ai-code-lab/projects/easy-harness && bun run tauri dev  # 잠깐 띄웠다 종료
ls "$HOME/Library/Application Support/ai.needslab.easyharness/" | grep recipes-bundle
```
Expected: `recipes-bundle.json`, `recipes-bundle.json.sig` (서명 검증 통과 후 캐시됨)

- [ ] **Step 6: 커밋**

```bash
git add scripts/build_recipes_bundle.sh .gitignore src-tauri/tests/real_recipes.rs
git commit -m "feat: 레시피 번들 빌드 스크립트 + 조립 라운드트립 테스트, 원격 레시피 채널 가동"
```

---

### Task 3: 서명 재료 준비 (업데이트 키·Apple .p12·공증 API 키·GitHub 시크릿)

**Files:** 없음 (레포 밖 작업. 산출물은 GitHub 시크릿 + Dashlane)

**Interfaces:**
- Produces: GitHub 시크릿 9종(easy-harness 레포): `APPLE_CERTIFICATE`, `APPLE_CERTIFICATE_PASSWORD`, `KEYCHAIN_PASSWORD`, `APPLE_API_ISSUER`, `APPLE_API_KEY`, `APPLE_API_KEY_P8`, `TAURI_SIGNING_PRIVATE_KEY`, `TAURI_SIGNING_PRIVATE_KEY_PASSWORD`, `RELEASES_PAT`. 그리고 **업데이터 공개키 문자열**(Task 5의 tauri.conf.json `pubkey`에 붙여넣음)
- 주의: 스펙 §4의 `APPLE_API_KEY_PATH`는 시크릿이 아니라 러너에서 .p8을 파일로 복원한 경로다(release.yml이 `APPLE_API_KEY_P8` 내용으로 파일을 만들고 경로를 env로 노출)

- [ ] **Step 1: 업데이트 서명키 생성**

```bash
cd /Users/ai-code-lab/projects/easy-harness
bunx tauri signer generate -w "$HOME/.tauri/easy-harness-updater.key"
```
비밀번호를 물으면 생성해 입력(빈 값 금지). 출력된 **공개키 문자열을 기록**(Task 5에서 사용).

- [ ] **Step 2: 시크릿 등록 + Dashlane 백업**

```bash
gh secret set TAURI_SIGNING_PRIVATE_KEY --repo needslab-ai/easy-harness < "$HOME/.tauri/easy-harness-updater.key"
gh secret set TAURI_SIGNING_PRIVATE_KEY_PASSWORD --repo needslab-ai/easy-harness  # 프롬프트에 비밀번호 입력
openssl rand -hex 16 | gh secret set KEYCHAIN_PASSWORD --repo needslab-ai/easy-harness
```
Dashlane 백업(개인키 내용+비밀번호): dcli는 읽기 전용이므로 사용자에게 확장으로 보안 메모 추가를 안내(전역 지침의 Dashlane 절차).

- [ ] **Step 3: Apple 인증서 .p12 내보내기 (사용자 개입 가능성)**

키체인 접근 앱 → 로그인 키체인 → 내 인증서 → "Developer ID Application: YONG BEOM GWON" 펼쳐 개인키 포함 선택 → 내보내기 → .p12 + 암호 설정. (CLI `security export`는 전체 identity를 묶어 내보내므로 GUI 권장)
```bash
base64 -i /path/to/DeveloperID.p12 | gh secret set APPLE_CERTIFICATE --repo needslab-ai/easy-harness
gh secret set APPLE_CERTIFICATE_PASSWORD --repo needslab-ai/easy-harness  # .p12 암호 입력
```

- [ ] **Step 4: App Store Connect API 키 발급 (사용자 로그인 필요)**

https://appstoreconnect.apple.com → 사용자 및 액세스 → 통합(Integrations) → 키 생성(역할 Developer) → Key ID·Issuer ID 확인, .p8 다운로드(1회만 가능).
```bash
gh secret set APPLE_API_ISSUER --repo needslab-ai/easy-harness   # Issuer ID
gh secret set APPLE_API_KEY --repo needslab-ai/easy-harness      # Key ID
gh secret set APPLE_API_KEY_P8 --repo needslab-ai/easy-harness < /path/to/AuthKey_XXXX.p8
```
.p8도 Dashlane 백업 안내 후 로컬 사본 삭제.

- [ ] **Step 5: RELEASES_PAT 발급 (사용자 브라우저 작업)**

https://github.com/settings/personal-access-tokens/new → Resource owner `needslab-ai` → Only select repositories `easy-harness-releases` → Permissions: Contents Read/Write → 만료 1년.
```bash
gh secret set RELEASES_PAT --repo needslab-ai/easy-harness  # 발급된 토큰 입력
```

- [ ] **Step 6: 등록 확인**

```bash
gh secret list --repo needslab-ai/easy-harness
```
Expected: 위 9종 전부 표시.

---

### Task 4: scan_secrets bin (산출물 시크릿 스캔)

**Files:**
- Create: `src-tauri/src/bin/scan_secrets.rs`
- Modify: `src-tauri/Cargo.toml` (bin 등록이 자동이 아니면 `[[bin]]` 추가. sign_recipes 선례 확인)

**Interfaces:**
- Produces: CLI `cargo run --bin scan_secrets -- <경로...>` — 경로(파일/디렉터리 재귀)를 검사, 시크릿 패턴 발견 시 "발견: <패턴> → <경로>" 출력 후 exit 1, 없으면 "시크릿 스캔 통과: 파일 N개" 후 exit 0. Task 10의 release.yml과 Task 12의 주입 실증이 이 CLI를 그대로 호출

- [ ] **Step 1: 실패하는 테스트 작성** — scan_secrets.rs 하단 `#[cfg(test)]`:

```rust
//! 릴리스 산출물 시크릿 스캔 (CI·개발 전용, 앱 번들 미포함).
//! 사용법: scan_secrets <경로...>
use std::path::Path;

/// (패턴 이름, 마커 바이트, 마커 뒤에 필요한 영숫자 최소 개수)
const PATTERNS: &[(&str, &[u8], usize)] = &[
    ("tauri-updater-개인키", b"rsign encrypted secret key", 0),
    ("minisign-개인키", b"minisign encrypted secret key", 0),
    ("PEM-개인키", b"PRIVATE KEY-----", 0),
    ("Anthropic-API키", b"sk-ant-", 8),
    ("AWS-액세스키", b"AKIA", 16),
    ("GitHub-PAT", b"github_pat_", 20),
    ("GitHub-토큰-ghp", b"ghp_", 30),
    ("GitHub-토큰-gho", b"gho_", 30),
];
const FORBIDDEN_FILE_NAMES: &[&str] = &["recipe-signing-secret.key"];

fn is_token_byte(b: u8) -> bool {
    b.is_ascii_alphanumeric() || b == b'_'
}

/// 데이터에서 발견된 패턴 이름들. 마커 뒤 최소 길이의 토큰 문자가 이어져야 매치(무작위 바이트 오탐 억제).
pub fn find_hits(data: &[u8]) -> Vec<&'static str> {
    let mut hits = Vec::new();
    for (name, marker, min_suffix) in PATTERNS {
        let found = data.windows(marker.len()).enumerate().any(|(i, w)| {
            w == *marker && {
                let tail = &data[i + marker.len()..];
                tail.len() >= *min_suffix && tail[..*min_suffix].iter().all(|b| is_token_byte(*b))
            }
        });
        if found {
            hits.push(*name);
        }
    }
    hits
}

fn scan_path(path: &Path, report: &mut Vec<(String, &'static str)>, count: &mut usize) {
    if path.is_dir() {
        for entry in std::fs::read_dir(path).into_iter().flatten().flatten() {
            scan_path(&entry.path(), report, count);
        }
        return;
    }
    let name = path.file_name().and_then(|n| n.to_str()).unwrap_or("");
    if FORBIDDEN_FILE_NAMES.contains(&name) {
        report.push((path.display().to_string(), "금지 파일명(레시피 개인키)"));
    }
    if let Ok(data) = std::fs::read(path) {
        *count += 1;
        for hit in find_hits(&data) {
            report.push((path.display().to_string(), hit));
        }
    }
}

fn main() {
    let args: Vec<String> = std::env::args().skip(1).collect();
    if args.is_empty() {
        eprintln!("사용법: scan_secrets <경로...>");
        std::process::exit(2);
    }
    let mut report = Vec::new();
    let mut count = 0usize;
    for a in &args {
        scan_path(Path::new(a), &mut report, &mut count);
    }
    if report.is_empty() {
        println!("시크릿 스캔 통과: 파일 {count}개 검사");
    } else {
        for (path, pat) in &report {
            eprintln!("발견: {pat} → {path}");
        }
        std::process::exit(1);
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn detects_private_key_markers() {
        assert_eq!(
            find_hits(b"untrusted comment: rsign encrypted secret key\nabc"),
            vec!["tauri-updater-개인키"]
        );
        assert_eq!(
            find_hits(b"-----BEGIN RSA PRIVATE KEY-----"),
            vec!["PEM-개인키"]
        );
    }

    #[test]
    fn detects_api_keys_with_token_suffix() {
        assert!(!find_hits(b"sk-ant-api03-abcdefgh123").is_empty());
        assert!(!find_hits(b"AKIAABCDEFGHIJKLMNOP").is_empty());
        assert!(!find_hits(b"github_pat_11ABCDEFGHIJKLMNOPQRST").is_empty());
    }

    #[test]
    fn ignores_public_keys_and_short_lookalikes() {
        // 업데이터·레시피 공개키는 정상 포함물 → 매치되면 안 됨
        assert!(find_hits(b"untrusted comment: minisign public key ABC").is_empty());
        assert!(find_hits(b"-----BEGIN PUBLIC KEY-----").is_empty());
        // 마커 뒤 토큰이 짧으면 무시 (무작위 바이트 오탐 억제)
        assert!(find_hits(b"AKIA!not-a-key").is_empty());
        assert!(find_hits(b"ghp_short").is_empty());
    }

    #[test]
    fn scans_directories_recursively_and_flags_forbidden_names() {
        let dir = std::env::temp_dir().join(format!("scan-test-{}", std::process::id()));
        std::fs::create_dir_all(dir.join("inner")).unwrap();
        std::fs::write(dir.join("inner/ok.txt"), b"clean file").unwrap();
        std::fs::write(dir.join("inner/recipe-signing-secret.key"), b"x").unwrap();
        let mut report = Vec::new();
        let mut count = 0;
        scan_path(&dir, &mut report, &mut count);
        std::fs::remove_dir_all(&dir).unwrap();
        assert_eq!(report.len(), 1);
        assert!(report[0].1.contains("금지 파일명"));
    }
}
```

- [ ] **Step 2: 실행해 실패 확인** (파일이 없으므로 컴파일 에러)

```bash
cd src-tauri && cargo test --bin scan_secrets
```
Expected: FAIL (bin 미존재). 파일 생성 후 재실행하며 테스트 통과까지 진행.

- [ ] **Step 3: 위 코드로 파일 생성 후 테스트 통과 확인**

```bash
cargo test --bin scan_secrets
```
Expected: 4 passed. `cargo run --bin scan_secrets -- recipes`도 "시크릿 스캔 통과" 출력·exit 0 확인.

- [ ] **Step 4: clippy·fmt 확인 후 커밋**

```bash
cargo clippy -- -D warnings && cargo fmt
git add src-tauri && git commit -m "feat: scan_secrets 산출물 시크릿 스캔 bin (릴리스 안전망)"
```

---

### Task 5: updater 백엔드 통합 (플러그인·설정·권한)

**Files:**
- Modify: `src-tauri/Cargo.toml`, `src-tauri/src/lib.rs:23-24`, `src-tauri/capabilities/default.json`, `src-tauri/tauri.conf.json`, `package.json`

**Interfaces:**
- Consumes: Task 3 Step 1의 **업데이터 공개키 문자열**
- Produces: 프론트에서 `@tauri-apps/plugin-updater`의 `check()`, `@tauri-apps/plugin-process`의 `relaunch()` 호출 가능 상태. `bun run tauri build`가 업데이터 아티팩트(.app.tar.gz+.sig)를 생성

- [ ] **Step 1: 의존성 추가**

```bash
cd src-tauri && cargo add tauri-plugin-updater@2 tauri-plugin-process@2
cd .. && bun add @tauri-apps/plugin-updater @tauri-apps/plugin-process
```

- [ ] **Step 2: lib.rs 플러그인 등록** — 기존 builder에 추가:

```rust
tauri::Builder::default()
    .plugin(tauri_plugin_opener::init())
    .plugin(tauri_plugin_updater::Builder::new().build())
    .plugin(tauri_plugin_process::init())
```

- [ ] **Step 3: capabilities/default.json permissions 추가**

```json
"permissions": [
    "core:default",
    "opener:default",
    "updater:default",
    "process:default"
]
```

- [ ] **Step 4: tauri.conf.json 설정** — `bundle`에 `"createUpdaterArtifacts": true` 추가, 최상위에 `plugins` 추가:

```json
"plugins": {
    "updater": {
        "pubkey": "<Task 3 Step 1 출력의 공개키 문자열>",
        "endpoints": [
            "https://github.com/needslab-ai/easy-harness-releases/releases/latest/download/latest.json"
        ],
        "windows": { "installMode": "passive" }
    }
}
```

- [ ] **Step 5: 빌드 확인** (createUpdaterArtifacts 때문에 로컬 tauri build에 서명키 env가 필요해짐)

```bash
cd src-tauri && cargo check && cd ..
TAURI_SIGNING_PRIVATE_KEY="$HOME/.tauri/easy-harness-updater.key" \
TAURI_SIGNING_PRIVATE_KEY_PASSWORD="<키 비밀번호>" \
bun run tauri build 2>&1 | tail -5
ls src-tauri/target/release/bundle/macos/*.app.tar.gz*
```
Expected: `.app.tar.gz`와 `.app.tar.gz.sig` 존재. (CLAUDE.md 갱신은 Task 13에서 일괄)

- [ ] **Step 6: 커밋**

```bash
git add src-tauri package.json bun.lock
git commit -m "feat: tauri-plugin-updater·process 통합 (엔드포인트·공개키·업데이터 아티팩트)"
```

---

### Task 6: 프론트 업데이트 훅 + 대시보드 배너

**Files:**
- Create: `src/lib/appUpdate.ts`
- Modify: `src/screens/Dashboard.tsx:16-17,65-70`
- Test: `src/lib/__tests__/appUpdate.test.ts`, `src/screens/__tests__/dashboard.test.tsx`(배너 상태 케이스 추가)

**Interfaces:**
- Consumes: `@tauri-apps/plugin-updater` `check(): Promise<Update|null>`, `Update.downloadAndInstall(cb)`, `@tauri-apps/plugin-process` `relaunch()`
- Produces: `useAppUpdate(): { phase: AppUpdatePhase; install: () => Promise<void> }`, `type AppUpdatePhase = {kind:"idle"} | {kind:"available"} | {kind:"downloading"; percent:number} | {kind:"failed"}`

- [ ] **Step 1: 실패하는 테스트 작성** — `src/lib/__tests__/appUpdate.test.ts`:

```ts
import { describe, expect, it, vi, beforeEach } from "vitest";
import { renderHook, act, waitFor } from "@testing-library/react";

const { mockCheck, mockRelaunch } = vi.hoisted(() => ({
  mockCheck: vi.fn(),
  mockRelaunch: vi.fn(),
}));
vi.mock("@tauri-apps/plugin-updater", () => ({ check: mockCheck }));
vi.mock("@tauri-apps/plugin-process", () => ({ relaunch: mockRelaunch }));

import { useAppUpdate } from "../appUpdate";

beforeEach(() => {
  mockCheck.mockReset();
  mockRelaunch.mockReset();
});

describe("useAppUpdate", () => {
  it("업데이트가 없으면 idle 유지", async () => {
    mockCheck.mockResolvedValue(null);
    const { result } = renderHook(() => useAppUpdate());
    await waitFor(() => expect(mockCheck).toHaveBeenCalled());
    expect(result.current.phase.kind).toBe("idle");
  });

  it("확인 실패는 조용히 무시 (idle)", async () => {
    mockCheck.mockRejectedValue(new Error("offline"));
    const { result } = renderHook(() => useAppUpdate());
    await waitFor(() => expect(mockCheck).toHaveBeenCalled());
    expect(result.current.phase.kind).toBe("idle");
  });

  it("업데이트가 있으면 available, install 성공 시 진행률 후 relaunch", async () => {
    const update = {
      downloadAndInstall: vi.fn(async (cb: (e: unknown) => void) => {
        cb({ event: "Started", data: { contentLength: 100 } });
        cb({ event: "Progress", data: { chunkLength: 50 } });
        cb({ event: "Finished" });
      }),
    };
    mockCheck.mockResolvedValue(update);
    const { result } = renderHook(() => useAppUpdate());
    await waitFor(() => expect(result.current.phase.kind).toBe("available"));
    await act(() => result.current.install());
    expect(update.downloadAndInstall).toHaveBeenCalled();
    expect(mockRelaunch).toHaveBeenCalled();
  });

  it("다운로드 실패 시 failed, relaunch 안 함", async () => {
    const update = { downloadAndInstall: vi.fn().mockRejectedValue(new Error("네트워크")) };
    mockCheck.mockResolvedValue(update);
    const { result } = renderHook(() => useAppUpdate());
    await waitFor(() => expect(result.current.phase.kind).toBe("available"));
    await act(() => result.current.install());
    expect(result.current.phase.kind).toBe("failed");
    expect(mockRelaunch).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: 실행해 실패 확인**

```bash
bun run test src/lib/__tests__/appUpdate.test.ts
```
Expected: FAIL (appUpdate.ts 없음)

- [ ] **Step 3: 구현** — `src/lib/appUpdate.ts`:

```ts
import { useCallback, useEffect, useState } from "react";
import { check, type Update } from "@tauri-apps/plugin-updater";
import { relaunch } from "@tauri-apps/plugin-process";

export type AppUpdatePhase =
  | { kind: "idle" }
  | { kind: "available" }
  | { kind: "downloading"; percent: number }
  | { kind: "failed" };

/** 앱 자체 업데이트 훅. 마운트 시 1회 조용히 확인하고, install()로 내려받아 재시작한다. */
export function useAppUpdate() {
  const [update, setUpdate] = useState<Update | null>(null);
  const [phase, setPhase] = useState<AppUpdatePhase>({ kind: "idle" });

  useEffect(() => {
    let cancelled = false;
    check()
      .then((u) => {
        if (!cancelled && u) {
          setUpdate(u);
          setPhase({ kind: "available" });
        }
      })
      .catch(() => {
        /* 확인 실패는 사용자를 귀찮게 하지 않는다 */
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const install = useCallback(async () => {
    if (!update) return;
    let total = 0;
    let received = 0;
    setPhase({ kind: "downloading", percent: 0 });
    try {
      await update.downloadAndInstall((event) => {
        if (event.event === "Started") total = event.data.contentLength ?? 0;
        if (event.event === "Progress") {
          received += event.data.chunkLength;
          if (total > 0) {
            const percent = Math.min(99, Math.round((received / total) * 100));
            setPhase({ kind: "downloading", percent });
          }
        }
      });
      await relaunch();
    } catch {
      setPhase({ kind: "failed" });
    }
  }, [update]);

  return { phase, install };
}
```

- [ ] **Step 4: 테스트 통과 확인**

```bash
bun run test src/lib/__tests__/appUpdate.test.ts
```
Expected: 4 passed

- [ ] **Step 5: Dashboard 연결** — `const appUpdateReady = false;`(16-17행)를 지우고 훅 사용, 배너 블록(65-70행)을 phase 분기로 교체:

```tsx
const { phase: updatePhase, install: installUpdate } = useAppUpdate();
```
```tsx
{updatePhase.kind !== "idle" && (
  <div className="mb-6 flex items-center justify-between rounded-card border border-line-gold bg-surface-gold-tint px-5 py-4">
    {updatePhase.kind === "available" && (
      <>
        <p className="font-bold">이지 하네스 새 버전이 나왔어요. 1분이면 끝나요.</p>
        <PrimaryButton onClick={installUpdate}>지금 업데이트</PrimaryButton>
      </>
    )}
    {updatePhase.kind === "downloading" && (
      <p className="font-bold">새 버전을 받는 중이에요 {updatePhase.percent}%</p>
    )}
    {updatePhase.kind === "failed" && (
      <p className="font-bold">업데이트를 받지 못했어요. 다음에 다시 시도할게요.</p>
    )}
  </div>
)}
```
import 추가: `import { useAppUpdate } from "../lib/appUpdate";`

- [ ] **Step 6: dashboard.test.tsx에 배너 케이스 추가** — 기존 목 패턴에 맞춰 `../lib/appUpdate`를 vi.mock으로 제어:

```tsx
// 파일 상단 목 (기존 vi.mock들 옆에)
const { mockUseAppUpdate } = vi.hoisted(() => ({
  mockUseAppUpdate: vi.fn(() => ({ phase: { kind: "idle" }, install: vi.fn() })),
}));
vi.mock("../../lib/appUpdate", () => ({ useAppUpdate: mockUseAppUpdate }));
```
```tsx
it("업데이트가 있으면 배너와 버튼이 보인다", async () => {
  mockUseAppUpdate.mockReturnValue({ phase: { kind: "available" }, install: vi.fn() });
  renderDashboard(); // 파일의 기존 렌더 헬퍼 사용
  expect(await screen.findByText(/새 버전이 나왔어요/)).toBeInTheDocument();
  expect(screen.getByText("지금 업데이트")).toBeInTheDocument();
});

it("다운로드 중에는 진행률이 보인다", async () => {
  mockUseAppUpdate.mockReturnValue({ phase: { kind: "downloading", percent: 42 }, install: vi.fn() });
  renderDashboard();
  expect(await screen.findByText(/받는 중이에요 42%/)).toBeInTheDocument();
});
```
(경로 상대 깊이는 dashboard.test.tsx 위치 기준으로 맞춘다)

- [ ] **Step 7: 전체 프론트 테스트 + 커밋**

```bash
bun run test && bun run build
git add src package.json && git commit -m "feat: 앱 자동 업데이트 훅·대시보드 배너 (확인 무음, 원클릭 설치·재시작)"
```

---

### Task 7: 설치 성공 시 실버전 채움 (백엔드)

**Files:**
- Modify: `src-tauri/src/probe.rs`, `src-tauri/src/commands.rs:326-350`
- Test: probe.rs `#[cfg(test)]`, commands.rs 기존 테스트 모듈

**Interfaces:**
- Consumes: `ProcessRunner` trait(runner/process.rs), `Catalog::get(id)`, `PlatformSpec.detect: Vec<Step>`, `Step::CheckCommand { command, args, .. }`
- Produces: `probe::extract_version(&str) -> Option<String>`, `probe::probe_tool_version(&impl ProcessRunner, &str, &[String]) -> Option<String>`, commands.rs `version_probe_command(&Catalog, &str, Platform) -> Option<(String, Vec<String>)>`. Task 8의 UI가 Installation.version(Some) 표시

- [ ] **Step 1: 실패하는 테스트 작성** — probe.rs 테스트 모듈에 추가:

```rust
#[test]
fn extract_version_finds_semverish_token() {
    assert_eq!(extract_version("v24.16.0\n").as_deref(), Some("24.16.0"));
    assert_eq!(extract_version("git version 2.49.0").as_deref(), Some("2.49.0"));
    assert_eq!(extract_version("omo 4.15.1 (stable)").as_deref(), Some("4.15.1"));
    assert_eq!(extract_version("1.2.3-beta").as_deref(), Some("1.2.3"));
    assert_eq!(extract_version("버전 없음"), None);
}

#[tokio::test]
async fn probe_tool_version_uses_runner_output() {
    let runner = FakeProcessRunner::new(vec![ok("claude 2.1.201\n")]);
    let v = probe_tool_version(&runner, "claude", &["--version".to_string()]).await;
    assert_eq!(v.as_deref(), Some("2.1.201"));
}

#[tokio::test]
async fn probe_tool_version_none_on_failure() {
    let runner = FakeProcessRunner::new(vec![]); // 명령 실패 시나리오 (기존 헬퍼 관례에 맞춰 조정)
    let v = probe_tool_version(&runner, "ghost", &[]).await;
    assert_eq!(v, None);
}
```
(FakeProcessRunner·ok 헬퍼는 probe.rs 기존 테스트의 것을 재사용. 실패 시나리오 표현은 기존 헬퍼 형태에 맞춘다)

- [ ] **Step 2: 실행해 실패 확인**

```bash
cd src-tauri && cargo test extract_version
```
Expected: FAIL (함수 없음)

- [ ] **Step 3: probe.rs 구현 추가**

```rust
/// stdout에서 버전 토큰(예: 1.2.3, v24.16.0)을 뽑는다. 못 찾으면 None (거짓 버전 금지).
pub fn extract_version(stdout: &str) -> Option<String> {
    for token in stdout.split_whitespace() {
        let t = token
            .trim_start_matches('v')
            .trim_end_matches(|c: char| !c.is_ascii_digit());
        let parts: Vec<&str> = t.split('.').collect();
        if parts.len() >= 2
            && parts
                .iter()
                .all(|p| !p.is_empty() && p.chars().all(|c| c.is_ascii_digit()))
        {
            return Some(t.to_string());
        }
    }
    None
}

/// 도구 하나의 버전을 검출 명령으로 조사한다. 어떤 실패든 None (설치 성공 판정과 무관).
pub async fn probe_tool_version(
    runner: &impl ProcessRunner,
    command: &str,
    args: &[String],
) -> Option<String> {
    match runner.run(command, args).await {
        Ok(out) if out.exit_code == 0 => extract_version(&out.stdout),
        _ => None,
    }
}
```

- [ ] **Step 4: 테스트 통과 확인**

```bash
cargo test extract_version && cargo test probe_tool_version
```
Expected: PASS

- [ ] **Step 5: commands.rs 배선** — 헬퍼 추가 + 성공 분기에서 version 채움:

```rust
/// 레시피의 detect 첫 check_command를 버전 조사 명령으로 쓴다 (없으면 None → 날짜만 표시).
fn version_probe_command(
    catalog: &crate::recipe::loader::Catalog,
    id: &str,
    platform: crate::recipe::schema::Platform,
) -> Option<(String, Vec<String>)> {
    let spec = catalog.get(id)?.platforms.get(platform)?;
    spec.detect.iter().find_map(|s| match s {
        crate::recipe::schema::Step::CheckCommand { command, args, .. } => {
            Some((command.clone(), args.clone()))
        }
        _ => None,
    })
}

async fn probe_version_for(
    catalog: &crate::recipe::loader::Catalog,
    id: &str,
    platform: crate::recipe::schema::Platform,
) -> Option<String> {
    let (cmd, args) = version_probe_command(catalog, id, platform)?;
    crate::probe::probe_tool_version(&TokioProcessRunner, &cmd, &args).await
}
```
성공 분기(commands.rs:330 부근)의 두 upsert에서 `version: None`을 교체:
```rust
Flow::Install | Flow::Update => {
    let target_version = probe_version_for(&catalog, &plan.target_id, platform).await;
    let _ = store.upsert(Installation {
        recipe_id: plan.target_id.clone(),
        version: target_version,
        installed_at: now_unix(),
        auth_done: true,
        verified_at: Some(now_unix()),
    });
    // 의존성으로 함께 설치된 도구들도 기록
    for id in &plan.tool_order {
        if id != &plan.target_id {
            let dep_version = probe_version_for(&catalog, id, platform).await;
            let _ = store.upsert(Installation {
                recipe_id: id.clone(),
                version: dep_version,
                installed_at: now_unix(),
                auth_done: false,
                verified_at: Some(now_unix()),
            });
        }
    }
}
```
(catalog·platform이 async 블록에서 이미 사용 중인 값과 소유권 충돌하면 블록 진입 전에 clone)

- [ ] **Step 6: version_probe_command 테스트** — commands.rs 테스트 모듈에:

```rust
#[test]
fn version_probe_command_uses_first_detect_check() {
    let catalog = crate::recipe::loader::Catalog::load_dir(
        &crate::recipe::loader::Catalog::bundled_dir(),
    )
    .unwrap();
    let (cmd, _args) = version_probe_command(
        &catalog,
        "claude-code",
        crate::recipe::schema::Platform::Mac,
    )
    .expect("claude-code mac detect에 check_command 있어야 함");
    assert!(!cmd.is_empty());
}
```

- [ ] **Step 7: 전체 게이트 + 커밋**

```bash
cargo test && cargo clippy -- -D warnings && cargo fmt
git add src && git commit -m "feat: 설치 성공 시 detect 명령으로 실버전 조사해 installed.json에 기록"
```
(git add 경로는 src-tauri 기준으로 조정)

---

### Task 8: 대시보드 버전·날짜 병기

**Files:**
- Modify: `src/screens/Dashboard.tsx:92-95`
- Test: `src/screens/__tests__/dashboard.test.tsx`

**Interfaces:**
- Consumes: `Installation.version: string | null` (types.ts 기존재, Task 7이 실제 값 공급)

- [ ] **Step 1: 실패하는 테스트 작성** — dashboard.test.tsx에 추가 (기존 목 상태에 version 있는 설치 항목 케이스):

```tsx
it("버전이 있으면 버전과 설치 날짜를 함께 보여준다", async () => {
  // 기존 getAppState 목을 version: "4.15.1", installedAt: 1783300000 항목으로 설정 (파일의 기존 목 헬퍼 사용)
  renderDashboard();
  expect(await screen.findByText(/v4\.15\.1/)).toBeInTheDocument();
  expect(screen.getByText(/2026년/)).toBeInTheDocument();
});
```

- [ ] **Step 2: 실행해 실패 확인** — 현재는 version 있으면 날짜가 사라지므로 두 번째 단언이 FAIL:

```bash
bun run test src/screens/__tests__/dashboard.test.tsx
```

- [ ] **Step 3: 구현** — Dashboard.tsx 92-95행 교체:

```tsx
{i.version ? (
  <p className="text-caption text-txt-tertiary">
    <span className="font-mono">v{i.version}</span> · {formatInstalledAt(i.installedAt)}
  </p>
) : (
  <p className="text-caption text-txt-tertiary">{formatInstalledAt(i.installedAt)}</p>
)}
```

- [ ] **Step 4: 테스트 통과 + 커밋**

```bash
bun run test
git add src && git commit -m "feat: 대시보드에 실버전과 설치 날짜 병기 (버전 없으면 날짜만)"
```

---

### Task 9: verify 인증 실검증 레시피 보강 (codex·opencode·openclaw, hermes 조건부)

**Files:**
- Modify: `src-tauri/recipes/codex.json`, `src-tauri/recipes/opencode.json`, `src-tauri/recipes/openclaw.json`, (조건부) `src-tauri/recipes/hermes.json` — 각 mac verify만
- Test: `src-tauri/tests/real_recipes.rs`

**Interfaces:**
- Consumes: 실측 확정 명령(계획 상단 실측 결과 3). 스키마 무변경, run_command + zsh grep 패턴(claude-code 선례)
- Produces: mac verify에 인증 실검증 스텝. windows 섹션은 M6까지 불변

- [ ] **Step 1: 실패하는 테스트 작성** — real_recipes.rs에 추가 (`Step` import 추가: `use easy_harness_lib::recipe::schema::{AuthPattern, Platform, Step, ToolKind};`):

```rust
#[test]
fn auth_verify_steps_check_real_login() {
    let cat = catalog();
    for (id, needle) in [
        ("codex", "codex login status"),
        ("opencode", "opencode auth list"),
        ("openclaw", "openclaw models status"),
    ] {
        let r = cat.get(id).unwrap_or_else(|| panic!("{id} 레시피 없음"));
        let spec = r.platforms.get(Platform::Mac).unwrap();
        let hit = spec.verify.iter().any(|s| match s {
            Step::RunCommand { args, .. } => args.iter().any(|a| a.contains(needle)),
            _ => false,
        });
        assert!(hit, "{id}: mac verify에 인증 실검증 스텝 필요");
    }
}
```

- [ ] **Step 2: 실행해 실패 확인**

```bash
cd src-tauri && cargo test auth_verify_steps_check_real_login
```
Expected: FAIL ("codex: mac verify에 인증 실검증 스텝 필요")

- [ ] **Step 3: 레시피 3종의 mac verify 배열 끝에 스텝 추가**

codex.json:
```json
{ "type": "run_command", "friendly": "ChatGPT 로그인이 살아 있는지 볼게요", "command": "/bin/zsh", "args": ["-lc", "codex login status 2>&1 | grep -q 'Logged in'"] }
```
opencode.json:
```json
{ "type": "run_command", "friendly": "로그인 정보가 잘 저장됐는지 볼게요", "command": "/bin/zsh", "args": ["-lc", "opencode auth list 2>&1 | grep -Eq 'oauth|api'"] }
```
openclaw.json:
```json
{ "type": "run_command", "friendly": "모델 연결이 잘 됐는지 볼게요", "command": "/bin/zsh", "args": ["-lc", "openclaw models status --json | grep -q '\"missingProvidersInUse\": \\[\\]'"] }
```

- [ ] **Step 4: hermes 후보 조사 (결정 규칙)**

```bash
hermes auth status portal; hermes auth status nous; hermes auth list
```
Nous Portal 로그인 상태를 정확히 보고하는 provider id가 있으면 codex와 같은 형태(`! ... grep -q 'logged out'` 또는 긍정 매치)로 hermes.json mac verify에 추가하고 Step 1 테스트 목록에도 추가. **어느 후보도 Portal 상태를 반영하지 않으면 hermes는 수정하지 않고** 레저에 "hermes verify 실검증 보류: portal provider id 미확인"을 기록.

- [ ] **Step 5: 테스트 통과 + 로컬 실동작 확인**

```bash
cargo test   # real_recipes 전수 드라이런 포함 전부 GREEN
/bin/zsh -lc "codex login status 2>&1 | grep -q 'Logged in'" && echo "codex verify OK"
```
Expected: cargo 전부 PASS, "codex verify OK" 출력 (이 맥은 codex 로그인 상태). openclaw·opencode는 현재 로그아웃이면 grep 실패가 **정상 동작**(그게 이 기능의 목적)임을 확인만 하고 넘어간다.

- [ ] **Step 6: 커밋**

```bash
git add src-tauri/recipes src-tauri/tests
git commit -m "feat: codex·opencode·openclaw mac verify에 인증 실검증 추가 (스키마 무변경)"
```

---

### Task 10: release.yml + ci.yml concurrency

**Files:**
- Create: `.github/workflows/release.yml`
- Modify: `.github/workflows/ci.yml` (concurrency 추가)

**Interfaces:**
- Consumes: Task 3 시크릿 9종, Task 4 `scan_secrets`, Task 5 `createUpdaterArtifacts`
- Produces: `v*` 태그 push → draft 릴리스(easy-harness-releases) + latest.json. Task 12·13이 이 파이프라인을 실행

- [ ] **Step 1: release.yml 작성**

```yaml
name: Release
on:
  push:
    tags: ["v*"]

permissions:
  contents: write

jobs:
  version-check:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v7
      - name: 태그와 tauri.conf.json 버전 일치 검사
        run: |
          TAG="${GITHUB_REF_NAME#v}"
          CONF=$(jq -r .version src-tauri/tauri.conf.json)
          if [ "$TAG" != "$CONF" ]; then
            echo "버전 불일치: 태그 v$TAG vs tauri.conf.json $CONF" >&2
            exit 1
          fi

  build:
    needs: version-check
    strategy:
      fail-fast: false
      matrix:
        include:
          - platform: macos-latest
            args: --target aarch64-apple-darwin
            target: aarch64-apple-darwin
          - platform: macos-latest
            args: --target x86_64-apple-darwin
            target: x86_64-apple-darwin
          - platform: windows-latest
            args: ""
            target: ""
    runs-on: ${{ matrix.platform }}
    steps:
      - uses: actions/checkout@v7
      - uses: oven-sh/setup-bun@v2
      - uses: dtolnay/rust-toolchain@stable
        with:
          targets: ${{ matrix.target }}
      - uses: Swatinem/rust-cache@v2
        with:
          workspaces: src-tauri
      - run: bun install
      - name: 공증 API 키 파일 복원 (맥 전용)
        if: startsWith(matrix.platform, 'macos')
        shell: bash
        run: |
          echo "$APPLE_API_KEY_P8" > "$RUNNER_TEMP/apple-api-key.p8"
          echo "APPLE_API_KEY_PATH=$RUNNER_TEMP/apple-api-key.p8" >> "$GITHUB_ENV"
        env:
          APPLE_API_KEY_P8: ${{ secrets.APPLE_API_KEY_P8 }}
      # 윈도우 코드 서명 자리 (M5 보류): WINDOWS_SIGN_* 시크릿 등록 시 여기에 서명 스텝 추가
      - name: Tauri 빌드·서명·공증·draft 릴리스
        uses: tauri-apps/tauri-action@v1
        env:
          GITHUB_TOKEN: ${{ secrets.RELEASES_PAT }}
          APPLE_CERTIFICATE: ${{ secrets.APPLE_CERTIFICATE }}
          APPLE_CERTIFICATE_PASSWORD: ${{ secrets.APPLE_CERTIFICATE_PASSWORD }}
          KEYCHAIN_PASSWORD: ${{ secrets.KEYCHAIN_PASSWORD }}
          APPLE_API_ISSUER: ${{ secrets.APPLE_API_ISSUER }}
          APPLE_API_KEY: ${{ secrets.APPLE_API_KEY }}
          APPLE_SIGNING_IDENTITY: "Developer ID Application: YONG BEOM GWON (RB6FTGW2DK)"
          TAURI_SIGNING_PRIVATE_KEY: ${{ secrets.TAURI_SIGNING_PRIVATE_KEY }}
          TAURI_SIGNING_PRIVATE_KEY_PASSWORD: ${{ secrets.TAURI_SIGNING_PRIVATE_KEY_PASSWORD }}
        with:
          owner: needslab-ai
          repo: easy-harness-releases
          tagName: v__VERSION__
          releaseName: "이지 하네스 v__VERSION__"
          releaseBody: "새 버전이 나왔어요. 아래 파일로 설치할 수 있어요."
          releaseDraft: true
          args: ${{ matrix.args }}
      - name: 시크릿 스캔 (산출물, 발행 게이트 앞 안전망)
        shell: bash
        working-directory: src-tauri
        run: |
          BUNDLE_DIR="target/release/bundle"
          if [ -n "${{ matrix.target }}" ]; then
            BUNDLE_DIR="target/${{ matrix.target }}/release/bundle"
          fi
          cargo run --bin scan_secrets -- "$BUNDLE_DIR"
```
스캔이 실패하면 잡이 빨갛게 실패한다. 그 경우 **draft를 발행하지 말고 삭제**한다(`gh release delete <태그> --repo needslab-ai/easy-harness-releases`). 이 규칙은 Task 13에서 CLAUDE.md 릴리스 절차에 명문화.

- [ ] **Step 2: ci.yml 상단에 concurrency 추가** (`on:` 블록 아래):

```yaml
concurrency:
  group: ci-${{ github.ref }}
  cancel-in-progress: true
```

- [ ] **Step 3: 로컬 YAML 검증 + 커밋**

```bash
python3 -c "import yaml,sys; yaml.safe_load(open('.github/workflows/release.yml')); yaml.safe_load(open('.github/workflows/ci.yml')); print('YAML OK')"
git add .github && git commit -m "feat: 릴리스 파이프라인 (서명·공증·시크릿 스캔·draft) + CI 중복 실행 취소"
```

---

### Task 11: 브랜치 게이트 + main 머지

**Files:** 없음 (검증·머지)

- [ ] **Step 1: 게이트 5종 전부 실행**

```bash
cd src-tauri && cargo fmt --check && cargo clippy -- -D warnings && cargo test && cd ..
bun run test && bun run build
```
Expected: 전부 GREEN. 하나라도 실패 시 해당 태스크로 돌아가 수정.

- [ ] **Step 2: 코드 리뷰** — superpowers:requesting-code-review 절차로 feat/m5-deploy 전체 diff 리뷰(모델 sonnet), Important 이상은 수정 후 재확인.

- [ ] **Step 3: main 머지 + push**

```bash
git checkout main && git merge --no-ff feat/m5-deploy -m "merge: M5 배포 파이프라인·자동 업데이트 (리뷰 통과)"
git push origin main
gh run watch --repo needslab-ai/easy-harness   # push CI(테스트) GREEN 확인
```

---

### Task 12: 첫 릴리스 v0.1.0 스모크 (완료 기준 1·3)

**Files:** 없음 (릴리스 실행·검증)

**Interfaces:**
- Consumes: Task 10 파이프라인, Task 3 시크릿. tauri.conf.json version은 이미 `0.1.0`

- [ ] **Step 1: 태그 push → 파이프라인 관찰**

```bash
git tag v0.1.0 && git push origin v0.1.0
gh run watch --repo needslab-ai/easy-harness
```
Expected: version-check·build(3매트릭스)·시크릿 스캔 전부 GREEN. 실패 시 로그로 원인 파악(공증 실패면 Apple 자격증명, 업로드 실패면 RELEASES_PAT 권한 확인).

- [ ] **Step 2: draft 확인 → 발행**

```bash
gh release view v0.1.0 --repo needslab-ai/easy-harness-releases
```
Expected: draft, 자산에 .dmg(2아키텍처)·.app.tar.gz(+.sig)·setup.exe·latest.json. 이상 없으면:
```bash
gh release edit v0.1.0 --repo needslab-ai/easy-harness-releases --draft=false
```

- [ ] **Step 3: latest.json URL 실검증** (실측 결과 4의 확인)

```bash
curl -sL "https://github.com/needslab-ai/easy-harness-releases/releases/latest/download/latest.json" | jq .
ASSET_URL=$(curl -sL ".../latest.json 위 명령" | jq -r '.platforms["darwin-aarch64"].url')
curl -sL -o /tmp/upd-test.bin "$ASSET_URL" && ls -la /tmp/upd-test.bin && file /tmp/upd-test.bin
```
Expected: latest.json에 version 0.1.0, 다운로드 파일이 수 MB 이상의 바이너리(gzip). JSON 메타데이터(수백 바이트)가 내려오면 API URL 문제 → Task 13 Step 4의 폴백을 미리 적용.

- [ ] **Step 4: .dmg 설치 스모크 (완료 기준 1)**

```bash
curl -sLo /tmp/EasyHarness.dmg "<릴리스의 aarch64 .dmg browser 다운로드 URL>"
hdiutil attach /tmp/EasyHarness.dmg
spctl -a -vv "/Volumes/Easy Harness/Easy Harness.app"
```
Expected: `accepted` + `source=Notarized Developer ID`. 사용자 육안 확인: 앱을 응용 프로그램에 복사해 더블클릭 → 경고 없이 실행. (볼륨·앱 이름은 실제 산출물 이름에 맞춘다)

- [ ] **Step 5: 시크릿 스캔 주입 실증 (완료 기준 3)** — CI와 동일 명령·동일 산출물로 로컬 실증:

```bash
cd src-tauri
BUNDLE=target/aarch64-apple-darwin/release/bundle 2>/dev/null || BUNDLE=target/release/bundle
cp -R "$BUNDLE" /tmp/bundle-canary
echo "untrusted comment: rsign encrypted secret key" > /tmp/bundle-canary/canary.txt
cargo run --bin scan_secrets -- /tmp/bundle-canary; echo "exit=$?"
rm -rf /tmp/bundle-canary
```
Expected: "발견: tauri-updater-개인키 → .../canary.txt", exit=1. (로컬 bundle 디렉터리가 없으면 Task 5 Step 5의 빌드 산출물 사용)

- [ ] **Step 6: 레저 기록**

progress.md에 Task 12 결과(런 URL, spctl 출력 요약) 기록.

---

### Task 13: v0.1.1 자동 업데이트 스모크 (완료 기준 2) + 문서 마감

**Files:**
- Modify: `src-tauri/tauri.conf.json`(version 0.1.1), `CLAUDE.md`(릴리스 절차 추가), `HANDOFF.md`

- [ ] **Step 1: v0.1.0 설치 상태 만들기** — Task 12의 앱을 /Applications에 설치하고 실행해 대시보드 확인(배너 없음이 정상, 최신이므로).

- [ ] **Step 2: v0.1.1 릴리스**

```bash
# main에서: tauri.conf.json version을 "0.1.1"로 수정
git add src-tauri/tauri.conf.json && git commit -m "chore: v0.1.1 (자동 업데이트 스모크)"
git push origin main
git tag v0.1.1 && git push origin v0.1.1
gh run watch --repo needslab-ai/easy-harness
gh release edit v0.1.1 --repo needslab-ai/easy-harness-releases --draft=false
```

- [ ] **Step 3: 업데이트 관통 스모크 (완료 기준 2)**

/Applications의 v0.1.0 앱 실행 → 대시보드 금색 배너 → "지금 업데이트" → 진행률 → 자동 재시작. 기계 확인:
```bash
defaults read "/Applications/Easy Harness.app/Contents/Info.plist" CFBundleShortVersionString
```
Expected: `0.1.1`

- [ ] **Step 4: (조건부 폴백) 업데이트 다운로드가 실패할 때만** — latest.json의 API URL을 브라우저 URL로 치환해 재게시하고, 같은 치환을 release.yml 마지막 스텝(맥 aarch64 잡에만)으로 영구화:

```bash
V=0.1.1
gh release download "v$V" --repo needslab-ai/easy-harness-releases --pattern latest.json --output /tmp/latest.json --clobber
gh api "repos/needslab-ai/easy-harness-releases/releases/tags/v$V" \
  --jq '[.assets[] | {id, url: .browser_download_url}]' > /tmp/assets.json
jq --slurpfile a /tmp/assets.json '
  .platforms |= with_entries(.value.url = (
    (.value.url | capture("assets/(?<id>[0-9]+)$").id | tonumber) as $id
    | ($a[0][] | select(.id == $id) | .url)
  ))' /tmp/latest.json > /tmp/latest.fixed.json
mv /tmp/latest.fixed.json /tmp/latest.json
gh release upload "v$V" /tmp/latest.json --repo needslab-ai/easy-harness-releases --clobber
```
적용 후 Step 3 재시도. 성공하면 release.yml에 같은 로직의 스텝을 추가 커밋(리뷰 포함).

- [ ] **Step 5: 문서 마감**

CLAUDE.md "자주 쓰는 명령" 아래에 릴리스 절차 추가:
```markdown
## 릴리스 절차 (M5)
1. src-tauri/tauri.conf.json의 version을 올리고 main에 커밋
2. `git tag v<버전> && git push origin v<버전>` → GitHub Actions가 빌드·서명·공증·시크릿 스캔 후 easy-harness-releases에 draft 생성
3. draft 자산 확인 후 발행(Publish)이 곧 배포. 시크릿 스캔이 실패한 draft는 발행 금지, `gh release delete`로 삭제
4. 로컬 `bun run tauri build`에는 TAURI_SIGNING_PRIVATE_KEY(+_PASSWORD) 환경변수가 필요하다 (createUpdaterArtifacts)
5. 레시피 번들 갱신은 `scripts/build_recipes_bundle.sh <버전+1> <개인키>` 후 easy-harness-recipes에 게시
```
HANDOFF.md 갱신(M5 완료 상태), progress.md 최종 기록, 게이트 5종 재실행 GREEN 확인, superpowers:finishing-a-development-branch로 마감.

---

## Self-Review 결과 (계획 작성 후 점검)

- **스펙 커버리지**: §4→T1·T3 / §5→T10 / §6→T5·T6 / §7→T7·T8 / §8→T9 / §9→T4 / §11→각 태스크 테스트+T12·T13 / §12 완료 기준 1→T12S4, 2→T13S3, 3→T12S5, 4→T11S1·T13S5 / §14 라이브 확인→계획 상단 실측 결과 + T9S4·T12S3. 갭 없음
- **스펙과 다른 점 2건(근거 있는 조정)**: ① 시크릿 스캔 시점 "업로드 전"→"draft 업로드 후·발행 전"(실측 결과 6) ② 시크릿 이름 APPLE_API_KEY_PATH→APPLE_API_KEY_P8(내용)+러너에서 경로 복원(T3 Interfaces)
- **타입 일치**: AppUpdatePhase(T6 정의·소비 동일), probe 함수 시그니처(T7 정의=사용), scan_secrets CLI 계약(T4 정의=T10·T12 호출) 확인
