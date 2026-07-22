<div align="center">

<img src="web/public/og.png" alt="이지 하네스" width="600" />

# 이지 하네스 (Easy Harness)

**터미널 없이, 클릭 몇 번으로 AI 코딩 도구를 시작하세요.**

AI 코딩 도구를 설치하고 로그인하고 확인하는 일을 대신 해주는 맥·윈도우 앱입니다.
명령어를 한 줄도 몰라도 됩니다.

[![License](https://img.shields.io/badge/license-Apache--2.0-blue.svg)](LICENSE)
[![Platform](https://img.shields.io/badge/platform-macOS%20%7C%20Windows-lightgrey.svg)](https://github.com/needslab-ai/easy-harness-releases/releases/latest)
[![Download](https://img.shields.io/badge/download-latest-brightgreen.svg)](https://easyharness.needslab.ai)

[홈페이지](https://easyharness.needslab.ai) · [다운로드](https://github.com/needslab-ai/easy-harness-releases/releases/latest) · [도구 추가하기](CONTRIBUTING.md)

</div>

---

## 왜 만들었나

Claude Code 같은 AI 코딩 도구는 강력하지만, 시작하는 방법이 대부분 이렇게 생겼습니다.

```
brew install node
npm install -g @anthropic-ai/claude-code
claude login
```

개발자에게는 세 줄이지만, 터미널을 처음 여는 사람에게는 세 개의 벽입니다.
실제로 많은 사람이 도구가 어려워서가 아니라 **설치 단계에서** 포기합니다.

이지 하네스는 그 세 줄을 버튼 하나로 바꿉니다.
Node.js가 필요하면 알아서 먼저 깔고, 설치가 끝나면 로그인 창을 띄우고,
마지막에 정말 잘 깔렸는지 확인까지 해서 알려줍니다.

## 지금 지원하는 도구

**AI 코딩 도구 (harness)**

| 도구 | 설명 |
|---|---|
| Claude Code | 말로 시키면 코딩을 대신해 주는 Anthropic 공식 AI 비서 |
| Codex | ChatGPT 계정으로 바로 쓰는 OpenAI의 AI 코딩 비서 |
| 가재코드 | 꼼꼼히 묻고 계획을 세운 뒤 코딩하는 한국산 AI 도우미 |
| Hermes | 모델 300여 가지를 갈아끼며 쓰는 만능 AI 도우미 (애플 실리콘 맥 전용) |
| OpenClaw | 메신저로 심부름을 시키는 만능 AI 비서 |
| OpenCode | 원하는 AI 모델을 골라 쓰는 오픈소스 코딩 도우미 |

**확장 (plugin)**

| 확장 | 설명 | 만든 곳 |
|---|---|---|
| 임낫에이아이 | AI가 쓴 한글 특유의 티를 지워 사람 글처럼 다듬기 | epoko77-ai |
| 인세인서치 | 웹페이지가 안 열릴 때 다른 길을 찾아 끝까지 읽어오기 | fivetaku |
| K-스킬 | 로또·날씨·법령·부동산 등 한국 생활 정보 백여 가지 | NomaDamas |
| 한국 법령 검색 | 법제처 공식 자료로 법령과 판례 찾기 | chrisryugj |
| LazyCodex | Codex에 계획 세우기·자기 검증·기억력 더하기 | Sisyphus Labs |

**준비물 (prerequisite)** · Node.js와 Bun은 필요한 도구를 고르면 알아서 함께 설치됩니다.

> **여기에 여러분의 도구를 올려보세요.** 도구 하나를 추가하는 데 필요한 건 JSON 파일 한 개입니다.
> Rust나 React를 몰라도 됩니다. [도구 추가 가이드](CONTRIBUTING.md)를 보세요.

## 어떻게 동작하나

핵심은 **레시피**입니다. 도구 하나가 JSON 파일 하나입니다.

```jsonc
{
  "schemaVersion": 1,
  "id": "claude-code",
  "name": "Claude Code",
  "kind": "harness",
  "easyDescription": "말로 시키면 코딩을 대신해 주는 Anthropic 공식 AI 비서예요",
  "pricing": { "label": "무료", "kind": "free" },
  "platforms": {
    "mac": {
      "prerequisites": ["nodejs-lts"],  // 없으면 이것부터 알아서 설치
      "detect":  [ /* 이미 깔려 있나? */ ],
      "install": [ /* 어떻게 깔지 */ ],
      "auth":    { /* 어떻게 로그인할지 */ },
      "verify":  [ /* 진짜 잘 깔렸나 */ ]
    },
    "windows": { /* 윈도우용은 따로 */ }
  }
}
```

앱은 이 선언을 읽어서 순서대로 실행하고, 진행 상황을 사람이 읽을 수 있는 말로 바꿔 보여줍니다.
설치 로직이 코드가 아니라 데이터라서, **새 도구를 추가해도 앱 코드는 건드리지 않습니다.**

레시피는 ed25519로 서명되어 배포되고, 앱은 서명을 검증한 것만 실행합니다.
자세한 내용은 [SECURITY.md](SECURITY.md)를 보세요.

## 설치해서 쓰기

[최신 릴리스](https://github.com/needslab-ai/easy-harness-releases/releases/latest)에서 받으세요.

- **맥**: `.dmg` (애플 실리콘 / 인텔)
- **윈도우**: `.exe` 설치 파일

맥 빌드는 애플 공증(notarization)을 거쳤고, 윈도우 빌드도 서명되어 있습니다.

## 개발

패키지 매니저는 [bun](https://bun.sh)입니다.

```bash
bun install
bun run tauri dev            # 앱 실행

bun run test                 # 프론트 테스트
cd src-tauri && cargo test --all-features   # Rust 테스트
```

기술 스택은 Tauri 2 (Rust) + React 19 + TypeScript + Vite + Tailwind CSS 4입니다.
구조와 설계 배경은 [CLAUDE.md](CLAUDE.md)와 [docs/](docs/)에 정리되어 있습니다.

## 기여

가장 반가운 기여는 **새 레시피**입니다. [CONTRIBUTING.md](CONTRIBUTING.md)에 처음부터 끝까지 적어뒀습니다.

버그 제보와 카피 수정도 환영합니다.
이 앱은 터미널을 처음 여는 사람이 쓰는 앱이라, **어려운 말을 쉬운 말로 고치는 제안**도 진짜 기여입니다.

보안 문제는 공개 이슈 대신 [SECURITY.md](SECURITY.md)의 절차를 따라주세요.

## 만든 사람

[니즈랩(NeedsLab)](https://needslab.ai)의 권용범이 만들고 있습니다.

저는 개발자 출신이 아닙니다. 2025년에 AI로 코딩을 시작했고, 이 앱도 그렇게 만들었습니다.
그래서 "설치에서 막혀 포기하는 경험"을 남 얘기로 쓰지 않았습니다.

문의: hello@needslab.ai

## 라이선스

[Apache License 2.0](LICENSE)

"이지 하네스"와 "Easy Harness" 이름, 그리고 마스코트를 포함한 브랜드 자산은
Apache 라이선스의 상표 조항(제6조)에 따라 별도입니다.
포크해서 배포하실 때는 다른 이름을 붙여주세요. 코드는 마음껏 쓰셔도 됩니다.
