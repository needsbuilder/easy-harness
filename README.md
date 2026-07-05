# 이지 하네스 (Easy Harness)

AI 입문자가 클릭 몇 번으로 AI 코딩 도구를 설치하고 로그인까지 끝내는 맥/윈도우 데스크톱 앱입니다.

- 스펙: `docs/superpowers/specs/2026-07-05-easy-harness-design.md`
- 디자인 자산: `design/README.md`
- 기술: Tauri 2 (Rust) + React + TypeScript + Vite + Tailwind CSS 4

## 개발

```bash
bun install
bun run tauri dev   # 앱 실행
bun run test        # 프론트 테스트
cd src-tauri && cargo test   # Rust 테스트 (드라이런 전수 검증 포함)
```
