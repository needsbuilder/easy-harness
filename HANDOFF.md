# HANDOFF — 이지 하네스

## 현재 작업
- 브레인스토밍 완료, 설계 문서 작성·커밋됨: `docs/superpowers/specs/2026-07-05-easy-harness-design.md`
- 셀프 리뷰 반영 완료. **사용자 스펙 리뷰 승인 대기 중.**

## 다음 스텝
1. 사용자가 스펙 승인하면 → `superpowers:writing-plans` 스킬로 구현 계획 작성 (마일스톤 1: 브랜드·UI 디자인부터)
2. 디자인은 Claude Design + 힉스필드 MCP로 마스코트/미니멀 2방향 시안 → 사용자 선택

## 핵심 결정/주의
- 기존 EasyClaw(코드·UI·주황 집게 마스코트) 완전 배제 — 참고 금지
- Tauri 2 + React/TS, 맥+윈도우 동시, 유료 서명 풀세팅, 한국어 UI
- v1 = 하네스 6종 + 오픈소스 4종, 레시피(JSON+원격갱신+서명검증) 구조
- 각 도구 설치법·서명 가격 등은 구현 시점 라이브 검증 (스펙 9절)

## 관련 파일
- 스펙: docs/superpowers/specs/2026-07-05-easy-harness-design.md
