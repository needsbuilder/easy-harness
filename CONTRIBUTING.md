# 기여 가이드

이지 하네스에 관심 가져주셔서 고맙습니다.

가장 반가운 기여는 **새 도구 레시피**입니다. 여러분이 만든 AI 코딩 도구나 확장을,
터미널을 한 번도 안 열어본 사람도 클릭 몇 번으로 설치할 수 있게 만드는 일이니까요.

기여는 크게 세 가지입니다.

1. **새 도구 레시피 추가** (JSON 파일 한 개, 앱 코드는 안 건드립니다)
2. **버그 제보와 코드 수정**
3. **카피 다듬기** (어려운 말을 쉬운 말로 바꾸는 것도 진짜 기여입니다)

---

## 1. 새 도구 추가하기

### 먼저: 이슈로 알려주세요

레시피를 쓰기 전에 이슈를 하나 열어주세요. 도구 이름, 무엇을 하는 도구인지,
설치 명령이 무엇인지만 적어주시면 됩니다.
맥과 윈도우 중 어디까지 지원할지 미리 맞춰두면 두 번 일하지 않습니다.

### 레시피는 이렇게 생겼습니다

도구 하나가 파일 하나입니다. `src-tauri/recipes/<도구id>.json`에 놓습니다.

```jsonc
{
  "schemaVersion": 1,
  "id": "my-tool",                    // 파일 이름과 같게. 영문 소문자와 하이픈만
  "name": "내 도구",                   // 화면에 보이는 이름
  "kind": "harness",                  // harness | plugin | prerequisite
  "easyDescription": "무엇을 해 주는 도구인지 한 문장으로 쉽게 써요",
  "pricing": { "label": "무료", "kind": "free" },   // free | paid | freemium
  "recommended": false,
  "requires": [],                     // 다른 도구가 먼저 필요하면 그 id (예: ["claude-code"])
  "source": { "label": "만든 곳: 내이름", "url": "https://github.com/..." },
  "platforms": {
    "mac":     { /* 아래 참고 */ },
    "windows": { /* 맥만 지원하면 이건 빼도 됩니다 */ }
  }
}
```

플랫폼 한 곳은 이런 칸들로 이뤄집니다. 전부 채울 필요는 없습니다.

| 칸 | 언제 쓰나 | 필수 |
|---|---|---|
| `prerequisites` | Node.js 같은 준비물이 필요할 때 (`["nodejs-lts"]`, `["bun"]`) | |
| `detect` | 이미 깔려 있는지 확인 | 사실상 필수 |
| `install` | 설치하기 | 필수 |
| `auth` | 로그인이 필요할 때 | |
| `verify` | 정말 잘 깔렸는지 확인 | 필수 |
| `update` | 새 버전으로 올리기 | |
| `uninstall` | 지우기 | |
| `rollback` | 설치하다 실패했을 때 흔적 치우기 | |

### 쓸 수 있는 동작 7가지

모든 동작에는 `friendly`가 들어갑니다. **사용자 화면에 그대로 나오는 한국어 문장**입니다.

| type | 하는 일 | 필요한 값 |
|---|---|---|
| `check_command` | 명령이 있는지 확인 (실패해도 안 멈춤) | `command`, `args` |
| `run_command` | 명령 실행 | `command`, `args` |
| `download_run` | 파일을 받아서 실행 | `url`, `fileName`, `command`, `args` |
| `open_url` | 브라우저 열기 | `url` |
| `input_secret` | API 키 입력창 띄우기 | `label` |
| `pty_session` | 앱 안의 터미널에서 대화형 실행 | `command`, `args` |
| `path_check` | 파일이나 폴더가 있는지 확인 | `path` |

쓸 수 있는 치환자입니다.

- `{{home}}` 사용자 홈 폴더
- `{{file}}` `download_run`으로 받은 파일 경로
- `{{secret:라벨}}` `input_secret`으로 받은 값

맥은 보통 `"command": "/bin/zsh", "args": ["-lc", "실제 명령"]`,
윈도우는 `"command": "cmd", "args": ["/C", "실제 명령"]` 꼴로 씁니다.

### 로그인이 필요하면

`auth`는 네 가지 방식 중 하나를 고릅니다.

| pattern | 어떤 경우 |
|---|---|
| `automatic` | 사용자 입력이 아예 필요 없음 (**가장 좋습니다**) |
| `browser_login` | 브라우저를 띄워 로그인 |
| `api_key` | API 키를 입력창으로 받음 |
| `interactive_terminal` | 앱 안 터미널에서 직접 입력해야 함 (**최후의 수단**) |

```jsonc
"auth": {
  "pattern": "browser_login",
  "steps": [ /* 동작들 */ ],
  "guide": ["첫 번째 안내", "두 번째 안내", "세 번째 안내"]   // 정확히 3개
}
```

> **터미널은 되도록 감춥니다.** 이 앱을 쓰는 사람은 터미널이 무서워서 온 사람입니다.
> `automatic`으로 될 일을 `interactive_terminal`로 만들지 말아주세요.

### 문구 쓰는 법

`friendly`와 `easyDescription`은 이 앱의 얼굴입니다. 규칙이 있습니다.

