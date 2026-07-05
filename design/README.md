# design/ 산출물 인덱스 (마일스톤 1 완료본)

마일스톤 2(Tauri 앱 구현)가 소비하는 파일들. 전부 사용자 승인 완료 (2026-07-05).

## 최종 자산 (`final/`)
| 파일 | 용도 | 마일스톤 2 사용법 |
|---|---|---|
| `app-icon-1024.png` | 앱 아이콘 마스터 (1024px 투명, 오공이 머리+긴고아+구름) | `bunx tauri icon design/final/app-icon-1024.png` 로 .icns/.ico 등 전체 생성 |
| `logo-symbol.png` | 마스코트 전신 (근두운 라이더, 2048px 투명) | 환영·설치·성공 화면의 마스코트 이미지 |
| `logo-horizontal.png` | 가로형 로고 (심볼+워드마크 A안: 클래식 골드 라인) | 랜딩·문서·성공 화면 하단 프레임 |

## 디자인 시스템
| 파일 | 내용 |
|---|---|
| `tokens.json` | 색(긴고아 골드 주 색)·폰트(Pretendard)·radius·spacing·elevation 토큰. Tailwind 설정으로 그대로 변환 |
| `design-system.md` | 컴포넌트 규칙 (도구 카드·배지·스텝퍼·버튼 위계·에러 패널·성공 화면), 카탈로그 계층 규칙, 카피 규칙(em dash 금지·humanize 검수) |
| `brief.md` | 디자인 브리프 (타깃·배제 목록·평가 기준) |
| `DECISION.md` | 브랜드 결정 기록 + "긴고아=하네스" 브랜드 스토리 (랜딩 카피 소스) |

## 화면 목업 (`mockups/`)
`01-welcome` `02-catalog` `03-wizard` `04-auth` `05-success` `06-dashboard` (1100×700 데스크톱 프레임, 최종 승인본)

- 편집 가능한 원본: Claude Design 프로젝트 https://claude.ai/design/p/ebbc4d4c-7119-41d4-a621-4e0824677a57?file=screens.dc.html
- 카탈로그는 하네스 6종만 (플러그인·오픈소스는 별도 메뉴). 도구 로고 검증 기록은 design-system.md 참조.
- 주의: 목업 내 마스코트 이미지는 힉스필드 CDN URL 참조라 만료될 수 있음. 영구 보존본은 이 레포의 PNG들.

## 후보·과정 기록
- `candidates/` 시안 전체 (mascot 12종, minimal 4종, dragon 4종, wukong 5종), `comparison-board.html`, `wordmark-variants.png`, `generation-log.md`
