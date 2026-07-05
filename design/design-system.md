# 이지 하네스 디자인 시스템

토큰 원본: `design/tokens.json` (마일스톤 2에서 Tailwind 설정으로 그대로 변환)

## 원칙

1. **비개발자 눈높이** — 모든 문구는 전문용어 0. 검수 질문: "개발 지식 없는 사람이 처음 읽어도 이해되는가?"
2. **긴고아 = 하네스** 브랜드 스토리 — 골드는 "제어·완료·신뢰"의 색. 남용 금지: 화면당 골드 포인트는 1~2곳.
3. **근두운 = 진행·이동** — 진행 표시·로딩에 구름/민트 모티프. 어려운 일은 마스코트가 "대신 날아가서" 하는 연출.
4. 라이트/다크 테마 모두 지원 (`surface.*Dark`, `text.*Dark` 토큰).

## 마스코트 사용 규칙

- 앱 아이콘: `design/final/app-icon-1024.png` (머리+긴고아+구름) → `tauri icon`으로 변환.
- 화면 안 마스코트: 환영·성공·에러 화면에만 등장 (작업 화면에선 방해 금지). 성공 화면에선 크게, 에러 화면에선 미안한 표정 소형.
- 마스코트 옆 말풍선(`radius.mascotBubble`)으로 안내 문구 — 시스템 메시지가 아니라 "손오공이 말해주는" 형식.

## 컴포넌트

### 도구 카드 (카탈로그)
- 구성: 도구 아이콘(48px) · 이름(subtitle/bold) · 한 줄 쉬운 설명(body/secondary) · 배지 행 · 설치 상태.
- 배지(badge/999px): **지원 AI 모델**(accent 배경 + text.primary), **필요 계정**(line 테두리), **무료/요금제**(secondary 계열), **입문자 추천**(goldBar 배경 + onBrand), **선행 도구 필요**(warning 테두리, 예: "Codex 필요").
- 설치됨: 카드 우상단 골드 체크 + "설치됨 · v1.2.3" 캡션.

### 진행 스텝퍼 (마법사)
- "지금 Node.js를 설치하고 있어요 (2/4단계)" — 현재 단계 문구는 title, 단계 카운트는 caption.
- 진행바: line.default 트랙 위 primary 채움, 진행 헤드에 작은 구름 아이콘.
- "자세한 로그 보기" 토글: tertiary 텍스트 버튼, 펼치면 mono 폰트 로그 패널(cardDark 배경 고정).

### 버튼 위계
- 주(Primary): primary 배경 + onBrand 텍스트, radius.button. 화면당 1개 원칙.
- 보조(Secondary): card 배경 + line 테두리 + text.primary.
- 위험(Danger): error 배경 — 삭제 확인 다이얼로그에서만.

### 에러 패널
- 구성: ⚠ 아이콘 + 쉬운 말 요약(subtitle) + 해결 제안(body) + [다시 시도] 주버튼 + [자세한 로그 복사] 보조버튼.
- 마스코트 소형(미안한 표정) 좌측 배치. 빨간 배경 금지 — error는 테두리·아이콘에만.

### 성공 화면 (SNS 공유 트리거 — 특별 설계)
- 마스코트 대형(근두운 라이더) + 골드 컨페티 + "『Claude Code』 준비 완료!" (display/bold).
- 화면 전체가 캡처 프레임: 하단에 은은한 워드마크 + 골드 라인. 여백 넉넉히, 스크린샷했을 때 그대로 자랑 가능한 구도.
- 보조 버튼: [바로 시작하기] (primary).

## 타이포

- 한글·영문 모두 Pretendard Variable (오픈소스 SIL OFL — 앱 번들에 포함, 구현 시 라이선스 고지 파일 추가).
- 로그·버전 표기만 JetBrains Mono.
- 워드마크 규칙: "이지 하네스"(weight 800, letter-spacing -0.025em) + 골드 바(44×4px, goldBar) + "EASY HARNESS"(letter-spacing 0.42em, #B9891F).