- **"~하고 있어요" 말투**를 씁니다. ("설치 중" 대신 "설치하고 있어요")
- 전문 용어를 쓰지 않습니다. ("의존성 해결" 대신 "필요한 부품을 먼저 챙기고 있어요")
- **줄표(em dash)를 쓰지 않습니다.** 한국어 문장에서 AI가 쓴 티가 납니다.
- 사용자가 무엇을 기다리는지 알 수 있게 씁니다.

좋은 예시입니다.

```json
{ "type": "run_command", "friendly": "한국 생활 스킬 모음을 설치하고 있어요", ... }
{ "type": "path_check",  "friendly": "스킬이 제자리에 들어갔는지 확인하고 있어요", ... }
```

### 테스트를 꼭 같이 넣어주세요

**이건 선택이 아닙니다.** 레시피의 동작 부분은 내부적으로 태그로 구분되는데,
오타가 난 필드를 조용히 무시해 버리는 성질이 있습니다.
즉 오타가 있어도 파싱은 통과하고, 실제 설치 때 이상하게 동작합니다.

그래서 `src-tauri/tests/real_recipes.rs`에 자기 검증 테스트를 하나 추가합니다.
기존 테스트를 복사해서 이름만 바꾸면 됩니다.

```rust
#[test]
fn my_tool_recipe_spec() {
    let cat = catalog();
    let r = cat.get("my-tool").expect("my-tool 레시피 없음");
    assert_eq!(r.kind, ToolKind::Harness);
    for p in [Platform::Mac, Platform::Windows] {
        let spec = r.platforms.get(p).unwrap();
        assert!(!spec.install.is_empty());
        assert!(!spec.verify.is_empty());
    }
    // 준비물이 함께 깔리는지까지 확인
    let plan = build_plan(&cat, "my-tool", Platform::Mac, Flow::Install, &[]).unwrap();
    assert_eq!(plan.tool_order, vec!["nodejs-lts", "my-tool"]);
}
```

### 확인하고 올리기

```bash
cd src-tauri
cargo test --all-features        # 레시피 검증 테스트
cargo fmt --check                # 서식
cargo clippy -- -D warnings      # 경고는 실패로 칩니다

cd .. && bun run tauri dev       # 앱을 실제로 띄워서 설치까지 눌러보기
```

**직접 설치해 보고 올려주세요.** 맥과 윈도우 둘 다 적었다면 되도록 둘 다요.
한쪽만 확인했다면 PR에 어느 쪽을 확인했는지 적어주시면 됩니다.

PR에는 이 세 가지를 적어주세요.

1. 어떤 도구이고 무엇을 하는지
2. 어느 OS에서 직접 설치해 봤는지
3. 로그인이 필요하다면 어떤 방식인지

---

## 2. 보안에 대해 (꼭 읽어주세요)

레시피는 **사용자 컴퓨터에서 실제로 명령을 실행합니다.** 이 점이 다른 프로젝트와 다릅니다.

- 레시피 PR은 기능 리뷰가 아니라 **보안 리뷰**로 취급합니다. 그래서 머지가 느릴 수 있습니다.
- 배포되는 레시피 묶음은 ed25519로 서명되고, 앱은 서명이 맞는 것만 실행합니다.
  서명은 관리자만 하므로, 머지되었다고 바로 사용자에게 나가지는 않습니다.
- 아래에 해당하면 받지 않습니다.
  - 출처를 확인할 수 없는 곳에서 스크립트를 받아 실행 (`curl ... | sh`로 알 수 없는 도메인)
  - 설치와 관계없는 파일을 지우거나 옮기는 동작
  - 사용자 몰래 자격증명이나 개인정보를 밖으로 보내는 동작
  - 무엇을 하는지 `friendly` 문구와 실제 명령이 다른 경우

취약점을 발견하셨다면 공개 이슈 대신 [SECURITY.md](SECURITY.md)의 절차를 따라주세요.

---

## 3. 코드 기여

```bash
bun install
bun run tauri dev
```

올리기 전에 다섯 개를 통과시켜 주세요. CI가 검사하는 것과 같습니다.

```bash
bun run test                              # 프론트 테스트
bun run build                             # 타입 검사 + 빌드
cd src-tauri
cargo test --all-features
cargo fmt --check
cargo clippy -- -D warnings
```

백엔드 명령이나 구조체를 바꿨다면 프론트 쪽 짝꿍 파일(`src/lib/ipc.ts`, `src/lib/types.ts`)도
같이 맞춰야 합니다. 자세한 구조는 [CLAUDE.md](CLAUDE.md)에 정리돼 있습니다.

커밋 메시지는 `feat(recipe): ...`, `fix(runner): ...` 같은 형태를 쓰고 있습니다.
한국어로 쓰셔도 됩니다.

---

## 서로에 대한 예의

이 프로젝트는 "몰라서 못 하는 사람"을 위해 만들어졌습니다.
질문하는 사람에게 "그것도 모르냐"고 하지 않기. 그거 하나면 충분합니다.

궁금한 게 있으면 이슈로 물어보세요. hello@needslab.ai 로 메일 주셔도 됩니다.
